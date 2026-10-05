import { expect, test } from 'claude-code/testing'

import { applyMove, freshProgress } from './stages'
import { isTrack, rank, standing } from './track'
import { DEFAULT_WORKFLOW as W } from './workflow'

test('a stage has a place on the track from 0, or -1 off it', () => {
  expect(isTrack(W, 'plan')).toBe(true)
  expect(isTrack(W, 'debugging')).toBe(false)
  expect(isTrack(W, null)).toBe(false)
  expect(rank(W, 'roadmap')).toBe(0)
  expect(rank(W, 'plan')).toBe(4)
  expect(rank(W, 'debugging')).toBe(-1)
  expect(rank(W, null)).toBe(-1)
})

test('the work stands at its track stage, or the one a side stage returns to', () => {
  const fresh = freshProgress(0)
  expect(standing(W, fresh)).toBe(-1)
  const plan = applyMove(W, fresh, { stage: 'plan', by: 'user', at: 1 })
  expect(standing(W, plan)).toBe(4)
  const side = applyMove(W, plan, { stage: 'debugging', by: 'user', at: 2 })
  expect(standing(W, side)).toBe(4)
  const sideFirst = applyMove(W, fresh, { stage: 'debugging', by: 'user', at: 1 })
  expect(standing(W, sideFirst)).toBe(-1)
})
