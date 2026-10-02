import { expect, test } from 'claude-code/testing'

import { DEMO_SCENES, demoAt, demoLine } from './demo'
import { WIPE_MS } from './director'

const demo = { at: 1000, seconds: 10 }
const after = (ms: number) => demoAt(demo, demo.at + ms)

test('the demo plays the ten stages, Other and the auditor, in workflow order', () => {
  expect(DEMO_SCENES).toEqual(['roadmap', 'brainstorm', 'spec', 'spec-audit', 'plan', 'plan-audit', 'develop', 'claude-test', 'user-test', 'cleanup', 'other', 'auditor'])
})

test('each scene plays for its seconds, on its own clock from 0', () => {
  expect(after(0)).toMatchObject({ index: 0, sceneMs: 0, shot: { base: 'roadmap', wipe: null, reaction: null } })
  expect(after(9_999)).toMatchObject({ index: 0, sceneMs: 9_999 })
  expect(after(10_000)).toMatchObject({ index: 1, sceneMs: 0, shot: { base: 'brainstorm' } })
  expect(after(115_000)).toMatchObject({ index: 11, sceneMs: 5_000, shot: { base: 'auditor' } })
  expect(demoAt({ at: 0, seconds: 3 }, 7_000)).toMatchObject({ index: 2, sceneMs: 1_000 })
})

test('a scene wipes in over the one before, the first one does not', () => {
  expect(after(10_000 + WIPE_MS / 2)?.shot.wipe).toEqual({ from: 'roadmap', progress: 0.5 })
  expect(after(10_000 + WIPE_MS)?.shot.wipe).toBeNull()
  expect(after(WIPE_MS / 2)?.shot.wipe).toBeNull()
})

test('the demo is over after its last scene', () => {
  expect(after(119_999)).not.toBeNull()
  expect(after(120_000)).toBeNull()
})

test('the demo line names the scene and how to stop', () => {
  expect(demoLine(after(25_000)!)).toBe('Demo 3/12: Spec · /stage demo stop ends it')
  expect(demoLine(after(115_000)!)).toBe('Demo 12/12: Fable auditing · /stage demo stop ends it')
})
