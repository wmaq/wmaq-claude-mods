import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, spawned } from './agents'
import { areaCells, castOf } from './frames'
import { createMod, type Mod } from './mod'

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
