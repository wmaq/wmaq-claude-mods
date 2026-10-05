import { expect, test } from 'claude-code/testing'

import { createDirector, heldShot, react, restarted, shot, tick, withAuditing, withScene } from './director'

const T = 1_000_000

test('the base scene follows the stage, on its own clock from when it came on', () => {
  let d = createDirector('spec', false)
  expect(d.baseAt).toBe(0)
  d = restarted(d, T)
  expect(shot(d, T + 1500)).toEqual({ base: 'spec', time: 1.5, reaction: null })
  d = withScene(d, 'plan', T + 2000)
  expect(shot(d, T + 2150)).toEqual({ base: 'plan', time: 0.15, reaction: null })
  // The same scene again changes nothing: its clock runs on.
  expect(withScene(d, 'plan', T + 3000).baseAt).toBe(T + 2000)
})

test('Fable walks in over the stage scene, then the auditor scene takes over, and Fable walks out', () => {
  let d = withAuditing(restarted(createDirector('develop', false), T), true, T)
  expect(shot(d, T + 500)).toEqual({ base: 'develop', time: 0.5, reaction: { id: 'fable-arrives', t: 0.5 } })
  d = tick(d, T + 2000)
  expect(shot(d, T + 2000)).toEqual({ base: 'fable-audit', time: 0, reaction: null })
  d = withAuditing(d, false, T + 5000)
  expect(shot(d, T + 5000)).toEqual({ base: 'develop', time: 0, reaction: { id: 'fable-leaves', t: 0 } })
  d = tick(d, T + 7000)
  expect(shot(d, T + 7000)).toEqual({ base: 'develop', time: 2, reaction: null })
})

test('Fable reactions are never cut short, and failures during them are dropped', () => {
  let d = withAuditing(createDirector('develop', false), true, T)
  d = react(d, 'failure', T + 100)
  expect(d.reaction?.id).toBe('fable-arrives')
  d = withAuditing(d, false, T + 200)
  expect(d.reaction?.id).toBe('fable-arrives')
  d = tick(d, T + 2000)
  expect(shot(d, T + 2000)).toEqual({ base: 'develop', time: 0, reaction: { id: 'fable-leaves', t: 0 } })
})

test('a new failure or advance replaces the one playing, and both expire; neither restarts the scene', () => {
  let d = react(restarted(createDirector('plan', false), T), 'failure', T)
  d = react(d, 'advance', T + 100)
  expect(shot(d, T + 100).reaction).toEqual({ id: 'advance', t: 0 })
  expect(d.baseAt).toBe(T)
  d = tick(d, T + 3100)
  expect(d.reaction).toBeNull()
})

test('a stage change while the auditor scene shows keeps it, on its clock', () => {
  let d = tick(withAuditing(createDirector('spec', false), true, T), T + 2000)
  d = withScene(d, 'spec-audit', T + 2100)
  expect(shot(d, T + 2100)).toEqual({ base: 'fable-audit', time: 0.1, reaction: null })
  d = withAuditing(d, false, T + 3000)
  expect(shot(d, T + 3000)).toEqual({ base: 'spec-audit', time: 0, reaction: { id: 'fable-leaves', t: 0 } })
})

test('auditing again while Fable walks out brings Fable back once the exit ends', () => {
  let d = tick(withAuditing(createDirector('plan', false), true, T), T + 2000)
  d = withAuditing(d, false, T + 2500)
  d = withAuditing(d, true, T + 3000)
  expect(d.reaction?.id).toBe('fable-leaves')
  d = tick(d, T + 4500)
  expect(shot(d, T + 4500).reaction).toEqual({ id: 'fable-arrives', t: 0 })
})

test("a stage change while Fable walks in starts the new scene under the walk; the walk-in's end brings the auditor scene", () => {
  let d = withAuditing(createDirector('develop', false), true, T)
  d = withScene(d, 'claude-test', T + 1900)
  expect(shot(d, T + 1950)).toEqual({ base: 'claude-test', time: 0.05, reaction: { id: 'fable-arrives', t: 1.95 } })
  d = tick(d, T + 2000)
  expect(shot(d, T + 2000)).toEqual({ base: 'fable-audit', time: 0, reaction: null })
  expect(d.scene).toBe('claude-test')
})

test('a stage change while Fable walks out starts the new scene under the walk', () => {
  let d = tick(withAuditing(createDirector('develop', false), true, T), T + 2000)
  d = withAuditing(d, false, T + 3000)
  d = withScene(d, 'claude-test', T + 3500)
  expect(shot(d, T + 3650)).toEqual({ base: 'claude-test', time: 0.15, reaction: { id: 'fable-leaves', t: 0.65 } })
})

test('auditing turning on or off cuts a failure or advance short', () => {
  for (const id of ['failure', 'advance'] as const) {
    const on = withAuditing(react(restarted(createDirector('develop', false), T), id, T), true, T + 500)
    expect(shot(on, T + 500)).toEqual({ base: 'develop', time: 0.5, reaction: { id: 'fable-arrives', t: 0 } })
    let off = tick(withAuditing(createDirector('develop', false), true, T), T + 2000)
    off = withAuditing(react(off, id, T + 2100), false, T + 2500)
    expect(shot(off, T + 2500)).toEqual({ base: 'develop', time: 0, reaction: { id: 'fable-leaves', t: 0 } })
  }
})

test('a director made while auditing starts on the auditor scene, with no walk-in', () => {
  const d = restarted(createDirector('spec', true), T)
  expect(shot(d, T)).toEqual({ base: 'fable-audit', time: 0, reaction: null })
  expect(shot(tick(d, T + 5000), T + 5000)).toEqual({ base: 'fable-audit', time: 5, reaction: null })
})

test('a failure alone plays for 2.5 s', () => {
  const d = react(createDirector('plan', false), 'failure', T)
  expect(tick(d, T + 2499).reaction?.id).toBe('failure')
  expect(tick(d, T + 2500).reaction).toBeNull()
})

test("a held shot's reaction stops at its last moment; its scene's clock runs on", () => {
  const d = withAuditing(restarted(createDirector('develop', false), T), true, T)
  expect(heldShot(d, T + 1000)).toEqual(shot(d, T + 1000))
  expect(heldShot(d, T + 2400)).toEqual({ base: 'develop', time: 2.4, reaction: { id: 'fable-arrives', t: 2 } })
  const failing = react(restarted(createDirector('plan', false), T), 'failure', T)
  expect(heldShot(failing, T + 9000).reaction).toEqual({ id: 'failure', t: 2.5 })
})
