import { expect, test } from 'claude-code/testing'

import { moveFor, parseCommand, showText, USAGE } from './command'
import { applyMove, freshProgress } from './stages'

test('/stage arguments parse into commands', () => {
  expect(parseCommand('')).toEqual({ kind: 'show' })
  expect(parseCommand('   ')).toEqual({ kind: 'show' })
  expect(parseCommand('5')).toEqual({ kind: 'move', stage: 'plan' })
  expect(parseCommand(' Plan ')).toEqual({ kind: 'move', stage: 'plan' })
  expect(parseCommand('?')).toEqual({ kind: 'move', stage: 'other' })
  expect(parseCommand('NEXT')).toEqual({ kind: 'next' })
  expect(parseCommand('back')).toEqual({ kind: 'back' })
  expect(parseCommand('hide')).toEqual({ kind: 'hide' })
  expect(parseCommand('feature  stage toons ')).toEqual({ kind: 'feature', name: 'stage toons' })
  expect(parseCommand('message Writing task 3')).toEqual({ kind: 'message', text: 'Writing task 3' })
  for (const bad of ['11', 'feature', 'message', 'next please', 'plan now', 'deploy']) expect(parseCommand(bad)).toEqual({ kind: 'usage' })
})

test('commands move the progress as the user', () => {
  const p = freshProgress(0)
  expect(moveFor(p, { kind: 'move', stage: 'spec' }, 5)).toMatchObject({ stage: 'spec', message: 'Writing the spec', history: [{ stage: 'spec', at: 5, by: 'user' }] })
  expect(moveFor(p, { kind: 'next' }, 5).stage).toBe('roadmap')
  expect(moveFor(p, { kind: 'back' }, 5).stage).toBe('other')
  expect(moveFor(p, { kind: 'feature', name: 'gauge' }, 5).feature).toBe('gauge')
  expect(moveFor(moveFor(p, { kind: 'feature', name: 'gauge' }, 5), { kind: 'feature', name: '-' }, 6).feature).toBeNull()
  expect(moveFor(p, { kind: 'message', text: 'poking' }, 5).message).toBe('poking')
  expect(moveFor(p, { kind: 'show' }, 5)).toBe(p)
})

test('/stage alone shows the state and the latest moves first', () => {
  let p = applyMove(freshProgress(0), { stage: 'spec', by: 'claude', at: 0 })
  p = applyMove(p, { stage: 'plan', by: 'user', at: 60_000 })
  expect(showText(p, 3 * 60_000)).toBe(
    [
      'Stage 5/10 Plan · no feature · "Writing the implementation plan"',
      'Recent moves:',
      '  5/10 Plan by user, 2m ago',
      '  3/10 Spec by claude, 3m ago',
    ].join('\n'),
  )
  expect(showText(freshProgress(0), 0)).toBe('Stage ? Other · no feature · "Not tracked yet"')
  expect(USAGE).toContain('/stage next')
})
