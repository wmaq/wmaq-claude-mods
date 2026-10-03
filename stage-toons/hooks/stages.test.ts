import { expect, test } from 'claude-code/testing'

import type { Progress, StageId } from '../types'
import { applyMove, backStage, cut, describe, freshProgress, isAdvance, nextStage, parseStage, stageLabel } from './stages'
import { DEFAULT_WORKFLOW as W, type Workflow } from './workflow'

const at = (stage: StageId, extra: Partial<Progress> = {}): Progress => ({
  ...freshProgress(0),
  stage,
  lastTrackStage: stage === 'other' ? null : stage,
  ...extra,
})

test('a fresh project starts in Other, untracked', () => {
  expect(freshProgress(5)).toEqual({ v: 1, stage: 'other', lastTrackStage: null, feature: null, message: 'Not tracked yet', history: [], updatedAt: 5 })
})

test('stages parse from numbers, ids and the aliases for Other', () => {
  expect(parseStage(W, '5')).toBe('plan')
  expect(parseStage(W, ' Plan ')).toBe('plan')
  expect(parseStage(W, '10')).toBe('cleanup')
  expect(parseStage(W, '0')).toBe('other')
  expect(parseStage(W, '?')).toBe('other')
  expect(parseStage(W, 'other')).toBe('other')
  expect(parseStage(W, '11')).toBeUndefined()
  expect(parseStage(W, 'planning')).toBeUndefined()
  expect(parseStage(W, '')).toBeUndefined()
})

test('text is cut to fit, with whitespace and newlines collapsed', () => {
  expect(cut('  a\n\nb  ', 80)).toBe('a b')
  expect(cut('x'.repeat(90), 80)).toBe(`${'x'.repeat(79)}…`)
  expect(cut('x'.repeat(80), 80)).toBe('x'.repeat(80))
})

test("a move to a new stage takes that stage's message unless given one, and is recorded", () => {
  const p = applyMove(W, freshProgress(0), { stage: 'plan', by: 'user', at: 10 })
  expect(p.stage).toBe('plan')
  expect(p.message).toBe('Writing the implementation plan')
  expect(p.lastTrackStage).toBe('plan')
  expect(p.history).toEqual([{ stage: 'plan', at: 10, by: 'user' }])
  expect(p.updatedAt).toBe(10)
  const q = applyMove(W, p, { stage: 'plan', message: 'Splitting task 3', feature: 'stage-toons', by: 'claude', at: 20 })
  expect(q.message).toBe('Splitting task 3')
  expect(q.feature).toBe('stage-toons')
  expect(q.history).toHaveLength(1)
})

test('Other remembers the last track stage', () => {
  const p = applyMove(W, at('develop'), { stage: 'other', message: 'Fixing a CI flake', by: 'claude', at: 1 })
  expect(p.lastTrackStage).toBe('develop')
  expect(backStage(W, p)).toBe('develop')
  expect(nextStage(W, p)).toBe('claude-test')
})

test('next and back stop at the ends of the track', () => {
  expect(nextStage(W, at('cleanup'))).toBe('cleanup')
  expect(backStage(W, at('roadmap'))).toBe('roadmap')
  expect(nextStage(W, at('spec'))).toBe('spec-audit')
  expect(backStage(W, at('spec'))).toBe('brainstorm')
  expect(nextStage(W, freshProgress(0))).toBe('roadmap')
  expect(backStage(W, freshProgress(0))).toBe('other')
  expect(nextStage(W, at('other', { lastTrackStage: 'cleanup' }))).toBe('cleanup')
})

test('history keeps the last 50 moves', () => {
  let p = freshProgress(0)
  for (let i = 0; i < 60; i++) p = applyMove(W, p, { stage: i % 2 === 0 ? 'plan' : 'develop', by: 'claude', at: i })
  expect(p.history).toHaveLength(50)
  expect(p.history[49]?.at).toBe(59)
})

test('an advance is a move to a later track stage', () => {
  expect(isAdvance(W, at('spec'), at('plan'))).toBe(true)
  expect(isAdvance(W, at('plan'), at('spec'))).toBe(false)
  expect(isAdvance(W, at('plan'), at('plan'))).toBe(false)
  expect(isAdvance(W, freshProgress(0), at('roadmap'))).toBe(true)
  expect(isAdvance(W, at('other', { lastTrackStage: 'develop' }), at('plan'))).toBe(false)
  expect(isAdvance(W, at('other', { lastTrackStage: 'develop' }), at('cleanup'))).toBe(true)
  expect(isAdvance(W, at('plan'), at('other'))).toBe(false)
})

test('the state reads as one line', () => {
  expect(describe(W, applyMove(W, freshProgress(0), { stage: 'plan', feature: 'stage-toons', by: 'user', at: 1 }))).toBe(
    '5/10 Plan · stage-toons · "Writing the implementation plan"',
  )
  expect(describe(W, freshProgress(0))).toBe('? Other · no feature · "Not tracked yet"')
})

// Whether a string holds half of a surrogate pair, as a cut through an emoji leaves.
const hasHalfPair = (s: string) => Array.from(s).some(ch => ch.length === 1 && ch.charCodeAt(0) >= 0xd800 && ch.charCodeAt(0) <= 0xdfff)

test('text is cut between characters, never through an emoji', () => {
  expect(cut('a😀bcd', 3)).toBe('a😀…')
  expect(cut('ab😀', 3)).toBe('ab😀')
  expect(hasHalfPair(cut('x😀'.repeat(50), 80))).toBe(false)
})

const SMALL: Workflow = {
  track: [
    { id: 'plan', label: 'Plan', message: 'Planning', when: 'planning', scene: 'stepping-stones' },
    { id: 'build', label: 'Build', message: 'Building', when: 'building', scene: 'bricklaying' },
    { id: 'ship', label: 'Ship', message: 'Shipping', when: 'shipping', scene: 'gift' },
  ],
  side: [{ id: 'debugging', label: 'Debugging', message: 'Hunting a bug', when: 'debugging', scene: 'mystery-box' }],
}

test('any workflow: numbers, ids and 0 parse against it', () => {
  expect(parseStage(SMALL, '2')).toBe('build')
  expect(parseStage(SMALL, '4')).toBeUndefined()
  expect(parseStage(SMALL, '0')).toBe('debugging')
  expect(parseStage(SMALL, 'Ship')).toBe('ship')
  expect(parseStage(SMALL, 'roadmap')).toBeUndefined()
  expect(parseStage({ track: SMALL.track, side: [] }, '0')).toBeUndefined()
})

test('any workflow: moves, labels and the stage left for a side stage', () => {
  let p = applyMove(SMALL, freshProgress(0), { stage: 'build', by: 'claude', at: 1 })
  expect(p.message).toBe('Building')
  expect(describe(SMALL, p)).toBe('2/3 Build · no feature · "Building"')
  p = applyMove(SMALL, p, { stage: 'debugging', by: 'claude', at: 2 })
  expect(p.lastTrackStage).toBe('build')
  expect(stageLabel(SMALL, 'debugging')).toBe('? Debugging')
  expect(backStage(SMALL, p)).toBe('build')
  expect(nextStage(SMALL, p)).toBe('ship')
  expect(isAdvance(SMALL, p, applyMove(SMALL, p, { stage: 'ship', by: 'claude', at: 3 }))).toBe(true)
  expect(stageLabel(SMALL, 'qa')).toBe('qa (no longer in the workflow)')
})
