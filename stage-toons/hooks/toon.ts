// One frame of a scene: the base scene at its own time, the reaction on
// top, cropped to the raster. A scene that throws is replaced by the
// standing scene for the rest of the session.

import type { Shot } from './director'
import { createBuffer, type PixelBuffer } from './pixels'
import type { Point } from './pixels'
import { crop, cropStart, FALLBACK_SCENE, focusAt, heroAt, type Mood, overlay, type ReactionId, type ReactionSpec, renderSeamed, type Scene, type SceneId, STAGE_H, STAGE_W } from './scene'

export const TOON_ROWS = STAGE_H / 2

export type Cast = {
  scenes: Record<SceneId, Scene>
  reactions: Record<ReactionId, ReactionSpec>
  broken: Set<SceneId>
  onBreak: (id: SceneId, error: unknown) => void
}

const sceneIn = (cast: Cast, id: SceneId): Scene => (cast.broken.has(id) ? undefined : cast.scenes[id]) ?? cast.scenes[FALLBACK_SCENE]!

// The column a shot's camera keeps in view: a reaction plays around the
// hero, so a camera that panned away holds still on the scene's own focus
// while it lasts.
const focusOf = (shot: Shot, scene: Scene): number => (shot.reaction ? scene.focusX : focusAt(scene, shot.time))

// Where the hero's head is in a raster of this width: its centre column and
// top row.
export function heroOnScreen(shot: Shot, width: number, cast: Cast): Point {
  const scene = sceneIn(cast, shot.base)
  const head = heroAt(scene, shot.time)

  return { x: head.x - cropStart(STAGE_W, focusOf(shot, scene), width), y: head.y }
}

export function composeFrame(shot: Shot, width: number, cast: Cast): PixelBuffer {
  const time = shot.time
  const sceneOf = (id: SceneId) => sceneIn(cast, id)
  const full = (id: SceneId, mood: Mood): PixelBuffer => {
    try {
      return renderSeamed(sceneOf(id), time, mood)
    } catch (error) {
      if (!cast.broken.has(id)) {
        cast.broken.add(id)
        cast.onBreak(id, error)
      }

      return renderSeamed(cast.scenes[FALLBACK_SCENE]!, time, mood)
    }
  }
  const reaction = shot.reaction ? cast.reactions[shot.reaction.id] : null
  const reactionT = shot.reaction?.t ?? 0
  let frame = full(shot.base, reaction?.mood?.(reactionT) ?? shot.mood ?? null)
  if (reaction) {
    const layer = createBuffer(STAGE_W, STAGE_H)
    try {
      reaction.draw(layer, reactionT, heroAt(sceneOf(shot.base), time))
    } catch {
      // A reaction that breaks just doesn't show.
    }
    frame = overlay(frame, layer)
  }

  return crop(frame, focusOf(shot, sceneOf(shot.base)), width)
}
