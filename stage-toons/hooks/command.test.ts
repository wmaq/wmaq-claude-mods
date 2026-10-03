import { expect, test } from 'claude-code/testing'

import { moveFor, parseCommand, showText, usage, workflowSummary } from './command'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW } from './workflow'

const W = DEFAULT_WORKFLOW

test('/stage arguments parse into commands', () => {
  expect(parseCommand(DEFAULT_WORKFLOW, '')).toEqual({ kind: 'show' })
  expect(parseCommand(DEFAULT_WORKFLOW, '   ')).toEqual({ kind: 'show' })
  expect(parseCommand(DEFAULT_WORKFLOW, '5')).toEqual({ kind: 'move', stage: 'plan' })
  expect(parseCommand(DEFAULT_WORKFLOW, ' Plan ')).toEqual({ kind: 'move', stage: 'plan' })
  expect(parseCommand(DEFAULT_WORKFLOW, '?')).toEqual({ kind: 'move', stage: 'other' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'NEXT')).toEqual({ kind: 'next' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'back')).toEqual({ kind: 'back' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'hide')).toEqual({ kind: 'hide' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'feature  stage toons ')).toEqual({ kind: 'feature', name: 'stage toons' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'message Writing task 3')).toEqual({ kind: 'message', text: 'Writing task 3' })
  for (const bad of ['11', 'feature', 'message', 'next please', 'plan now', 'deploy']) expect(parseCommand(DEFAULT_WORKFLOW, bad)).toEqual({ kind: 'usage' })
})

test('/stage demo takes the library, a stage by id, or idle, with seconds per item, or stop', () => {
  expect(parseCommand(W, 'demo')).toEqual({ kind: 'demo', seconds: 10, stage: null })
  expect(parseCommand(W, 'Demo 4')).toEqual({ kind: 'demo', seconds: 4, stage: null })
  expect(parseCommand(W, 'demo 60')).toEqual({ kind: 'demo', seconds: 60, stage: null })
  expect(parseCommand(W, 'demo develop')).toEqual({ kind: 'demo', seconds: 10, stage: 'develop' })
  expect(parseCommand(W, 'demo develop 5')).toEqual({ kind: 'demo', seconds: 5, stage: 'develop' })
  expect(parseCommand(W, 'demo idle')).toEqual({ kind: 'demo-idle', seconds: 10 })
  expect(parseCommand(W, 'demo idle 5')).toEqual({ kind: 'demo-idle', seconds: 5 })
  expect(parseCommand(W, 'demo stop')).toEqual({ kind: 'demo-stop' })
  for (const bad of ['demo 1', 'demo 61', 'demo 2.5', 'demo x', 'demo 5 6', 'demo -3', 'demo nope', 'demo develop 1', 'demo idle x', 'demo stop now', 'demo develop 5 6']) {
    expect(parseCommand(W, bad)).toEqual({ kind: 'usage' })
  }
  expect(usage(W)).toContain('/stage demo [<stage> | idle] [seconds]')
})

test('commands move the progress as the user', () => {
  const p = freshProgress(0)
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'move', stage: 'spec' }, 5)).toMatchObject({ stage: 'spec', message: 'Writing the spec', history: [{ stage: 'spec', at: 5, by: 'user' }] })
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'next' }, 5).stage).toBe('roadmap')
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'back' }, 5).stage).toBeNull()
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'feature', name: 'gauge' }, 5).feature).toBe('gauge')
  expect(moveFor(DEFAULT_WORKFLOW, moveFor(DEFAULT_WORKFLOW, p, { kind: 'feature', name: 'gauge' }, 5), { kind: 'feature', name: '-' }, 6).feature).toBeNull()
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'message', text: 'poking' }, 5).message).toBe('poking')
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'show' }, 5)).toBe(p)
})

test('/stage alone shows the state and the latest moves first', () => {
  let p = applyMove(DEFAULT_WORKFLOW, freshProgress(0), { stage: 'spec', by: 'claude', at: 0 })
  p = applyMove(DEFAULT_WORKFLOW, p, { stage: 'plan', by: 'user', at: 60_000 })
  expect(showText(DEFAULT_WORKFLOW, p, 3 * 60_000)).toBe(
    [
      'Stage 5/10 Plan · no feature · "Writing the implementation plan"',
      'Recent moves:',
      '  5/10 Plan by user, 2m ago',
      '  3/10 Spec by claude, 3m ago',
    ].join('\n'),
  )
  expect(showText(DEFAULT_WORKFLOW, freshProgress(0), 0)).toBe('Stage Not tracked yet · no feature')
  expect(usage(DEFAULT_WORKFLOW)).toContain('/stage next')
})

test('the usage lists the workflow stages and says where 0 goes', () => {
  expect(usage(DEFAULT_WORKFLOW)).toContain('(0 or ? for Other)')
  expect(usage(DEFAULT_WORKFLOW)).toContain('Stages: 1 roadmap, 2 brainstorm, 3 spec, 4 spec-audit, 5 plan, 6 plan-audit, 7 develop, 8 claude-test, 9 user-test, 10 cleanup, debugging, 0 other')
  const small = { track: DEFAULT_WORKFLOW.track.slice(0, 2), side: [] }
  expect(usage(small)).toContain('Stages: 1 roadmap, 2 brainstorm')
  expect(usage(small)).not.toContain('0 or ?')
})

test('/stage workflow shows, inits or reloads the workflow', () => {
  expect(parseCommand(W, 'workflow')).toEqual({ kind: 'workflow' })
  expect(parseCommand(W, 'Workflow INIT')).toEqual({ kind: 'workflow-init' })
  expect(parseCommand(W, 'workflow reload')).toEqual({ kind: 'workflow-reload' })
  expect(parseCommand(W, 'workflow edit')).toEqual({ kind: 'usage' })
  expect(usage(W)).toContain('/stage workflow [init | reload]')
})

test('the workflow summary says where it came from and lists the stages with their scenes', () => {
  const lines = workflowSummary(W, 'default').split('\n')
  expect(lines[0]).toBe('Workflow: the default (no .claude/stage-toons.json; /stage workflow init writes it there to edit)')
  expect(lines).toContain(`  7 develop: Develop (${W.track[6]!.scenes.join(', ')})`)
  expect(lines).toContain(`  0 other: Other (${W.side[1]!.scenes.join(', ')})`)
  const two = { track: [{ ...W.track[0]!, scenes: ['road-trip', 'gift'] }], side: [] }
  expect(workflowSummary(two, 'file').split('\n')).toEqual(['Workflow: from .claude/stage-toons.json', 'Track:', '  1 roadmap: Roadmap (road-trip, gift)'])
})
