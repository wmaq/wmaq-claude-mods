import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, type Roster, spawned } from './agents'
import { createDirector } from './director'
import { areaCells } from './frames'
import { DEEP_SLEEP_MS, DOZE_MS } from './idle'
import { CALM_FRAME_MS, createMod, djPollState, frameMs, isDeepAsleep, isDjOn, type Mod, QUICK_MS, redance } from './mod'
import { heard, NO_MUSIC, type NowPlaying } from './nowplaying'
import { HELPER_COLORS } from './waiting'
import { EMPTY_LOG } from './waiting/seats'
import { createActivity, withMode } from './work'

// Clawd DJ in the mod: which picture the area shows, its pace, the dance
// floor, and the demo's picture. (The scene's own drawing is
// scenes/dj.test.ts's; the commands are dj-command.test.ts's; the engine's
// side is register-dj.test.tsx's.)
const START = 1_000_000
const quiet = () => undefined
const FIGURE: NowPlaying = { artist: 'Linkin Park', title: 'Figure.09', isPlaying: true }
const WIDE = { columns: 120, rows: 9 }

// A mod whose area is on screen in DJ mode, Spotify playing (or not).
function djMod(isPlaying = true, prepare: (mod: Mod) => void = () => undefined): Mod {
  const mod = createMod()
  mod.idleSince = START
  mod.band.requestId = 'r1'
  mod.band.columns = WIDE.columns
  mod.isDj = true
  mod.music = isPlaying ? heard(NO_MUSIC, FIGURE) : NO_MUSIC
  prepare(mod)

  return mod
}
const decodeCells = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)
const withAgents = (...models: string[]): Roster => models.reduce<Roster>((r, m, i) => spawned(r, `a${i + 1}`, m, START), EMPTY_ROSTER)
const shownAt = (mod: Mod, at: number) => {
  areaCells(mod, WIDE, at, quiet)

  return mod.shown?.name
}

test('while Spotify plays in DJ mode the area shows the DJ picture, whatever the stage, the waiting toon or the idle Clawd would', () => {
  const working = djMod(true, mod => {
    mod.isBandWorking = true
    mod.director = createDirector('dice', false)
  })
  expect(shownAt(working, START)).toBe('dj')
  const waiting = djMod(true, mod => (mod.roster = withAgents('claude-sonnet-5-5')))
  expect(shownAt(waiting, START)).toBe('dj')
  expect(shownAt(djMod(), START)).toBe('dj')
  // Nothing playing, DJ mode off, or the picture broken: the usual ones.
  expect(shownAt(djMod(false), START)).toBe(`idle:classic:${START}`)
  expect(shownAt(djMod(true, mod => (mod.isDj = false)), START)).toBe(`idle:classic:${START}`)
  expect(shownAt(djMod(true, mod => (mod.isDjBroken = true)), START)).toBe(`idle:classic:${START}`)
})

test('calm, the DJ picture is named by the track and the dancers present, so it is drawn again when they change', () => {
  const mod = djMod(true, mod => (mod.isCalm = true))
  expect(shownAt(mod, START)).toBe('dj:calm:Linkin Park - Figure.09:')
  mod.roster = withAgents('claude-opus-5-5')
  expect(shownAt(mod, START + 100)).toBe('dj:calm:Linkin Park - Figure.09:a1')
})

test('the DJ picture is a quick picture: never the idle pace, never deep asleep', () => {
  const mod = djMod()
  const late = START + DOZE_MS + DEEP_SLEEP_MS + 1000
  expect(isDjOn(mod)).toBe(true)
  expect(frameMs(mod, late)).toBe(QUICK_MS)
  expect(isDeepAsleep(mod, late)).toBe(false)
  mod.isCalm = true
  expect(frameMs(mod, late)).toBe(CALM_FRAME_MS)
  const silent = djMod(false)
  expect(frameMs(silent, late)).toBe(333)
  expect(isDeepAsleep(silent, late)).toBe(true)
})

test('the poll is paced by what the area shows: a broken DJ picture counts as nothing playing, so Clawd may sleep to slow reads', () => {
  const mod = djMod()
  expect(djPollState(mod)).toEqual({ isAreaShown: true, isAsleep: false, isPlaying: true })
  mod.isDjBroken = true
  expect(djPollState(mod).isPlaying).toBe(false)
  mod.band.requestId = undefined
  mod.band.isAsleep = true
  expect(djPollState(mod)).toEqual({ isAreaShown: false, isAsleep: true, isPlaying: false })
})

test('the dance floor: the helpers of the agents at work take spots while the DJ picture shows, working or not', () => {
  for (const isWorking of [false, true]) {
    const mod = djMod(true, mod => {
      mod.isBandWorking = isWorking
      mod.roster = withAgents('claude-opus-5-5', 'claude-fable-5-1')
    })
    redance(mod, START, true)
    expect(mod.dancers.entries.map(e => [e.agentId, e.x])).toEqual([
      ['a1', 45],
      ['a2', 55],
    ])
    // The waiting toon's own log is left alone.
    expect(mod.seats).toEqual(EMPTY_LOG)
  }
})

test('one dancer too many waits off the floor; away from the DJ picture the floor empties', () => {
  const mod = djMod(true, mod => {
    mod.band.columns = 48
    mod.roster = withAgents('claude-opus-5-5', 'claude-fable-5-1')
  })
  redance(mod, START, true)
  expect(mod.dancers.entries.map(e => e.agentId)).toEqual(['a1'])
  expect(mod.dancers.queue).toEqual(['a2'])
  redance(mod, START + 100, false)
  expect(mod.dancers).toEqual(EMPTY_LOG)
})

test('a dancer shows on the floor in its colour', () => {
  const mod = djMod(true, mod => (mod.roster = withAgents('claude-sonnet-5-5')))
  let cells = ''
  for (let at = START; at <= START + 4000; at += 100) cells = areaCells(mod, WIDE, at, quiet)!
  const words = decodeCells(cells)
  let isShown = false
  for (let i = 0; i < words.length; i += 3) if (words[i + 1] === HELPER_COLORS.sonnet || words[i + 2] === HELPER_COLORS.sonnet) isShown = true
  expect(isShown).toBe(true)
})

test("while Claude works, Clawd's pop-ups show over his head in the DJ picture; with /stage bubbles off, none", () => {
  const frame = (isBubbles: boolean) => {
    const mod = djMod(true, mod => {
      mod.isBandWorking = true
      mod.isBubbles = isBubbles
      mod.activity = withMode(createActivity(), 'thinking')
    })
    areaCells(mod, WIDE, START, quiet)

    return areaCells(mod, WIDE, START + 1200, quiet)
  }
  expect(frame(true)).not.toBe(frame(false))
})

test('a DJ picture that throws gives way to the usual pictures for the load, at once', () => {
  const logs: string[] = []
  const mod = djMod()
  const broken = { ...FIGURE }
  Object.defineProperty(broken, 'title', {
    get() {
      throw new Error('boom')
    },
  })
  mod.music = { track: broken, isPlaying: true, misses: 0 }
  expect(areaCells(mod, WIDE, START, text => logs.push(text))).not.toBe(null)
  expect(mod.isDjBroken).toBe(true)
  expect(mod.shown?.name).toBe(`idle:classic:${START}`)
  expect(logs).toEqual(['stage-toons: the DJ picture failed and was replaced by the usual pictures: Error: boom'])
})

test('the DJ demo plays whatever DJ mode and Spotify say, and ends when its time is up', () => {
  const mod = createMod()
  mod.band.requestId = 'r1'
  mod.demo = { kind: 'dj', at: START, seconds: 2 }
  expect(shownAt(mod, START)).toBe(`demo:${START}:dj`)
  expect(areaCells(mod, WIDE, START + 2000, quiet)).toBe(null)
})
