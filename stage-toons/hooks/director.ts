// Which scene to show, with which reaction over it and which wipe into it.
// Pure: every change takes the time it happens at, and tick settles what
// has run its course.

import type { StageId } from '../types'
import type { ReactionId, SceneId } from './scene'

export const REACTION_MS: Record<ReactionId, number> = { failure: 2500, advance: 3000, 'fable-arrives': 2000, 'fable-leaves': 2000 }
export const WIPE_MS = 300

export type Director = {
  stage: StageId
  auditing: boolean
  base: SceneId
  reaction: { id: ReactionId; at: number } | null
  wipe: { from: SceneId; at: number } | null
}

export type Shot = {
  base: SceneId
  wipe: { from: SceneId; progress: number } | null
  reaction: { id: ReactionId; t: number } | null
}

const isFable = (id: ReactionId) => id === 'fable-arrives' || id === 'fable-leaves'

export const createDirector = (stage: StageId, auditing: boolean): Director => ({
  stage,
  auditing,
  base: auditing ? 'auditor' : stage,
  reaction: null,
  wipe: null,
})

// Ends what has run its course, then brings Fable in or out to match
// whether an auditor runs. Fable's walks are never cut short: the auditor
// scene takes over when the walk-in ends, and the stage's scene returns at
// once when Fable starts to walk out (over the auditor scene, which holds
// Fable already, there would be two).
export function tick(d: Director, now: number): Director {
  let n = d
  if (n.reaction && now - n.reaction.at >= REACTION_MS[n.reaction.id]) {
    const ended = n.reaction.id
    n = { ...n, reaction: null }
    // A wipe begun under the walk ends with it: the auditor scene takes over whole.
    if (ended === 'fable-arrives') n = { ...n, base: 'auditor', wipe: null }
  }
  if (n.wipe && now - n.wipe.at >= WIPE_MS) n = { ...n, wipe: null }
  const isWalking = n.reaction !== null && isFable(n.reaction.id)
  if (!isWalking) {
    if (n.auditing && n.base !== 'auditor') n = { ...n, reaction: { id: 'fable-arrives', at: now }, wipe: null }
    else if (!n.auditing && n.base === 'auditor') n = { ...n, base: n.stage, reaction: { id: 'fable-leaves', at: now }, wipe: null }
  }

  return n
}

export function withStage(d: Director, stage: StageId, now: number): Director {
  const n = tick(d, now)
  if (stage === n.stage) return n
  const isShowingStage = n.base !== 'auditor'
  // A wipe still running goes on wiping out the scene it started from,
  // into the newest stage.
  const wipe = isShowingStage ? (n.wipe ?? { from: n.base, at: now }) : n.wipe

  return { ...n, stage, base: isShowingStage ? stage : n.base, wipe }
}

export const withAuditing = (d: Director, auditing: boolean, now: number): Director => tick({ ...d, auditing }, now)

export function react(d: Director, id: 'failure' | 'advance', now: number): Director {
  const n = tick(d, now)
  if (n.reaction && isFable(n.reaction.id)) return n

  return { ...n, reaction: { id, at: now } }
}

export const shot = (d: Director, now: number): Shot => ({
  base: d.base,
  wipe: d.wipe ? { from: d.wipe.from, progress: (now - d.wipe.at) / WIPE_MS } : null,
  reaction: d.reaction ? { id: d.reaction.id, t: (now - d.reaction.at) / 1000 } : null,
})
