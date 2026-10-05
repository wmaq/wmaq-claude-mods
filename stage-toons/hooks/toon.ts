// One frame of a scene: the base scene at its own time, the reaction on
// top, cropped to the raster. A scene that throws is replaced by the
// standing scene for the rest of the session.

import type { Shot } from './director'
import { createBuffer, type PixelBuffer } from './pixels'
import { crop, FALLBACK_SCENE, focusAt, heroAt, type Mood, overlay, type ReactionId, type ReactionSpec, renderSeamed, type Scene, type SceneId, STAGE_H, STAGE_W } from './scene'

export const TOON_ROWS = STAGE_H / 2

export type Cast = {
  scenes: Record<SceneId, Scene>
  reactions: Record<ReactionId, ReactionSpec>
  broken: Set<SceneId>
  onBreak: (id: SceneId, error: unknown) => void
}

export function composeFrame(shot: Shot, width: number, cast: Cast): PixelBuffer {
  const time = shot.time
  const sceneOf = (id: SceneId) => (cast.broken.has(id) ? undefined : cast.scenes[id]) ?? cast.scenes[FALLBACK_SCENE]!
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
  let frame = full(shot.base, reaction?.mood?.(reactionT) ?? null)
  if (reaction) {
    const layer = createBuffer(STAGE_W, STAGE_H)
    try {
      reaction.draw(layer, reactionT, heroAt(sceneOf(shot.base), time))
    } catch {
      // A reaction that breaks just doesn't show.
    }
    frame = overlay(frame, layer)
  }

  // A reaction plays around the hero: a camera that panned away holds still
  // on the scene's own focus while it lasts.
  const base = sceneOf(shot.base)

  return crop(frame, reaction ? base.focusX : focusAt(base, time), width)
}
