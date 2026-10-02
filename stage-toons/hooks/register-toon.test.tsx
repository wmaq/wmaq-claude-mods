import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { bandText, colorInRows, decode, endTurn, engine, mountSpinner, runStage, setStage, spawnAgent, SPINNER, START } from './harness'
import { C } from './scenes/kit'

test('the toon draws under the spinner on the terminal only', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountSpinner($)
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect(await ui.find({ key: 'toon' })).toBeDefined()
  await clock.advance(1000)
  expect(world.blits.length).toBeGreaterThan(8)
  expect(world.blits.at(-1)?.columns).toBe(48)
  expect(decode(world.blits.at(-1)?.cells ?? '')).toHaveLength(48 * 6 * 3)
  await ui.unmount()
  const desktop = await $.ui.mount({ plugin: 'stage-toons', surface: 'desktop', component: 'Spinner', props: SPINNER })
  expect(await desktop.find({ key: 'toon' })).toBeUndefined()
  await desktop.unmount()
})

test("a subagent's turn end keeps the toon going; the main turn's end stops it", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($)
  await clock.advance(300)
  const before = world.blits.length
  await endTurn($, 'agent-1')
  await clock.advance(300)
  expect(world.blits.length).toBeGreaterThan(before)
  await endTurn($)
  await clock.advance(100)
  const stopped = world.blits.length
  await clock.advance(1000)
  expect(world.blits.length).toBe(stopped)
})

test('the toon follows the terminal width and skips narrow terminals', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($, 80)
  await clock.advance(200)
  expect(world.blits.at(-1)?.columns).toBe(48)
  await mountSpinner($, 40)
  await clock.advance(200)
  expect(world.blits.at(-1)?.columns).toBe(34)
  const narrow = await mountSpinner($, 29)
  expect(await narrow.find({ key: 'toon' })).toBeUndefined()
})

test('a resize while the old raster still refuses blits does not stop the toon', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($, 80)
  await clock.advance(200)
  // The terminal narrows: the hook draws at the new width while the old
  // Raster is still mounted, so the engine refuses blits for a moment.
  world.isBlitRefused = true
  await mountSpinner($, 40)
  await clock.advance(500)
  world.isBlitRefused = false
  const before = world.blits.length
  await clock.advance(500)
  expect(world.blits.length).toBeGreaterThan(before)
  expect(world.blits.at(-1)?.columns).toBe(34)
})

test('/stage hide stops the toon', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($)
  await clock.advance(200)
  expect(world.blits.length).toBeGreaterThan(0)
  await runStage($, 'hide')
  await clock.advance(100)
  const stopped = world.blits.length
  await clock.advance(1000)
  expect(world.blits.length).toBe(stopped)
  const ui = await mountSpinner($)
  expect(await ui.find({ key: 'toon' })).toBeUndefined()
})

test("a background agent's spinner stops when that agent finishes", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($)
  await endTurn($)
  // The main turn is over; the agent still runs, with a spinner on its row.
  await mountSpinner($, undefined, 'agent-7')
  const before = world.blits.length
  await clock.advance(300)
  expect(world.blits.length).toBeGreaterThan(before)
  await endTurn($, 'agent-7')
  await clock.advance(100)
  const stopped = world.blits.length
  await clock.advance(60_000)
  expect(world.blits.length).toBe(stopped)
})

test('the toon gives up when the engine refuses its blits', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($)
  await clock.advance(200)
  expect(world.blits.length).toBeGreaterThan(0)
  world.isBlitRefused = true
  await clock.advance(1000)
  const stopped = world.blits.length
  await clock.advance(60_000)
  expect(world.blits.length).toBe(stopped)
})

test('a forward move makes Clawd jump; a backward move does not', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($)
  await setStage($, { stage: 'plan', message: 'Writing the plan' })
  await clock.advance(500)
  expect(colorInRows(world.blits.at(-1), [0, 1], CLAWD_ORANGE)).toBe(true)
  await clock.advance(3000)
  expect(colorInRows(world.blits.at(-1), [0, 1], CLAWD_ORANGE)).toBe(false)
  await setStage($, { stage: 'spec', message: 'Back to the spec' })
  await clock.advance(500)
  expect(colorInRows(world.blits.at(-1), [0, 1], CLAWD_ORANGE)).toBe(false)
})

test('a failed tool call flashes a red mark; a refused set_stage does not', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'tu-bash', input: { command: 'false' } } as never)
  await clock.advance(700)
  expect(colorInRows(world.blits.at(-1), [0, 1], C.red)).toBe(true)
  await clock.advance(4000)
  await setStage($, { stage: 'deploy', message: 'Shipping' })
  await clock.advance(700)
  expect(colorInRows(world.blits.at(-1), [0, 1], C.red)).toBe(false)
})

test('a Fable spawn brings Fable on stage and tags the band until every Fable agent completes', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountSpinner($)
  world.spawnModel = 'claude-fable-5-1'
  await spawnAgent($, 'fable')
  expect(await bandText($)).toContain('⌕ Fable reviewing')
  await clock.advance(2500)
  expect(colorInRows(world.blits.at(-1), [2, 3, 4, 5], FABLE_VIOLET)).toBe(true)
  await spawnAgent($, 'fable')
  await endTurn($, 'agent-1')
  expect(await bandText($)).toContain('⌕ Fable reviewing')
  await endTurn($, 'agent-2')
  expect(await bandText($)).not.toContain('Fable')
  await clock.advance(2500)
  expect(colorInRows(world.blits.at(-1), [2, 3, 4, 5], FABLE_VIOLET)).toBe(false)
})

test('a non-Fable spawn, or one that only inherits Fable from a Fable session, does nothing', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  await spawnAgent($)
  expect(await bandText($)).not.toContain('Fable')
  world.spawnModel = 'claude-fable-5-1'
  await spawnAgent($, undefined, 'claude-fable-5-1')
  expect(await bandText($)).not.toContain('Fable')
  // The same hook does tag a spawn that names Fable.
  await spawnAgent($, 'fable', 'claude-fable-5-1')
  expect(await bandText($)).toContain('⌕ Fable reviewing')
})

test('a killed Fable agent is cleared when the main turn ends', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.spawnModel = 'claude-fable-5-1'
  await spawnAgent($, 'fable')
  expect(await bandText($)).toContain('⌕ Fable reviewing')
  world.agents = [{ id: 'agent-1', description: 'Audit the plan', type: 'general-purpose', status: 'killed' }]
  await endTurn($)
  expect(await bandText($)).not.toContain('Fable')
})

test('a reload mid-audit clears the tag', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.spawnModel = 'claude-fable-5-1'
  await spawnAgent($, 'fable')
  expect(await bandText($)).toContain('⌕ Fable reviewing')
  await $.session.start(START)
  expect(await bandText($)).not.toContain('Fable')
})
