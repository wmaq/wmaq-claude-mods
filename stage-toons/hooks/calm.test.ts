import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, ended, type Roster, spawned } from './agents'
import { createDirector, react, withAuditing, withScene } from './director'
import { areaCells } from './frames'
import { DOZE_MS, IDLE_IDS } from './idle'
import { CALM_FRAME_MS, createMod, frameMs, isDeepAsleep, type Mod } from './mod'
import { WAITING_SCENE_IDS, type WaitingSceneId } from './waiting'
import { calmView, isPresent, WAITING_STILL_S } from './waiting/calm'
import { marksOf } from './waiting/conveyor'
import { seatedAt, type SeatLog } from './waiting/seats'
import { CALM_LAYER_T, createActivity, layerAt, said, toolStarted, withMode } from './work'

// Calm mode: each picture held at its still, changing only when something
// happens.
const START = 1_000_000
const quiet = () => undefined
const SIZE = { columns: 120, rows: 9 }

// A mod whose area is on screen, in calm mode.
function calmMod(prepare: (mod: Mod) => void = () => undefined): Mod {
  const mod = createMod()
  mod.idleSince = START
  mod.band.requestId = 'r1'
  mod.isCalm = true
  prepare(mod)

  return mod
}
// Frames every 100 ms from `from` to `to`; the last frame's cells.
function run(mod: Mod, from: number, to: number): string {
  let cells = ''
  for (let at = from; at <= to; at += 100) cells = areaCells(mod, SIZE, at, quiet)!

  return cells
}
const withAgents = (...models: string[]): Roster => models.reduce<Roster>((r, m, i) => spawned(r, `a${i + 1}`, m, START), EMPTY_ROSTER)

test('calm mode holds the stage scene still while Claude works, under a still layer', () => {
  const mod = calmMod(m => {
    m.isBandWorking = true
    m.director = createDirector('bricklaying', false)
    m.activity = toolStarted(createActivity(), 't1', 'edit', 'auth.ts')
  })
  const a = run(mod, START, START + 2000)
  expect(mod.shown?.name).toBe(`scene:bricklaying:${START}:calm`)
  expect(run(mod, START + 2100, START + 7000)).toBe(a)
})

test('calm mode holds the idle routine, then the doze, each still; the doze stops the loop once shown', () => {
  for (const routine of IDLE_IDS) {
    const mod = calmMod(m => {
      m.idle = routine
    })
    const a = run(mod, START, START + 2000)
    expect(mod.shown?.name).toBe(`idle:${routine}:${START}:calm`)
    expect(run(mod, START + 2100, START + 9000)).toBe(a)
  }
  const mod = calmMod()
  const doze = run(mod, START + DOZE_MS, START + DOZE_MS + 1000)
  expect(mod.shown?.name).toBe(`doze:${START}:calm`)
  expect(run(mod, START + DOZE_MS + 1100, START + DOZE_MS + 20_000)).toBe(doze)
  expect(isDeepAsleep(mod, START + DOZE_MS + 20_000)).toBe(true)
  expect(isDeepAsleep(mod, START + DOZE_MS - 1)).toBe(false)
  mod.isCalm = false
  expect(isDeepAsleep(mod, START + DOZE_MS + 20_000)).toBe(false)
})

test('a reaction in calm mode: no jump or flinch, the line shown, the badge kept; after the line, the badge alone', () => {
  for (const id of ['failure', 'advance'] as const) {
    const at = START + 1000
    const mod = calmMod(m => {
      m.isBandWorking = true
      m.director = react(createDirector('dice', false), id, at)
      m.activity = toolStarted(createActivity(), 't1', 'run', 'npm test')
    })
    const half = run(mod, START, at + 500)
    expect(run(mod, at + 600, at + 2000)).toBe(half)
    const layer = layerAt(mod.activity, mod.director, at + 1000, true)!
    expect(layer.badge).toBe('run')
    expect(layer.bubble).not.toBeNull()
    const after = layerAt(mod.activity, mod.director, at + 2600, true)!
    expect(after.badge).toBe('run')
    expect(after.bubble).toBeNull()
  }
})

test("the layer in calm mode: all three puffs at any time (a fixed t), the dots full", () => {
  const d = createDirector('dice', false)
  const thinking = { ...withMode(createActivity(), 'thinking'), shown: { display: { badge: 'thinking' as const, what: '', isTyping: false }, since: 0 } }
  for (const now of [0, 100, 450, 1234]) expect(layerAt(thinking, d, now, true)?.t).toBe(CALM_LAYER_T)
  const typing = { ...withMode(createActivity(), 'responding'), shown: { display: { badge: null, what: '', isTyping: true }, since: 0 } }
  for (const now of [0, 100, 450, 1234]) expect(layerAt(typing, d, now, true)?.bubble).toBe('...')
  // A line still takes the bubble.
  expect(layerAt(said(typing, 'All green!', 0), d, 100, true)?.bubble).toBe('All green!')
})

test("Fable in calm mode: the stage's still until her walk-in ends, then fable-audit's, each change a dissolve", () => {
  const mod = calmMod(m => {
    m.isBandWorking = true
    m.director = createDirector('gift', false)
  })
  run(mod, START, START + 1000)
  mod.director = withAuditing(mod.director, true, START + 1000)
  const walking = run(mod, START + 1100, START + 2900)
  expect(mod.shown?.name).toBe(`scene:gift:${START}:calm`)
  expect(run(mod, START + 1100, START + 1500)).toBe(walking)
  run(mod, START + 3000, START + 3100)
  expect(mod.shown?.name).toBe(`scene:fable-audit:${START + 3000}:calm`)
  expect(mod.fade).not.toBeNull()
})

test('a stage move in calm mode changes the picture and dissolves', () => {
  const mod = calmMod(m => {
    m.isBandWorking = true
    m.director = createDirector('gift', false)
  })
  run(mod, START, START + 1000)
  mod.director = withScene(mod.director, 'dice', START + 1000)
  run(mod, START + 1100, START + 1100)
  expect(mod.shown?.name).toBe(`scene:dice:${START + 1000}:calm`)
  expect(mod.fade).not.toBeNull()
})

test('turning calm mode on or off changes the picture, which dissolves', () => {
  const mod = calmMod()
  mod.isCalm = false
  run(mod, START, START + 1000)
  expect(mod.shown?.name).toBe(`idle:classic:${START}`)
  mod.isCalm = true
  run(mod, START + 1100, START + 1100)
  expect(mod.shown?.name).toBe(`idle:classic:${START}:calm`)
  expect(mod.fade).not.toBeNull()
})

test('a demo moves in calm mode', () => {
  const demos: Mod['demo'][] = [
    { kind: 'scenes', at: START, seconds: 10, scenes: ['bricklaying'] },
    { kind: 'waiting', at: START, scene: 'laptops', columns: 120 },
  ]
  for (const demo of demos) {
    const mod = calmMod(m => {
      m.demo = demo
    })
    const a = run(mod, START, START + 1000)
    expect(run(mod, START + 1100, START + 1300)).not.toBe(a)
  }
})

test('frameMs in calm mode: the quick rate during a dissolve and a demo, CALM_FRAME_MS otherwise', () => {
  const mod = calmMod(m => {
    m.isBandWorking = true
  })
  expect(frameMs(mod, START)).toBe(CALM_FRAME_MS)
  mod.fade = { from: { name: 'x', draw: () => null as never }, at: START }
  expect(frameMs(mod, START + 100)).toBe(83)
  mod.fade = null
  mod.demo = { kind: 'waiting', at: START, scene: 'laptops', columns: 48 }
  expect(frameMs(mod, START)).toBe(83)
})

// The waiting toon held still.
function waitingMod(scene: WaitingSceneId, roster: Roster): Mod {
  return calmMod(m => {
    m.waiting = { ...m.waiting, deal: { deck: [scene], last: undefined } }
    m.roster = roster
  })
}

test('the waiting toon in calm mode: helpers seated from their arrival, the picture still between arrivals and departures, each change a dissolve', () => {
  for (const scene of WAITING_SCENE_IDS) {
    const mod = waitingMod(scene, withAgents('claude-sonnet-5-5'))
    const one = run(mod, START, START + 2000)
    expect(mod.shown?.name).toBe(`waiting:${START}:${scene}:calm:a1`)
    expect(run(mod, START + 2100, START + 6000)).toBe(one)
    mod.roster = spawned(mod.roster, 'a2', 'claude-opus-5-5', START + 6000)
    run(mod, START + 6100, START + 6100)
    expect(mod.shown?.name).toBe(`waiting:${START}:${scene}:calm:a1,a2`)
    expect(mod.fade).not.toBeNull()
    const two = run(mod, START + 6200, START + 8000)
    expect(run(mod, START + 8100, START + 12_000)).toBe(two)
    mod.roster = ended(mod.roster, 'a1', START + 12_000)
    run(mod, START + 12_100, START + 12_100)
    expect(mod.shown?.name).toBe(`waiting:${START}:${scene}:calm:a2`)
  }
})

test('the calm view: present helpers only, seated from the period start, Clawd aside, at the still moment', () => {
  const e = (agentId: string, seat: number, arrivedAt: number, leftAt: number | null) => ({ agentId, seat, kind: 'sonnet' as const, arrivedAt, leftAt, edge: 48 })
  const log: SeatLog = {
    entries: [e('a', 0, START, null), e('b', 1, START + 500, null), e('c', 2, START, START + 3000)],
    queue: [],
    since: START,
    until: null,
    walk: { at: START, fromX: 12, toX: 0 },
    seats: 4,
  }
  // b is staggered: not there before its arrival.
  expect(calmView(log, START + 400).present).toEqual(['a', 'c'])
  const view = calmView(log, START + 3000)
  expect(view.present).toEqual(['a', 'b'])
  expect(view.now).toBe(START + WAITING_STILL_S * 1000)
  for (const n of view.log.entries) {
    expect(seatedAt(n)).toBe(START)
    expect(n.leftAt).toBeNull()
  }
  expect(isPresent(e('d', 0, START, START + 10), START + 10)).toBe(false)
})

test("the conveyor in calm mode marks each box only with the present helpers' colours", () => {
  const e = (agentId: string, seat: number, leftAt: number | null) => ({ agentId, seat, kind: 'sonnet' as const, arrivedAt: START, leftAt, edge: 48 })
  const log: SeatLog = { entries: [e('a', 0, null), e('c', 2, START + 3000)], queue: [], since: START, until: null, walk: null, seats: 4 }
  const view = calmView(log, START + 3000)
  const marks = Array.from({ length: 12 }, (_, j) => j - 6).flatMap(j => marksOf(view.log, j, view.now))
  expect(marks.length > 0).toBe(true)
  expect([...new Set(marks.map(m => m.seat))]).toEqual([0])
  expect(marks.some(m => m.isNew)).toBe(false)
})
