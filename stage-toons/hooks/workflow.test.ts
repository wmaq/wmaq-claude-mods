import { expect, test } from 'claude-code/testing'

import { DEFAULT_WORKFLOW as W, isTrack, rank, sceneOf, stageIds, stageList, stageOf, type Workflow, zeroStage } from './workflow'

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
  expect(W.side.map(s => s.id)).toEqual(['other'])
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
