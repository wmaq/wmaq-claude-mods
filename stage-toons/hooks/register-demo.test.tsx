import { expect, test } from 'claude-code/testing'

import { bandProps, bandText, engine, mountBand, runStage, START } from './harness'

const text = (answer: unknown) => (answer as { text?: string }).text ?? ''

test("/stage demo develop plays Develop's scenes", async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  expect(text(await runStage($, 'demo develop 5'))).toBe('Playing 2 scenes of Develop, 5 s each (under a minute). /stage demo stop ends it.')
  expect(await bandText($)).toContain('Demo 1/2: bricklaying (Develop)')
  await clock.advance(5_000)
  expect(await bandText($)).toContain('Demo 2/2: terminal (Develop)')
})

test('/stage demo idle plays the routines in the idle box, then the doze, then ends', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  expect(text(await runStage($, 'demo idle 3'))).toBe('Playing 2 idle routines and the doze, 3 s each (under a minute). /stage demo stop ends it.')
  await ui.redraw(bandProps(100))
  expect(await ui.find({ key: 'idle' })).toBeDefined()
  expect(await bandText($)).toContain('Idle demo 1/3: classic')
  await clock.advance(3_000)
  expect(await bandText($)).toContain('Idle demo 2/3: nyan')
  await clock.advance(3_000)
  expect(await bandText($)).toContain('Idle demo 3/3: doze')
  await clock.advance(3_000)
  expect(await bandText($)).not.toContain('Idle demo')
})

test('/stage demo idle without room says so and plays nothing', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', bandProps(77))
  expect(text(await runStage($, 'demo idle'))).toBe('The idle demo needs a terminal at least 78 columns wide and 5 rows of band.')
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
  expect(text(await runStage($, 'demo'))).toBe('Playing 25 scenes, 10 s each (about 4 min). /stage demo stop ends it.')
})
