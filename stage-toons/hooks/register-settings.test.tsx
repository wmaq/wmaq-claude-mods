import { expect, test } from 'claude-code/testing'

import { bandText, callTool, engine, runStage, START } from './harness'
import { DEFAULT_WORKFLOW, workflowJson } from './workflow'

const FILE = '.claude/stage-toons.json'
const WELCOME = "stage-toons: the bar above the prompt follows the work's stage; /stage shows it and its commands, /stage demo plays the cartoons."
const text = (answer: unknown) => (answer as { text?: string }).text ?? ''
// The default workflow as a project's file, with settings of its own.
const fileWith = (settings: Record<string, unknown>) => JSON.stringify({ ...JSON.parse(workflowJson(DEFAULT_WORKFLOW)), ...settings }, null, 2)
const brainstorm = { skill: 'superpowers:brainstorming' }

test("a file's auto: false starts the session with rules off, though the person's own setting is on", async ($, on) => {
  const { world } = engine(on, { store: { auto: true } })
  world.files[FILE] = fileWith({ auto: false })
  await $.session.start(START)
  const answer = text(await runStage($, 'auto'))
  expect(answer).toContain('Automatic moves are off')
  expect(answer).toContain("This project's workflow file starts it off.")
  await callTool($, 'Skill', brainstorm)
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
  // /stage auto on still turns them on at once, and saves the person's own setting.
  expect(text(await runStage($, 'auto on'))).toContain("Automatic moves are on: /stage auto off turns them off.\nThis project's workflow file starts it off.")
  expect(world.store.auto).toBe(true)
  await callTool($, 'Skill', brainstorm)
  expect(text(await runStage($, ''))).toContain('2/10 Brainstorm by auto')
})

test("a file's hide: true hides the bar, though the person's own setting shows it; /stage hide says so", async ($, on) => {
  const { world } = engine(on, { store: { hidden: false } })
  world.files[FILE] = fileWith({ hide: true })
  await $.session.start(START)
  expect(await bandText($)).toBe('(engine)')
  expect(text(await runStage($, 'hide'))).toBe("stage-toons is shown. This project's workflow file starts it hidden.")
  expect(world.store.hidden).toBe(false)
  expect(await bandText($)).toContain('Not tracked yet')
})

test("where the file says nothing, the person's own setting stands; the answers name no file", async ($, on) => {
  const { world } = engine(on, { store: { auto: false, hidden: true } })
  world.files[FILE] = fileWith({})
  await $.session.start(START)
  expect(await bandText($)).toBe('(engine)')
  expect(text(await runStage($, 'auto'))).not.toContain('workflow file')
  expect(text(await runStage($, 'hide'))).toBe('stage-toons is shown.')
})

test("a hot reload keeps the session's own auto and hidden, whatever the file and the store say", async ($, on) => {
  const held = { workflow: DEFAULT_WORKFLOW, source: 'file', settings: { auto: false, hide: true } }
  on('state.get', ($, e, next) => {
    // The session typed /stage auto on and /stage hide (shown) after the file started them off and hidden.
    if (e.key === 'workflow') return { value: { value: held, version: 1 } }
    if (e.key === 'auto') return { value: { value: true, version: 1 } }
    if (e.key === 'hidden') return { value: { value: false, version: 1 } }

    return next(e)
  })
  const { world } = engine(on, { store: { auto: false, hidden: true } })
  world.files[FILE] = fileWith({ auto: false, hide: true })
  await $.session.start(START)
  expect(await bandText($)).toContain('Not tracked yet')
  // The answer still names the file's setting, which rode the session's workflow.
  expect(text(await runStage($, 'auto'))).toContain("Automatic moves are on: /stage auto off turns them off.\nThis project's workflow file starts it off.")
})

test('/stage workflow reload applies the settings even when the stages are unchanged', async ($, on) => {
  const { world } = engine(on)
  world.files[FILE] = fileWith({})
  await $.session.start(START)
  expect(await bandText($)).toContain('Not tracked yet')
  world.files[FILE] = fileWith({ hide: true, auto: false })
  const invalidations = world.invalidations
  expect(text(await runStage($, 'workflow reload'))).toBe("workflow unchanged.\nThis project's workflow file starts automatic moves off and the bar hidden.")
  expect(world.invalidations).toBeGreaterThan(invalidations)
  expect(await bandText($)).toBe('(engine)')
  expect(text(await runStage($, 'auto'))).toContain('Automatic moves are off')
  // /stage workflow lists them too.
  expect(text(await runStage($, 'workflow'))).toContain("This project's workflow file starts automatic moves off and the bar hidden.")
  // Taken out of the file again: the person's own settings (none saved: on, shown).
  world.files[FILE] = fileWith({})
  expect(text(await runStage($, 'workflow reload'))).toBe('workflow unchanged.')
  expect(await bandText($)).toContain('Not tracked yet')
  expect(text(await runStage($, 'auto'))).toContain('Automatic moves are on')
  // Saved nowhere: the person's own settings are theirs.
  expect(world.store.auto).toBeUndefined()
  expect(world.store.hidden).toBeUndefined()
})

test('a reload that changes the stages applies the settings too; one with errors changes nothing', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.files[FILE] = JSON.stringify({ track: [{ id: 'plan', label: 'Plan', message: 'Planning', when: 'planning', scene: 'gift' }], hide: true })
  expect(text(await runStage($, 'workflow reload'))).toContain("This project's workflow file starts the bar hidden.")
  expect(await bandText($)).toBe('(engine)')
  world.files[FILE] = JSON.stringify({ track: [{ id: 'plan', label: 'Plan', message: 'Planning', when: 'planning', scene: 'gift' }], hide: 'no' })
  expect(text(await runStage($, 'workflow reload'))).toContain('hide: must be true or false')
  expect(await bandText($)).toBe('(engine)')
})

test('the first session shows the welcome toast once the store has it; the next one shows none', async ($, on) => {
  const { world } = engine(on, { store: { welcomed: undefined } })
  await $.session.start(START)
  expect(world.toasts).toEqual([WELCOME])
  expect(world.store.welcomed).toBe(true)
  await $.session.start(START)
  expect(world.toasts).toEqual([WELCOME])
})

test('a store that cannot be read shows no welcome', async ($, on) => {
  const { world } = engine(on, { store: { welcomed: undefined } })
  world.isStoreBroken = true
  await $.session.start(START)
  expect(world.toasts).not.toContain(WELCOME)
})

test('a store that cannot save the welcome shows none', async ($, on) => {
  const { world } = engine(on)
  // The welcome reads as never given, and saving it fails.
  Object.defineProperty(world.store, 'welcomed', {
    get: () => undefined,
    set: () => {
      throw new Error('store full')
    },
  })
  await $.session.start(START)
  expect(world.toasts).toEqual([])
})
