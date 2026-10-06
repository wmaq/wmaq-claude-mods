// /stage demo: the library's scenes, one stage's scenes, or the idle
// routines, each for so many seconds, or the waiting toon's script, or the
// work layer's steps over the stage's scene, so the cartoons can be seen
// while Claude is idle. What shows at a moment is
// worked out from the demo and the time alone (the area dissolves from one
// step into the next); startDemo is the one function that sets mod.demo.

import type { IdleId, Workflow } from '../types'
import { bandMode, type BandSite } from './band'
import type { Command } from './command'
import { createDirector, type Director, react, type Shot, tick } from './director'
import { CELEBRATE, IDLE_IDS, SHOW_OFF_DEMO, SHOW_OFF_PREFIX } from './idle'
import type { Mod } from './mod'
import type { Phase } from './phase'
import { FABLE_SCENE, FALLBACK_SCENE, type SceneId } from './scene'
import { DEMO_ORDER } from './scenes'
import { TOON_ROWS } from './toon'
import { WAITING_DEMO_MS } from './waiting/demo'
import { type Activity, createActivity, type LineMoment, lineOf, said, settleActivity, type SpinnerMode, toolStarted, withMode } from './work'
import { allStages, stageOf } from './workflow'

export const DEMO_SECONDS = 10
export const DEMO_MIN = 2
export const DEMO_MAX = 60
export const WORK_DEMO_SECONDS = 3

export type Demo =
  | { kind: 'scenes'; at: number; seconds: number; scenes: readonly SceneId[] }
  | { kind: 'idle'; at: number; seconds: number }
  | { kind: 'waiting'; at: number }
  | { kind: 'work'; at: number; seconds: number; scene: SceneId }
// The scene showing, as a shot, and how long it has shown.
export type DemoFrame = { index: number; shot: Shot; sceneMs: number }
// The idle demo's step: a routine, or the doze (null) after them all.
export type IdleDemoFrame = { index: number; routine: IdleId | null; ms: number }

// The idle demo plays every routine, the celebration, the show-off (each
// prop for SHOW_OFF_DEMO_MS in turn), then the doze.
export const IDLE_DEMO_LENGTH = IDLE_IDS.length + 3
export const SHOW_OFF_DEMO_MS = 2000
// The work demo's script: what Claude does in each step, as the layer
// shows it.
export type WorkStep = { name: string; mode?: SpinnerMode; phase?: Phase; what?: string; say?: LineMoment; isFailure?: boolean }
export const WORK_STEPS: readonly WorkStep[] = [
  { name: 'thinking', mode: 'thinking' },
  { name: 'searching', phase: 'search', what: 'useAuth' },
  { name: 'reading', phase: 'read', what: 'auth.ts' },
  { name: 'editing', phase: 'edit', what: 'auth.ts' },
  { name: 'testing', phase: 'test', what: 'npm test' },
  { name: 'building', phase: 'build', what: 'npm run' },
  { name: 'git', phase: 'git', what: 'git status' },
  { name: 'running a command', phase: 'run', what: 'ls src' },
  { name: 'on the web', phase: 'web', what: 'docs.rs' },
  { name: 'agents', phase: 'agents', what: 'Audit spec' },
  { name: 'a test fails', phase: 'test', what: 'npm test', say: 'test-fail', isFailure: true },
  { name: 'the tests pass', phase: 'test', what: 'npm test', say: 'test-pass' },
  { name: 'a commit', phase: 'git', what: 'git commit', say: 'commit' },
  { name: 'writing the answer', mode: 'responding' },
]

export const demoLength = (demo: Demo): number =>
  demo.kind === 'scenes' ? demo.scenes.length : demo.kind === 'idle' ? IDLE_DEMO_LENGTH : demo.kind === 'work' ? WORK_STEPS.length : 1

// Which item plays at a moment and for how long it has, or null once the
// demo is over.
export function demoStep(demo: Demo, now: number): { index: number; ms: number } | null {
  const length = demo.kind === 'waiting' ? WAITING_DEMO_MS : demo.seconds * 1000
  const elapsed = Math.max(0, now - demo.at)
  const index = Math.floor(elapsed / length)

  return index < demoLength(demo) ? { index, ms: elapsed - index * length } : null
}

export function demoAt(demo: Demo, now: number): DemoFrame | null {
  if (demo.kind !== 'scenes') return null
  const step = demoStep(demo, now)
  if (!step) return null
  return { index: step.index, shot: { base: demo.scenes[step.index]!, time: step.ms / 1000, reaction: null }, sceneMs: step.ms }
}

export function idleDemoAt(demo: Demo, now: number): IdleDemoFrame | null {
  if (demo.kind !== 'idle') return null
  const step = demoStep(demo, now)

  if (!step) return null
  const n = IDLE_IDS.length
  if (step.index < n) return { index: step.index, routine: IDLE_IDS[step.index]!, ms: step.ms }
  if (step.index === n) return { index: step.index, routine: CELEBRATE, ms: step.ms }
  if (step.index === n + 1) {
    const prop = Math.floor(step.ms / SHOW_OFF_DEMO_MS)

    return { index: step.index, routine: SHOW_OFF_DEMO[prop % SHOW_OFF_DEMO.length]!, ms: step.ms - prop * SHOW_OFF_DEMO_MS }
  }

  return { index: step.index, routine: null, ms: step.ms }
}

// The work demo at a moment: its step (the last one past the end, which an
// outgoing picture keeps drawing through its dissolve), when the step
// started, the activity and the director as the step makes them: the
// stage's scene from the demo's start, the failure from the step's.
export type WorkDemoFrame = { index: number; step: WorkStep; activity: Activity; director: Director }

export function workDemoAt(demo: Extract<Demo, { kind: 'work' }>, now: number): WorkDemoFrame {
  const stepMs = demo.seconds * 1000
  const index = Math.max(0, Math.min(WORK_STEPS.length - 1, Math.floor((now - demo.at) / stepMs)))
  const step = WORK_STEPS[index]!
  const start = demo.at + index * stepMs
  let activity = createActivity()
  if (step.mode) activity = withMode(activity, step.mode)
  if (step.phase) activity = toolStarted(activity, 'demo', step.phase, step.what ?? '')
  if (step.say) activity = said(activity, lineOf(step.say, start), start)
  let director: Director = { ...createDirector(demo.scene, false), baseAt: demo.at }
  if (step.isFailure) director = react(director, 'failure', start)

  return { index, step, activity: settleActivity(activity, start), director: tick(director, now) }
}

export const workDemoLine = (f: WorkDemoFrame, isBubbles: boolean): string =>
  `Work demo ${f.index + 1}/${WORK_STEPS.length}: ${f.step.name}${isBubbles ? '' : " (Clawd's pop-ups are off)"} · /stage demo stop ends it`

// A scene as the demo names it: its own name, and the first stage (track,
// then side) that lists it.
function labelOf(id: SceneId, w: Workflow): string {
  if (id === FABLE_SCENE) return `${id} (Fable reviewing)`
  const stage = allStages(w).find(s => s.scenes.includes(id))

  return stage ? `${id} (${stage.label})` : id
}

export const demoLine = (f: DemoFrame, demo: Demo, w: Workflow): string =>
  `Demo ${f.index + 1}/${demoLength(demo)}: ${labelOf(f.shot.base, w)} · /stage demo stop ends it`

// A routine as the idle demo's line names it: a show-off by its prop's stage.
function routineName(routine: IdleId | null): string {
  if (routine === null) return 'doze'
  if (!routine.startsWith(SHOW_OFF_PREFIX)) return routine
  const stage = routine.slice(SHOW_OFF_PREFIX.length)

  return `show-off (${stage === '*' ? 'any other stage' : stage})`
}

export const idleDemoLine = (f: IdleDemoFrame): string => `Idle demo ${f.index + 1}/${IDLE_DEMO_LENGTH}: ${routineName(f.routine)} · /stage demo stop ends it`

export const WAITING_DEMO_LINE = 'Waiting demo · /stage demo stop ends it'

// The demo a /stage demo command asks for, and what its answer calls it.
// scene: the stage's, which the work demo plays under its layer.
export function demoFor(cmd: Extract<Command, { kind: 'demo' | 'demo-idle' | 'demo-waiting' | 'demo-work' }>, w: Workflow, now: number, scene: SceneId = FALLBACK_SCENE): { demo: Demo; label: string } {
  if (cmd.kind === 'demo-work') return { demo: { kind: 'work', at: now, seconds: cmd.seconds, scene }, label: `what Clawd shows while Claude works, over ${scene}, in ${WORK_STEPS.length} steps` }
  const stage = cmd.kind === 'demo' && cmd.stage !== null ? stageOf(w, cmd.stage) : undefined
  const demo: Demo =
    cmd.kind === 'demo-waiting'
      ? { kind: 'waiting', at: now }
      : cmd.kind === 'demo-idle'
        ? { kind: 'idle', at: now, seconds: cmd.seconds }
        : { kind: 'scenes', at: now, seconds: cmd.seconds, scenes: stage?.scenes ?? DEMO_ORDER }
  const n = demoLength(demo)
  const label =
    cmd.kind === 'demo-waiting'
      ? 'the waiting toon'
      : cmd.kind === 'demo-idle'
        ? `${IDLE_IDS.length} idle routines, the celebration, the show-off and the doze`
        : stage
          ? `${n} scene${n === 1 ? '' : 's'} of ${stage.label}`
          : `${n} scenes`

  return { demo, label }
}

// Whether the band last drawn has room for the area under a bar of
// barLines lines (the bar with the demo's line).
export const hasRoom = (lastBand: BandSite | null, barLines: number): boolean =>
  !lastBand || bandMode({ ...lastBand, hasSurvey: false, isAgentView: false, isHidden: false, barLines }) === 'area'

// Starts the demo, or says why not. label names what plays; barLines is
// how many lines the bar takes with the demo's line.
export function startDemo(mod: Mod, demo: Demo, label: string, now: number, isHidden: boolean, barLines: number): string {
  if (isHidden) return 'stage-toons is hidden; /stage hide shows it.'
  if (mod.surface !== 'terminal') return 'The demo plays in the terminal only.'
  if (!hasRoom(mod.lastBand, barLines)) return `The band has no room for the demo: it needs 30 columns and ${barLines + TOON_ROWS} rows.`
  const isRestart = mod.demo !== null && demoStep(mod.demo, now) !== null
  mod.demo = demo
  const playing = `${isRestart ? 'Restarting the demo: p' : 'P'}laying`
  if (demo.kind === 'waiting') return `${playing} ${label} (about ${Math.round(WAITING_DEMO_MS / 1000)} s). /stage demo stop ends it.`
  const total = demoLength(demo) * demo.seconds
  const length = total < 60 ? 'under a minute' : `about ${Math.round(total / 60)} min`

  return `${playing} ${label}, ${demo.seconds} s each (${length}). /stage demo stop ends it.`
}
