import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { type Blit, bandText, blitsOf, decode, engine, mountBand, runStage, START, type World } from './harness'
import { DEFAULT_WORKFLOW } from './workflow'

// /stage dj: the setting, the reads of Spotify, and the area while it plays.
const text = (answer: unknown) => (answer as { text?: string }).text ?? ''
const OFF = "DJ mode is off. /stage dj on: while Spotify plays, Clawd DJs and the track's name shows."
const WAITING = 'DJ mode on: waiting for Spotify to play. /stage dj off turns it off.'
const FIGURE_LINE = 'DJ mode on: ♪ Linkin Park – Figure.09'
const PLAYING = '{"status":"Playing","artist":"Linkin Park","title":"Figure.09"}'
const PAUSED = '{"status":"Paused","artist":"Linkin Park","title":"Figure.09"}'
const NL = String.fromCharCode(10)
const NEEDS_TERMINAL = 'DJ mode needs Claude Code in a terminal on Windows, macOS or Linux.'
const ASKING = 'DJ mode on: reading Spotify timed out. If macOS is asking whether your terminal may control Spotify, allow it, and the music shows.'
const DENIED = "DJ mode on, but macOS doesn't let your terminal control Spotify: switch it on in System Settings › Privacy & Security › Automation, under your terminal's name."
const MAC = { ...START, cwd: '/Users/me/proj' }
const LINUX = { ...START, cwd: '/home/me/proj' }
const LINUX_PLAYING = ['Playing', 'Linkin Park', 'Figure.09', ''].join(NL)

// The host's commands as the mod runs them: the platform check (uname,
// playerctl --version), counted in checks, and the reads (powershell.exe,
// osascript, playerctl metadata), counted in argv with their timeouts.
// uname answers FreeBSD unless a test names another (null: it times out);
// unameGate, when set, holds uname's answer until it resolves.
type Spotify = {
  stdout: string
  stderr: string
  exitCode: number
  isFailing: boolean
  uname: string | null
  hasPlayerctl: boolean
  unameGate: Promise<void> | null
  argv: (readonly string[])[]
  timeouts: (number | undefined)[]
  checks: string[]
}
function spotify(on: On): Spotify {
  const s: Spotify = { stdout: PLAYING, stderr: '', exitCode: 0, isFailing: false, uname: 'FreeBSD 14.1-RELEASE', hasPlayerctl: true, unameGate: null, argv: [], timeouts: [], checks: [] }
  const answer = (exitCode: number, stdout: string, stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', async ($, e) => {
    if (e.argv[0] === 'uname') {
      s.checks.push('uname')
      if (s.unameGate !== null) await s.unameGate
      if (s.uname === null) throw new Error('uname ran past its time')

      return answer(0, s.uname + NL)
    }
    if (e.argv[0] === 'playerctl' && e.argv[1] === '--version') {
      s.checks.push('playerctl')
      if (!s.hasPlayerctl) throw new Error('playerctl could not start')

      return answer(0, 'v2.4.1' + NL)
    }
    s.argv.push(e.argv)
    s.timeouts.push(e.init?.timeoutMs)
    if (s.isFailing) throw new Error('the reader could not start')

    return answer(s.exitCode, s.stdout, s.stderr)
  })

  return s
}

// The debug log's lines.
function logs(on: On): string[] {
  const lines: string[] = []
  on('ui.log', ($, e) => {
    lines.push(e.text)

    return { value: undefined }
  })

  return lines
}

// The characters a blitted frame shows (the box's text), in order.
function charsOf(blit: Blit | undefined): string {
  if (!blit) return ''
  const words = decode(blit.cells)
  let out = ''
  for (let i = 0; i < words.length; i += 3) {
    const cp = words[i]!
    if (cp > 0x20 && cp !== 0x2580 && cp !== 0x2584) out += String.fromCodePoint(cp)
    else if (cp === 0x20 && words[i + 1] !== 0x01000000) out += ' '
  }

  return out
}
const lastArea = (world: World) => blitsOf(world, 'area').at(-1)

test("DJ mode is off by default; /stage dj on reads Spotify at once, names the track, and is kept for every project", async ($, on) => {
  const { world } = engine(on)
  const s = spotify(on)
  await $.session.start(START)
  expect(text(await runStage($, 'dj'))).toBe(OFF)
  expect(s.argv).toHaveLength(0)
  expect(text(await runStage($, 'dj on'))).toBe(FIGURE_LINE)
  expect(s.argv).toHaveLength(1)
  expect(s.argv[0]!.slice(0, 4)).toEqual(['powershell.exe', '-NoProfile', '-NonInteractive', '-EncodedCommand'])
  // Windows is known from the cwd: no check runs.
  expect(s.checks).toEqual([])
  expect(world.store.dj).toBe(true)
  expect(text(await runStage($, 'dj'))).toBe(FIGURE_LINE)
  expect(text(await runStage($, 'dj off'))).toBe(OFF)
  expect(world.store.dj).toBe(false)
})

test("/stage dj on's own read may take 4 s (the command's hook has 10 s in all), the poll's 10 s; the answers are the person's alone", async ($, on) => {
  const { clock } = engine(on)
  const s = spotify(on)
  await $.session.start(START)
  await mountBand($)
  const answer = (await runStage($, 'dj on')) as { text?: string; context?: unknown }
  expect(answer.text).toBe(FIGURE_LINE)
  expect(answer.context).toBe(undefined)
  expect(((await runStage($, 'dj')) as { context?: unknown }).context).toBe(undefined)
  await clock.advance(5100)
  expect(s.timeouts).toEqual([4000, 10_000])
})

test('/stage dj party is off by default; on, it is kept for every project and redraws the band', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  expect(text(await runStage($, 'dj party'))).toBe('DJ party lights off: the booth glows steady while Clawd bobs to the beat. /stage dj party on lights it up.')
  const invalidations = world.invalidations
  expect(text(await runStage($, 'dj party on'))).toBe('DJ party lights on: the speakers, the floor, the booth and the box light up with the beat. /stage dj party off calms them.')
  expect(world.store['dj-party']).toBe(true)
  expect(world.invalidations).toBeGreaterThan(invalidations)
  await runStage($, 'dj party off')
  expect(world.store['dj-party']).toBe(false)
})

test("the store's dj-party: true starts a session with the party lights on", async ($, on) => {
  engine(on, { store: { 'dj-party': true } })
  await $.session.start(START)
  expect(text(await runStage($, 'dj party'))).toContain('DJ party lights on')
})

test('with nothing playing, DJ mode waits for Spotify', async ($, on) => {
  engine(on)
  const s = spotify(on)
  s.stdout = '{}'
  await $.session.start(START)
  expect(text(await runStage($, 'dj on'))).toBe(WAITING)
})

test('on another OS DJ mode stays off, with no read', async ($, on) => {
  const { world } = engine(on)
  const s = spotify(on)
  await $.session.start(LINUX)
  expect(text(await runStage($, 'dj on'))).toBe(NEEDS_TERMINAL)
  expect(s.checks).toEqual(['uname'])
  expect(s.argv).toHaveLength(0)
  expect(world.store.dj).toBe(undefined)
  expect(text(await runStage($, 'dj'))).toBe(OFF)
})

test('kept on from another machine, DJ mode on another OS says what it needs, checks once and never reads', async ($, on) => {
  const { clock } = engine(on, { store: { dj: true } })
  const s = spotify(on)
  await $.session.start(LINUX)
  await clock.advance(60_000)
  expect(s.argv).toHaveLength(0)
  expect(text(await runStage($, 'dj'))).toBe(NEEDS_TERMINAL)
  expect(s.checks).toEqual(['uname'])
})

test('while Spotify plays the area shows the DJ picture and its box; one paused read keeps it, the second gives the area back', async ($, on) => {
  const { world, clock } = engine(on)
  const s = spotify(on)
  await $.session.start(START)
  await mountBand($)
  await clock.advance(200)
  expect(charsOf(lastArea(world))).not.toContain('Figure.09')
  await runStage($, 'dj on')
  await clock.advance(1000)
  expect(charsOf(lastArea(world))).toContain('Linkin Park - Figure.09')
  s.stdout = PAUSED
  await clock.advance(5000)
  expect(s.argv).toHaveLength(2)
  expect(charsOf(lastArea(world))).toContain('Linkin Park - Figure.09')
  await clock.advance(5000)
  expect(s.argv).toHaveLength(3)
  await clock.advance(1000)
  expect(charsOf(lastArea(world))).not.toContain('Figure.09')
})

test('/stage dj off stops the reads; /stage dj on while on starts no second poll', async ($, on) => {
  const { clock } = engine(on)
  const s = spotify(on)
  await $.session.start(START)
  await runStage($, 'dj on')
  expect(text(await runStage($, 'dj on'))).toBe(FIGURE_LINE)
  expect(s.argv).toHaveLength(1)
  // Away from the area (no band mounted) the poll takes its slow pace.
  await clock.advance(30_000)
  expect(s.argv).toHaveLength(2)
  await runStage($, 'dj off')
  await clock.advance(120_000)
  expect(s.argv).toHaveLength(2)
})

test('a failed read counts as nothing playing and is logged once per kind, never with what it printed', async ($, on) => {
  const { clock } = engine(on)
  const lines = logs(on)
  const s = spotify(on)
  s.isFailing = true
  await $.session.start(START)
  expect(text(await runStage($, 'dj on'))).toBe(WAITING)
  await clock.advance(60_000)
  expect(s.argv.length).toBeGreaterThan(2)
  const failures = () => lines.filter(line => line.includes('reading Spotify failed'))
  expect(failures()).toEqual(['stage-toons: reading Spotify failed (rejected); DJ mode takes it as nothing playing'])
  s.isFailing = false
  s.exitCode = 1
  s.stdout = 'Secret Song by Someone'
  await clock.advance(60_000)
  expect(failures()).toEqual(['stage-toons: reading Spotify failed (rejected); DJ mode takes it as nothing playing', 'stage-toons: reading Spotify failed (exit 1); DJ mode takes it as nothing playing'])
  expect(lines.some(line => line.includes('Secret'))).toBe(false)
})

test('a session that starts with DJ mode kept on reads Spotify at once', async ($, on) => {
  const { clock } = engine(on, { store: { dj: true } })
  const s = spotify(on)
  await $.session.start(START)
  await clock.advance(10)
  expect(s.argv).toHaveLength(1)
  expect(text(await runStage($, 'dj'))).toBe(FIGURE_LINE)
})

test("a hot reload keeps the session's own DJ mode, whatever the store says", async ($, on) => {
  on('state.get', ($, e, next) => {
    if (e.key === 'workflow') return { value: { value: { workflow: DEFAULT_WORKFLOW, source: 'default' }, version: 1 } }
    if (e.key === 'dj') return { value: { value: true, version: 1 } }

    return next(e)
  })
  const { clock } = engine(on, { store: { dj: false } })
  const s = spotify(on)
  await $.session.start(START)
  await clock.advance(10)
  expect(s.argv).toHaveLength(1)
  expect(text(await runStage($, 'dj'))).toBe(FIGURE_LINE)
})

test('/stage demo dj plays Clawd DJ with its line under the bar; dj is in the help', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await mountBand($)
  expect(text(await runStage($, 'demo dj'))).toBe('Playing Clawd DJ for 20 s: a long title, a track change, two helpers dancing. /stage demo stop ends it.')
  expect(await bandText($)).toContain('DJ demo: Clawd at the decks · /stage demo stop ends it')
  expect(text(await runStage($, 'help'))).toContain("/stage dj [on | off]    Clawd DJ: while Spotify plays, Clawd at the decks and the track's name (Windows, macOS, Linux)")
  expect(text(await runStage($, 'help'))).toContain("/stage dj party [on | off]  the DJ's full light show: speakers, floor, booth and box lighting up with the beat")
})

test('on macOS, /stage dj on reads through osascript and names the track; the check runs once', async ($, on) => {
  const { world } = engine(on)
  const s = spotify(on)
  s.uname = 'Darwin 27.0.0'
  await $.session.start(MAC)
  expect(text(await runStage($, 'dj on'))).toBe(FIGURE_LINE)
  expect(s.argv[0]!.slice(0, 4)).toEqual(['osascript', '-l', 'JavaScript', '-e'])
  expect(s.timeouts[0]).toBe(4000)
  expect(world.store.dj).toBe(true)
  expect(text(await runStage($, 'dj'))).toBe(FIGURE_LINE)
  expect(s.checks).toEqual(['uname'])
})

test('on macOS, a first read that times out is the Automation prompt; once a read goes through, a timeout is only slow', async ($, on) => {
  const { clock } = engine(on)
  const s = spotify(on)
  s.uname = 'Darwin 27.0.0'
  s.isFailing = true
  await $.session.start(MAC)
  expect(text(await runStage($, 'dj on'))).toBe(ASKING)
  expect(text(await runStage($, 'dj'))).toBe(ASKING)
  s.isFailing = false
  // No band: the poll's slow pace.
  await clock.advance(30_000)
  expect(text(await runStage($, 'dj'))).toBe(FIGURE_LINE)
  s.isFailing = true
  await clock.advance(30_000)
  expect(text(await runStage($, 'dj'))).not.toContain('timed out')
})

test('on macOS with Spotify closed at /stage dj on, the prompt that comes once it runs still reads as asking', async ($, on) => {
  const { clock } = engine(on)
  const s = spotify(on)
  s.uname = 'Darwin 27.0.0'
  s.stdout = '{}'
  await $.session.start(MAC)
  expect(text(await runStage($, 'dj on'))).toBe(WAITING)
  // Spotify starts; the first Apple Event waits on the prompt.
  s.isFailing = true
  await clock.advance(30_000)
  expect(text(await runStage($, 'dj'))).toBe(ASKING)
})

test('on macOS, denied says where to allow it; allowed, the music comes back at the next read, the denial logged once without stderr', async ($, on) => {
  const { world, clock } = engine(on)
  const lines = logs(on)
  const s = spotify(on)
  s.uname = 'Darwin 27.0.0'
  s.exitCode = 1
  s.stdout = ''
  s.stderr = 'execution error: Error: Error: An error occurred. (-1743)'
  await $.session.start(MAC)
  expect(text(await runStage($, 'dj on'))).toBe(DENIED)
  expect(world.store.dj).toBe(true)
  await clock.advance(30_000)
  expect(text(await runStage($, 'dj'))).toBe(DENIED)
  s.exitCode = 0
  s.stdout = PLAYING
  s.stderr = ''
  await clock.advance(30_000)
  expect(text(await runStage($, 'dj'))).toBe(FIGURE_LINE)
  const failures = lines.filter(line => line.includes('reading Spotify failed'))
  expect(failures).toEqual(['stage-toons: reading Spotify failed (denied); DJ mode takes it as nothing playing'])
  expect(lines.some(line => line.includes('-1743') || line.includes('execution error'))).toBe(false)
})

test('on macOS without Spotify installed, DJ mode waits, and logs no failure', async ($, on) => {
  engine(on)
  const lines = logs(on)
  const s = spotify(on)
  s.uname = 'Darwin 27.0.0'
  s.exitCode = 1
  s.stdout = ''
  s.stderr = "execution error: Error: Error: Application can't be found. (-2700)"
  await $.session.start(MAC)
  expect(text(await runStage($, 'dj on'))).toBe(WAITING)
  expect(lines.some(line => line.includes('reading Spotify failed'))).toBe(false)
})

test('on Linux, /stage dj on checks for playerctl, then reads through it', async ($, on) => {
  engine(on)
  const s = spotify(on)
  s.uname = 'Linux 6.8.0-45-generic'
  s.stdout = LINUX_PLAYING
  await $.session.start(LINUX)
  expect(text(await runStage($, 'dj on'))).toBe(FIGURE_LINE)
  expect(s.checks).toEqual(['uname', 'playerctl'])
  expect(s.argv[0]!.slice(0, 4)).toEqual(['playerctl', '--player=spotify', 'metadata', '--format'])
})

test('on Linux with no Spotify player, DJ mode waits and logs no failure', async ($, on) => {
  engine(on)
  const lines = logs(on)
  const s = spotify(on)
  s.uname = 'Linux 6.8.0-45-generic'
  s.exitCode = 1
  s.stdout = ''
  s.stderr = 'No players found'
  await $.session.start(LINUX)
  expect(text(await runStage($, 'dj on'))).toBe(WAITING)
  expect(lines.some(line => line.includes('reading Spotify failed'))).toBe(false)
})

test('on Linux without playerctl, DJ mode says so and stays off; installed, the next /stage dj on looks again', async ($, on) => {
  const { world } = engine(on)
  const s = spotify(on)
  s.uname = 'Linux 6.8.0-45-generic'
  s.stdout = LINUX_PLAYING
  s.hasPlayerctl = false
  await $.session.start(LINUX)
  expect(text(await runStage($, 'dj on'))).toBe('DJ mode on Linux needs playerctl (from your package manager): it reads Spotify through MPRIS.')
  expect(world.store.dj).toBe(undefined)
  expect(s.argv).toHaveLength(0)
  s.hasPlayerctl = true
  expect(text(await runStage($, 'dj on'))).toBe(FIGURE_LINE)
  expect(s.checks).toEqual(['uname', 'playerctl', 'uname', 'playerctl'])
})

test("under WSL DJ mode says Windows' Spotify is out of reach, and runs no playerctl", async ($, on) => {
  engine(on)
  const s = spotify(on)
  s.uname = 'Linux 5.15.153.1-microsoft-standard-WSL2'
  await $.session.start(LINUX)
  expect(text(await runStage($, 'dj on'))).toBe("DJ mode can't reach Spotify on Windows from WSL: run Claude Code in a Windows terminal for it.")
  expect(s.checks).toEqual(['uname'])
})

test('a uname that times out is not kept: the next /stage dj on asks again', async ($, on) => {
  engine(on)
  const s = spotify(on)
  s.uname = null
  await $.session.start(MAC)
  expect(text(await runStage($, 'dj on'))).toBe(NEEDS_TERMINAL)
  s.uname = 'Darwin 27.0.0'
  expect(text(await runStage($, 'dj on'))).toBe(FIGURE_LINE)
  expect(s.checks).toEqual(['uname', 'uname'])
})

test("a /stage dj typed while the poll's check runs shares that check", async ($, on) => {
  const { clock } = engine(on, { store: { dj: true } })
  const s = spotify(on)
  s.uname = 'Darwin 27.0.0'
  // The mock clock's sleep is how a test hook answers late: uname answers
  // at the clock's next 10 ms, after /stage dj has asked.
  s.unameGate = clock.sleep(10)
  await $.session.start(MAC)
  const answer = runStage($, 'dj')
  await clock.advance(10)
  expect(text(await answer)).toContain('DJ mode on')
  await clock.advance(10)
  expect(s.checks).toEqual(['uname'])
  expect(s.argv.length).toBeGreaterThan(0)
})
