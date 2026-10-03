import { expect, test } from 'claude-code/testing'

import { moveFor, parseCommand, showText, usage } from './command'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW } from './workflow'

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

test('/stage demo takes seconds per scene, 2 to 60, or stop', () => {
  expect(parseCommand(DEFAULT_WORKFLOW, 'demo')).toEqual({ kind: 'demo', seconds: 10 })
  expect(parseCommand(DEFAULT_WORKFLOW, 'Demo 4')).toEqual({ kind: 'demo', seconds: 4 })
  expect(parseCommand(DEFAULT_WORKFLOW, 'demo 2')).toEqual({ kind: 'demo', seconds: 2 })
  expect(parseCommand(DEFAULT_WORKFLOW, 'demo 60')).toEqual({ kind: 'demo', seconds: 60 })
  expect(parseCommand(DEFAULT_WORKFLOW, 'demo stop')).toEqual({ kind: 'demo-stop' })
  for (const bad of ['demo 1', 'demo 61', 'demo 2.5', 'demo x', 'demo 5 6', 'demo -3']) expect(parseCommand(DEFAULT_WORKFLOW, bad)).toEqual({ kind: 'usage' })
  expect(usage(DEFAULT_WORKFLOW)).toContain('/stage demo [seconds]')
})

test('commands move the progress as the user', () => {
  const p = freshProgress(0)
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'move', stage: 'spec' }, 5)).toMatchObject({ stage: 'spec', message: 'Writing the spec', history: [{ stage: 'spec', at: 5, by: 'user' }] })
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'next' }, 5).stage).toBe('roadmap')
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'back' }, 5).stage).toBe('other')
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
  expect(showText(DEFAULT_WORKFLOW, freshProgress(0), 0)).toBe('Stage ? Other · no feature · "Not tracked yet"')
  expect(usage(DEFAULT_WORKFLOW)).toContain('/stage next')
})

test('the usage lists the workflow stages and says where 0 goes', () => {
  expect(usage(DEFAULT_WORKFLOW)).toContain('(0 or ? for Other)')
  expect(usage(DEFAULT_WORKFLOW)).toContain('Stages: 1 roadmap, 2 brainstorm, 3 spec, 4 spec-audit, 5 plan, 6 plan-audit, 7 develop, 8 claude-test, 9 user-test, 10 cleanup, 0 other')
  const small = { track: DEFAULT_WORKFLOW.track.slice(0, 2), side: [] }
  expect(usage(small)).toContain('Stages: 1 roadmap, 2 brainstorm')
  expect(usage(small)).not.toContain('0 or ?')
})
