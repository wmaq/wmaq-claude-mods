import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { bandProps, blitsOf, colorInRows, endTurn, engine, mountBand, mountSpinner, runStage, setStage, spawnAgent, START, type World } from './harness'
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

test('the area dissolves from the idle Clawd into the scene when Claude starts, and back when he stops', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await clock.advance(500)
  await ui.redraw(WORKING)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'tu-bash', input: { command: 'false' } } as never)
  await clock.advance(700)
  expect(colorInRows(lastArea(world), [0, 1], C.red)).toBe(true)
  const scene = lastArea(world)?.cells
  // Claude stops while the red mark still shows: the scene, mark and all,
  // dissolves into the idle Clawd over half a second, at twelve frames a
  // second.
  await endTurn($)
  await ui.redraw(bandProps(100))
  const cells = String((await ui.find({ key: 'area' }))?.props.cells ?? '')
  expect(cells).not.toBe('')
  expect(colorInRows({ key: 'area', cells, columns: 48, rows: 7 }, [0, 1], C.red)).toBe(true)
  const before = blitsOf(world, 'area').length
  await clock.advance(600)
  expect(blitsOf(world, 'area').length - before).toBeGreaterThanOrEqual(5)
  expect(lastArea(world)?.cells).not.toBe(scene)
  expect(colorInRows(lastArea(world), [0, 1], C.red)).toBe(false)
})

test('a turn starts its scene from the beginning even while the area was away, and the area comes back dissolving from what it last showed', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'plan', message: 'Writing the plan' })
  // The move's jump is over before the turn starts.
  await clock.advance(5000)
  const ui = await mountBand($, 'terminal', WORKING)
  // The scene, at 83 ms steps from its start.
  const firstTurn: string[] = []
  for (let k = 0; k <= 24; k++) {
    firstTurn.push(lastArea(world)?.cells ?? '')
    await clock.advance(83)
  }
  // The bar alone (too few rows for the area) from mid-turn, through the
  // turn's end and the next turn's start.
  const SHORT = { maxRows: 7 }
  await ui.redraw(bandProps(100, { isWorking: true, ...SHORT }))
  await endTurn($)
  await ui.redraw(bandProps(100, SHORT))
  await clock.advance(3000)
  await ui.redraw(bandProps(100, { isWorking: true, ...SHORT }))
  await clock.advance(830)
  // The area again, 830 ms into the turn: it dissolves from the first
  // turn's scene into this turn's, which started with the turn.
  await ui.redraw(WORKING)
  const back = [String((await ui.find({ key: 'area' }))?.props.cells ?? '')]
  for (let m = 1; m <= 12; m++) {
    await clock.advance(83)
    back.push(lastArea(world)?.cells ?? '')
  }
  // The scene moves (so the match below is no accident), a mid-dissolve
  // frame is neither turn's scene, and the dissolved-in frames are the
  // first turn's at the same scene time.
  expect(new Set(firstTurn.slice(17)).size).toBeGreaterThan(1)
  expect(back[3]).not.toBe(firstTurn[13])
  for (let m = 7; m <= 12; m++) expect(back[m]).toBe(firstTurn[10 + m])
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

test("the area follows the band's width while Claude works", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', bandProps(40, { isWorking: true }))
  expect((await ui.find({ key: 'area' }))?.props).toMatchObject({ columns: 39, rows: 7 })
  await clock.advance(300)
  expect(lastArea(world)?.columns).toBe(39)
})

test("the spinner is Claude Code's own: no toon under it, the main one or an agent's", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  for (const id of [undefined, 'agent-1']) {
    const ui = await mountSpinner($, 100, id)
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    expect(await ui.find({ key: 'toon' })).toBeUndefined()
    await ui.unmount()
  }
  await clock.advance(1000)
  expect(world.blits.filter(b => b.key !== 'area')).toHaveLength(0)
})

test('the area stops painting once a newer load of the module has taken over the session', async ($, on) => {
  // What a hot reload leaves: the session's load id is another load's.
  let newer: string | null = null
  on('state.get', ($, e, next) => (e.key === 'loadId' && newer !== null ? { value: { value: newer, version: 99 } } : next(e)))
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', WORKING)
  await clock.advance(500)
  const painted = blitsOf(world, 'area').length
  const redraws = world.invalidations
  expect(painted).toBeGreaterThan(0)
  newer = 'a newer load'
  await clock.advance(2000)
  expect(blitsOf(world, 'area').length).toBe(painted)
  expect(world.invalidations).toBe(redraws)
})
