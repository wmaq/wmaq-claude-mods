import { expect, test } from 'claude-code/testing'

import type { Progress } from '../types'
import { answerText, BS, callTool, endTurn, engine, KEY, NOW, runStage, sectionText, setStage, spawnAgent, START, startTurn, submit } from './harness'
import { DEFAULT_WORKFLOW } from './workflow'

const text = (answer: unknown) => (answer as { text?: string }).text ?? ''
const MIN = 60_000
const skill = (name: string) => ({ skill: name })
const saved = (store: Record<string, unknown>) => store[KEY] as Progress

test('loading a skill a rule names moves the stage, by auto, and tells Claude with that result', async ($, on) => {
  engine(on)
  await $.session.start(START)
  const answer = await callTool($, 'Skill', skill('superpowers:brainstorming'))
  expect(answer.context).toEqual([
    '[stage-toons] The stage moved by itself to 2/10 Brainstorm (skill superpowers:brainstorming). Now: 2/10 Brainstorm · no feature · "Brainstorming the feature". Call mcp__stage-toons__set_stage if a more specific message or another stage fits.',
  ])
  expect(text(await runStage($, ''))).toContain('2/10 Brainstorm by auto (skill superpowers:brainstorming), just now')
  // Told once: the next result keeps its own context alone.
  expect((await callTool($, 'Read', { file_path: 'x' })).context).toEqual(['read note'])
})

test('writing a file a rule names moves the stage; its path is read relative to the session’s directory', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  await callTool($, 'Skill', skill('superpowers:brainstorming'))
  await callTool($, 'Write', { file_path: ['C:', 'Dev', 'other', 'docs', 'superpowers', 'specs', 'a.md'].join(BS), content: 'x' })
  expect(text(await runStage($, ''))).toContain('Stage 2/10 Brainstorm')
  await callTool($, 'Write', { file_path: ['c:', 'dev', 'proj', 'docs', 'superpowers', 'specs', 'a.md'].join(BS), content: 'x' })
  expect(text(await runStage($, ''))).toContain('3/10 Spec by auto (wrote docs/superpowers/specs/a.md)')
  // A worktree: the session's directory moved.
  world.cwd = '/repo/.claude/worktrees/x'
  await callTool($, 'Edit', { file_path: '/repo/.claude/worktrees/x/docs/superpowers/plans/p.md', old_string: 'a', new_string: 'b' })
  expect(text(await runStage($, ''))).toContain('5/10 Plan by auto (wrote docs/superpowers/plans/p.md)')
})

test('a Fable spawn from the spec moves to the spec audit; a subagent’s or a teammate’s spawn does not', async ($, on) => {
  const { world } = engine(on)
  world.spawnModel = 'claude-fable-5-1'
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await spawnAgent($, 'fable', 'claude-opus-5-5', { parentAgentId: 'agent-x' })
  await spawnAgent($, 'fable', 'claude-opus-5-5', { isTeammate: true })
  expect(text(await runStage($, ''))).toContain('Stage 3/10 Spec')
  await spawnAgent($, 'fable')
  expect(text(await runStage($, ''))).toContain('4/10 Spec audit by auto (agent on claude-fable-5-1)')
  // The note waits for the next prompt.
  await submit($)
  expect(world.prompts.at(-1)?.[0]).toContain('[stage-toons] The stage moved by itself to 4/10 Spec audit')
})

test('two Fable spawns at once move the work once', async ($, on) => {
  const { world } = engine(on)
  world.spawnModel = 'claude-fable-5-1'
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await Promise.all([spawnAgent($, 'fable'), spawnAgent($, 'fable')])
  expect(saved(world.store).history.map(h => h.stage)).toEqual(['spec', 'spec-audit'])
})

test('a subagent’s calls, failed calls, and moves back move nothing', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await callTool($, 'Skill', skill('superpowers:brainstorming'), 'agent-1')
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
  await setStage($, { stage: 'develop', message: 'Task 1' })
  const answer = await callTool($, 'Write', { file_path: 'C:/Dev/proj/docs/superpowers/plans/p.md', content: 'x' })
  expect(answer.context).toBeUndefined()
  expect(text(await runStage($, ''))).toContain('Stage 7/10 Develop')
})

test("a note follows the context a result already has", async ($, on) => {
  const { world } = engine(on)
  world.spawnModel = 'claude-fable-5-1'
  await $.session.start(START)
  await setStage($, { stage: 'plan', message: 'Writing it' })
  await spawnAgent($, 'fable')
  const answer = await callTool($, 'Read', { file_path: 'x' })
  expect(answer.context?.[0]).toBe('read note')
  expect(answer.context?.[1]).toContain('[stage-toons] The stage moved by itself to 6/10 Plan audit')
})

// The tests above show a spawn's note arriving; here set_stage comes first.
test('set_stage drops the notes Claude has not heard yet', async ($, on) => {
  const { world } = engine(on)
  world.spawnModel = 'claude-fable-5-1'
  await $.session.start(START)
  await setStage($, { stage: 'plan', message: 'Writing it' })
  await spawnAgent($, 'fable')
  expect(answerText(await setStage($, { stage: 'plan-audit', message: 'Fable reads the plan' }))).toContain('6/10 Plan audit')
  await submit($)
  expect(world.prompts.at(-1)).toBeUndefined()
})

test('/stage auto off stops the moves, for every project, and on starts them again', async ($, on) => {
  const { world } = engine(on)
  await $.session.start(START)
  expect(text(await runStage($, 'auto'))).toContain('Automatic moves are on')
  expect(text(await runStage($, 'auto off'))).toContain('Automatic moves are off')
  expect(world.store.auto).toBe(false)
  await callTool($, 'Skill', skill('superpowers:brainstorming'))
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
  await runStage($, 'auto on')
  await callTool($, 'Skill', skill('superpowers:brainstorming'))
  expect(text(await runStage($, ''))).toContain('2/10 Brainstorm')
})

test('a session starts with automatic moves off when the store says so', async ($, on) => {
  engine(on, { store: { auto: false } })
  await $.session.start(START)
  expect(text(await runStage($, 'auto'))).toContain('Automatic moves are off')
})

test('Claude’s working time goes to the stage it was spent in, across a move, and is saved at the turn’s end', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it', feature: 'login' })
  await startTurn($)
  await clock.advance(10 * MIN)
  await setStage($, { stage: 'plan', message: 'Planning' })
  await clock.advance(5 * MIN)
  await endTurn($)
  const history = saved(world.store).history
  expect(history.map(h => [h.stage, h.workMs])).toEqual([
    ['spec', 10 * MIN],
    ['plan', 5 * MIN],
  ])
  expect(saved(world.store).updatedAt).toBe(NOW + 15 * MIN)
  // Between turns nothing counts.
  await clock.advance(30 * MIN)
  expect(text(await runStage($, 'log'))).toContain('5/10 Plan   35m so far (Claude 5m)')
})

test('/stage log counts the turn under way; /stage time totals features and stages', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it', feature: 'login' })
  await startTurn($)
  await clock.advance(20 * MIN)
  expect(text(await runStage($, 'log'))).toContain('3/10 Spec   20m so far (Claude 20m)')
  const time = text(await runStage($, 'time'))
  expect(time).toContain('Time per feature:')
  expect(time).toContain('  login       20m (Claude 20m)')
  expect(time).toContain('  3/10 Spec   20m (Claude 20m)')
})

test('a turn whose start was missed credits its duration, at most since the stage began', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'spec', message: 'Writing it' })
  await clock.advance(3 * MIN)
  await endTurn($, undefined, 10 * MIN)
  expect(saved(world.store).history[0]!.workMs).toBe(3 * MIN)
})

test('the prompt section says the bar moves by itself', async ($, on) => {
  engine(on)
  await $.session.start(START)
  expect(await sectionText($)).toContain('The bar also moves by itself on some steps')
})

test('a session on the default an older version kept takes this version’s rules', async ($, on) => {
  const old = { track: DEFAULT_WORKFLOW.track.map(({ auto: _, ...s }) => s), side: DEFAULT_WORKFLOW.side.map(({ auto: _, ...s }) => s) }
  on('state.get', ($, e, next) => (e.key === 'workflow' ? { value: { value: { workflow: old, source: 'default' }, version: 1 } } : next(e)))
  engine(on)
  await $.session.start(START)
  await callTool($, 'Skill', skill('superpowers:brainstorming'))
  expect(text(await runStage($, ''))).toContain('2/10 Brainstorm')
})

test("a project's own rules: a bash rule moves on a command that ran, not on one that failed", async ($, on) => {
  const { world } = engine(on)
  const stage = (id: string, auto?: unknown[]) => ({ id, label: id, message: `In ${id}`, when: id, scenes: ['gift'], ...(auto ? { auto } : {}) })
  world.files['.claude/stage-toons.json'] = JSON.stringify({ track: [stage('plan'), stage('build', [{ bash: 'make build' }]), stage('ship', [{ bash: 'git merge' }])] })
  await $.session.start(START)
  const failed = await callTool($, 'Bash', { command: 'make build' })
  expect(failed.context).toBeUndefined()
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
  world.isBashFailing = false
  const ran = await callTool($, 'Bash', { command: 'make build' })
  expect(ran.context?.[0]).toContain('moved by itself to 2/3 build (ran make build)')
  await callTool($, 'Bash', { command: 'git checkout main && git merge feat' })
  expect(text(await runStage($, ''))).toContain('3/3 ship by auto (ran git checkout main && git merge feat)')
})

test('a Windows path matches a rule in any case', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await callTool($, 'Write', { file_path: ['C:', 'DEV', 'PROJ', 'Docs', 'Superpowers', 'Specs', 'a.md'].join(BS), content: 'x' })
  expect(text(await runStage($, ''))).toContain('3/10 Spec by auto (wrote Docs/Superpowers/Specs/a.md)')
})

test("with no session directory a file's path stays whole and matches no rule", async ($, on) => {
  const { world } = engine(on)
  world.isCwdBroken = true
  await $.session.start(START)
  await callTool($, 'Write', { file_path: 'C:/Dev/proj/docs/superpowers/specs/a.md', content: 'x' })
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
})

test("/stage feature mid-turn credits the turn so far to the feature it leaves", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await setStage($, { stage: 'develop', message: 'Building', feature: 'login' })
  await startTurn($)
  await clock.advance(10 * MIN)
  await runStage($, 'feature signup')
  await clock.advance(4 * MIN)
  await endTurn($)
  expect(saved(world.store).history.map(h => [h.feature, h.workMs])).toEqual([
    ['login', 10 * MIN],
    ['signup', 4 * MIN],
  ])
})
