import { expect, test } from 'claude-code/testing'

import { bandText, endTurn, engine, spawnAgent, START } from './harness'

// The bar's Fable tag. Fable walking into the area is in register-area.test.tsx.

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

test('the tag stays until every Fable agent completes', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.spawnModel = 'claude-fable-5-1'
  await spawnAgent($, 'fable')
  await spawnAgent($, 'fable')
  await endTurn($, 'agent-1')
  expect(await bandText($)).toContain('⌕ Fable reviewing')
  await endTurn($, 'agent-2')
  expect(await bandText($)).not.toContain('Fable')
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
