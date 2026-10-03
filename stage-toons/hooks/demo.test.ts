import { expect, test } from 'claude-code/testing'

import { type Demo, demoAt, demoLine, IDLE_DEMO_LENGTH, idleDemoAt, idleDemoLine } from './demo'
import { WIPE_MS } from './director'
import { IDLE_IDS } from './idle'
import { DEMO_ORDER, STAGE_SCENES } from './scenes'
import { DEFAULT_WORKFLOW } from './workflow'

const library: Demo = { kind: 'scenes', at: 1000, seconds: 10, scenes: DEMO_ORDER }
const after = (ms: number, demo: Demo = library) => demoAt(demo, demo.at + ms)

test("the library demo plays the default workflow's scenes stage by stage, then Fable", () => {
  expect(DEMO_ORDER.slice(0, 4)).toEqual(['road-trip', 'stargazing', 'treasure-map', 'light-bulbs'])
  expect(DEMO_ORDER.at(-1)).toBe('fable-audit')
  expect(DEMO_ORDER).toHaveLength(37)
  for (const id of STAGE_SCENES) expect(DEMO_ORDER).toContain(id)
})

test('each scene plays for its seconds, on its own clock from 0, wiping in over the one before', () => {
  expect(after(0)).toMatchObject({ index: 0, sceneMs: 0, shot: { base: 'road-trip', wipe: null, reaction: null } })
  expect(after(10_000)).toMatchObject({ index: 1, sceneMs: 0, shot: { base: 'stargazing' } })
  expect(after(10_000 + WIPE_MS / 2)?.shot.wipe).toEqual({ from: 'road-trip', progress: 0.5 })
  expect(after(WIPE_MS / 2)?.shot.wipe).toBeNull()
  expect(after(369_999)).not.toBeNull()
  expect(after(370_000)).toBeNull()
})

test("a stage's demo plays its scenes; its line names them by the first stage that lists them", () => {
  const develop: Demo = { kind: 'scenes', at: 0, seconds: 5, scenes: DEFAULT_WORKFLOW.track[6]!.scenes }
  expect(demoLine(after(5_000, develop)!, develop, DEFAULT_WORKFLOW)).toBe('Demo 2/3: terminal (Develop) · /stage demo stop ends it')
  expect(demoLine(after(10_000, develop)!, develop, DEFAULT_WORKFLOW)).toBe('Demo 3/3: workbench (Develop) · /stage demo stop ends it')
  expect(after(15_000, develop)).toBeNull()
  expect(demoLine(after(360_000)!, library, DEFAULT_WORKFLOW)).toBe('Demo 37/37: fable-audit (Fable reviewing) · /stage demo stop ends it')
})

test('the idle demo plays each routine, then the doze', () => {
  const idle: Demo = { kind: 'idle', at: 0, seconds: 3 }
  expect(IDLE_DEMO_LENGTH).toBe(IDLE_IDS.length + 1)
  expect(idleDemoAt(idle, 0)).toEqual({ index: 0, routine: 'classic', ms: 0 })
  expect(idleDemoAt(idle, 3_500)).toEqual({ index: 1, routine: 'nyan', ms: 500 })
  expect(idleDemoAt(idle, 6_000)).toEqual({ index: 2, routine: null, ms: 0 })
  expect(idleDemoAt(idle, 9_000)).toBeNull()
  expect(idleDemoLine(idleDemoAt(idle, 3_500)!)).toBe('Idle demo 2/3: nyan · /stage demo stop ends it')
  expect(idleDemoLine(idleDemoAt(idle, 6_000)!)).toBe('Idle demo 3/3: doze · /stage demo stop ends it')
  expect(demoAt(idle, 0)).toBeNull()
})
