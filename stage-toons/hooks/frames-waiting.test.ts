import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, ended, type Roster, spawned } from './agents'
import { areaCells } from './frames'
import { createMod, type Mod, PAST_MS } from './mod'
import { getPixel } from './pixels'
import { HELPER_COLORS, WAITING_SCENES, type WaitingSceneId } from './waiting'

// The waiting scenes in the area: which one a waiting period is dealt, the
// helpers that left kept for the conveyor, and a scene that throws.
const START = 1_000_000
const quiet = () => undefined

// A mod whose area is on screen between turns, its next waiting period
// dealt `scene` when one is given.
function liveMod(scene?: WaitingSceneId): Mod {
  const mod = createMod()
  mod.idleSince = START
  mod.band.requestId = 'r1'
  if (scene) mod.waiting = { ...mod.waiting, deal: { deck: [scene], last: undefined } }

  return mod
}
// Frames every 100 ms from `from` to `to`.
function run(mod: Mod, from: number, to: number, log: (text: string) => void = quiet) {
  for (let at = from; at <= to; at += 100) areaCells(mod, 48, at, log)
}
const withAgents = (...models: string[]): Roster => models.reduce<Roster>((r, m, i) => spawned(r, `a${i + 1}`, m, START), EMPTY_ROSTER)

test('a waiting period is dealt its scene as it starts and keeps it; the next period is dealt another', () => {
  const mod = liveMod()
  mod.roster = withAgents('claude-sonnet-5-5')
  run(mod, START, START + 3000)
  const first = mod.waiting.scene
  expect(mod.shown?.name).toBe(`waiting:${START}:${first}`)
  mod.roster = spawned(mod.roster, 'a2', 'claude-opus-5-5', START + 3000)
  run(mod, START + 3000, START + 5000)
  expect(mod.waiting.scene).toBe(first)
  mod.roster = ended(ended(mod.roster, 'a1', START + 5000), 'a2', START + 5000)
  run(mod, START + 5000, START + 9000)
  expect(mod.seats.since).toBeNull()
  mod.roster = spawned(mod.roster, 'a3', 'claude-haiku-4-5', START + 9100)
  run(mod, START + 9100, START + 9500)
  expect(mod.shown?.name).toBe(`waiting:${START + 9100}:${mod.waiting.scene}`)
  expect(mod.waiting.scene).not.toBe(first)
})

test("a helper that left stays in the conveyor's log for a while: the boxes it marked keep its mark", () => {
  const mod = liveMod('conveyor')
  mod.roster = withAgents('claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5')
  run(mod, START, START + 5000)
  // The haiku helper at seat 3 gets up at 5 s; its seat frees at 5.63 s.
  mod.roster = ended(mod.roster, 'a4', START + 5000)
  run(mod, START + 5000, START + 5700)
  expect(mod.seats.entries.map(e => e.agentId)).toEqual(['a1', 'a2', 'a3'])
  expect(mod.waiting.past.map(e => e.agentId)).toEqual(['a4'])
  // Box 2 passed seat 3 at 4 s; at 5.7 s it is at column 27, its seat-3 mark at 27 + 4.
  expect(getPixel(mod.shown!.draw(START + 5700, 48), 31, 10)).toBe(HELPER_COLORS.haiku)
  run(mod, START + 5800, START + 5700 + PAST_MS)
  expect(mod.waiting.past).toEqual([])
})

test('a waiting scene that throws gives way to the laptops for the session, and the laptops to the idle routine', () => {
  const rowing = WAITING_SCENES.rowing
  const laptops = WAITING_SCENES.laptops
  const boom = { helper: () => { throw new Error('boom') } }
  const lines: string[] = []
  try {
    WAITING_SCENES.rowing = boom
    const mod = liveMod('rowing')
    mod.roster = withAgents('claude-sonnet-5-5')
    run(mod, START, START + 3000, line => lines.push(line))
    expect(lines).toEqual(['stage-toons: the waiting scene rowing failed and was replaced by the laptops: Error: boom'])
    expect(mod.waiting.scene).toBe('laptops')
    expect([...mod.waiting.broken]).toEqual(['rowing'])
    expect(mod.shown?.name).toBe(`waiting:${START}:laptops`)
    WAITING_SCENES.laptops = boom
    run(mod, START + 3100, START + 3200, line => lines.push(line))
    expect(lines[1]).toBe('stage-toons: the waiting toon failed and was replaced by the idle routine: Error: boom')
    expect(mod.isWaitingBroken).toBe(true)
    expect(mod.shown?.name.startsWith('idle:')).toBe(true)
  } finally {
    WAITING_SCENES.rowing = rowing
    WAITING_SCENES.laptops = laptops
  }
})

test('a waiting scene that throws is cut to the laptops, not dissolved from', () => {
  const rowing = WAITING_SCENES.rowing
  let throws = false
  try {
    const mod = liveMod('rowing')
    mod.roster = withAgents('claude-sonnet-5-5')
    run(mod, START, START + 3000)
    expect(mod.shown?.name).toBe(`waiting:${START}:rowing`)
    // Throws once, in one state: the old picture would still draw.
    WAITING_SCENES.rowing = {
      ...rowing,
      helper: (...args) => {
        if (throws) {
          throws = false
          throw new Error('boom')
        }
        rowing.helper(...args)
      },
    }
    throws = true
    areaCells(mod, 48, START + 3100, quiet)
    expect(mod.shown?.name).toBe(`waiting:${START}:laptops`)
    expect(mod.fade).toBeNull()
  } finally {
    WAITING_SCENES.rowing = rowing
  }
})
