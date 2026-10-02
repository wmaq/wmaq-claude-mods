import { expect, test } from 'claude-code/testing'

import { createDirector, react, shot, tick, withAuditing, withStage } from './director'

const T = 1_000_000

test('the base scene follows the stage, with a wipe on a stage change', () => {
  let d = createDirector('spec', false)
  expect(shot(d, T)).toEqual({ base: 'spec', wipe: null, reaction: null })
  d = withStage(d, 'plan', T)
  expect(shot(d, T + 150)).toEqual({ base: 'plan', wipe: { from: 'spec', progress: 0.5 }, reaction: null })
  d = tick(d, T + 300)
  expect(shot(d, T + 300).wipe).toBeNull()
})

test('Fable walks in over the stage scene, then the auditor scene takes over, and Fable walks out', () => {
  let d = withAuditing(createDirector('develop', false), true, T)
  expect(shot(d, T + 500)).toEqual({ base: 'develop', wipe: null, reaction: { id: 'fable-arrives', t: 0.5 } })
  d = tick(d, T + 2000)
  expect(shot(d, T + 2000)).toEqual({ base: 'auditor', wipe: null, reaction: null })
  d = withAuditing(d, false, T + 5000)
  expect(shot(d, T + 5000)).toEqual({ base: 'develop', wipe: null, reaction: { id: 'fable-leaves', t: 0 } })
  d = tick(d, T + 7000)
  expect(shot(d, T + 7000)).toEqual({ base: 'develop', wipe: null, reaction: null })
})

test('Fable reactions are never cut short, and failures during them are dropped', () => {
  let d = withAuditing(createDirector('develop', false), true, T)
  d = react(d, 'failure', T + 100)
  expect(d.reaction?.id).toBe('fable-arrives')
  d = withAuditing(d, false, T + 200)
  expect(d.reaction?.id).toBe('fable-arrives')
  d = tick(d, T + 2000)
  expect(shot(d, T + 2000)).toEqual({ base: 'develop', wipe: null, reaction: { id: 'fable-leaves', t: 0 } })
})

test('a new failure or advance replaces the one playing, and both expire', () => {
  let d = react(createDirector('plan', false), 'failure', T)
  d = react(d, 'advance', T + 100)
  expect(shot(d, T + 100).reaction).toEqual({ id: 'advance', t: 0 })
  d = tick(d, T + 3100)
  expect(d.reaction).toBeNull()
})

test('a stage change while the auditor scene shows keeps it and wipes nothing', () => {
  let d = tick(withAuditing(createDirector('spec', false), true, T), T + 2000)
  d = withStage(d, 'spec-audit', T + 2100)
  expect(shot(d, T + 2100)).toEqual({ base: 'auditor', wipe: null, reaction: null })
  d = withAuditing(d, false, T + 3000)
  expect(shot(d, T + 3000).base).toBe('spec-audit')
})

test('auditing again while Fable walks out brings Fable back once the exit ends', () => {
  let d = tick(withAuditing(createDirector('plan', false), true, T), T + 2000)
  d = withAuditing(d, false, T + 2500)
  d = withAuditing(d, true, T + 3000)
  expect(d.reaction?.id).toBe('fable-leaves')
  d = tick(d, T + 4500)
  expect(shot(d, T + 4500).reaction).toEqual({ id: 'fable-arrives', t: 0 })
})
