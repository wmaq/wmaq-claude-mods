import { expect, test } from 'claude-code/testing'

import { bandProps, bandText, engine, mountBand, runStage, START } from './harness'

const text = (answer: unknown) => (answer as { text?: string }).text ?? ''

test("/stage demo develop plays Develop's scenes", async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  expect(text(await runStage($, 'demo develop 5'))).toBe('Playing 3 scenes of Develop, 5 s each (under a minute). /stage demo stop ends it.')
  expect(await bandText($)).toContain('Demo 1/3: bricklaying (Develop)')
  await clock.advance(5_000)
  expect(await bandText($)).toContain('Demo 2/3: terminal (Develop)')
  await clock.advance(5_000)
  expect(await bandText($)).toContain('Demo 3/3: workbench (Develop)')
})

test('/stage demo idle plays the routines in the area, the celebration, the show-off, then the doze, then ends', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  expect(text(await runStage($, 'demo idle 3'))).toBe(
    'Playing 5 idle routines, the celebration, the show-off and the doze, 3 s each (under a minute). /stage demo stop ends it.',
  )
  await ui.redraw(bandProps(100))
  expect(await ui.find({ key: 'area' })).toBeDefined()
  expect(await bandText($)).toContain('Idle demo 1/8: classic')
  for (const [i, name] of ['nyan', 'coffee', 'reading', 'yo-yo', 'celebrate', 'show-off (roadmap)', 'doze'].entries()) {
    await clock.advance(3_000)
    expect(await bandText($)).toContain(`Idle demo ${i + 2}/8: ${name}`)
  }
  await clock.advance(3_000)
  expect(await bandText($)).not.toContain('Idle demo')
})

test('/stage demo idle over a playing scene demo keeps playing before the band is drawn again', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await runStage($, 'demo 5')
  await ui.redraw()
  await clock.advance(200)
  await runStage($, 'demo idle 5')
  // The scene demo's loop wakes before any redraw switches the band's kind.
  await clock.advance(200)
  expect(await bandText($)).toContain('Idle demo 1/8: classic')
  expect(text(await runStage($, 'demo stop'))).toBe('Demo stopped.')
})

test('/stage demo idle without room says so and plays nothing', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', bandProps(29))
  expect(text(await runStage($, 'demo idle'))).toBe('The band has no room for the demo: it needs 30 columns and 9 rows.')
  expect(await bandText($)).not.toContain('Idle demo')
})

test('a new prompt ends the idle demo', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await mountBand($)
  await runStage($, 'demo idle')
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  expect(await bandText($)).not.toContain('Idle demo')
  expect(text(await runStage($, 'demo stop'))).toContain('No demo is playing')
})

test('/stage demo plays the whole library', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await mountBand($)
  expect(text(await runStage($, 'demo'))).toBe('Playing 39 scenes, 10 s each (about 7 min). /stage demo stop ends it.')
})

test('/stage demo work plays the layer over the stage\'s scene, step by step, then ends', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  expect(text(await runStage($, 'demo work'))).toBe('Playing what Clawd shows while Claude works, over mystery-box, in 14 steps, 3 s each (under a minute). /stage demo stop ends it.')
  await ui.redraw(bandProps(100))
  expect(await bandText($)).toContain('Work demo 1/14: thinking')
  await clock.advance(3_000)
  expect(await bandText($)).toContain('Work demo 2/14: searching')
  await clock.advance(12 * 3_000)
  expect(await bandText($)).toContain('Work demo 14/14: writing the answer')
  await clock.advance(3_000)
  expect(await bandText($)).not.toContain('Work demo')
})

test('/stage demo work with the pop-ups off still shows them, and says so', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await mountBand($)
  await runStage($, 'bubbles off')
  expect(text(await runStage($, 'demo work 2'))).toContain("Clawd's pop-ups are off: the demo shows them; /stage bubbles on turns them on.")
  expect(await bandText($)).toContain("Work demo 1/14: thinking (Clawd's pop-ups are off)")
})
