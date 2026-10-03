import { expect, test } from 'claude-code/testing'

import type { Progress } from '../types'
import { answerText, bandProps, bandText, BS, COMPOSE, engine, KEY, NOW, runStage, setStage, START, SUMMARY, TOOL_NAME } from './harness'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW } from './workflow'

const saved = (stage: Progress['stage'], message: string, at = NOW - 1000): Progress => applyMove(DEFAULT_WORKFLOW, freshProgress(0), { stage, message, by: 'claude', at })

test('a fresh project is not tracked yet, on the terminal and on the desktop', async ($, on) => {
  engine(on)
  await $.session.start(START)
  for (const surface of ['terminal', 'desktop'] as const) {
    const text = await bandText($, surface)
    expect(text).toContain('Not tracked yet')
  }
})

test('set_stage moves the band, answers the new state and saves it', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  const answer = await setStage($, { stage: 'plan', message: 'Writing the plan', feature: 'stage-toons' })
  expect(answerText(answer)).toBe('Stage 5/10 Plan · stage-toons · "Writing the plan"')
  expect(await bandText($)).toContain('5/10 Plan · stage-toons')
  expect((world.store[KEY] as Progress).stage).toBe('plan')
})

test('saved progress is read back under any Windows spelling of the directory', async ($, on) => {
  engine(on, { store: { [KEY]: saved('develop', 'Building the band') } })
  await $.session.start({ ...START, cwd: `c:${BS}DEV${BS}Proj${BS}` })
  const text = await bandText($)
  expect(text).toContain('7/10 Develop')
  expect(text).toContain('Building the band')
})

test('invalid saved progress starts untracked', async ($, on) => {
  engine(on, { store: { [KEY]: { v: 7, stage: 'deploy' } } })
  await $.session.start(START)
  expect(await bandText($)).toContain('Not tracked yet')
})

test("another session's move shows after the next prompt", async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  world.store[KEY] = saved('cleanup', 'Writing the docs', NOW + 5000)
  await $.prompt.submit({ text: 'next?', wait: false, origin: { kind: 'composer' } })
  expect(await bandText($)).toContain('10/10 Cleanup')
})

test('set_stage is refused from a subagent and for bad input', async ($, on) => {
  engine(on)
  await $.session.start(START)
  expect(await setStage($, { stage: 'plan', message: 'Sneaky', agentId: 'agent-9' })).toEqual({ deny: 'stage-toons: only the main conversation moves the workflow stage.' })
  const bad = (await setStage($, { stage: 'deploy', message: 'Shipping' })) as { deny?: string }
  expect(bad.deny).toContain('roadmap, brainstorm, spec')
  const empty = (await setStage($, { stage: 'plan', message: '   ' })) as { deny?: string }
  expect(empty.deny).toBeDefined()
  expect(await bandText($)).toContain('Not tracked yet')
})

test('/stage moves, steps, names, shows and hides', async ($, on) => {
  engine(on)
  await $.session.start(START)
  expect(await runStage($, 'plan')).toEqual({
    text: 'Stage 5/10 Plan · no feature · "Writing the implementation plan"',
    context: ['[stage-toons] The user set the stage: 5/10 Plan · no feature · "Writing the implementation plan"'],
  })
  expect((await runStage($, 'next')).text).toContain('6/10 Plan audit')
  expect((await runStage($, 'back')).text).toContain('5/10 Plan ·')
  expect((await runStage($, 'feature stage toons')).text).toContain('· stage toons ·')
  expect((await runStage($, 'message Splitting task 3')).text).toContain('"Splitting task 3"')
  expect((await runStage($, '')).text).toContain('Recent moves:')
  expect((await runStage($, 'bogus')).text).toContain('Usage: /stage')
  expect((await runStage($, 'hide')).text).toBe('stage-toons is hidden. /stage hide shows it again.')
  expect(await bandText($)).toBe('(engine)')
  expect((await runStage($, 'hide')).text).toBe('stage-toons is shown.')
  expect(await bandText($)).toContain('5/10 Plan')
})

test('the workflow section holds the start state until a real compaction', async ($, on) => {
  engine(on)
  await $.session.start(START)
  const section = async () => (await $.prompt.compose(COMPOSE as never)).sections.at(-1)
  const first = await section()
  expect(first?.id).toBe('stage-toons:workflow')
  expect(first?.scope).toBe('session')
  expect(first?.text).toContain(TOOL_NAME)
  expect(first?.text).toContain('At session start: Not tracked yet · no feature.')
  await setStage($, { stage: 'plan', message: 'Writing the plan' })
  expect(await section()).toEqual(first)
  // A hot reload fires session.start again.
  await $.session.start(START)
  expect(await section()).toEqual(first)
  await $.session.compact({ trigger: 'precompute', messages: [SUMMARY] })
  expect(await section()).toEqual(first)
  await $.session.compact({ trigger: 'auto', messages: [SUMMARY], agentId: 'agent-1' })
  expect(await section()).toEqual(first)
  await $.session.compact({ trigger: 'auto', messages: [SUMMARY] })
  expect((await section())?.text).toContain('At session start: 5/10 Plan')
})

test('a broken store keeps progress in memory and warns once', async ($, on) => {
  const { world } = engine(on)
  world.isStoreBroken = true
  await $.session.start(START)
  await setStage($, { stage: 'plan', message: 'Writing the plan' })
  await setStage($, { stage: 'develop', message: 'Building' })
  expect(world.toasts).toEqual(["stage-toons: couldn't save progress; it lasts for this session only"])
  expect(await bandText($)).toContain('7/10 Develop')
})

test('a warning given before a hot reload is not given again after it', async ($, on) => {
  // The session's state outlives a reload; this stands for a warning given
  // by the module's previous load.
  on('state.get', ($, e, next) => (e.key === 'warned' ? { value: { value: true, version: 1 } } : next(e)))
  const { world } = engine(on)
  world.isStoreBroken = true
  await $.session.start(START)
  await setStage($, { stage: 'plan', message: 'Writing the plan' })
  expect(world.toasts).toEqual([])
})

test('the band stacks above what the engine and other plugins draw there', async ($, on) => {
  engine(on)
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'stage-toons', surface: 'terminal', component: 'AbovePrompt', props: bandProps() })
  expect(await ui.find({ key: 'stage-toons' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('the band yields to surveys and agent views, and shrinks when narrow', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'plan', message: 'Writing the plan' })
  expect(await bandText($, 'terminal', bandProps(100, { hasSurvey: true }))).toBe('(engine)')
  expect(await bandText($, 'terminal', bandProps(100, { agentId: 'agent-1' }))).toBe('(engine)')
  expect(await bandText($, 'terminal', bandProps(40))).toBe('5/10 Plan — Writing the plan')
})

test('/stage debugging hides the track and shows the stage left', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'develop', message: 'Building' })
  await runStage($, 'debugging')
  const text = await bandText($)
  expect(text).toContain('? Debugging')
  expect(text).toContain('↩ 7/10 Develop')
  expect(text).not.toContain('●')
})

test('/stage message waits for a stage while untracked', async ($, on) => {
  engine(on)
  await $.session.start(START)
  const answer = (await runStage($, 'message Poking around')) as { text?: string }
  expect(answer.text).toBe('a message belongs to a stage; set one first (/stage next, or /stage <id>).')
  expect(await bandText($)).toContain('Not tracked yet')
})
