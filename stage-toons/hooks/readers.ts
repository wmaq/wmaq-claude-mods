// Clawd DJ's readers, one per platform: which platform the session runs
// on (Windows from the cwd; elsewhere uname -sr's answer), and for each
// the command that reads what Spotify plays and what its answer means.
// Every reader ends in the same Outcome, so what follows a read is the
// same everywhere. Pure: register.tsx runs the commands with $.process.run.

import { type Outcome, parseNowPlaying, type ReadFailure } from './nowplaying'
import { base64 } from './pixels'

// Where DJ mode reads: 'linux-missing' is Linux without playerctl, 'wsl'
// Linux under Windows (Spotify plays on the Windows side, out of reach).
export type Platform = 'windows' | 'macos' | 'linux' | 'linux-missing' | 'wsl' | 'none'

// The platform check's commands, each given CHECK_TIMEOUT_MS.
export const UNAME_ARGV: readonly string[] = ['uname', '-sr']
export const PLAYERCTL_VERSION_ARGV: readonly string[] = ['playerctl', '--version']
export const CHECK_TIMEOUT_MS = 2000

// What uname -sr's answer makes the platform: Darwin is macOS; Linux is
// Linux, or WSL when its release names Microsoft. 'linux' still needs
// playerctl's check.
export function platformOfUname(result: { exitCode: number; stdout: string }): Platform {
  if (result.exitCode !== 0) return 'none'
  const text = result.stdout.trim()
  if (text.startsWith('Darwin ')) return 'macos'
  if (text.startsWith('Linux ')) return text.toLowerCase().includes('microsoft') ? 'wsl' : 'linux'

  return 'none'
}

export type ReadResult = { exitCode: number; stdout: string; stderr: string }
// A platform's read: the command, whether the OS may ask the person first
// (macOS's Automation permission), and what its answer means.
export type Reader = { argv: readonly string[]; asksPermission: boolean; outcomeOf: (result: ReadResult) => Outcome }

const NOTHING: Outcome = { track: null, failure: null }

// Windows: the script, for Windows PowerShell 5.1 (powershell.exe;
// PowerShell 7 can't reach the media session). It prints Spotify's session
// as compact JSON, { status, artist, title }, or {} when Spotify has none.
// Spotify names its session after the shortcut it was started from:
// Spotify.exe (the Start menu, Win+R), a name with Spotify in it (the
// Microsoft Store edition), or Chromium's per-user id (a taskbar pin that
// carries it), which every Chromium-embedded app without an id of its own
// shares: that one counts only while a Spotify process runs. Without the
// progress line PowerShell writes a progress record to stderr; without the
// UTF-8 output accented names come garbled.
export const WINDOWS_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation${'`'}1' } | select -First 1
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$hasSpotify = [bool](Get-Process -Name Spotify -ErrorAction SilentlyContinue)
$s = $mgr.GetSessions() | ? { $id = $_.SourceAppUserModelId; $id -eq 'Spotify.exe' -or $id -like '*Spotify*' -or ($hasSpotify -and $id -like 'Chromium.*') } | select -First 1
if (-not $s) { '{}'; exit }
$p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
[pscustomobject]@{ status = "$($s.GetPlaybackInfo().PlaybackStatus)"; artist = $p.Artist; title = $p.Title } | ConvertTo-Json -Compress
`

// What -EncodedCommand reads: the text's UTF-16LE bytes in base64.
export function encodeCommand(text: string): string {
  const bytes = new Uint8Array(text.length * 2)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    bytes[i * 2] = c & 0xff
    bytes[i * 2 + 1] = c >> 8
  }

  return base64(bytes)
}

export const WINDOWS_ARGV: readonly string[] = ['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodeCommand(WINDOWS_SCRIPT)]

// A finished read that prints the scripts' JSON (Windows, macOS): the
// track, or nothing playing, and what failed if anything did. {} is no
// failure: Spotify has no session.
export function jsonOutcome(result: { exitCode: number; stdout: string }): Outcome {
  if (result.exitCode !== 0) return { track: null, failure: 'exit' }
  const track = parseNowPlaying(result.stdout)
  if (track !== null) return { track, failure: null }

  return { track: null, failure: result.stdout.trim() === '{}' ? null : 'output' }
}

// macOS: osascript's JavaScript (JXA). running() asks the system, not
// Spotify: no Apple Event, no Automation prompt, and Spotify isn't
// launched (anything asked of Spotify itself would launch it). Stopped
// (nothing loaded) has no track to ask. The status is capitalised to the
// Windows script's spelling, so both print the same JSON.
export const MAC_SCRIPT = `(() => {
  const app = Application('Spotify')
  if (!app.running()) return '{}'
  const state = app.playerState()
  if (state === 'stopped') return '{}'
  const track = app.currentTrack
  return JSON.stringify({ status: state.charAt(0).toUpperCase() + state.slice(1), artist: track.artist(), title: track.name() })
})()`
export const MAC_ARGV: readonly string[] = ['osascript', '-l', 'JavaScript', '-e', MAC_SCRIPT]

// osascript's error codes, as stderr ends them: the Automation permission
// denied (-1743), or needed with no one to ask, as over SSH (-1744);
// Spotify not installed (-2700) or quit between running() and the read
// (-600), which are nothing playing, as Windows' {}.
const DENIED_CODES = ['(-1743)', '(-1744)']
const GONE_CODES = ['(-2700)', '(-600)']

export function macOutcome(result: ReadResult): Outcome {
  if (result.exitCode !== 0 && DENIED_CODES.some(code => result.stderr.includes(code))) return { track: null, failure: 'denied' }
  if (result.exitCode !== 0 && GONE_CODES.some(code => result.stderr.includes(code))) return NOTHING

  return jsonOutcome(result)
}

// Linux: playerctl over MPRIS, Spotify's player only, as three lines:
// status (Playing, Paused, Stopped), artist, title. Lines, not JSON:
// playerctl's format has no escaping. Unprobed (the spec): the "No player"
// texts are playerctl's own, to be confirmed on a Linux desktop.
export const LINUX_ARGV: readonly string[] = ['playerctl', '--player=spotify', 'metadata', '--format', ['{{status}}', '{{artist}}', '{{title}}'].join('\n')]

export function linuxOutcome(result: ReadResult): Outcome {
  if (result.exitCode !== 0) return result.stderr.includes('No player') ? NOTHING : { track: null, failure: 'exit' }
  const lines = result.stdout.replace(/\r?\n$/, '').split(/\r?\n/)
  if (lines.length < 3) return { track: null, failure: 'output' }
  const [status = '', artist = '', ...rest] = lines
  const title = rest.join(' ').trim()
  if (title === '') return NOTHING

  return { track: { artist: artist.trim(), title, isPlaying: status.trim() === 'Playing' }, failure: null }
}

export const WINDOWS_READER: Reader = { argv: WINDOWS_ARGV, asksPermission: false, outcomeOf: jsonOutcome }
export const MAC_READER: Reader = { argv: MAC_ARGV, asksPermission: true, outcomeOf: macOutcome }
export const LINUX_READER: Reader = { argv: LINUX_ARGV, asksPermission: false, outcomeOf: linuxOutcome }

// The platform's reader, or null where DJ mode can't read.
export function readerFor(platform: Platform): Reader | null {
  if (platform === 'windows') return WINDOWS_READER
  if (platform === 'macos') return MAC_READER

  return platform === 'linux' ? LINUX_READER : null
}

// What macOS's Automation permission keeps from a read: denied, or
// probably asking (a read waits on the prompt until its timeout), which
// only a timeout before any read of the load reached Spotify counts as;
// after one, a timeout is a slow read (a hung Spotify, a busy machine).
export type DjProblem = 'asking' | 'denied' | null

export function problemOf(reader: Reader, failure: ReadFailure | null, hasRead: boolean): DjProblem {
  if (!reader.asksPermission) return null
  if (failure === 'denied') return 'denied'

  return failure === 'rejected' && !hasRead ? 'asking' : null
}
