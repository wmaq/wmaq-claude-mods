import { expect, test } from 'claude-code/testing'

import { bandProps, blitsOf, colorInRows, endTurn, engine, mountBand, runStage, START } from './harness'
import { Z_COLOR } from './idle'
import { C } from './scenes/kit'

const text = (answer: unknown) => (answer as { text?: string }).text ?? ''

test('while Claude waits, the band shows the idle Clawd beside the bar', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  const idle = await ui.find({ key: 'idle' })
  expect(idle?.props).toMatchObject({ columns: 26, rows: 4 })
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Not tracked yet')
  // A blank row keeps Clawd off the transcript's last line.
  expect((await ui.find({ key: 'idle-row' }))?.props).toMatchObject({ marginTop: 1 })
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

test('the idle routine is picked at the prompt that starts a turn, not at one typed during it', async ($, on) => {
  let writes = 0
  on('state.set', ($, e, next) => {
    if ((e as unknown as { key: string }).key === 'idle') writes += 1

    return next(e)
  })
  engine(on)
  await $.session.start(START)
  const atStart = writes
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  expect(writes).toBe(atStart + 1)
  await $.prompt.submit({ text: 'more', wait: false, origin: { kind: 'composer' }, turnId: 't1' } as never)
  expect(writes).toBe(atStart + 1)
})

test('/stage demo plays every scene below the bar, then gives the band back', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  expect(text(await runStage($, 'demo 2'))).toContain('Playing 37 scenes, 2 s each')
  expect(world.invalidations).toBeGreaterThan(0)
  await ui.redraw()
  expect(await ui.find({ key: 'idle' })).toBeUndefined()
  expect((await ui.find({ key: 'demo' }))?.props).toMatchObject({ columns: 48, rows: 7 })
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Demo 1/37: road-trip (Roadmap) · /stage demo stop ends it')
  // The line under the bar is text: the band is drawn again for each scene.
  const started = world.invalidations
  await clock.advance(1_500)
  expect(world.invalidations).toBe(started)
  await clock.advance(1_000)
  expect(world.invalidations).toBe(started + 1)
  expect(blitsOf(world, 'demo').length).toBeGreaterThan(20)
  await ui.redraw()
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Demo 2/37: stargazing (Roadmap)')
  const before = world.invalidations
  await clock.advance(72_000)
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

test('a band whose blits keep being refused asks to be drawn again, and then animates', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await clock.advance(500)
  world.isBlitRefused = true
  const before = world.invalidations
  await clock.advance(1500)
  expect(world.invalidations).toBeGreaterThan(before)
  world.isBlitRefused = false
  await ui.redraw()
  const after = blitsOf(world, 'idle').length
  await clock.advance(1000)
  expect(blitsOf(world, 'idle').length).toBeGreaterThan(after + 3)
})

test('the idle Clawd starts awake when the band stops working, before the turn is reported', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', bandProps(100, { isWorking: true }))
  await clock.advance(70_000)
  await ui.redraw(bandProps(100))
  const cells = String((await ui.find({ key: 'idle' }))?.props.cells ?? '')
  expect(cells).not.toBe('')
  expect(colorInRows({ key: 'idle', cells, columns: 26, rows: 4 }, [0, 1, 2, 3], Z_COLOR)).toBe(false)
})

test('/stage demo says so when the band has no room for it', async ($, on) => {
  engine(on)
  await $.session.start(START)
  const narrow = await mountBand($, 'terminal', bandProps(29))
  expect(text(await runStage($, 'demo'))).toContain('no room')
  await narrow.unmount()
  const short = await mountBand($, 'terminal', bandProps(100, { maxRows: 8 }))
  expect(text(await runStage($, 'demo'))).toContain('no room')
  await short.unmount()
})

test('/stage demo while one plays starts it over, and says so', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await mountBand($)
  await runStage($, 'demo')
  expect(text(await runStage($, 'demo 5'))).toContain('Restarting the demo')
})

test('/stage lists demo where it is registered', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  expect(world.commands.at(-1)?.argumentHint).toContain('demo')
  expect(world.commands.at(-1)?.description).toContain('demo')
})

test('the idle routine is picked at session start and again when a turn starts, never during a render', async ($, on) => {
  const picks: string[] = []
  on('state.set', ($, e, next) => {
    const write = e as unknown as { key: string; value: unknown }
    if (write.key === 'idle') picks.push(String(write.value))

    return next(e)
  })
  engine(on)
  await $.session.start(START)
  expect(picks).toHaveLength(1)
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  expect(picks).toHaveLength(2)
  expect(picks[1]).not.toBe(picks[0])
  const ui = await mountBand($, 'terminal', bandProps(100, { isWorking: true }))
  await ui.redraw(bandProps(100))
  expect(picks).toHaveLength(2)
})

test('the routine picked at a prompt shows only from the next idle period, not at Enter', async ($, on) => {
  // Session start finds classic; later reads see what the mod writes.
  let isFirstRead = true
  on('state.get', ($, e, next) => {
    if (e.key !== 'idle' || !isFirstRead) return next(e)
    isFirstRead = false

    return { value: { value: 'classic', version: 0 } }
  })
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  await clock.advance(500)
  // Nyan's rainbow has the only orange of the two routines.
  const isNyan = () => colorInRows(blitsOf(world, 'idle').at(-1), [0, 1, 2, 3], C.orange)
  expect(isNyan()).toBe(false)
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  const before = blitsOf(world, 'idle').length
  await clock.advance(500)
  expect(blitsOf(world, 'idle').length).toBeGreaterThan(before)
  expect(isNyan()).toBe(false)
  await endTurn($)
  await clock.advance(500)
  expect(isNyan()).toBe(true)
})

test('a hot reload keeps the idle routine', async ($, on) => {
  const picks: string[] = []
  on('state.get', ($, e, next) => (e.key === 'idle' ? { value: { value: 'nyan', version: 1 } } : next(e)))
  on('state.set', ($, e, next) => {
    const write = e as unknown as { key: string; value: unknown }
    if (write.key === 'idle') picks.push(String(write.value))

    return next(e)
  })
  engine(on)
  await $.session.start(START)
  expect(picks).toHaveLength(0)
})
