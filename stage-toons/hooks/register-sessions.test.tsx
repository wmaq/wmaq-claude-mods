import { expect, test } from 'claude-code/testing'

import type { Progress } from '../types'
import { answerText, endTurn, engine, KEY, runStage, setStage, START, startTurn } from './harness'

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
