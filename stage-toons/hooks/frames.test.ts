import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, spawned } from './agents'
import { react, withAuditing, withScene } from './director'
import { areaCells, castOf } from './frames'
import { DOZE_MS } from './idle'
import { createMod, frameMs, isDeepAsleep, type Mod } from './mod'
import { encodeCells, type PixelBuffer } from './pixels'
import { dissolve, FADE_MS } from './scene'
import { C } from './scenes/kit'
import { HELPER_COLORS } from './waiting'

const START = 1_000_000
const quiet = () => undefined

// The frame of the band's area, mounted 48 columns wide, for a mod in a
// known state; the mod is built fresh each time, since composing a frame
// moves it on (the director's clock, the seat log).
function cellsAt(at: number, prepare: (mod: Mod) => void = () => undefined) {
  const mod = createMod()
  mod.idleSince = START
  prepare(mod)
  mod.band.requestId = 'r1'

  return areaCells(mod, 48, at, quiet)
}

test('the idle Clawd: the same state at the same time gives the same frame', () => {
  const a = cellsAt(START + 5000)
  expect(cellsAt(START + 5000)).toBe(a)
})

test('the stage scene while Claude works: the same state at the same time gives the same frame, and it is neither the idle one nor the waiting one', () => {
  const working = (mod: Mod) => {
    mod.isBandWorking = true
  }
  const both = (mod: Mod) => {
    working(mod)
    mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-fable-5-1', START)
  }
  const a = cellsAt(START + 5000, working)
  expect(cellsAt(START + 5000, working)).toBe(a)
  expect(a).not.toBe(cellsAt(START + 5000))
  // An agent at work shows no helper while Claude works.
  expect(cellsAt(START + 5000, both)).toBe(a)
})

test('a demo plays over the stage scene while Claude works', () => {
  const demo = (mod: Mod) => {
    mod.demo = { kind: 'waiting', at: START }
  }
  const demoWorking = (mod: Mod) => {
    demo(mod)
    mod.isBandWorking = true
  }
  const working = (mod: Mod) => {
    mod.isBandWorking = true
  }
  expect(cellsAt(START + 5000, demoWorking)).toBe(cellsAt(START + 5000, demo))
  expect(cellsAt(START + 5000, demoWorking)).not.toBe(cellsAt(START + 5000, working))
})

test('the waiting toon: the same state at the same time gives the same frame, and it is not the idle one', () => {
  const waiting = (mod: Mod) => {
    mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-fable-5-1', START)
  }
  const a = cellsAt(START + 5000, waiting)
  expect(cellsAt(START + 5000, waiting)).toBe(a)
  expect(a).not.toBe(cellsAt(START + 5000))
})

test('the mod keeps one cast, with the log it was first given', () => {
  const mod = createMod()
  const lines: string[] = []
  const cast = castOf(mod, text => lines.push(text))
  expect(castOf(mod, quiet)).toBe(cast)
  expect(cast.broken).toBe(mod.broken)
  cast.onBreak('stamp', new Error('boom'))
  expect(lines).toEqual(['stage-toons: scene stamp failed and was replaced by the standing scene: Error: boom'])
  expect(castOf(createMod(), quiet)).not.toBe(cast)
})

// One mod across frames, as the paint loop keeps it: the band's area mounted
// 48 columns wide, Claude idle since START.
function liveMod(): Mod {
  const mod = createMod()
  mod.idleSince = START
  mod.band.requestId = 'r1'

  return mod
}
const frame = (mod: Mod, at: number) => areaCells(mod, 48, at, quiet)
// What the picture on show, and the one dissolving out, draw at a moment:
// each as it was at the last frame (its director, its seats), so call them
// right after the frame they check.
const shownCells = (mod: Mod, at: number) => encodeCells(mod.shown!.draw(at, 48))
const fromCells = (mod: Mod, at: number) => encodeCells(mod.fade!.from.draw(at, 48))
const has = (b: PixelBuffer, color: number) => [...b.px].includes(color)

test('each picture has a name that changes when the picture does', () => {
  const mod = liveMod()
  frame(mod, START + 1000)
  expect(mod.shown?.name).toBe(`idle:classic:${START}`)
  frame(mod, START + DOZE_MS)
  expect(mod.shown?.name).toBe(`doze:${START}`)
  mod.isBandWorking = true
  frame(mod, START + DOZE_MS + 1000)
  expect(mod.shown?.name).toBe(`scene:mystery-box:${START + DOZE_MS + 1000}`)
  mod.isBandWorking = false
  mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-fable-5-1', START + DOZE_MS + 2000)
  frame(mod, START + DOZE_MS + 2000)
  expect(mod.shown?.name).toBe(`waiting:${START + DOZE_MS + 2000}`)
  mod.demo = { kind: 'scenes', at: START + DOZE_MS + 3000, seconds: 2, scenes: ['dice', 'gift'] }
  frame(mod, START + DOZE_MS + 5500)
  expect(mod.shown?.name).toBe(`demo:${START + DOZE_MS + 3000}:1`)
  mod.demo = { kind: 'idle', at: START + DOZE_MS + 6000, seconds: 2 }
  frame(mod, START + DOZE_MS + 8500)
  expect(mod.shown?.name).toBe(`demo:${START + DOZE_MS + 6000}:1:nyan`)
  mod.demo = { kind: 'waiting', at: START + DOZE_MS + 9000 }
  frame(mod, START + DOZE_MS + 9500)
  expect(mod.shown?.name).toBe(`demo:${START + DOZE_MS + 9000}:waiting`)
})

test("the first frame after a load is a cut; idle to the scene dissolves over FADE_MS, then the scene shows alone, from its start", () => {
  const mod = liveMod()
  frame(mod, START + 1000)
  expect(mod.fade).toBeNull()
  mod.isBandWorking = true
  const at = START + 2000
  frame(mod, at)
  expect(mod.fade?.at).toBe(at)
  expect(mod.director.baseAt).toBe(at)
  for (const ms of [83, 249, 415]) {
    const cells = frame(mod, at + ms)
    expect(cells).not.toBe(shownCells(mod, at + ms))
    expect(cells).not.toBe(fromCells(mod, at + ms))
  }
  // A resize mid-dissolve draws both pictures at the new width.
  const narrow = areaCells(mod, 40, at + 450, quiet)
  expect(narrow).toBe(encodeCells(dissolve(mod.fade!.from.draw(at + 450, 40), mod.shown!.draw(at + 450, 40), 450 / FADE_MS, at)))
  expect(frame(mod, at + FADE_MS)).toBe(shownCells(mod, at + FADE_MS))
  expect(mod.fade).toBeNull()
})

test('a change while a dissolve runs keeps dissolving the first picture', () => {
  const mod = liveMod()
  frame(mod, START + 1000)
  mod.isBandWorking = true
  frame(mod, START + 2000)
  const first = mod.fade!.from
  mod.isBandWorking = false
  mod.idleSince = START + 2100
  frame(mod, START + 2100)
  expect(mod.fade?.from).toBe(first)
  expect(mod.fade?.at).toBe(START + 2000)
  expect(mod.shown?.name).toBe(`idle:classic:${START + 2100}`)
})

test('a picture that throws while dissolving out ends the dissolve', () => {
  const mod = liveMod()
  frame(mod, START + 1000)
  mod.isBandWorking = true
  frame(mod, START + 2000)
  mod.fade = {
    at: mod.fade!.at,
    from: {
      name: 'broken',
      draw: () => {
        throw new Error('boom')
      },
    },
  }
  expect(frame(mod, START + 2100)).toBe(shownCells(mod, START + 2100))
  expect(mod.fade).toBeNull()
})

test('a demo that is over leaves its last picture to dissolve from; the scene starts over after it', () => {
  const mod = liveMod()
  mod.isBandWorking = true
  frame(mod, START + 1000)
  mod.demo = { kind: 'scenes', at: START + 2000, seconds: 2, scenes: ['dice'] }
  frame(mod, START + 3000)
  expect(frame(mod, START + 4000)).toBeNull()
  expect(mod.shown?.name).toBe(`demo:${START + 2000}:0`)
  mod.demo = null
  frame(mod, START + 4000)
  expect(mod.fade?.from.name).toBe(`demo:${START + 2000}:0`)
  expect(mod.director.baseAt).toBe(START + 4000)
})

test('the outgoing picture is as it was in its last frame: a helper who came later, a failure mark that started after the scene', () => {
  const mod = liveMod()
  mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-fable-5-1', START)
  frame(mod, START + 100)
  mod.roster = spawned(mod.roster, 'a2', 'claude-sonnet-5-5', START + 1000)
  for (let at = START + 1000; at <= START + 6000; at += 500) frame(mod, at)
  expect(has(mod.shown!.draw(START + 6000, 48), HELPER_COLORS.sonnet)).toBe(true)
  mod.isBandWorking = true
  frame(mod, START + 6100)
  expect(has(mod.fade!.from.draw(START + 6200, 48), HELPER_COLORS.sonnet)).toBe(true)

  const working = liveMod()
  working.isBandWorking = true
  frame(working, START + 1000)
  working.director = react(working.director, 'failure', START + 2000)
  frame(working, START + 2500)
  working.isBandWorking = false
  working.idleSince = START + 2600
  frame(working, START + 2600)
  expect(has(working.fade!.from.draw(START + 2700, 48), C.red)).toBe(true)
})

test('a dissolve repaints at twelve frames a second and keeps the area awake', () => {
  const mod = liveMod()
  const dozing = START + DOZE_MS + 400_000
  frame(mod, START + DOZE_MS - 100)
  frame(mod, dozing)
  expect(mod.fade?.at).toBe(dozing)
  expect(frameMs(mod, dozing + 100)).toBe(83)
  expect(isDeepAsleep(mod, dozing + 100)).toBe(false)
  expect(frameMs(mod, dozing + FADE_MS)).toBe(333)
  expect(isDeepAsleep(mod, dozing + FADE_MS)).toBe(true)
})

test("a stage move, Fable's arrival and his departure while Claude works each dissolve from the scene before", () => {
  const mod = liveMod()
  mod.isBandWorking = true
  frame(mod, START + 1000)
  mod.director = withScene(mod.director, 'dice', START + 2000)
  frame(mod, START + 2000)
  expect(mod.fade?.from.name).toBe(`scene:mystery-box:${START + 1000}`)
  expect(mod.shown?.name).toBe(`scene:dice:${START + 2000}`)
  mod.director = withAuditing(mod.director, true, START + 3000)
  frame(mod, START + 3000)
  // The walk-in plays over the stage's scene: no new picture until it ends.
  expect(mod.shown?.name).toBe(`scene:dice:${START + 2000}`)
  frame(mod, START + 5000)
  expect(mod.shown?.name).toBe(`scene:fable-audit:${START + 5000}`)
  expect(mod.fade?.from.name).toBe(`scene:dice:${START + 2000}`)
  mod.director = withAuditing(mod.director, false, START + 8000)
  frame(mod, START + 8000)
  expect(mod.shown?.name).toBe(`scene:dice:${START + 8000}`)
  expect(mod.fade?.from.name).toBe(`scene:fable-audit:${START + 5000}`)
})
