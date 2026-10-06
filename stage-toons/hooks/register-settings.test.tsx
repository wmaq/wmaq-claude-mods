import { expect, test } from 'claude-code/testing'

import { bandText, callTool, engine, mountBand, runStage, START } from './harness'
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
  expect(text(await runStage($, 'workflow reload'))).toBe('workflow unchanged; applied its settings: automatic moves off and the bar hidden.')
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

test("/stage bubbles off turns Clawd's pop-ups off and saves it for every project; a file's bubbles: false starts a session so", async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  expect(text(await runStage($, 'bubbles'))).toContain("Clawd's pop-ups are on")
  expect(text(await runStage($, 'bubbles off'))).toBe("Clawd's pop-ups are off. /stage bubbles on turns them on.")
  expect(world.store.bubbles).toBe(false)
  world.files[FILE] = fileWith({ bubbles: true })
  expect(text(await runStage($, 'workflow reload'))).toBe("workflow unchanged (now from .claude/stage-toons.json); applied its settings: Clawd's pop-ups on.")
  expect(text(await runStage($, 'bubbles'))).toContain("This project's workflow file starts them on.")
})

test("a file's bubbles: false starts the session with the pop-ups off, though the person's own setting is on", async ($, on) => {
  const { world } = engine(on, { store: { bubbles: true } })
  world.files[FILE] = fileWith({ bubbles: false })
  await $.session.start(START)
  expect(text(await runStage($, 'bubbles'))).toBe("Clawd's pop-ups are off. /stage bubbles on turns them on. This project's workflow file starts them off.")
})

test("a hot reload keeps the session's own bubbles, whatever the store says", async ($, on) => {
  on('state.get', ($, e, next) => {
    if (e.key === 'workflow') return { value: { value: { workflow: DEFAULT_WORKFLOW, source: 'default' }, version: 1 } }
    if (e.key === 'bubbles') return { value: { value: false, version: 1 } }

    return next(e)
  })
  engine(on, { store: { bubbles: true } })
  await $.session.start(START)
  expect(text(await runStage($, 'bubbles'))).toContain("Clawd's pop-ups are off")
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

test("a file's auto: true and hide: false win over the person's own settings off and hidden", async ($, on) => {
  const { world } = engine(on, { store: { auto: false, hidden: true } })
  world.files[FILE] = fileWith({ auto: true, hide: false })
  await $.session.start(START)
  expect(await bandText($)).toContain('Not tracked yet')
  expect(text(await runStage($, 'auto'))).toContain("This project's workflow file starts it on.")
  await callTool($, 'Skill', brainstorm)
  expect(text(await runStage($, ''))).toContain('2/10 Brainstorm by auto')
})

test("/stage width sets how wide the cartoons grow and saves it for every project; a file's width starts a session so", async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  expect(text(await runStage($, 'width'))).toBe('The cartoons grow up to 120 columns. /stage width <n> or /stage width full changes it.')
  await mountBand($)
  expect(text(await runStage($, 'width 90'))).toBe('The cartoons grow up to 90 columns (the band has room for 99). /stage width <n> or /stage width full changes it.')
  expect(world.store.width).toBe(90)
  expect(text(await runStage($, 'width 30'))).toBe('Usage: /stage width [<n> | full], n a whole number of columns from 48 to 512.')
  expect(world.store.width).toBe(90)
  world.files[FILE] = fileWith({ width: 'full' })
  expect(text(await runStage($, 'workflow reload'))).toBe("workflow unchanged (now from .claude/stage-toons.json); applied its settings: the cartoons up to the band's whole width.")
  expect(text(await runStage($, 'width'))).toContain("grow to the band's whole width, up to 512 columns (the band has room for 99). /stage width <n> or /stage width full changes it. This project's workflow file starts it at full.")
  // The person's own setting is theirs.
  expect(world.store.width).toBe(90)
})

test("the store's width starts a session", async ($, on) => {
  engine(on, { store: { width: 64 } })
  await $.session.start(START)
  expect(text(await runStage($, 'width'))).toContain('up to 64 columns')
})

test("a store's width that is not a width reads as the default", async ($, on) => {
  engine(on, { store: { width: 'wide' } })
  await $.session.start(START)
  expect(text(await runStage($, 'width'))).toContain('up to 120 columns')
})

test("a hot reload keeps the session's own width, whatever the store says", async ($, on) => {
  on('state.get', ($, e, next) => {
    if (e.key === 'workflow') return { value: { value: { workflow: DEFAULT_WORKFLOW, source: 'default' }, version: 1 } }
    if (e.key === 'width') return { value: { value: 'full', version: 1 } }

    return next(e)
  })
  engine(on, { store: { width: 64 } })
  await $.session.start(START)
  expect(text(await runStage($, 'width'))).toContain("grow to the band's whole width")
})
