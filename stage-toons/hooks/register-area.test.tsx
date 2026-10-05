import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { bandProps, blitsOf, colorInRows, endTurn, engine, mountBand, runStage, setStage, spawnAgent, START, type World } from './harness'
import { DEEP_SLEEP_MS, DOZE_MS } from './idle'
import { C } from './scenes/kit'

// The stage's scene plays in the band's area while Claude works.
const WORKING = bandProps(100, { isWorking: true })
const lastArea = (world: World) => blitsOf(world, 'area').at(-1)

test('while Claude works, the area plays the stage scene: a forward move makes Clawd jump there, a backward move does not', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', WORKING)
  await setStage($, { stage: 'plan', message: 'Writing the plan' })
  await clock.advance(500)
  expect(lastArea(world)?.columns).toBe(48)
  expect(colorInRows(lastArea(world), [0, 1, 2], CLAWD_ORANGE)).toBe(true)
  await clock.advance(3000)
  expect(colorInRows(lastArea(world), [0, 1, 2], CLAWD_ORANGE)).toBe(false)
  await setStage($, { stage: 'spec', message: 'Back to the spec' })
  await clock.advance(500)
  expect(colorInRows(lastArea(world), [0, 1, 2], CLAWD_ORANGE)).toBe(false)
})

test('a failed tool call flashes a red mark in the area; a refused set_stage does not', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', WORKING)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'tu-bash', input: { command: 'false' } } as never)
  await clock.advance(700)
  expect(colorInRows(lastArea(world), [0, 1], C.red)).toBe(true)
  await clock.advance(4000)
  await setStage($, { stage: 'deploy', message: 'Shipping' })
  await clock.advance(700)
  expect(colorInRows(lastArea(world), [0, 1], C.red)).toBe(false)
})

test('a Fable spawn walks Fable into the area and tags the bar until the Fable agent completes', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', WORKING)
  world.spawnModel = 'claude-fable-5-1'
  await spawnAgent($, 'fable')
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('⌕ Fable reviewing')
  await clock.advance(2500)
  expect(colorInRows(lastArea(world), [2, 3, 4, 5], FABLE_VIOLET)).toBe(true)
  await endTurn($, 'agent-1')
  expect((await ui.find({ key: 'stage-toons' }))?.text).not.toContain('Fable')
  await clock.advance(2500)
  expect(colorInRows(lastArea(world), [2, 3, 4, 5], FABLE_VIOLET)).toBe(false)
})

test('the area cuts from the idle Clawd to the scene when Claude starts, and back when he stops', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await clock.advance(500)
  await ui.redraw(WORKING)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'tu-bash', input: { command: 'false' } } as never)
  await clock.advance(700)
  expect(colorInRows(lastArea(world), [0, 1], C.red)).toBe(true)
  const scene = lastArea(world)?.cells
  // Claude stops while the red mark still shows: the Raster is drawn
  // again at once with the idle Clawd.
  await endTurn($)
  await ui.redraw(bandProps(100))
  const cells = String((await ui.find({ key: 'area' }))?.props.cells ?? '')
  expect(cells).not.toBe('')
  expect(cells).not.toBe(scene)
  expect(colorInRows({ key: 'area', cells, columns: 48, rows: 7 }, [0, 1], C.red)).toBe(false)
})

test('a demo started while Claude works plays over the scene; the scene comes back when it ends', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', WORKING)
  await runStage($, 'demo idle')
  await ui.redraw(WORKING)
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('demo 1/')
  await clock.advance(1000)
  await runStage($, 'demo stop')
  await ui.redraw(WORKING)
  expect((await ui.find({ key: 'stage-toons' }))?.text).not.toContain('demo 1/')
  await setStage($, { stage: 'plan', message: 'Writing the plan' })
  await clock.advance(500)
  expect(colorInRows(lastArea(world), [0, 1, 2], CLAWD_ORANGE)).toBe(true)
})

test('a deep-asleep area wakes when Claude starts working', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await clock.advance(DOZE_MS + DEEP_SLEEP_MS + 10_000)
  const asleep = blitsOf(world, 'area').length
  await clock.advance(10_000)
  expect(blitsOf(world, 'area').length).toBe(asleep)
  await ui.redraw(WORKING)
  await clock.advance(5000)
  expect(blitsOf(world, 'area').length).toBeGreaterThan(asleep)
})

test('in a band too short for the area, the bar shows alone while Claude works', async ($, on) => {
  engine(on)
  await $.session.start(START)
  // Untracked, the bar is one line: the area needs 8 rows.
  const ui = await mountBand($, 'terminal', bandProps(100, { isWorking: true, maxRows: 7 }))
  expect(await ui.find({ key: 'area' })).toBeUndefined()
  expect(await ui.find({ key: 'stage-toons' })).toBeDefined()
})
