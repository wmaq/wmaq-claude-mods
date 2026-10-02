import { expect, test } from 'claude-code/testing'

import { bandProps, blitsOf, colorInRows, endTurn, engine, mountBand, runStage, START } from './harness'
import { Z_COLOR } from './idle'

const text = (answer: unknown) => (answer as { text?: string }).text ?? ''

test('while Claude waits, the band shows the idle Clawd beside the bar', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  const idle = await ui.find({ key: 'idle' })
  expect(idle?.props).toMatchObject({ columns: 18, rows: 4 })
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Not tracked yet')
  await clock.advance(1000)
  expect(blitsOf(world, 'idle').length).toBeGreaterThanOrEqual(4)
  expect(blitsOf(world, 'idle').length).toBeLessThanOrEqual(8)
})

test('no idle Clawd while Claude works, in a narrow band, on the desktop, or hidden', async ($, on) => {
  engine(on)
  await $.session.start(START)
  for (const [surface, props] of [
    ['terminal', bandProps(100, { isWorking: true })],
    ['terminal', bandProps(69)],
    ['desktop', bandProps(100)],
  ] as const) {
    const ui = await mountBand($, surface, props)
    expect(await ui.find({ key: 'idle' })).toBeUndefined()
    expect(await ui.find({ key: 'stage-toons' })).toBeDefined()
    await ui.unmount()
  }
  await runStage($, 'hide')
  const hidden = await mountBand($)
  expect(await hidden.find({ key: 'idle' })).toBeUndefined()
})

test('the idle Clawd stops repainting when Claude starts working', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await clock.advance(500)
  await ui.redraw(bandProps(100, { isWorking: true }))
  await clock.advance(200)
  const stopped = blitsOf(world, 'idle').length
  await clock.advance(2000)
  expect(blitsOf(world, 'idle').length).toBe(stopped)
})

test('the idle Clawd dozes after a minute and is awake again after the next turn', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  await clock.advance(59_000)
  expect(colorInRows(blitsOf(world, 'idle').at(-1), [0, 1, 2, 3], Z_COLOR)).toBe(false)
  await clock.advance(3_000)
  expect(colorInRows(blitsOf(world, 'idle').at(-1), [0, 1, 2, 3], Z_COLOR)).toBe(true)
  await $.prompt.submit({ text: 'hi' } as never)
  await endTurn($)
  await clock.advance(500)
  expect(colorInRows(blitsOf(world, 'idle').at(-1), [0, 1, 2, 3], Z_COLOR)).toBe(false)
})

test('/stage demo plays every scene below the bar, then gives the band back', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  expect(text(await runStage($, 'demo 2'))).toContain('Playing 12 scenes, 2 s each')
  expect(world.invalidations).toBeGreaterThan(0)
  await ui.redraw()
  expect(await ui.find({ key: 'idle' })).toBeUndefined()
  expect((await ui.find({ key: 'demo' }))?.props).toMatchObject({ columns: 48, rows: 7 })
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Demo 1/12: Roadmap · /stage demo stop ends it')
  await clock.advance(2_500)
  expect(blitsOf(world, 'demo').length).toBeGreaterThan(20)
  await ui.redraw()
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Demo 2/12: Brainstorm')
  const before = world.invalidations
  await clock.advance(22_000)
  expect(world.invalidations).toBeGreaterThan(before)
  await ui.redraw()
  expect(await ui.find({ key: 'demo' })).toBeUndefined()
  expect(await ui.find({ key: 'idle' })).toBeDefined()
  expect((await ui.find({ key: 'stage-toons' }))?.text).not.toContain('Demo')
})

test('/stage demo stop, or a new prompt, ends the demo', async ($, on) => {
  engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await runStage($, 'demo')
  expect(text(await runStage($, 'demo stop'))).toContain('Demo stopped')
  await ui.redraw()
  expect(await ui.find({ key: 'demo' })).toBeUndefined()
  await runStage($, 'demo')
  await $.prompt.submit({ text: 'hi' } as never)
  await ui.redraw()
  expect(await ui.find({ key: 'demo' })).toBeUndefined()
  expect(text(await runStage($, 'demo stop'))).toContain('No demo is playing')
})

test('/stage demo plays nothing while hidden or off the terminal', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await runStage($, 'hide')
  expect(text(await runStage($, 'demo'))).toContain('/stage hide shows it')
  await runStage($, 'hide')
  await $.session.start({ ...START, surface: 'desktop' })
  expect(text(await runStage($, 'demo'))).toContain('terminal only')
})
