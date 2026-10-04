import { expect, test } from 'claude-code/testing'

import type { Progress } from '../types'
import { answerText, callTool, endTurn, engine, KEY, runStage, setStage, START, startTurn } from './harness'

const MIN = 60_000
const saved = (store: Record<string, unknown>) => store[KEY] as Progress
const text = (answer: unknown) => (answer as { text?: string }).text ?? ''

// Another session on the project moves the stage: its whole progress lands
// in the store, newer than this session's.
function theirMove(store: Record<string, unknown>, stage: string, at: number) {
  const p = saved(store)
  store[KEY] = { ...p, stage, lastTrackStage: stage, message: 'Theirs', history: [...p.history, { stage, at, by: 'user', feature: p.feature }], updatedAt: at }
}

test("a turn's end keeps another session's move made during it, and credits this session's time where it was spent", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  const start = saved(world.store).history[0]!.at
  await startTurn($)
  await clock.advance(5 * MIN)
  theirMove(world.store, 'plan', start + 5 * MIN)
  await clock.advance(5 * MIN)
  await endTurn($)
  const p = saved(world.store)
  expect(p.stage).toBe('plan')
  expect(p.history.map(h => [h.stage, h.by, h.workMs])).toEqual([
    ['spec', 'claude', 10 * MIN],
    ['plan', 'user', undefined],
  ])
  expect(text(await runStage($, ''))).toContain('Stage 5/10 Plan')
})

test("a move builds on another session's newer move instead of writing over it", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await clock.advance(MIN)
  theirMove(world.store, 'plan', saved(world.store).updatedAt + MIN)
  await clock.advance(MIN)
  expect(answerText(await setStage($, { stage: 'develop', message: 'Building' }))).toContain('7/10 Develop')
  expect(saved(world.store).history.map(h => h.stage)).toEqual(['spec', 'plan', 'develop'])
})

test('/stage moves build on it too', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await clock.advance(MIN)
  theirMove(world.store, 'plan', saved(world.store).updatedAt + MIN)
  await clock.advance(MIN)
  await runStage($, 'next')
  expect(saved(world.store).history.map(h => h.stage)).toEqual(['spec', 'plan', 'plan-audit'])
})

test("a turn's credit keeps another session's stage even when this session's workflow lacks it", async ($, on) => {
  const { world, clock } = engine(on)
  world.files['.claude/stage-toons.json'] = JSON.stringify({
    track: [
      { id: 'plan', label: 'Plan', message: 'Planning', when: 'planning', scenes: ['gift'] },
      { id: 'build', label: 'Build', message: 'Building', when: 'building', scenes: ['gift'] },
    ],
  })
  await $.session.start(START)
  await setStage($, { stage: 'plan', message: 'Planning' })
  await startTurn($)
  await clock.advance(5 * MIN)
  theirMove(world.store, 'develop', saved(world.store).updatedAt + 5 * MIN)
  await clock.advance(5 * MIN)
  await endTurn($)
  const p = saved(world.store)
  expect(p.stage).toBe('develop')
  expect(p.history.map(h => [h.stage, h.workMs])).toEqual([
    ['plan', 10 * MIN],
    ['develop', undefined],
  ])
})

test('adopting another session\'s move mid-turn leaves this turn\'s time with the entry it was spent in', async ($, on) => {
  const { world, clock } = engine(on)
  world.isBashFailing = false
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  await clock.advance(5 * MIN)
  theirMove(world.store, 'plan', saved(world.store).updatedAt + 5 * MIN)
  // A call the rules read: the other session's copy is adopted, nothing moves.
  await callTool($, 'Bash', { command: 'ls' })
  await clock.advance(5 * MIN)
  await endTurn($)
  expect(saved(world.store).history.map(h => [h.stage, h.workMs])).toEqual([
    ['spec', 10 * MIN],
    ['plan', undefined],
  ])
})

test("/stage shows another session's move without waiting for a prompt", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await clock.advance(MIN)
  theirMove(world.store, 'plan', saved(world.store).updatedAt + MIN)
  expect(text(await runStage($, ''))).toContain('Stage 5/10 Plan')
})

test('a session prunes projects untouched for months, at most once a week', async ($, on) => {
  const DAY = 86_400_000
  const old = { v: 2, stage: 'plan', lastTrackStage: 'plan', feature: null, message: 'm', history: [], updatedAt: 0 }
  const { world, clock } = engine(on, { store: { 'progress:/old': old, hidden: false } })
  await clock.advance(181 * DAY)
  await $.session.start(START)
  expect('progress:/old' in world.store).toBe(false)
  expect(world.store.hidden).toBe(false)
  expect(typeof world.store['pruned-at']).toBe('number')
  // Within the week, nothing is pruned again.
  world.store['progress:/old2'] = old
  await clock.advance(DAY)
  await $.session.start(START)
  expect('progress:/old2' in world.store).toBe(true)
})
