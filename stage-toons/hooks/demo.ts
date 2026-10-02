// /stage demo: every scene in turn, for so many seconds each, so the
// cartoons can be seen while Claude is idle. Pure: which scene shows at a
// moment, wiping in over the one before.

import type { SceneId } from './scene'
import { type Shot, WIPE_MS } from './director'
import { STAGE_IDS, STAGES } from './stages'

export const DEMO_SCENES: readonly SceneId[] = [...STAGE_IDS, 'auditor']
export const DEMO_SECONDS = 10
export const DEMO_MIN = 2
export const DEMO_MAX = 60

export type Demo = { at: number; seconds: number }
// The scene showing, as a shot, and how long it has shown.
export type DemoFrame = { index: number; shot: Shot; sceneMs: number }

export function demoAt(demo: Demo, now: number): DemoFrame | null {
  const sceneLength = demo.seconds * 1000
  const elapsed = Math.max(0, now - demo.at)
  const index = Math.floor(elapsed / sceneLength)
  const base = DEMO_SCENES[index]
  if (base === undefined) return null
  const sceneMs = elapsed - index * sceneLength
  const from = DEMO_SCENES[index - 1]
  const wipe = from !== undefined && sceneMs < WIPE_MS ? { from, progress: sceneMs / WIPE_MS } : null

  return { index, shot: { base, wipe, reaction: null }, sceneMs }
}

const labelOf = (id: SceneId): string => (id === 'auditor' ? 'Fable auditing' : id === 'idle' ? 'Idle' : STAGES[id].label)

export const demoLine = (f: DemoFrame): string => `Demo ${f.index + 1}/${DEMO_SCENES.length}: ${labelOf(f.shot.base)} · /stage demo stop ends it`
