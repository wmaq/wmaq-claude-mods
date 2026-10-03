import { expect, test } from 'claude-code/testing'

import { DEMO_SCENES, demoAt, demoLine } from './demo'
import { WIPE_MS } from './director'
import { DEFAULT_WORKFLOW } from './workflow'

const demo = { at: 1000, seconds: 10 }
const after = (ms: number) => demoAt(demo, demo.at + ms)

test('the demo plays the library: the default track scenes, then the mystery box and Fable', () => {
  expect(DEMO_SCENES).toEqual(['road-trip', 'light-bulbs', 'writing-desk', 'proofread-page', 'stepping-stones', 'proofread-checklist', 'bricklaying', 'test-tubes', 'gift', 'sweeping', 'mystery-box', 'fable-audit'])
})

test('each scene plays for its seconds, on its own clock from 0', () => {
  expect(after(0)).toMatchObject({ index: 0, sceneMs: 0, shot: { base: 'road-trip', wipe: null, reaction: null } })
  expect(after(9_999)).toMatchObject({ index: 0, sceneMs: 9_999 })
  expect(after(10_000)).toMatchObject({ index: 1, sceneMs: 0, shot: { base: 'light-bulbs' } })
  expect(after(115_000)).toMatchObject({ index: 11, sceneMs: 5_000, shot: { base: 'fable-audit' } })
  expect(demoAt({ at: 0, seconds: 3 }, 7_000)).toMatchObject({ index: 2, sceneMs: 1_000 })
})

test('a scene wipes in over the one before, the first one does not', () => {
  expect(after(10_000 + WIPE_MS / 2)?.shot.wipe).toEqual({ from: 'road-trip', progress: 0.5 })
  expect(after(10_000 + WIPE_MS)?.shot.wipe).toBeNull()
  expect(after(WIPE_MS / 2)?.shot.wipe).toBeNull()
})

test('the demo is over after its last scene', () => {
  expect(after(119_999)).not.toBeNull()
  expect(after(120_000)).toBeNull()
})

test('the demo line names the scene by the stage that uses it, and how to stop', () => {
  expect(demoLine(after(25_000)!, DEFAULT_WORKFLOW)).toBe('Demo 3/12: Spec · /stage demo stop ends it')
  expect(demoLine(after(115_000)!, DEFAULT_WORKFLOW)).toBe('Demo 12/12: Fable auditing · /stage demo stop ends it')
})
