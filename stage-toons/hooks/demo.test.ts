import { expect, test } from 'claude-code/testing'

import type { BandSite } from './band'
import { type Demo, demoAt, demoFor, demoLine, demoStep, hasRoom, IDLE_DEMO_LENGTH, idleDemoAt, idleDemoLine, WORK_STEPS, workDemoAt, workDemoLine } from './demo'
import { LINES } from './work'
import { IDLE_IDS } from './idle'
import { DEMO_ORDER, STAGE_SCENES } from './scenes'
import { TOON_ROWS } from './toon'
import { DEFAULT_WORKFLOW } from './workflow'

const library: Demo = { kind: 'scenes', at: 1000, seconds: 10, scenes: DEMO_ORDER }
const after = (ms: number, demo: Demo = library) => demoAt(demo, demo.at + ms)

test("the library demo plays the default workflow's scenes stage by stage, then Fable", () => {
  expect(DEMO_ORDER.slice(0, 4)).toEqual(['road-trip', 'stargazing', 'treasure-map', 'light-bulbs'])
  expect(DEMO_ORDER.at(-1)).toBe('fable-audit')
  expect(DEMO_ORDER).toHaveLength(39)
  expect(DEMO_ORDER.slice(DEMO_ORDER.indexOf('recycling') + 1, DEMO_ORDER.indexOf('recycling') + 3)).toEqual(['fireworks', 'rocket'])
  for (const id of STAGE_SCENES) expect(DEMO_ORDER).toContain(id)
})

test('each scene plays for its seconds, on its own clock from 0', () => {
  expect(after(0)).toMatchObject({ index: 0, sceneMs: 0, shot: { base: 'road-trip', time: 0, reaction: null } })
  expect(after(10_000)).toMatchObject({ index: 1, sceneMs: 0, shot: { base: 'stargazing', time: 0 } })
  expect(after(12_500)).toMatchObject({ index: 1, sceneMs: 2500, shot: { base: 'stargazing', time: 2.5, reaction: null } })
  expect(after(389_999)).not.toBeNull()
  expect(after(390_000)).toBeNull()
})

test("a stage's demo plays its scenes; its line names them by the first stage that lists them", () => {
  const develop: Demo = { kind: 'scenes', at: 0, seconds: 5, scenes: DEFAULT_WORKFLOW.track[6]!.scenes }
  expect(demoLine(after(5_000, develop)!, develop, DEFAULT_WORKFLOW)).toBe('Demo 2/3: terminal (Develop) · /stage demo stop ends it')
  expect(demoLine(after(10_000, develop)!, develop, DEFAULT_WORKFLOW)).toBe('Demo 3/3: workbench (Develop) · /stage demo stop ends it')
  expect(after(15_000, develop)).toBeNull()
  expect(demoLine(after(380_000)!, library, DEFAULT_WORKFLOW)).toBe('Demo 39/39: fable-audit (Fable reviewing) · /stage demo stop ends it')
  expect(demoLine(after(300_000)!, library, DEFAULT_WORKFLOW)).toBe('Demo 31/39: fireworks (Done) · /stage demo stop ends it')
  expect(demoLine(after(310_000)!, library, DEFAULT_WORKFLOW)).toBe('Demo 32/39: rocket (Done) · /stage demo stop ends it')
})

test('the idle demo plays each routine, the celebration, the show-off with each prop in turn, then the doze', () => {
  const idle: Demo = { kind: 'idle', at: 0, seconds: 3 }
  expect(IDLE_DEMO_LENGTH).toBe(IDLE_IDS.length + 3)
  expect(idleDemoAt(idle, 0)).toEqual({ index: 0, routine: 'classic', ms: 0 })
  expect(idleDemoAt(idle, 3_500)).toEqual({ index: 1, routine: 'nyan', ms: 500 })
  expect(idleDemoAt(idle, 6_000)).toEqual({ index: 2, routine: 'coffee', ms: 0 })
  expect(idleDemoAt(idle, 15_000)).toEqual({ index: 5, routine: 'celebrate', ms: 0 })
  // Each prop for 2 s, on its own clock.
  expect(idleDemoAt(idle, 18_000)).toEqual({ index: 6, routine: 'show-off:roadmap', ms: 0 })
  expect(idleDemoAt(idle, 20_500)).toEqual({ index: 6, routine: 'show-off:brainstorm', ms: 500 })
  expect(idleDemoAt(idle, 21_000)).toEqual({ index: 7, routine: null, ms: 0 })
  expect(idleDemoAt(idle, 24_000)).toBeNull()
  expect(idleDemoLine(idleDemoAt(idle, 3_500)!)).toBe('Idle demo 2/8: nyan · /stage demo stop ends it')
  expect(idleDemoLine(idleDemoAt(idle, 15_000)!)).toBe('Idle demo 6/8: celebrate · /stage demo stop ends it')
  expect(idleDemoLine(idleDemoAt(idle, 20_500)!)).toBe('Idle demo 7/8: show-off (brainstorm) · /stage demo stop ends it')
  expect(idleDemoLine(idleDemoAt(idle, 21_000)!)).toBe('Idle demo 8/8: doze · /stage demo stop ends it')
  // 22 s a step shows all eleven props: the last is the page any other stage gets.
  const slow: Demo = { kind: 'idle', at: 0, seconds: 22 }
  expect(idleDemoLine(idleDemoAt(slow, 6 * 22_000 + 21_000)!)).toBe('Idle demo 7/8: show-off (any other stage) · /stage demo stop ends it')
  expect(demoAt(idle, 0)).toBeNull()
})

test('demoFor builds the demo a /stage demo command asks for, and names it', () => {
  const plan = DEFAULT_WORKFLOW.track.find(s => s.id === 'plan')!
  expect(demoFor({ kind: 'demo', seconds: 5, stage: 'plan' }, DEFAULT_WORKFLOW, 7)).toEqual({
    demo: { kind: 'scenes', at: 7, seconds: 5, scenes: plan.scenes },
    label: `${plan.scenes.length} scenes of Plan`,
  })
  expect(demoFor({ kind: 'demo', seconds: 10, stage: null }, DEFAULT_WORKFLOW, 7)).toEqual({
    demo: { kind: 'scenes', at: 7, seconds: 10, scenes: DEMO_ORDER },
    label: `${DEMO_ORDER.length} scenes`,
  })
  expect(demoFor({ kind: 'demo-idle', seconds: 3 }, DEFAULT_WORKFLOW, 7)).toEqual({
    demo: { kind: 'idle', at: 7, seconds: 3 },
    label: `${IDLE_IDS.length} idle routines, the celebration, the show-off and the doze`,
  })
  expect(demoFor({ kind: 'demo-waiting', scene: null }, DEFAULT_WORKFLOW, 7)).toEqual({ demo: { kind: 'waiting', at: 7, scene: 'laptops', columns: 48 }, label: 'the waiting toon: laptops' })
  expect(demoFor({ kind: 'demo-waiting', scene: 'rowing' }, DEFAULT_WORKFLOW, 7, undefined, 'rowing')).toEqual({ demo: { kind: 'waiting', at: 7, scene: 'rowing', columns: 48 }, label: 'the waiting toon: rowing' })
})

test('a band not drawn yet has room for the demo', () => {
  expect(hasRoom(null, 3)).toBe(true)
})

test('a band already drawn has room for the demo when the bar and the area fit in it', () => {
  const band: BandSite = {
    surface: 'terminal',
    hasSurvey: true,
    isAgentView: false,
    isHidden: false,
    columns: 80,
    maxRows: 3 + TOON_ROWS,
    barLines: 2,
  }
  // Under a survey when last drawn: the demo still plays.
  expect(hasRoom(band, 3)).toBe(true)
  expect(hasRoom(band, 4)).toBe(false)
  expect(hasRoom({ ...band, columns: 29 }, 3)).toBe(false)
  expect(hasRoom({ ...band, surface: 'desktop' }, 3)).toBe(false)
})

test('the work demo plays its steps, seconds each, over the scene from its start; past the end it holds the last', () => {
  const demo = { kind: 'work', at: 1000, seconds: 3, scene: 'dice' } as const
  expect(demoFor({ kind: 'demo-work', seconds: 3 }, DEFAULT_WORKFLOW, 1000, 'dice')).toEqual({ demo, label: `what Clawd shows while Claude works, over dice, in ${WORK_STEPS.length} steps` })
  const first = workDemoAt(demo, 1000)
  expect(first.activity.shown.display).toEqual({ badge: 'thinking', what: '', isTyping: false })
  expect(first.director).toMatchObject({ base: 'dice', baseAt: 1000, reaction: null })
  expect(workDemoLine(first, true)).toBe(`Work demo 1/${WORK_STEPS.length}: thinking · /stage demo stop ends it`)
  expect(workDemoLine(first, false)).toBe(`Work demo 1/${WORK_STEPS.length}: thinking (Clawd's pop-ups are off) · /stage demo stop ends it`)
  const testing = workDemoAt(demo, 1000 + 4 * 3000 + 500)
  expect(testing.activity.shown.display).toEqual({ badge: 'test', what: 'npm test', isTyping: false })
  // The failed test: the failure from the step's start, and a red line.
  const fails = WORK_STEPS.findIndex(s => s.isFailure)
  const failing = workDemoAt(demo, 1000 + fails * 3000 + 100)
  expect(failing.director.reaction).toEqual({ id: 'failure', at: 1000 + fails * 3000 })
  expect(LINES['test-fail']).toContain(failing.activity.said?.line)
  // After REACTION_MS the reaction is over.
  expect(workDemoAt(demo, 1000 + fails * 3000 + 2900).director.reaction).toBe(null)
  const end = 1000 + WORK_STEPS.length * 3000
  expect(demoStep(demo, end)).toBe(null)
  expect(workDemoAt(demo, end + 500).step.name).toBe('writing the answer')
})
