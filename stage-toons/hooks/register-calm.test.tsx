import { expect, test } from 'claude-code/testing'

import { engine, mountBand, runStage, START } from './harness'
import { DEFAULT_WORKFLOW, workflowJson } from './workflow'

// /stage calm: the setting, where it is kept, and what the file says.
const FILE = '.claude/stage-toons.json'
const text = (answer: unknown) => (answer as { text?: string }).text ?? ''
const fileWith = (settings: Record<string, unknown>) => JSON.stringify({ ...JSON.parse(workflowJson(DEFAULT_WORKFLOW)), ...settings }, null, 2)
const ON = 'Calm mode is on: the cartoons hold still and change only when something happens. /stage calm off brings the motion back.'
const OFF = 'Calm mode is off: the cartoons move. /stage calm on holds them still.'

test('calm mode is off by default; /stage calm on turns it on, saves it for every project and redraws the band', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  expect(text(await runStage($, 'calm'))).toBe(OFF)
  const invalidations = world.invalidations
  expect(text(await runStage($, 'calm on'))).toBe(ON)
  expect(world.store.calm).toBe(true)
  expect(world.invalidations).toBeGreaterThan(invalidations)
  expect(text(await runStage($, 'calm off'))).toBe(OFF)
  expect(world.store.calm).toBe(false)
})

test("the store's calm: true starts a session with it on; anything else, off", async ($, on) => {
  engine(on, { store: { calm: true } })
  await $.session.start(START)
  expect(text(await runStage($, 'calm'))).toBe(ON)
})

test("a store's calm that is not true reads as off", async ($, on) => {
  engine(on, { store: { calm: 'yes' } })
  await $.session.start(START)
  expect(text(await runStage($, 'calm'))).toBe(OFF)
})

test("a file's calm: true starts the session with it on, though the person's own setting is off; /stage workflow reload applies it", async ($, on) => {
  const { world } = engine(on, { store: { calm: false } })
  world.files[FILE] = fileWith({ calm: true })
  await $.session.start(START)
  expect(text(await runStage($, 'calm'))).toBe(`${ON} This project's workflow file starts it on.`)
  world.files[FILE] = fileWith({ calm: false })
  expect(text(await runStage($, 'workflow reload'))).toBe('workflow unchanged; applied its settings: calm mode off.')
  expect(text(await runStage($, 'calm'))).toBe(`${OFF} This project's workflow file starts it off.`)
  expect(text(await runStage($, 'workflow'))).toContain("This project's workflow file starts calm mode off.")
})

test("a file's calm that is not true or false is an error with its field", async ($, on) => {
  const { world } = engine(on)
  world.files[FILE] = fileWith({ calm: 'yes' })
  await $.session.start(START)
  expect(text(await runStage($, 'workflow reload'))).toContain('calm: must be true or false')
})

test("a hot reload keeps the session's own calm, whatever the store says", async ($, on) => {
  on('state.get', ($, e, next) => {
    if (e.key === 'workflow') return { value: { value: { workflow: DEFAULT_WORKFLOW, source: 'default' }, version: 1 } }
    if (e.key === 'calm') return { value: { value: true, version: 1 } }

    return next(e)
  })
  engine(on, { store: { calm: false } })
  await $.session.start(START)
  expect(text(await runStage($, 'calm'))).toBe(ON)
})

test('/stage calm with a wrong word is a command with a bad argument; calm is in the help', async ($, on) => {
  engine(on)
  await $.session.start(START)
  expect(text(await runStage($, 'calm maybe'))).toBe('Not a /stage command: calm maybe. /stage help commands lists them all.')
  expect(text(await runStage($, 'help calm'))).toContain('/stage calm [on | off]  whether the cartoons hold still, changing only when something happens')
})

test("/stage help calm ends with what /stage calm answers now", async ($, on) => {
  engine(on)
  await $.session.start(START)
  expect(text(await runStage($, 'help calm')).endsWith(`Now:\n  ${OFF}`)).toBe(true)
  await runStage($, 'calm on')
  expect(text(await runStage($, 'help calm')).endsWith(`Now:\n  ${ON}`)).toBe(true)
  expect(text(await runStage($, 'help'))).toContain('  calm     cartoons that hold still')
  expect(text(await runStage($, 'help waiting'))).not.toContain('Now:')
})

test('a demo started with calm mode on says it moves anyway', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await mountBand($)
  await runStage($, 'calm on')
  expect(text(await runStage($, 'demo plan 2'))).toContain('Calm mode is on: the demo moves anyway, and the stills come back when it ends.')
  await runStage($, 'demo stop')
  await runStage($, 'calm off')
  expect(text(await runStage($, 'demo plan 2'))).not.toContain('Calm mode')
})
