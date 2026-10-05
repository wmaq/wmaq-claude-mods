import { expect, test } from 'claude-code/testing'

import type { Progress, StageId } from '../types'
import { applyMove, backStage, cellWidth, cut, describe, fitCells, freshProgress, isAdvance, isReopen, nextStage, parseStage, reconcile, stageLabel } from './stages'
import { standing } from './track'
import { DEFAULT_WORKFLOW as W, type Workflow } from './workflow'

const at = (stage: StageId, extra: Partial<Progress> = {}): Progress => ({
  ...freshProgress(0),
  stage,
  lastTrackStage: stage === 'other' ? null : stage,
  ...extra,
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
  expect(p.history).toEqual([{ stage: 'plan', at: 10, by: 'user', feature: null }])
  expect(p.updatedAt).toBe(10)
  const q = applyMove(W, p, { stage: 'plan', message: 'Splitting task 3', feature: 'stage-toons', by: 'claude', at: 20 })
  expect(q.message).toBe('Splitting task 3')
  expect(q.feature).toBe('stage-toons')
  // The feature changed: an entry for the same stage.
  expect(q.history).toEqual([...p.history, { stage: 'plan', at: 20, by: 'claude', feature: 'stage-toons' }])
  expect(applyMove(W, q, { stage: 'plan', message: 'Task 4', by: 'claude', at: 30 }).history).toHaveLength(2)
})

test('Other remembers the last track stage', () => {
  const p = applyMove(W, at('develop'), { stage: 'other', message: 'Fixing a CI flake', by: 'claude', at: 1 })
  expect(p.lastTrackStage).toBe('develop')
  expect(backStage(W, p)).toBe('develop')
  expect(nextStage(W, p)).toBe('claude-test')
})

test('next and back: the start of the track, and Done past its end', () => {
  expect(nextStage(W, at('cleanup'))).toBe('done')
  expect(backStage(W, at('roadmap'))).toBe('roadmap')
  expect(nextStage(W, at('spec'))).toBe('spec-audit')
  expect(backStage(W, at('spec'))).toBe('brainstorm')
  expect(nextStage(W, freshProgress(0))).toBe('roadmap')
  expect(backStage(W, freshProgress(0))).toBeNull()
  expect(nextStage(W, at('other', { lastTrackStage: 'cleanup' }))).toBe('done')
  // From Done, next starts a new round; back reopens the stage it came from.
  expect(nextStage(W, at('done', { lastTrackStage: 'cleanup' }))).toBe('roadmap')
  expect(backStage(W, at('done', { lastTrackStage: 'cleanup' }))).toBe('cleanup')
  expect(backStage(W, at('done', { lastTrackStage: null }))).toBe('done')
})

test('history keeps the last 200 moves', () => {
  let p = freshProgress(0)
  for (let i = 0; i < 230; i++) p = applyMove(W, p, { stage: i % 2 === 0 ? 'plan' : 'develop', by: 'claude', at: i })
  expect(p.history).toHaveLength(200)
  expect(p.history[199]?.at).toBe(229)
})

test('a change of feature alone is recorded in the stage; a message alone, or untracked, is not', () => {
  let p = applyMove(W, freshProgress(0), { stage: 'plan', feature: 'login', by: 'claude', at: 1 })
  p = applyMove(W, p, { stage: 'plan', message: 'Task 2', by: 'claude', at: 2 })
  p = applyMove(W, p, { stage: 'plan', feature: 'signup', by: 'user', at: 3 })
  p = applyMove(W, p, { stage: 'plan', feature: 'signup', by: 'user', at: 4 })
  expect(p.history).toEqual([
    { stage: 'plan', at: 1, by: 'claude', feature: 'login' },
    { stage: 'plan', at: 3, by: 'user', feature: 'signup' },
  ])
  expect(applyMove(W, freshProgress(0), { stage: null, feature: 'x', by: 'user', at: 1 }).history).toEqual([])
})

test('an automatic move is recorded by auto, with why, cut to 60', () => {
  const p = applyMove(W, freshProgress(0), { stage: 'spec', by: 'auto', via: `wrote ${'x'.repeat(70)}`, at: 5 })
  expect(p.history).toEqual([{ stage: 'spec', at: 5, by: 'auto', feature: null, via: `wrote ${'x'.repeat(53)}…` }])
  expect(p.message).toBe('Writing the spec')
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
  expect(describe(W, freshProgress(0))).toBe('Not tracked yet · no feature')
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
    { id: 'plan', label: 'Plan', message: 'Planning', when: 'planning', scenes: ['stepping-stones'] },
    { id: 'build', label: 'Build', message: 'Building', when: 'building', scenes: ['bricklaying'] },
    { id: 'ship', label: 'Ship', message: 'Shipping', when: 'shipping', scenes: ['gift'] },
  ],
  side: [{ id: 'debugging', label: 'Debugging', message: 'Hunting a bug', when: 'debugging', scenes: ['mystery-box'] }],
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
  expect(stageLabel(SMALL, 'debugging')).toBe('Debugging (side stage)')
  expect(describe(SMALL, p)).toBe('Debugging (side stage) · no feature · "Hunting a bug"')
  expect(backStage(SMALL, p)).toBe('build')
  expect(nextStage(SMALL, p)).toBe('ship')
  expect(isAdvance(SMALL, p, applyMove(SMALL, p, { stage: 'ship', by: 'claude', at: 3 }))).toBe(true)
  expect(stageLabel(SMALL, 'qa')).toBe('qa (no longer in the workflow)')
})

test('a fresh project is untracked', () => {
  expect(freshProgress(5)).toEqual({ v: 2, stage: null, lastTrackStage: null, feature: null, message: 'Not tracked yet', history: [], updatedAt: 5 })
  expect(describe(W, freshProgress(0))).toBe('Not tracked yet · no feature')
  expect(describe(W, { ...freshProgress(0), feature: 'login' })).toBe('Not tracked yet · login')
  expect(nextStage(W, freshProgress(0))).toBe('roadmap')
  expect(backStage(W, freshProgress(0))).toBeNull()
  expect(isAdvance(W, freshProgress(0), applyMove(W, freshProgress(0), { stage: 'roadmap', by: 'claude', at: 1 }))).toBe(true)
})

test('reconcile: a stage gone from the workflow goes back to the last track stage, or to untracked', () => {
  const onQa = { ...freshProgress(9), stage: 'qa', lastTrackStage: 'build', message: 'Testing', history: [{ stage: 'qa', at: 9, by: 'claude' as const }] }
  const back = reconcile(SMALL, onQa)
  expect(back.progress).toEqual({ ...onQa, stage: 'build', message: 'Building' })
  expect(back.moved).toBe('the saved stage "qa" is not in this workflow: back to 2/3 Build')
  const lost = reconcile(SMALL, { ...onQa, lastTrackStage: 'gone' })
  expect(lost.progress).toEqual({ ...onQa, stage: null, lastTrackStage: null, message: 'Not tracked yet' })
  expect(lost.moved).toBe('the saved stage "qa" is not in this workflow: not tracked yet')
  const fine = applyMove(SMALL, freshProgress(0), { stage: 'ship', by: 'claude', at: 1 })
  expect(reconcile(SMALL, fine)).toEqual({ progress: fine, moved: null })
})

test("reconcile: a last track stage that is now a side stage is forgotten, so back and the return note don't use it", () => {
  const p = { ...freshProgress(0), stage: 'debugging', lastTrackStage: 'debugging' }
  expect(reconcile(SMALL, p)).toEqual({ progress: { ...p, lastTrackStage: null }, moved: null })
  expect(backStage(SMALL, reconcile(SMALL, p).progress)).toBe('debugging')
})

test('text is measured in terminal cells: wide characters two, marks and joiners none', () => {
  expect(cellWidth('ab')).toBe(2)
  expect(cellWidth('')).toBe(0)
  expect(cellWidth(' 5/10 Plan · stage-toons')).toBe(24)
  expect(cellWidth('Plan ~ 日')).toBe(9)
  expect(cellWidth('🚀')).toBe(2)
  expect(cellWidth('日本')).toBe(4)
  expect(cellWidth(`e${String.fromCodePoint(0x301)}`)).toBe(1)
  expect(cellWidth('●━◉─○')).toBe(5)
  expect(cellWidth('✅')).toBe(2)
  expect(fitCells('日本語', 4)).toBe('日…')
  expect(fitCells('日本語', 6)).toBe('日本語')
  expect(fitCells('ab🚀cd', 4)).toBe('ab…')
  expect(fitCells('abc', 0)).toBe('')
})

test('Done parses by name, not by number, and reads with a tick', () => {
  expect(parseStage(W, ' Done ')).toBe('done')
  expect(parseStage(W, '11')).toBeUndefined()
  expect(stageLabel(W, 'done')).toBe('✓ Done')
  expect(standing(W, at('done', { lastTrackStage: 'cleanup' }))).toBe(-1)
})

test('a move into Done keeps the feature; out of it a new round starts, unless it goes back to reopen', () => {
  const done = applyMove(W, at('cleanup', { feature: 'login' }), { stage: 'done', by: 'claude', at: 5 })
  expect(done).toMatchObject({ stage: 'done', feature: 'login', lastTrackStage: 'cleanup', message: 'Merged and done' })
  expect(done.history.at(-1)).toMatchObject({ stage: 'done', feature: 'login' })
  // Into Done is no advance: commit plays the confetti for it separately.
  expect(isAdvance(W, at('cleanup', { feature: 'login' }), done)).toBe(false)
  // Back to the stage it came from: the feature reopened, no confetti.
  const reopened = applyMove(W, done, { stage: 'cleanup', by: 'user', at: 6 })
  expect(isReopen(done, 'cleanup')).toBe(true)
  expect(reopened).toMatchObject({ stage: 'cleanup', feature: 'login', lastTrackStage: 'cleanup' })
  expect(isAdvance(W, done, reopened)).toBe(false)
  // Any other move: a new round, with the feature it names or none.
  const round = applyMove(W, done, { stage: 'brainstorm', by: 'auto', at: 7 })
  expect(isReopen(done, 'brainstorm')).toBe(false)
  expect(round).toMatchObject({ stage: 'brainstorm', feature: null, lastTrackStage: 'brainstorm' })
  expect(isAdvance(W, done, round)).toBe(true)
  expect(applyMove(W, done, { stage: 'roadmap', feature: 'signup', by: 'claude', at: 7 }).feature).toBe('signup')
  expect(applyMove(W, done, { stage: 'debugging', by: 'user', at: 7 })).toMatchObject({ feature: null, lastTrackStage: null })
  // A message alone in Done changes nothing else.
  expect(applyMove(W, done, { stage: 'done', message: 'Tagged v1', by: 'claude', at: 8 })).toMatchObject({ feature: 'login', lastTrackStage: 'cleanup', message: 'Tagged v1' })
})
