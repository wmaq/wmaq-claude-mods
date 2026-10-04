import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, spawned } from './agents'
import { siteCells } from './frames'
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

test('the waiting toon: the same state at the same time gives the same frame, and it is not the idle one', () => {
  const waiting = (mod: Mod) => {
    mod.roster = spawned(EMPTY_ROSTER, 'a1', 'claude-fable-5-1', START)
  }
  const a = cellsAt('area', START + 5000, waiting)
  expect(cellsAt('area', START + 5000, waiting)).toBe(a)
  expect(a).not.toBe(cellsAt('area', START + 5000))
})
