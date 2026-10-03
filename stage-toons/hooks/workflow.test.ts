import { expect, test } from 'claude-code/testing'

import { STAGE_SCENES } from './scenes'
import { DEFAULT_WORKFLOW as W, isTrack, parseWorkflow, rank, sameWorkflow, sceneOf, stageIds, stageList, stageOf, type Workflow, workflowJson, zeroStage } from './workflow'

const SMALL: Workflow = {
  track: [
    { id: 'plan', label: 'Plan', message: 'Planning', when: 'planning the work', scene: 'stepping-stones' },
    { id: 'build', label: 'Build', message: 'Building', when: 'writing the code', scene: 'bricklaying' },
    { id: 'ship', label: 'Ship', message: 'Shipping', when: 'releasing it', scene: 'gift' },
  ],
  side: [{ id: 'debugging', label: 'Debugging', message: 'Hunting a bug', when: 'finding and fixing a bug', scene: 'mystery-box' }],
}

test('the default workflow is the ten stages on the track and Other beside it', () => {
  expect(W.track.map(s => s.id)).toEqual(['roadmap', 'brainstorm', 'spec', 'spec-audit', 'plan', 'plan-audit', 'develop', 'claude-test', 'user-test', 'cleanup'])
  expect(W.side.map(s => s.id)).toEqual(['debugging', 'other'])
  expect(stageOf(W, 'debugging')).toEqual({ id: 'debugging', label: 'Debugging', message: 'Hunting a bug', when: 'finding and fixing a bug, at any point', scene: 'bug-hunt' })
  expect(stageOf(W, 'plan')).toEqual({ id: 'plan', label: 'Plan', message: 'Writing the implementation plan', when: 'writing the implementation plan', scene: 'stepping-stones' })
  expect(stageOf(W, 'other')?.scene).toBe('mystery-box')
  for (const s of [...W.track, ...W.side]) for (const v of Object.values(s)) expect(v.length).toBeGreaterThan(0)
})

test('lookups answer for any workflow', () => {
  expect(stageIds(SMALL)).toEqual(['plan', 'build', 'ship', 'debugging'])
  expect(isTrack(SMALL, 'build')).toBe(true)
  expect(isTrack(SMALL, 'debugging')).toBe(false)
  expect(isTrack(SMALL, null)).toBe(false)
  expect(rank(SMALL, 'ship')).toBe(2)
  expect(rank(SMALL, 'debugging')).toBe(-1)
  expect(rank(SMALL, null)).toBe(-1)
  expect(stageOf(SMALL, 'qa')).toBeUndefined()
  expect(sceneOf(SMALL, 'build')).toBe('bricklaying')
  expect(sceneOf(SMALL, 'qa')).toBe('mystery-box')
  expect(sceneOf(SMALL, null)).toBe('mystery-box')
})

test('/stage 0 goes to Other when there is one, else to the first side stage', () => {
  expect(zeroStage(W)?.id).toBe('other')
  expect(zeroStage(SMALL)?.id).toBe('debugging')
  expect(zeroStage({ track: SMALL.track, side: [] })).toBeUndefined()
})

test('the stage list names the track in order and the side stages', () => {
  expect(stageList(SMALL)).toBe('track: plan, build, ship; side: debugging')
  expect(stageList({ track: SMALL.track, side: [] })).toBe('track: plan, build, ship')
})

const stage = (id: string, extra: Record<string, unknown> = {}) => ({ id, label: 'L', message: 'M', when: 'W', scene: 'gift', ...extra })
const parse = (data: unknown) => parseWorkflow(JSON.stringify(data), STAGE_SCENES)
const errorsOf = (data: unknown) => {
  const r = parse(data)

  return 'errors' in r ? r.errors : []
}

test('what init writes parses back to the default workflow', () => {
  const r = parseWorkflow(workflowJson(W), STAGE_SCENES)
  expect('workflow' in r && sameWorkflow(r.workflow, W)).toBe(true)
  const NL = String.fromCharCode(10)
  expect(workflowJson(W).endsWith(`}${NL}`)).toBe(true)
  expect(workflowJson(W)).toContain(`${NL}  "track": [`)
})

test('a small workflow parses; side stages are optional; text is trimmed', () => {
  const r = parse({ track: [stage('plan', { label: '  Plan ' })] })
  expect(r).toEqual({ workflow: { track: [{ id: 'plan', label: 'Plan', message: 'M', when: 'W', scene: 'gift' }], side: [] } })
})

test('a byte-order mark and Windows line endings are fine', () => {
  const crlf = JSON.stringify({ track: [stage('plan')] }, null, 2).split(String.fromCharCode(10)).join(String.fromCharCode(13, 10))
  const r = parseWorkflow(`${String.fromCharCode(0xfeff)}${crlf}`, STAGE_SCENES)
  expect('workflow' in r).toBe(true)
})

test('every error is listed with its path', () => {
  expect(errorsOf('nope')).toEqual(['the file must hold an object with "track" and, if any, "side"'])
  const broken = parseWorkflow('{ "track": [', STAGE_SCENES)
  expect('errors' in broken && broken.errors.length === 1 && broken.errors[0]!.startsWith('not valid JSON: ')).toBe(true)
  expect(errorsOf({ track: [stage('plan')], extra: 1 })).toEqual(['extra: not a field (track, side)'])
  expect(errorsOf({ side: [] })).toEqual(['track: missing, or not a list of stages'])
  expect(errorsOf({ track: [] })).toEqual(['track: 0 stages, at least 1'])
  expect(errorsOf({ track: ['plan'] })).toEqual(['track[0]: not a stage (an object with id, label, message, when, scene)'])
  expect(errorsOf({ track: [{ id: 'plan', label: 'L', message: 'M', scene: 'gift', lable: 'x' }] })).toEqual([
    'track[0].lable: not a field (id, label, message, when, scene)',
    'track[0].when: missing',
  ])
  expect(errorsOf({ track: [stage('plan', { label: 3 })] })).toEqual(['track[0].label: must be text'])
  expect(errorsOf({ track: [stage('plan', { label: '   ' })] })).toEqual(['track[0].label: empty'])
  expect(errorsOf({ track: [stage('plan', { label: 'x'.repeat(21) })] })).toEqual(['track[0].label: 21 characters, at most 20'])
  expect(errorsOf({ track: [stage('Plan')] })).toEqual(['track[0].id "Plan": lowercase letters, digits and dashes, starting with a letter'])
  expect(errorsOf({ track: [stage('next')] })).toEqual([
    `track[0].id "next" is one of /stage's words (next, back, hide, demo, feature, message, workflow)`,
  ])
  expect(errorsOf({ track: [stage('plan'), stage('plan')] })).toEqual(['track[1].id "plan" is used twice'])
  expect(errorsOf({ track: [stage('plan')], side: [stage('plan')] })).toEqual(['side[0].id "plan" is used twice'])
  expect(errorsOf({ track: [stage('plan', { scene: 'bug-hnt' })] })).toEqual([`track[0].scene "bug-hnt" is not a scene (${STAGE_SCENES.join(', ')})`])
  expect(errorsOf({ track: [stage('plan', { scene: 'fable-audit' })] })).toEqual([
    `track[0].scene "fable-audit" plays while a Fable subagent runs, whatever the stage; a stage can't use it`,
  ])
  expect(errorsOf({ track: [stage('plan', { scene: 'standing' })] })).toEqual([
    `track[0].scene "standing" is the fallback for a scene that breaks; a stage can't use it`,
  ])
})

test('the limits: 15 track stages, 5 side stages', () => {
  const many = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => stage(`${prefix}${i}`))
  expect('workflow' in parse({ track: many(15, 't'), side: many(5, 's') })).toBe(true)
  expect(errorsOf({ track: many(16, 't') })).toEqual(['track: 16 stages, at most 15'])
  expect(errorsOf({ track: many(1, 't'), side: many(6, 's') })).toEqual(['side: 6 stages, at most 5'])
})

test('two workflows are the same when their stages are', () => {
  expect(sameWorkflow(W, { track: [...W.track], side: [...W.side] })).toBe(true)
  expect(sameWorkflow(W, { track: W.track.slice(1), side: W.side })).toBe(false)
})
