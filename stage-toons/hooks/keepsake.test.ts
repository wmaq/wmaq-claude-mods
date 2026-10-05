import { expect, test } from 'claude-code/testing'

import type { Progress, StageId } from '../types'
import { idleForMove } from './keepsake'
import { IDLE_IDS } from './idle'
import { freshProgress } from './stages'
import { DEFAULT_WORKFLOW as W } from './workflow'

const at = (stage: StageId | null, lastTrackStage: StageId | null = stage): Progress => ({ ...freshProgress(0), stage, lastTrackStage })

test('into Done Clawd celebrates; a move within Done changes nothing', () => {
  expect(idleForMove(W, at('cleanup'), at('done', 'cleanup'), 'classic', 0.5)).toBe('celebrate')
  expect(idleForMove(W, at('develop'), at('done', 'develop'), 'classic', 0.5)).toBe('celebrate')
  expect(idleForMove(W, at('done', 'cleanup'), at('done', 'cleanup'), 'celebrate', 0.5)).toBeNull()
})

test('out of Done, a new round or a reopen, a random routine takes over from the celebration', () => {
  for (const after of [at('brainstorm'), at('cleanup'), at('debugging', null)]) {
    const routine = idleForMove(W, at('done', 'cleanup'), after, 'celebrate', 0.5)
    expect(IDLE_IDS).toContain(routine)
  }
})

test("forward on the track he shows off the prop of the step finished; from a side stage, of the track stage it left", () => {
  expect(idleForMove(W, at('spec'), at('spec-audit'), 'classic', 0.5)).toBe('show-off:spec')
  // A skip shows the stage it left.
  expect(idleForMove(W, at('spec'), at('develop'), 'classic', 0.5)).toBe('show-off:spec')
  expect(idleForMove(W, at('debugging', 'spec'), at('spec-audit'), 'classic', 0.5)).toBe('show-off:spec')
  // From untracked, or a side stage with no track stage behind it: nothing to show.
  expect(idleForMove(W, at(null), at('roadmap'), 'classic', 0.5)).toBeNull()
  expect(idleForMove(W, at('other', null), at('plan'), 'classic', 0.5)).toBeNull()
})

test('a move back, into a side stage, or a feature change leaves the pick', () => {
  expect(idleForMove(W, at('plan'), at('spec'), 'classic', 0.5)).toBeNull()
  expect(idleForMove(W, at('plan'), at('debugging', 'plan'), 'classic', 0.5)).toBeNull()
  expect(idleForMove(W, at('plan'), { ...at('plan'), feature: 'login' }, 'classic', 0.5)).toBeNull()
})
