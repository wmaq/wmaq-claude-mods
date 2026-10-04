import { expect, test } from 'claude-code/testing'

import { bandProps, type Blit, blitsOf, colorInRows, endTurn, engine, mountBand, runStage, spawnAgent, START, type World } from './harness'
import { Z_COLOR } from './idle'
import { HELPER_COLORS } from './waiting'

const ALL_ROWS = [0, 1, 2, 3, 4, 5, 6]
const text = (answer: unknown) => (answer as { text?: string }).text ?? ''
const shows = (blit: Blit | undefined, kind: keyof typeof HELPER_COLORS) => colorInRows(blit, ALL_ROWS, HELPER_COLORS[kind])
const lastArea = (world: World) => blitsOf(world, 'area').at(-1)

test('a Sonnet spawn while Claude waits brings a magenta helper to the desk row', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  await clock.advance(500)
  expect(shows(lastArea(world), 'sonnet')).toBe(false)
  await spawnAgent($)
  await clock.advance(2000)
  expect(shows(lastArea(world), 'sonnet')).toBe(true)
  // The waiting toon moves briskly: about twelve frames a second.
  const before = blitsOf(world, 'area').length
  await clock.advance(1000)
  expect(blitsOf(world, 'area').length - before).toBeGreaterThanOrEqual(10)
})

test("each model's helper has its colour", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  for (const model of ['claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5', 'gpt-9']) {
    world.spawnModel = model
    await spawnAgent($)
  }
  await clock.advance(4000)
  for (const kind of ['opus', 'fable', 'haiku', 'unknown'] as const) expect(shows(lastArea(world), kind)).toBe(true)
})

test('an agent the list no longer shows walks off; Clawd goes back to idle, and dozes only a minute after that', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  await spawnAgent($)
  await clock.advance(50_000)
  expect(shows(lastArea(world), 'sonnet')).toBe(true)
  world.agents = []
  // A poll within 2 s, the hop and walk-off, Clawd's walk back.
  await clock.advance(6_000)
  expect(shows(lastArea(world), 'sonnet')).toBe(false)
  // 66 s after the session started, but under a minute since the period ended.
  await clock.advance(10_000)
  expect(colorInRows(lastArea(world), ALL_ROWS, Z_COLOR)).toBe(false)
  await clock.advance(60_000)
  expect(colorInRows(lastArea(world), ALL_ROWS, Z_COLOR)).toBe(true)
})

test("an agent's own turn ending sends its helper off at once, before any poll", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  await spawnAgent($)
  await clock.advance(3_000)
  expect(shows(lastArea(world), 'sonnet')).toBe(true)
  // The list still says running: the turn's end is taken over it.
  await endTurn($, 'agent-1')
  await clock.advance(1_800)
  expect(shows(lastArea(world), 'sonnet')).toBe(false)
})

test('an agent spawned while Claude works walks in when the turn ends', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', bandProps(100, { isWorking: true }))
  await spawnAgent($)
  await clock.advance(1_000)
  expect(await ui.find({ key: 'area' })).toBeUndefined()
  // The main turn ends, then the band draws Claude idle, as the engine does.
  await endTurn($)
  await ui.redraw(bandProps(100))
  await clock.advance(200)
  // Walking in from the right edge: not at its seat yet.
  expect(shows(lastArea(world), 'sonnet')).toBe(true)
  await clock.advance(2_000)
  expect(shows(lastArea(world), 'sonnet')).toBe(true)
})

test('a foreground agent that ends within the turn never shows; a nested spawn does', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', bandProps(100, { isWorking: true }))
  await spawnAgent($)
  await endTurn($, 'agent-1')
  world.agents = [{ id: 'agent-1', description: 'Audit', type: 'general-purpose', status: 'completed' }]
  await endTurn($)
  await ui.redraw(bandProps(100))
  await clock.advance(3_000)
  expect(blitsOf(world, 'area').some(b => shows(b, 'sonnet'))).toBe(false)
  world.spawnModel = 'claude-haiku-4-5'
  await spawnAgent($, undefined, 'claude-opus-5-5', { parentAgentId: 'agent-9' })
  await clock.advance(2_000)
  expect(shows(lastArea(world), 'haiku')).toBe(true)
})

test('after a reload, agents still at work are found and walk in as grey helpers', async ($, on) => {
  const { world, clock } = engine(on)
  world.agents = [{ id: 'old-1', description: 'Build', type: 'general-purpose', status: 'running' }]
  await $.session.start(START)
  await mountBand($)
  await clock.advance(2_000)
  expect(shows(lastArea(world), 'unknown')).toBe(true)
})

test('an idle teammate that works again gets its helper back within a poll', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  world.spawnModel = 'claude-haiku-4-5'
  await spawnAgent($)
  await clock.advance(2_000)
  world.agents = [{ id: 'agent-1', description: 'Mate', type: 'teammate', status: 'idle' }]
  await clock.advance(5_000)
  expect(shows(lastArea(world), 'haiku')).toBe(false)
  world.agents = [{ id: 'agent-1', description: 'Mate', type: 'teammate', status: 'running' }]
  await clock.advance(3_500)
  expect(shows(lastArea(world), 'haiku')).toBe(true)
})
test('/stage demo waiting plays the desk row, then the idle routine, then ends; it takes no seconds', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  expect(text(await runStage($, 'demo waiting'))).toBe('Playing the waiting toon (about 25 s). /stage demo stop ends it.')
  await ui.redraw()
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Waiting demo · /stage demo stop ends it')
  await clock.advance(9_000)
  for (const kind of ['sonnet', 'opus', 'fable', 'haiku'] as const) expect(shows(lastArea(world), kind)).toBe(true)
  await clock.advance(14_000)
  expect(shows(lastArea(world), 'unknown')).toBe(false)
  await clock.advance(3_000)
  await ui.redraw()
  expect((await ui.find({ key: 'stage-toons' }))?.text).not.toContain('Waiting demo')
  expect(text(await runStage($, 'demo waiting 5'))).toContain('Usage')
})

test('agents that arrive during /stage demo waiting walk in after it', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await runStage($, 'demo waiting')
  await ui.redraw()
  await clock.advance(22_000)
  world.spawnModel = 'claude-sonnet-5-5'
  await spawnAgent($)
  await clock.advance(1_000)
  // The demo's idle tail: no real helper drawn over it.
  expect(shows(lastArea(world), 'sonnet')).toBe(false)
  await clock.advance(3_000)
  await ui.redraw()
  await clock.advance(2_000)
  expect(shows(lastArea(world), 'sonnet')).toBe(true)
})
