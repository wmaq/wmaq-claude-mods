import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, spawned } from './agents'
import { castOf, siteCells } from './frames'
import { createMod, createSite, type Mod, type Site } from './mod'

const START = 1_000_000
const quiet = () => undefined

// A mod and a site in a known state; built fresh each time, since composing
// a frame moves the mod on (the director's clock, the seat log).
function setup(kind: 'toon' | 'area', prepare: (mod: Mod) => void = () => undefined): { mod: Mod; site: Site } {
  const mod = createMod()
  mod.idleSince = START
  prepare(mod)
  const site = kind === 'area' ? mod.band : createSite('toon')
  site.requestId = 'r1'
  if (kind === 'area') site.columns = 48

  return { mod, site }
}

const cellsAt = (kind: 'toon' | 'area', at: number, prepare?: (mod: Mod) => void) => {
  const { mod, site } = setup(kind, prepare)

  return siteCells(mod, site, at, quiet)
}

test('a scene under the spinner: the same state at the same time gives the same frame, without the engine', () => {
  const a = cellsAt('toon', START + 1234)
  expect(typeof a).toBe('string')
  expect(cellsAt('toon', START + 1234)).toBe(a)
})

test('the idle Clawd: the same state at the same time gives the same frame', () => {
  const a = cellsAt('area', START + 5000)
  expect(cellsAt('area', START + 5000)).toBe(a)
})

test('the stage scene while Claude works: the same state at the same time gives the same frame, and it is neither the idle one nor the waiting one', () => {
  const working = (mod: Mod) => {
    mod.isBandWorking = true
  }
  const both = (mod: Mod) => {
    working(mod)
    mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-fable-5-1', START)
  }
  const a = cellsAt('area', START + 5000, working)
  expect(cellsAt('area', START + 5000, working)).toBe(a)
  expect(a).not.toBe(cellsAt('area', START + 5000))
  // An agent at work shows no helper while Claude works.
  expect(cellsAt('area', START + 5000, both)).toBe(a)
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
  expect(cellsAt('area', START + 5000, demoWorking)).toBe(cellsAt('area', START + 5000, demo))
  expect(cellsAt('area', START + 5000, demoWorking)).not.toBe(cellsAt('area', START + 5000, working))
})

test('the waiting toon: the same state at the same time gives the same frame, and it is not the idle one', () => {
  const waiting = (mod: Mod) => {
    mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-fable-5-1', START)
  }
  const a = cellsAt('area', START + 5000, waiting)
  expect(cellsAt('area', START + 5000, waiting)).toBe(a)
  expect(a).not.toBe(cellsAt('area', START + 5000))
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
