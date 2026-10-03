// /stage demo: every scene in turn, for so many seconds each, so the
// cartoons can be seen while Claude is idle. Pure: which scene shows at a
// moment, wiping in over the one before.

import type { Workflow } from '../types'
import { type Shot, WIPE_MS } from './director'
import { FABLE_SCENE, type SceneId } from './scene'
import { DEMO_ORDER } from './scenes'

export const DEMO_SCENES: readonly SceneId[] = DEMO_ORDER
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

// A scene as the demo names it: by the first stage (track, then side) that
// plays it, else by its own name.
function labelOf(id: SceneId, w: Workflow): string {
  if (id === FABLE_SCENE) return 'Fable auditing'

  return [...w.track, ...w.side].find(s => s.scene === id)?.label ?? id
}

export const demoLine = (f: DemoFrame, w: Workflow): string =>
  `Demo ${f.index + 1}/${DEMO_SCENES.length}: ${labelOf(f.shot.base, w)} · /stage demo stop ends it`
