import { expect, test } from 'claude-code/testing'

import { answerText, bandText, engine, KEY, NOW, runStage, sectionText, setStage, START } from './harness'
import { DEFAULT_WORKFLOW, workflowJson } from './workflow'

const FILE = '.claude/stage-toons.json'
const CUSTOM = {
  track: [
    { id: 'plan', label: 'Plan', message: 'Planning', when: 'planning the work', scene: 'stepping-stones' },
    { id: 'build', label: 'Build', message: 'Building', when: 'writing the code', scene: 'bricklaying' },
    { id: 'ship', label: 'Ship', message: 'Shipping', when: 'releasing it', scene: 'gift' },
  ],
  side: [{ id: 'debugging', label: 'Debugging', message: 'Hunting a bug', when: 'finding and fixing a bug', scene: 'bug-hunt' }],
}
const json = (data: unknown) => JSON.stringify(data, null, 2)
const text = (answer: unknown) => (answer as { text?: string }).text ?? ''
const enumOf = (schema: unknown) => (schema as { properties: { stage: { enum: string[] } } }).properties.stage.enum

test("a project's file sets the workflow: set_stage, the prompt, /stage and the band follow it", async ($, on) => {
  const { world } = engine(on)
  world.files[FILE] = json(CUSTOM)
  await $.session.start(START)
  expect(enumOf(world.schemas.at(-1))).toEqual(['plan', 'build', 'ship', 'debugging'])
  expect(await sectionText($)).toContain('stages, in order: plan (planning the work), build (writing the code), ship (releasing it).')
  expect(answerText(await setStage($, { stage: 'build', message: 'Wiring it up' }))).toBe('Stage 2/3 Build · no feature · "Wiring it up"')
  expect(await bandText($)).toContain('●━◉─○  2/3 Build')
  expect(text(await runStage($, 'workflow'))).toContain('Workflow: from .claude/stage-toons.json')
  const refused = (await setStage($, { stage: 'roadmap', message: 'x' })) as { deny?: string }
  expect(refused.deny).toContain('plan, build, ship, debugging')
})

test('no file: the default workflow, silently', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  expect(enumOf(world.schemas.at(-1))).toContain('roadmap')
  expect(world.toasts).toEqual([])
})

test('a broken file at session start: the default workflow and one toast', async ($, on) => {
  const { world } = engine(on)
  world.files[FILE] = '{ "track": ['
  await $.session.start(START)
  expect(enumOf(world.schemas.at(-1))).toContain('roadmap')
  expect(world.toasts).toEqual(['stage-toons: .claude/stage-toons.json has errors; using the default workflow. /stage workflow reload lists them.'])
})

test('init writes the default workflow, and refuses when the file exists', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  expect(text(await runStage($, 'workflow init'))).toBe('Wrote the default workflow to .claude/stage-toons.json: edit it, then /stage workflow reload.')
  expect(world.files[FILE]).toContain('"id": "roadmap"')
  expect(text(await runStage($, 'workflow init'))).toBe('.claude/stage-toons.json exists; edit it, then /stage workflow reload')
})

test('after init the session reads its workflow as from the file, with nothing changed for Claude', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  const registered = world.schemas.length
  await runStage($, 'workflow init')
  expect(text(await runStage($, 'workflow'))).toContain('Workflow: from .claude/stage-toons.json')
  expect(world.schemas.length).toBe(registered)
  expect(text(await runStage($, 'workflow reload'))).toBe('workflow unchanged.')
})

test('init says so when the write fails', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.isFsBroken = true
  expect(text(await runStage($, 'workflow init'))).toContain("couldn't write .claude/stage-toons.json")
})

test('reload switches: set_stage, the section and Claude learn the new stages', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  const before = await sectionText($)
  world.files[FILE] = json(CUSTOM)
  const answer = (await runStage($, 'workflow reload')) as { text?: string; context?: string[] }
  expect(answer.text).toContain('workflow from .claude/stage-toons.json: 3 track stages, 1 side stages.')
  expect(answer.context?.[0]).toContain('[stage-toons] The workflow changed: track: plan, build, ship; side: debugging.')
  expect(enumOf(world.schemas.at(-1))).toEqual(['plan', 'build', 'ship', 'debugging'])
  expect(await sectionText($)).not.toBe(before)
  expect(await sectionText($)).toContain('plan (planning the work)')
  const stale = (await setStage($, { stage: 'develop', message: 'Building' })) as { deny?: string }
  expect(stale.deny).toContain('plan, build, ship, debugging')
})

test('reload of an unchanged workflow registers nothing', async ($, on) => {
  const { world } = engine(on)
  world.files[FILE] = json(CUSTOM)
  await $.session.start(START)
  const registered = world.schemas.length
  expect(text(await runStage($, 'workflow reload'))).toBe('workflow unchanged.')
  expect(world.schemas.length).toBe(registered)
})

test('reload with errors keeps the workflow and lists every error', async ($, on) => {
  const { world } = engine(on)
  world.files[FILE] = json(CUSTOM)
  await $.session.start(START)
  world.files[FILE] = json({ track: [{ ...CUSTOM.track[0], scene: 'bug-hnt', lable: 'x' }] })
  const answer = text(await runStage($, 'workflow reload'))
  expect(answer).toContain('.claude/stage-toons.json has errors; kept the current workflow:')
  expect(answer).toContain('  track[0].lable: not a field (id, label, message, when, scene, scenes, auto)')
  expect(answer).toContain('  track[0].scene "bug-hnt" is not a scene (')
  expect(answer.split(String.fromCharCode(10)).filter(l => l.startsWith('  track[0]'))).toHaveLength(2)
  expect(answerText(await setStage($, { stage: 'ship', message: 'Out it goes' }))).toContain('3/3 Ship')
})

test('reload with the file gone switches to the default and says so', async ($, on) => {
  const { world } = engine(on)
  world.files[FILE] = json(CUSTOM)
  await $.session.start(START)
  delete world.files[FILE]
  expect(text(await runStage($, 'workflow reload'))).toContain('workflow the default (no .claude/stage-toons.json)')
})

test('reload moves a stage the workflow lost back to the last track stage, without saving', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'plan', message: 'Planning it' })
  await setStage($, { stage: 'other', message: 'A detour' })
  const saved = JSON.stringify(world.store[KEY])
  world.files[FILE] = json(CUSTOM)
  expect(text(await runStage($, 'workflow reload'))).toContain('the saved stage "other" is not in this workflow: back to 1/3 Plan')
  expect(await bandText($)).toContain('1/3 Plan')
  expect(JSON.stringify(world.store[KEY])).toBe(saved)
})

test("a hot reload keeps the session's workflow without reading the file", async ($, on) => {
  on('state.get', ($, e, next) => (e.key === 'workflow' ? { value: { value: { workflow: CUSTOM, source: 'file' }, version: 1 } } : next(e)))
  const { world } = engine(on)
  await $.session.start(START)
  expect(enumOf(world.schemas.at(-1))).toEqual(['plan', 'build', 'ship', 'debugging'])
  expect(text(await runStage($, 'workflow'))).toContain('  2 build: Build (bricklaying)')
})

test("another session's progress is reconciled in memory, not saved", async ($, on) => {
  const { world } = engine(on)
  world.files[FILE] = json(CUSTOM)
  await $.session.start(START)
  const theirs = { v: 2, stage: 'develop', lastTrackStage: 'develop', feature: null, message: 'Theirs', history: [], updatedAt: NOW + 5000 }
  world.store[KEY] = theirs
  await $.prompt.submit({ text: 'hi', wait: false, origin: { kind: 'composer' } } as never)
  expect(await bandText($)).toContain('Not tracked yet')
  expect(world.store[KEY]).toEqual(theirs)
})

test('reload of the same stages from another source says unchanged and tells Claude nothing', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.files[FILE] = workflowJson(DEFAULT_WORKFLOW)
  const registered = world.schemas.length
  const answer = (await runStage($, 'workflow reload')) as { text?: string; context?: string[] }
  expect(answer.text).toBe('workflow unchanged (now from .claude/stage-toons.json).')
  expect(answer.context).toBeUndefined()
  expect(world.schemas.length).toBe(registered)
  expect(text(await runStage($, 'workflow'))).toContain('Workflow: from .claude/stage-toons.json')
})

test('init says so when it cannot check for the file', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.isExistsBroken = true
  expect(text(await runStage($, 'workflow init'))).toContain("couldn't write .claude/stage-toons.json")
})

test('reload says so when set_stage could not be registered again', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.files[FILE] = json(CUSTOM)
  world.isRegisterBroken = true
  expect(text(await runStage($, 'workflow reload'))).toContain('set_stage could not be registered again')
})
