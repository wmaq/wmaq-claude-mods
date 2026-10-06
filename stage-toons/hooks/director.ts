// Which scene to show, since when, and with which reaction over it. Pure:
// every change takes the time it happens at, and tick settles what has run
// its course. The area dissolves from one scene into the next (frames.ts).

import { FABLE_SCENE, type Mood, type ReactionId, type SceneId } from './scene'

export const REACTION_MS: Record<ReactionId, number> = { failure: 2500, advance: 3000, 'fable-arrives': 2000, 'fable-leaves': 2000 }

export type Director = {
  // The scene of the stage the work is in.
  scene: SceneId
  auditing: boolean
  // The scene on show, and when it came on: each scene runs on its own
  // clock from there.
  base: SceneId
  baseAt: number
  reaction: { id: ReactionId; at: number } | null
}

// time: seconds on the base scene's own clock. mood: the hero's look when
// no reaction gives one (eyes up while Claude thinks).
export type Shot = {
  base: SceneId
  time: number
  reaction: { id: ReactionId; t: number } | null
  mood?: Mood
}

const isFable = (id: ReactionId) => id === 'fable-arrives' || id === 'fable-leaves'

export const createDirector = (scene: SceneId, auditing: boolean): Director => ({
  scene,
  auditing,
  base: auditing ? FABLE_SCENE : scene,
  baseAt: 0,
  reaction: null,
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
    if (ended === 'fable-arrives') n = { ...n, base: FABLE_SCENE, baseAt: now }
  }
  const isWalking = n.reaction !== null && isFable(n.reaction.id)
  if (!isWalking) {
    if (n.auditing && n.base !== FABLE_SCENE) n = { ...n, reaction: { id: 'fable-arrives', at: now } }
    else if (!n.auditing && n.base === FABLE_SCENE) n = { ...n, base: n.scene, baseAt: now, reaction: { id: 'fable-leaves', at: now } }
  }

  return n
}

// The stage moved and its scene is `scene`: it comes on from its start,
// unless the auditor scene shows, which plays on.
export function withScene(d: Director, scene: SceneId, now: number): Director {
  const n = tick(d, now)
  if (scene === n.scene) return n
  if (n.base === FABLE_SCENE) return { ...n, scene }

  return { ...n, scene, base: scene, baseAt: now }
}

// The area shows the scene again after showing something else: it starts
// over.
export const restarted = (d: Director, now: number): Director => ({ ...d, baseAt: now })

export const withAuditing = (d: Director, auditing: boolean, now: number): Director => tick({ ...d, auditing }, now)

export function react(d: Director, id: 'failure' | 'advance', now: number): Director {
  const n = tick(d, now)
  if (n.reaction && isFable(n.reaction.id)) return n

  return { ...n, reaction: { id, at: now } }
}

export const shot = (d: Director, now: number): Shot => ({
  base: d.base,
  time: (now - d.baseAt) / 1000,
  reaction: d.reaction ? { id: d.reaction.id, t: (now - d.reaction.at) / 1000 } : null,
})

// The shot of a director no longer ticked (a scene dissolving out): its
// reaction holds its last moment once over.
export const heldShot = (d: Director, now: number): Shot => ({
  base: d.base,
  time: (now - d.baseAt) / 1000,
  reaction: d.reaction ? { id: d.reaction.id, t: Math.min(now - d.reaction.at, REACTION_MS[d.reaction.id]) / 1000 } : null,
})
