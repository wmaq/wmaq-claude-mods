import type { On } from 'claude-code'
import { type Engine, expect, test } from 'claude-code/testing'

import type { Progress } from '../types'
import { engine, KEY, runStage, setStage, START, startTurn } from './harness'
import { validate } from './progress'

const MIN = 60_000
const saved = (store: Record<string, unknown>) => validate(store[KEY]) as Progress
const text = (answer: unknown) => (answer as { text?: string }).text ?? ''

// The session's cost as $.session.usage() answers it: a figure, no cost
// (a host with no ledger), or a failure.
type Ledger = { usd: number | undefined; isBroken: boolean; reads: number }

function ledger(on: On, usd?: number): Ledger {
  const l: Ledger = { usd, isBroken: false, reads: 0 }
  on('session.usage', () => {
    l.reads += 1
    if (l.isBroken) throw new Error('no usage')

    return { value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [], ...(l.usd === undefined ? {} : { cost: { usd: l.usd } }) } }
  })

  return l
}

const usage = (input: number, output: number, cacheRead = 0, cacheWrite = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheWrite,
  model: 'claude-opus-5-5',
})

// A turn's end with what it counted, the main conversation's or a subagent's.
const endTurn = ($: Engine, counted?: ReturnType<typeof usage>, agentId?: string, durationMs = 1) =>
  $.turn.complete({ answer: '', durationMs, isAborted: false, turnId: 't', reason: 'end_turn', ...(counted ? { usage: counted } : {}), ...(agentId ? { agentId } : {}) } as never)

test("a main turn's and its subagents' tokens go to the entry with its working time, the dollars since the last credit too", async ($, on) => {
  const { world, clock } = engine(on)
  const l = ledger(on, 1)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  await clock.advance(5 * MIN)
  await endTurn($, usage(100, 10, 1000, 50), 'agent-1')
  l.usd = 1.75
  await endTurn($, usage(200, 40))
  expect(saved(world.store).history[0]).toEqual(expect.objectContaining({ stage: 'spec', workMs: 5 * MIN, cost: { usd: 0.75, in: 1350, out: 50 } }))
  // The next turn: only what came since.
  await startTurn($)
  l.usd = 2
  await endTurn($, usage(10, 5))
  const cost = saved(world.store).history[0]!.cost!
  expect([Math.round(cost.usd * 100), cost.in, cost.out]).toEqual([100, 1360, 55])
  expect(text(await runStage($, 'log'))).toContain('(Claude 5m · $1.00 · 1.4k in, 55 out)')
})

test('a session.usage that fails, or has no cost, credits the tokens alone', async ($, on) => {
  const { world } = engine(on)
  const l = ledger(on, 1)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  l.isBroken = true
  await endTurn($, usage(100, 10))
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0, in: 100, out: 10 })
  await startTurn($)
  l.isBroken = false
  l.usd = undefined
  await endTurn($, usage(1, 1))
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0, in: 101, out: 11 })
  // The baseline stood through both: the dollars since 1 come with the next.
  await startTurn($)
  l.usd = 1.5
  await endTurn($)
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0.5, in: 101, out: 11 })
})

test("dollars spent before the session started are not this history's", async ($, on) => {
  const { world } = engine(on)
  const l = ledger(on, 40)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  l.usd = 40.5
  await endTurn($)
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0.5, in: 0, out: 0 })
})

test("an untracked turn's dollars move the baseline: they never pile onto a later entry", async ($, on) => {
  const { world } = engine(on)
  const l = ledger(on, 1)
  await $.session.start(START)
  await startTurn($)
  l.usd = 2
  await endTurn($, usage(100, 10))
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  l.usd = 2.5
  await endTurn($, usage(5, 1))
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0.5, in: 5, out: 1 })
})

test('a ledger that restarts (a cost below the baseline) starts the baseline again and credits no dollars', async ($, on) => {
  const { world } = engine(on)
  const l = ledger(on, 3)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  l.usd = 0.4
  await endTurn($, usage(5, 1))
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0, in: 5, out: 1 })
  await startTurn($)
  l.usd = 0.9
  await endTurn($)
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0.5, in: 5, out: 1 })
})

// The baselines the mod writes to $.state, each value once (a write the
// kit retries shows once); given one, the baseline an earlier load of the
// mod left there, read until this load writes its own.
function baselines(on: On, earlier?: number): unknown[] {
  const written: unknown[] = []
  on('state.set', ($, e, next) => {
    const set = e as unknown as { key: string; value: unknown }
    if (set.key === 'usdCredited' && written.at(-1) !== set.value) written.push(set.value)

    return next(e)
  })
  if (earlier !== undefined) on('state.get', ($, e, next) => (e.key === 'usdCredited' && written.length === 0 ? { value: { value: earlier, version: 1 } } : next(e)))

  return written
}

test('a hot reload keeps the baseline an earlier load left: the dollars since then, once', async ($, on) => {
  const { world } = engine(on)
  // The earlier load credited up to $2; the session has cost $2.50 since.
  const written = baselines(on, 2)
  const l = ledger(on, 2.5)
  await $.session.start(START)
  expect(written).toEqual([])
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  l.usd = 2.75
  await endTurn($)
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0.75, in: 0, out: 0 })
  expect(written).toEqual([2.75])
})

test("a session start that finds the session's cost below the baseline kept (a restarted ledger) starts it again there", async ($, on) => {
  const { world } = engine(on)
  const written = baselines(on, 5)
  const l = ledger(on, 0.25)
  await $.session.start(START)
  expect(written).toEqual([0.25])
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  l.usd = 1
  await endTurn($)
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0.75, in: 0, out: 0 })
})

test('a fresh session starts the baseline at its cost, and with no cost leaves it unknown until a turn ends', async ($, on) => {
  const { world } = engine(on)
  const written = baselines(on)
  const l = ledger(on)
  await $.session.start(START)
  expect(written).toEqual([])
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  // The first figure only starts the baseline: what came before it is unknown.
  l.usd = 3
  await endTurn($, usage(1, 1))
  expect(saved(world.store).history[0]!.cost).toEqual({ usd: 0, in: 1, out: 1 })
  expect(written).toEqual([3])
})

test("a background agent's turn that ends after the main turn's goes to the next main turn's entry", async ($, on) => {
  const { world } = engine(on)
  ledger(on, 0)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  await endTurn($, usage(10, 1))
  await endTurn($, usage(500, 50), 'agent-1')
  await setStage($, { stage: 'plan', message: 'Planning' })
  await startTurn($)
  await endTurn($, usage(20, 2))
  expect(saved(world.store).history.map(h => [h.stage, h.cost])).toEqual([
    ['spec', { usd: 0, in: 10, out: 1 }],
    ['plan', { usd: 0, in: 520, out: 52 }],
  ])
})

test('a turn with tokens and no working time still credits its tokens', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  // Its start missed, and no duration: no time to credit.
  await endTurn($, usage(7, 3), undefined, 0)
  expect(saved(world.store).history[0]).toEqual(expect.objectContaining({ cost: { usd: 0, in: 7, out: 3 } }))
  expect(saved(world.store).history[0]!.workMs).toBeUndefined()
})

test("a hot reload keeps the subagent tokens an earlier load counted: they go to the main turn's entry", async ($, on) => {
  const { world } = engine(on)
  ledger(on, 1)
  // The earlier load heard a subagent's turn end (300 in, 30 out) before the main turn's.
  let isWritten = false
  on('state.set', ($, e, next) => {
    if ((e as unknown as { key: string }).key === 'turnTokens') isWritten = true

    return next(e)
  })
  on('state.get', ($, e, next) => (e.key === 'turnTokens' && !isWritten ? { value: { value: { usd: 0, in: 300, out: 30 }, version: 0 } } : next(e)))
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await startTurn($)
  await endTurn($, usage(100, 10, 0, 0), 'agent-1')
  await endTurn($, usage(200, 40))
  expect(saved(world.store).history[0]!.cost).toEqual(expect.objectContaining({ in: 600, out: 80 }))
  // Credited once: the next turn starts from nothing.
  await startTurn($)
  await endTurn($, usage(1, 1))
  expect(saved(world.store).history[0]!.cost).toEqual(expect.objectContaining({ in: 601, out: 81 }))
})
