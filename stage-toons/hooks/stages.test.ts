import { expect, test } from 'claude-code/testing'

import type { Progress, StageId } from '../types'
import { applyMove, backStage, cut, describe, freshProgress, isAdvance, nextStage, parseStage, STAGES, TRACK } from './stages'

const at = (stage: StageId, extra: Partial<Progress> = {}): Progress => ({
  ...freshProgress(0),
  stage,
  lastTrackStage: stage === 'other' ? null : stage,
  ...extra,
})

test('the track has ten stages in order, and every stage has a label and a message', () => {
  expect(TRACK).toEqual(['roadmap', 'brainstorm', 'spec', 'spec-audit', 'plan', 'plan-audit', 'develop', 'claude-test', 'user-test', 'cleanup'])
  for (const id of [...TRACK, 'other'] as const) {
    expect(STAGES[id].label.length).toBeGreaterThan(0)
    expect(STAGES[id].message.length).toBeGreaterThan(0)
  }
  expect(STAGES.other.label).toBe('Other')
})

test('a fresh project starts in Other, untracked', () => {
  expect(freshProgress(5)).toEqual({ v: 1, stage: 'other', lastTrackStage: null, feature: null, message: 'Not tracked yet', history: [], updatedAt: 5 })
})

test('stages parse from numbers, ids and the aliases for Other', () => {
  expect(parseStage('5')).toBe('plan')
  expect(parseStage(' Plan ')).toBe('plan')
  expect(parseStage('10')).toBe('cleanup')
  expect(parseStage('0')).toBe('other')
  expect(parseStage('?')).toBe('other')
  expect(parseStage('other')).toBe('other')
  expect(parseStage('11')).toBeUndefined()
  expect(parseStage('planning')).toBeUndefined()
  expect(parseStage('')).toBeUndefined()
})

test('text is cut to fit, with whitespace and newlines collapsed', () => {
  expect(cut('  a\n\nb  ', 80)).toBe('a b')
  expect(cut('x'.repeat(90), 80)).toBe(`${'x'.repeat(79)}…`)
  expect(cut('x'.repeat(80), 80)).toBe('x'.repeat(80))
})

test("a move to a new stage takes that stage's message unless given one, and is recorded", () => {
  const p = applyMove(freshProgress(0), { stage: 'plan', by: 'user', at: 10 })
  expect(p.stage).toBe('plan')
  expect(p.message).toBe('Writing the implementation plan')
  expect(p.lastTrackStage).toBe('plan')
  expect(p.history).toEqual([{ stage: 'plan', at: 10, by: 'user' }])
  expect(p.updatedAt).toBe(10)
  const q = applyMove(p, { stage: 'plan', message: 'Splitting task 3', feature: 'stage-toons', by: 'claude', at: 20 })
  expect(q.message).toBe('Splitting task 3')
  expect(q.feature).toBe('stage-toons')
  expect(q.history).toHaveLength(1)
})

test('Other remembers the last track stage', () => {
  const p = applyMove(at('develop'), { stage: 'other', message: 'Fixing a CI flake', by: 'claude', at: 1 })
  expect(p.lastTrackStage).toBe('develop')
  expect(backStage(p)).toBe('develop')
  expect(nextStage(p)).toBe('claude-test')
})

test('next and back stop at the ends of the track', () => {
  expect(nextStage(at('cleanup'))).toBe('cleanup')
  expect(backStage(at('roadmap'))).toBe('roadmap')
  expect(nextStage(at('spec'))).toBe('spec-audit')
  expect(backStage(at('spec'))).toBe('brainstorm')
  expect(nextStage(freshProgress(0))).toBe('roadmap')
  expect(backStage(freshProgress(0))).toBe('other')
  expect(nextStage(at('other', { lastTrackStage: 'cleanup' }))).toBe('cleanup')
})

test('history keeps the last 50 moves', () => {
  let p = freshProgress(0)
  for (let i = 0; i < 60; i++) p = applyMove(p, { stage: i % 2 === 0 ? 'plan' : 'develop', by: 'claude', at: i })
  expect(p.history).toHaveLength(50)
  expect(p.history[49]?.at).toBe(59)
})

test('an advance is a move to a later track stage', () => {
  expect(isAdvance(at('spec'), at('plan'))).toBe(true)
  expect(isAdvance(at('plan'), at('spec'))).toBe(false)
  expect(isAdvance(at('plan'), at('plan'))).toBe(false)
  expect(isAdvance(freshProgress(0), at('roadmap'))).toBe(true)
  expect(isAdvance(at('other', { lastTrackStage: 'develop' }), at('plan'))).toBe(false)
  expect(isAdvance(at('other', { lastTrackStage: 'develop' }), at('cleanup'))).toBe(true)
  expect(isAdvance(at('plan'), at('other'))).toBe(false)
})

test('the state reads as one line', () => {
  expect(describe(applyMove(freshProgress(0), { stage: 'plan', feature: 'stage-toons', by: 'user', at: 1 }))).toBe(
    '5/10 Plan · stage-toons · "Writing the implementation plan"',
  )
  expect(describe(freshProgress(0))).toBe('? Other · no feature · "Not tracked yet"')
})

// Whether a string holds half of a surrogate pair, as a cut through an emoji leaves.
const hasHalfPair = (s: string) => Array.from(s).some(ch => ch.length === 1 && ch.charCodeAt(0) >= 0xd800 && ch.charCodeAt(0) <= 0xdfff)

test('text is cut between characters, never through an emoji', () => {
  expect(cut('a😀bcd', 3)).toBe('a😀…')
  expect(cut('ab😀', 3)).toBe('ab😀')
  expect(hasHalfPair(cut('x😀'.repeat(50), 80))).toBe(false)
})
