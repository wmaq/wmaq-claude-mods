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

// Windows' media session as powershell.exe answers it: what the script
// prints, its exit code, or a failure to run at all; every read counted.
type Spotify = { stdout: string; exitCode: number; isFailing: boolean; argv: (readonly string[])[]; timeouts: (number | undefined)[] }
function spotify(on: On): Spotify {
  const s: Spotify = { stdout: PLAYING, exitCode: 0, isFailing: false, argv: [], timeouts: [] }
  on('process.run', ($, e) => {
    s.argv.push(e.argv)
    s.timeouts.push(e.init?.timeoutMs)
    if (s.isFailing) throw new Error('powershell.exe could not start')

    return { value: { exitCode: s.exitCode, stdout: s.stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
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

test('off Windows DJ mode stays off, with no read', async ($, on) => {
  const { world } = engine(on)
  const s = spotify(on)
  await $.session.start({ ...START, cwd: '/home/me/proj' })
  expect(text(await runStage($, 'dj on'))).toBe('DJ mode needs Claude Code in a terminal on Windows, macOS or Linux.')
  expect(s.argv).toHaveLength(0)
  expect(world.store.dj).toBe(undefined)
  expect(text(await runStage($, 'dj'))).toBe(OFF)
})

test('kept on from a Windows session, DJ mode off Windows says it needs Windows, and never reads', async ($, on) => {
  const { clock } = engine(on, { store: { dj: true } })
  const s = spotify(on)
  await $.session.start({ ...START, cwd: '/home/me/proj' })
  await clock.advance(60_000)
  expect(s.argv).toHaveLength(0)
  expect(text(await runStage($, 'dj'))).toBe('DJ mode needs Claude Code in a terminal on Windows, macOS or Linux.')
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
