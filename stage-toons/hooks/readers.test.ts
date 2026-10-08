import { expect, test } from 'claude-code/testing'

import {
  encodeCommand,
  jsonOutcome,
  LINUX_ARGV,
  LINUX_READER,
  linuxOutcome,
  MAC_ARGV,
  MAC_READER,
  MAC_SCRIPT,
  macOutcome,
  platformOfUname,
  PLAYERCTL_VERSION_ARGV,
  problemOf,
  readerFor,
  UNAME_ARGV,
  WINDOWS_ARGV,
  WINDOWS_READER,
  WINDOWS_SCRIPT,
} from './readers'

// Clawd DJ's readers: the platform from uname, and each platform's read.
const FIGURE = { artist: 'Linkin Park', title: 'Figure.09', isPlaying: true }
const PLAYING_JSON = '{"status":"Playing","artist":"Linkin Park","title":"Figure.09"}'
const NL = String.fromCharCode(10)
const CRLF = String.fromCharCode(13, 10)
const run = (exitCode: number, stdout: string, stderr = '') => ({ exitCode, stdout, stderr })

test("uname -sr's answer: macOS, Linux, WSL, or no platform DJ mode reads on", () => {
  expect(UNAME_ARGV).toEqual(['uname', '-sr'])
  expect(PLAYERCTL_VERSION_ARGV).toEqual(['playerctl', '--version'])
  expect(platformOfUname({ exitCode: 0, stdout: 'Darwin 27.0.0' + NL })).toBe('macos')
  expect(platformOfUname({ exitCode: 0, stdout: 'Linux 6.8.0-45-generic' + NL })).toBe('linux')
  expect(platformOfUname({ exitCode: 0, stdout: 'Linux 5.15.153.1-microsoft-standard-WSL2' + NL })).toBe('wsl')
  expect(platformOfUname({ exitCode: 0, stdout: 'Linux 4.4.0-19041-Microsoft' + NL })).toBe('wsl')
  expect(platformOfUname({ exitCode: 0, stdout: 'FreeBSD 14.1-RELEASE' + NL })).toBe('none')
  expect(platformOfUname({ exitCode: 1, stdout: 'Darwin 27.0.0' })).toBe('none')
  expect(platformOfUname({ exitCode: 0, stdout: '' })).toBe('none')
})

test('each platform that reads has its reader; the others none', () => {
  expect(readerFor('windows')).toBe(WINDOWS_READER)
  expect(readerFor('macos')).toBe(MAC_READER)
  expect(readerFor('linux')).toBe(LINUX_READER)
  expect(readerFor('linux-missing')).toBe(null)
  expect(readerFor('wsl')).toBe(null)
  expect(readerFor('none')).toBe(null)
  expect(WINDOWS_READER.argv).toBe(WINDOWS_ARGV)
  expect(MAC_READER.argv).toBe(MAC_ARGV)
  expect(LINUX_READER.argv).toBe(LINUX_ARGV)
  expect([WINDOWS_READER.asksPermission, MAC_READER.asksPermission, LINUX_READER.asksPermission]).toEqual([false, true, false])
})

test("Windows: a read's outcome: the track, nothing playing ({} is no failure), or what failed", () => {
  expect(jsonOutcome({ exitCode: 0, stdout: PLAYING_JSON })).toEqual({ track: FIGURE, failure: null })
  expect(jsonOutcome({ exitCode: 0, stdout: '{}' + CRLF })).toEqual({ track: null, failure: null })
  expect(jsonOutcome({ exitCode: 0, stdout: 'not json' })).toEqual({ track: null, failure: 'output' })
  expect(jsonOutcome({ exitCode: 1, stdout: '{"status":"Playing","artist":"A","title":"B"}' })).toEqual({ track: null, failure: 'exit' })
  expect(WINDOWS_READER.outcomeOf(run(0, PLAYING_JSON))).toEqual({ track: FIGURE, failure: null })
})

test("Windows: -EncodedCommand's text is the script's UTF-16LE bytes in base64, as Node writes it", () => {
  // Buffer.from('Hi ♪', 'utf16le').toString('base64') in Node.
  expect(encodeCommand('Hi ♪')).toBe('SABpACAAaiY=')
  expect(WINDOWS_ARGV.slice(0, 4)).toEqual(['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand'])
  expect(WINDOWS_ARGV[4]).toBe(encodeCommand(WINDOWS_SCRIPT))
})

test("Windows: the script finds Spotify's session by any of its names, and keeps PowerShell quiet and in UTF-8", () => {
  expect(WINDOWS_SCRIPT).toContain("$id -eq 'Spotify.exe'")
  expect(WINDOWS_SCRIPT).toContain("$id -like '*Spotify*'")
  expect(WINDOWS_SCRIPT).toContain("($hasSpotify -and $id -like 'Chromium.*')")
  expect(WINDOWS_SCRIPT).toContain('Get-Process -Name Spotify')
  expect(WINDOWS_SCRIPT).toContain("ParameterType.Name -eq 'IAsyncOperation`1'")
  expect(WINDOWS_SCRIPT).toContain("$ProgressPreference = 'SilentlyContinue'")
  expect(WINDOWS_SCRIPT).toContain('[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)')
})

test("macOS: osascript's JavaScript, which asks whether Spotify runs before it asks Spotify, and prints Windows' JSON", () => {
  expect(MAC_ARGV.slice(0, 4)).toEqual(['osascript', '-l', 'JavaScript', '-e'])
  expect(MAC_ARGV[4]).toBe(MAC_SCRIPT)
  // running() is no Apple Event and launches nothing; it comes first.
  expect(MAC_SCRIPT.indexOf('.running()')).toBeGreaterThan(-1)
  expect(MAC_SCRIPT.indexOf('.running()')).toBeLessThan(MAC_SCRIPT.indexOf('.playerState()'))
  // Stopped (nothing loaded) is nothing playing, before the track is asked.
  expect(MAC_SCRIPT).toContain("=== 'stopped'")
  expect(MAC_SCRIPT.indexOf("=== 'stopped'")).toBeLessThan(MAC_SCRIPT.indexOf('.currentTrack'))
  expect(MAC_SCRIPT).toContain('JSON.stringify')
})

test("macOS: a read's outcome: the track, nothing playing, denied, or what failed", () => {
  expect(macOutcome(run(0, PLAYING_JSON + NL))).toEqual({ track: FIGURE, failure: null })
  expect(macOutcome(run(0, '{"status":"Playing","artist":"Yeat","title":"COMË N GO"}' + NL))).toEqual({ track: { artist: 'Yeat', title: 'COMË N GO', isPlaying: true }, failure: null })
  expect(macOutcome(run(0, '{"status":"Paused","artist":"Yeat","title":"COMË N GO"}'))).toEqual({ track: { artist: 'Yeat', title: 'COMË N GO', isPlaying: false }, failure: null })
  expect(macOutcome(run(0, '{}' + NL))).toEqual({ track: null, failure: null })
  expect(macOutcome(run(1, '', 'execution error: Error: Error: An error occurred. (-1743)' + NL))).toEqual({ track: null, failure: 'denied' })
  expect(macOutcome(run(1, '', 'execution error: Error: Error: (-1744)'))).toEqual({ track: null, failure: 'denied' })
  // Not installed, or quit between running() and the read: nothing playing.
  expect(macOutcome(run(1, '', "execution error: Error: Error: Application can't be found. (-2700)"))).toEqual({ track: null, failure: null })
  expect(macOutcome(run(1, '', 'execution error: Error: Error: (-600)'))).toEqual({ track: null, failure: null })
  expect(macOutcome(run(1, '', 'execution error: Error: SyntaxError (-2753)'))).toEqual({ track: null, failure: 'exit' })
  expect(macOutcome(run(0, 'something else'))).toEqual({ track: null, failure: 'output' })
})

test("Linux: playerctl's three lines, status, artist and title", () => {
  expect(LINUX_ARGV).toEqual(['playerctl', '--player=spotify', 'metadata', '--format', ['{{status}}', '{{artist}}', '{{title}}'].join(NL)])
  expect(linuxOutcome(run(0, ['Playing', 'Linkin Park', 'Figure.09', ''].join(NL)))).toEqual({ track: FIGURE, failure: null })
  expect(linuxOutcome(run(0, ['Paused', 'Sigur Rós', 'Hoppípolla'].join(CRLF)))).toEqual({ track: { artist: 'Sigur Rós', title: 'Hoppípolla', isPlaying: false }, failure: null })
  // No artist (a podcast, a local file): the title alone.
  expect(linuxOutcome(run(0, ['Playing', '', 'Episode 12', ''].join(NL)))).toEqual({ track: { artist: '', title: 'Episode 12', isPlaying: true }, failure: null })
  // Nothing loaded: an empty title is nothing playing.
  expect(linuxOutcome(run(0, ['Stopped', '', '', ''].join(NL)))).toEqual({ track: null, failure: null })
  expect(linuxOutcome(run(0, 'Playing' + NL))).toEqual({ track: null, failure: 'output' })
})

test('Linux: no Spotify player is nothing playing; another error is a failed read', () => {
  expect(linuxOutcome(run(1, '', 'No players found' + NL))).toEqual({ track: null, failure: null })
  expect(linuxOutcome(run(1, '', 'No player could handle this command' + NL))).toEqual({ track: null, failure: null })
  expect(linuxOutcome(run(1, '', 'Could not connect to the session bus' + NL))).toEqual({ track: null, failure: 'exit' })
})

test("macOS's permission: denied while denied; asking only for a timeout before any read went through", () => {
  expect(problemOf(MAC_READER, 'denied', false)).toBe('denied')
  expect(problemOf(MAC_READER, 'denied', true)).toBe('denied')
  expect(problemOf(MAC_READER, 'rejected', false)).toBe('asking')
  expect(problemOf(MAC_READER, 'rejected', true)).toBe(null)
  expect(problemOf(MAC_READER, 'exit', false)).toBe(null)
  expect(problemOf(MAC_READER, null, false)).toBe(null)
  expect(problemOf(WINDOWS_READER, 'rejected', false)).toBe(null)
  expect(problemOf(LINUX_READER, 'rejected', false)).toBe(null)
})
