import { expect, test } from 'claude-code/testing'

import { bandProps, type Blit, blitsOf, colorInRows, decode, endTurn, engine, mountBand, runStage, setStage, spawnAgent, START } from './harness'
import { DEEP_SLEEP_MS, DOZE_MS, Z_COLOR } from './idle'

// The area's cells left of the idle Clawd, columns 0 to 10, are all blank.
function isLeftBlank(blit: Blit | undefined): boolean {
  if (!blit) return false
  const words = decode(blit.cells)
  for (let row = 0; row < blit.rows; row++) for (let x = 0; x <= 10; x++) if (words[(row * blit.columns + x) * 3] !== 0x20) return false

  return true
}

const text = (answer: unknown) => (answer as { text?: string }).text ?? ''
const ALL_ROWS = [0, 1, 2, 3, 4, 5, 6]

test('while Claude waits, the band shows the idle Clawd in the area below the bar', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  expect((await ui.find({ key: 'area' }))?.props).toMatchObject({ columns: 99, rows: 9 })
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Not tracked yet')
  await clock.advance(1000)
  // The idle Clawd is calm: about six frames a second, of which only those
  // that change are sent.
  expect(blitsOf(world, 'area').length).toBeGreaterThanOrEqual(1)
  expect(blitsOf(world, 'area').length).toBeLessThanOrEqual(8)
  const sent = blitsOf(world, 'area').map(b => b.cells)
  expect(sent.every((cells, i) => i === 0 || cells !== sent[i - 1])).toBe(true)
  // His box sits at the bottom-left: no Clawd on the area's top three rows
  // (Nyan's stars, if Nyan was picked, may be there).
  expect(colorInRows(blitsOf(world, 'area').at(-1), [0, 1, 2], 0xd97757)).toBe(false)
  expect(colorInRows(blitsOf(world, 'area').at(-1), [4, 5, 6], 0xd97757)).toBe(true)
})

test('the bar keeps the full width while Claude waits', async ($, on) => {
  engine(on)
  await $.session.start(START)
  // Beside the old idle box the bar had 72 columns, and dropped a feature
  // of 40 (the longest); it has all 100 now.
  await setStage($, { stage: 'plan', message: 'Planning', feature: 'f'.repeat(40) })
  const ui = await mountBand($)
  expect(await ui.find({ key: 'area' })).toBeDefined()
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain(`5/10 Plan · ${'f'.repeat(40)}`)
})

test('no area in a narrow band, a short one, on the desktop, or hidden', async ($, on) => {
  engine(on)
  await $.session.start(START)
  for (const [surface, props] of [
    ['terminal', bandProps(29)],
    // Untracked, the bar is one line: the area needs 8 rows.
    ['terminal', bandProps(100, { maxRows: 7 })],
    ['desktop', bandProps(100)],
  ] as const) {
    const ui = await mountBand($, surface, props)
    expect(await ui.find({ key: 'area' })).toBeUndefined()
    expect(await ui.find({ key: 'stage-toons' })).toBeDefined()
    await ui.unmount()
  }
  await runStage($, 'hide')
  const hidden = await mountBand($)
  expect(await hidden.find({ key: 'area' })).toBeUndefined()
})

test('when Claude starts working the area goes on repainting, on the same Raster', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await clock.advance(2500)
  // It was repainting before Claude started.
  expect(blitsOf(world, 'area').length).toBeGreaterThan(0)
  await ui.redraw(bandProps(100, { isWorking: true }))
  expect((await ui.find({ key: 'area' }))?.props).toMatchObject({ columns: 99, rows: 9 })
  await clock.advance(200)
  const before = blitsOf(world, 'area').length
  await clock.advance(2000)
  expect(blitsOf(world, 'area').length).toBeGreaterThan(before)
})

test('the idle Clawd dozes after a minute and is awake again after the next turn', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  await clock.advance(59_000)
  expect(colorInRows(blitsOf(world, 'area').at(-1), ALL_ROWS, Z_COLOR)).toBe(false)
  await clock.advance(3_000)
  expect(colorInRows(blitsOf(world, 'area').at(-1), ALL_ROWS, Z_COLOR)).toBe(true)
  await $.prompt.submit({ text: 'hi' } as never)
  await endTurn($)
  // The doze dissolves into the awake Clawd over half a second.
  await clock.advance(600)
  expect(colorInRows(blitsOf(world, 'area').at(-1), ALL_ROWS, Z_COLOR)).toBe(false)
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
  expect(text(await runStage($, 'demo 2'))).toContain('Playing 38 scenes, 2 s each')
  expect(world.invalidations).toBeGreaterThan(0)
  await ui.redraw()
  expect((await ui.find({ key: 'area' }))?.props).toMatchObject({ columns: 99, rows: 8 })
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Demo 1/38: road-trip (Roadmap) · /stage demo stop ends it')
  // The line under the bar is text: the band is drawn again for each scene.
  const started = world.invalidations
  await clock.advance(1_500)
  expect(world.invalidations).toBe(started)
  await clock.advance(1_000)
  expect(world.invalidations).toBe(started + 1)
  // Scenes move: about half their frames are new, and only those are sent.
  expect(blitsOf(world, 'area').length).toBeGreaterThan(10)
  await ui.redraw()
  expect((await ui.find({ key: 'stage-toons' }))?.text).toContain('Demo 2/38: stargazing (Roadmap)')
  const before = world.invalidations
  await clock.advance(74_000)
  expect(world.invalidations).toBeGreaterThan(before)
  await ui.redraw()
  expect(await ui.find({ key: 'area' })).toBeDefined()
  expect((await ui.find({ key: 'stage-toons' }))?.text).not.toContain('Demo')
})

test('/stage demo stop, or a new prompt, ends the demo', async ($, on) => {
  engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await runStage($, 'demo')
  expect(text(await runStage($, 'demo stop'))).toContain('Demo stopped')
  await ui.redraw()
  expect((await ui.find({ key: 'stage-toons' }))?.text).not.toContain('Demo')
  await runStage($, 'demo')
  await $.prompt.submit({ text: 'hi' } as never)
  await ui.redraw()
  expect((await ui.find({ key: 'stage-toons' }))?.text).not.toContain('Demo')
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
  // Long enough for a frame to be taken (a still one is resent within
  // RESEND_MS): until then refusals are expected for a while, as after a resize.
  await clock.advance(2500)
  world.isBlitRefused = true
  const before = world.invalidations
  // A still frame is resent within RESEND_MS, then every frame until taken.
  await clock.advance(3000)
  expect(world.invalidations).toBeGreaterThan(before)
  world.isBlitRefused = false
  await ui.redraw()
  const after = blitsOf(world, 'area').length
  await clock.advance(2500)
  expect(blitsOf(world, 'area').length).toBeGreaterThan(after)
})

test('the idle Clawd starts awake when the band stops working, before the turn is reported', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', bandProps(100, { isWorking: true }))
  await clock.advance(70_000)
  await ui.redraw(bandProps(100))
  const cells = String((await ui.find({ key: 'area' }))?.props.cells ?? '')
  expect(cells).not.toBe('')
  expect(colorInRows({ key: 'area', cells, columns: 99, rows: 9 }, ALL_ROWS, Z_COLOR)).toBe(false)
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
  // Classic alone leaves the box left of Clawd blank: every other routine
  // draws there (idle.test.ts).
  const isClassic = () => isLeftBlank(blitsOf(world, 'area').at(-1))
  expect(isClassic()).toBe(true)
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  const before = blitsOf(world, 'area').length
  // Classic's frames often repeat: long enough for a new one, or a resend.
  await clock.advance(2500)
  expect(blitsOf(world, 'area').length).toBeGreaterThan(before)
  expect(isClassic()).toBe(true)
  await endTurn($)
  await clock.advance(500)
  expect(isClassic()).toBe(false)
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

test('dozing he repaints at most three times a second; after five minutes he is still and the area stops; an agent wakes it', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  await clock.advance(DOZE_MS + 10_000)
  const dozing = blitsOf(world, 'area').length
  await clock.advance(10_000)
  expect(blitsOf(world, 'area').length - dozing).toBeLessThanOrEqual(30)
  await clock.advance(DEEP_SLEEP_MS)
  const asleep = blitsOf(world, 'area').length
  await clock.advance(10 * 60_000)
  expect(blitsOf(world, 'area').length).toBe(asleep)
  const before = world.invalidations
  await spawnAgent($)
  expect(world.invalidations).toBeGreaterThan(before)
})

test('the area takes the width setting, the whole band up to 512 columns with full, and follows the band when it resizes', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', bandProps(200))
  expect((await ui.find({ key: 'area' }))?.props).toMatchObject({ columns: 120, rows: 9 })
  expect(text(await runStage($, 'width full'))).toContain("The cartoons grow to the band's whole width")
  expect(world.store.width).toBe('full')
  await ui.redraw(bandProps(600))
  expect((await ui.find({ key: 'area' }))?.props).toMatchObject({ columns: 512, rows: 9 })
  // The loop paints on at the new size (the idle Clawd's frame is sent again
  // at least every RESEND_MS).
  await clock.advance(2500)
  expect(blitsOf(world, 'area').at(-1)?.columns).toBe(512)
  await ui.redraw(bandProps(80))
  expect((await ui.find({ key: 'area' }))?.props).toMatchObject({ columns: 79, rows: 9 })
  await clock.advance(2500)
  expect(blitsOf(world, 'area').at(-1)).toMatchObject({ columns: 79, rows: 9 })
})

test('the area shrinks with the band at once, and grows back only with a row to spare', async ($, on) => {
  engine(on)
  await $.session.start(START)
  // Untracked, the bar is one line.
  const ui = await mountBand($, 'terminal', bandProps(100, { maxRows: 10 }))
  const rows = async () => (await ui.find({ key: 'area' }))?.props.rows
  expect(await rows()).toBe(9)
  await ui.redraw(bandProps(100, { maxRows: 9 }))
  expect(await rows()).toBe(8)
  await ui.redraw(bandProps(100, { maxRows: 10 }))
  expect(await rows()).toBe(8)
  await ui.redraw(bandProps(100, { maxRows: 11 }))
  expect(await rows()).toBe(9)
  await ui.redraw(bandProps(100, { maxRows: 8 }))
  expect(await rows()).toBe(7)
  // Gone (too short) and back: it takes what fits.
  await ui.redraw(bandProps(100, { maxRows: 7 }))
  expect(await ui.find({ key: 'area' })).toBeUndefined()
  await ui.redraw(bandProps(100, { maxRows: 10 }))
  expect(await rows()).toBe(9)
})
