import { expect, test } from 'claude-code/testing'

import { ARGV, encodeCommand, heard, isNewTrack, nextDelay, NO_MUSIC, outcomeOf, parseNowPlaying, POLL_MS, SCRIPT, SLOW_POLL_MS, trackLine, trackText } from './nowplaying'

const FIGURE = { artist: 'Linkin Park', title: 'Figure.09', isPlaying: true }
const CALX = { artist: 'Aphex Twin', title: 'Yellow Calx', isPlaying: true }
const paused = (np: typeof FIGURE) => ({ ...np, isPlaying: false })
// Windows' line end, built so: escapes in test strings can trip the kit.
const CRLF = String.fromCharCode(13, 10)

test("the script's answer: a track playing or paused; nothing for {}, other output, or no title", () => {
  expect(parseNowPlaying('{"status":"Playing","artist":"Linkin Park","title":"Figure.09"}\r\n')).toEqual(FIGURE)
  expect(parseNowPlaying('{"status":"Paused","artist":"Aphex Twin","title":"Yellow Calx"}')).toEqual(paused(CALX))
  expect(parseNowPlaying('{"status":"Playing","artist":null,"title":" Intro "}')).toEqual({ artist: '', title: 'Intro', isPlaying: true })
  expect(parseNowPlaying('{}')).toBe(null)
  expect(parseNowPlaying('Get-Process : something went wrong')).toBe(null)
  expect(parseNowPlaying('{"status":"Playing","artist":"A","title":""}')).toBe(null)
  expect(parseNowPlaying('[]')).toBe(null)
  expect(parseNowPlaying('')).toBe(null)
})

test('a track as the box writes it, and as /stage dj answers it', () => {
  expect(trackText(FIGURE)).toBe('Linkin Park - Figure.09')
  expect(trackText({ artist: '', title: 'Intro', isPlaying: true })).toBe('Intro')
  expect(trackLine(FIGURE)).toBe('♪ Linkin Park – Figure.09')
})

test("a read's outcome: the track, nothing playing ({} is no failure), or what failed", () => {
  expect(outcomeOf({ exitCode: 0, stdout: '{"status":"Playing","artist":"Linkin Park","title":"Figure.09"}' })).toEqual({ track: FIGURE, failure: null })
  expect(outcomeOf({ exitCode: 0, stdout: '{}\r\n' })).toEqual({ track: null, failure: null })
  expect(outcomeOf({ exitCode: 0, stdout: 'not json' })).toEqual({ track: null, failure: 'output' })
  expect(outcomeOf({ exitCode: 1, stdout: '{"status":"Playing","artist":"A","title":"B"}' })).toEqual({ track: null, failure: 'exit' })
})

test("-EncodedCommand's text is the script's UTF-16LE bytes in base64, as Node writes it", () => {
  // Buffer.from('Hi ♪', 'utf16le').toString('base64') in Node.
  expect(encodeCommand('Hi ♪')).toBe('SABpACAAaiY=')
  expect(ARGV.slice(0, 4)).toEqual(['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand'])
  expect(ARGV[4]).toBe(encodeCommand(SCRIPT))
})

test("the script finds Spotify's session by any of its names, and keeps PowerShell quiet and in UTF-8", () => {
  expect(SCRIPT).toContain("$id -eq 'Spotify.exe'")
  expect(SCRIPT).toContain("$id -like '*Spotify*'")
  expect(SCRIPT).toContain("($hasSpotify -and $id -like 'Chromium.*')")
  expect(SCRIPT).toContain('Get-Process -Name Spotify')
  expect(SCRIPT).toContain("ParameterType.Name -eq 'IAsyncOperation`1'")
  expect(SCRIPT).toContain("$ProgressPreference = 'SilentlyContinue'")
  expect(SCRIPT).toContain('[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)')
})

test('the DJ picture stays through one read that says not playing, and goes at the second', () => {
  let m = heard(NO_MUSIC, FIGURE)
  expect(m).toEqual({ track: FIGURE, isPlaying: true, misses: 0 })
  m = heard(m, paused(FIGURE))
  expect(m.isPlaying).toBe(true)
  expect(m.track).toEqual(paused(FIGURE))
  m = heard(m, null)
  expect(m.isPlaying).toBe(false)
  // The last track is kept for the answer.
  expect(m.track).toEqual(paused(FIGURE))
  // Playing again brings it back at once.
  expect(heard(m, FIGURE).isPlaying).toBe(true)
  // From silence, a paused track doesn't start the picture.
  expect(heard(NO_MUSIC, paused(CALX)).isPlaying).toBe(false)
})

test('a new track is another one read while one plays', () => {
  const playing = heard(NO_MUSIC, FIGURE)
  expect(isNewTrack(playing, heard(playing, CALX))).toBe(true)
  expect(isNewTrack(playing, heard(playing, FIGURE))).toBe(false)
  expect(isNewTrack(NO_MUSIC, playing)).toBe(false)
  // A skip that lands on a paused track, while the booth holds: the box
  // changes its title, so the record swaps too.
  expect(isNewTrack(playing, heard(playing, paused(CALX)))).toBe(true)
  // Once the booth has gone, nothing is new.
  const gone = heard(heard(playing, null), null)
  expect(isNewTrack(gone, heard(gone, paused(CALX)))).toBe(false)
})

test("the poll's pace: 5 s while the area shows, 30 s while it doesn't or Clawd sleeps to silence", () => {
  expect(nextDelay({ isAreaShown: true, isAsleep: false, isPlaying: true })).toBe(POLL_MS)
  expect(nextDelay({ isAreaShown: true, isAsleep: false, isPlaying: false })).toBe(POLL_MS)
  expect(nextDelay({ isAreaShown: true, isAsleep: true, isPlaying: false })).toBe(SLOW_POLL_MS)
  expect(nextDelay({ isAreaShown: true, isAsleep: true, isPlaying: true })).toBe(POLL_MS)
  expect(nextDelay({ isAreaShown: false, isAsleep: false, isPlaying: true })).toBe(SLOW_POLL_MS)
  expect([POLL_MS, SLOW_POLL_MS]).toEqual([5000, 30_000])
})
