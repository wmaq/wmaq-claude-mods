// /stage demo: the library's scenes, one stage's scenes, or the idle
// routines, each for so many seconds, or the waiting toon's script, so the
// cartoons can be seen while Claude is idle. Pure: what shows at a moment,
// wiping in over the one before.

import type { IdleId, Workflow } from '../types'
import { type Shot, WIPE_MS } from './director'
import { IDLE_IDS } from './idle'
import { FABLE_SCENE, type SceneId } from './scene'
import { WAITING_DEMO_MS } from './waiting/demo'

export const DEMO_SECONDS = 10
export const DEMO_MIN = 2
export const DEMO_MAX = 60

export type Demo =
  | { kind: 'scenes'; at: number; seconds: number; scenes: readonly SceneId[] }
  | { kind: 'idle'; at: number; seconds: number }
  | { kind: 'waiting'; at: number }
// The scene showing, as a shot, and how long it has shown.
export type DemoFrame = { index: number; shot: Shot; sceneMs: number }
// The idle demo's step: a routine, or the doze (null) after them all.
export type IdleDemoFrame = { index: number; routine: IdleId | null; ms: number }

// The idle demo plays every routine, then the doze.
export const IDLE_DEMO_LENGTH = IDLE_IDS.length + 1
export const demoLength = (demo: Demo): number => (demo.kind === 'scenes' ? demo.scenes.length : demo.kind === 'idle' ? IDLE_DEMO_LENGTH : 1)

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
  const base = demo.scenes[step.index]!
  const from = demo.scenes[step.index - 1]
  const wipe = from !== undefined && step.ms < WIPE_MS ? { from, progress: step.ms / WIPE_MS } : null

  return { index: step.index, shot: { base, wipe, reaction: null }, sceneMs: step.ms }
}

export function idleDemoAt(demo: Demo, now: number): IdleDemoFrame | null {
  if (demo.kind !== 'idle') return null
  const step = demoStep(demo, now)

  return step ? { index: step.index, routine: IDLE_IDS[step.index] ?? null, ms: step.ms } : null
}

// A scene as the demo names it: its own name, and the first stage (track,
// then side) that lists it.
function labelOf(id: SceneId, w: Workflow): string {
  if (id === FABLE_SCENE) return `${id} (Fable reviewing)`
  const stage = [...w.track, ...w.side].find(s => s.scenes.includes(id))

  return stage ? `${id} (${stage.label})` : id
}

export const demoLine = (f: DemoFrame, demo: Demo, w: Workflow): string =>
  `Demo ${f.index + 1}/${demoLength(demo)}: ${labelOf(f.shot.base, w)} · /stage demo stop ends it`

export const idleDemoLine = (f: IdleDemoFrame): string => `Idle demo ${f.index + 1}/${IDLE_DEMO_LENGTH}: ${f.routine ?? 'doze'} · /stage demo stop ends it`

export const WAITING_DEMO_LINE = 'Waiting demo · /stage demo stop ends it'
