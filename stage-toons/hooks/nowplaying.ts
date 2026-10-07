// What Spotify plays, read through Windows' media session (Clawd DJ): the
// PowerShell script the mod runs, what it prints, and the poll's pace.
// Pure: register.tsx runs the script with $.process.run.

import { base64 } from './pixels'

export type NowPlaying = { artist: string; title: string; isPlaying: boolean }

// The script, for Windows PowerShell 5.1 (powershell.exe; PowerShell 7
// can't reach the media session). It prints Spotify's session as compact
// JSON, { status, artist, title }, or {} when Spotify has none. Spotify
// names its session after the shortcut it was started from: Spotify.exe
// (the Start menu, Win+R), a name with Spotify in it (the Microsoft Store
// edition), or Chromium's per-user id (a taskbar pin that carries it),
// which every Chromium-embedded app without an id of its own shares: that
// one counts only while a Spotify process runs. Without the progress line
// PowerShell writes a progress record to stderr; without the UTF-8 output
// accented names come garbled.
export const SCRIPT = String.raw`
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

export const ARGV: readonly string[] = ['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodeCommand(SCRIPT)]

// What the script printed: the track, or null for {} (no Spotify session),
// output that isn't the script's JSON, or a session with no title.
export function parseNowPlaying(stdout: string): NowPlaying | null {
  let raw: unknown
  try {
    raw = JSON.parse(stdout.trim())
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const { status, artist, title } = raw as Record<string, unknown>
  if (typeof title !== 'string' || title.trim() === '') return null

  return { artist: typeof artist === 'string' ? artist.trim() : '', title: title.trim(), isPlaying: status === 'Playing' }
}

// The track as the now-playing box writes it, and as /stage dj answers it.
export const trackText = (np: NowPlaying): string => (np.artist ? `${np.artist} - ${np.title}` : np.title)
export const trackLine = (np: NowPlaying): string => `♪ ${np.artist ? `${np.artist} – ${np.title}` : np.title}`

// Why a read gave nothing: the command didn't start or ran past its time
// (rejected), it exited with an error (exit), or it printed something
// that isn't the script's answer (output).
export type ReadFailure = 'rejected' | 'exit' | 'output'

// A finished read: the track, or nothing playing, and what failed if
// anything did. {} is no failure: Spotify has no session.
export function outcomeOf(result: { exitCode: number; stdout: string }): { track: NowPlaying | null; failure: ReadFailure | null } {
  if (result.exitCode !== 0) return { track: null, failure: 'exit' }
  const track = parseNowPlaying(result.stdout)
  if (track !== null) return { track, failure: null }

  return { track: null, failure: result.stdout.trim() === '{}' ? null : 'output' }
}

// What the mod has heard of the music: the last track read (kept through a
// pause, and through a read that found none, for the answer), whether the
// DJ picture shows, and how many reads in a row said not playing. The
// picture goes only after two: a skip or a short pause keeps the booth.
export type Music = { track: NowPlaying | null; isPlaying: boolean; misses: number }
export const NO_MUSIC: Music = { track: null, isPlaying: false, misses: 0 }
export const MISSES_TO_STOP = 2

export function heard(h: Music, read: NowPlaying | null): Music {
  if (read?.isPlaying) return { track: read, isPlaying: true, misses: 0 }
  const misses = h.misses + 1

  return { track: read ?? h.track, isPlaying: h.isPlaying && misses < MISSES_TO_STOP, misses }
}

// Whether a read brought another track than the one playing: the scene
// swaps the record then.
export const isNewTrack = (before: Music, after: Music): boolean =>
  before.isPlaying && after.isPlaying && before.track !== null && after.track !== null && trackText(before.track) !== trackText(after.track)

// The poll's pace: a read every 5 s while the area shows, every 30 s while
// it doesn't (the band hidden, collapsed or yielding) and while Clawd
// sleeps with nothing playing. A read may take this long before it counts
// as failed (reads never overlap: the loop awaits each).
export const POLL_MS = 5000
export const SLOW_POLL_MS = 30_000
export const READ_TIMEOUT_MS = 10_000
// /stage dj on reads in its own hook, whose budget (10 s) the read must not
// spend: it may take this long, and the poll catches up after it.
export const COMMAND_READ_MS = 4000

export type PollState = { isAreaShown: boolean; isAsleep: boolean; isPlaying: boolean }

export const nextDelay = (s: PollState): number => (s.isAreaShown && (s.isPlaying || !s.isAsleep) ? POLL_MS : SLOW_POLL_MS)
