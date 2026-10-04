// One frame of the toon: the base scene, the old one wiping out, the
// reaction on top, cropped to the raster. A scene that throws is replaced
// by idle for the rest of the session.

import type { Shot } from './director'
import { createBuffer, type PixelBuffer } from './pixels'
import { crop, FALLBACK_SCENE, focusAt, heroAt, type Mood, overlay, type ReactionId, type ReactionSpec, renderFull, type Scene, type SceneId, STAGE_H, STAGE_W, wipe } from './scene'

export const TOON_ROWS = STAGE_H / 2

export type Cast = {
  scenes: Record<SceneId, Scene>
  reactions: Record<ReactionId, ReactionSpec>
  broken: Set<SceneId>
  onBreak: (id: SceneId, error: unknown) => void
}

export function composeFrame(shot: Shot, now: number, width: number, cast: Cast): PixelBuffer {
  const time = now / 1000
  const sceneOf = (id: SceneId) => (cast.broken.has(id) ? undefined : cast.scenes[id]) ?? cast.scenes[FALLBACK_SCENE]!
  const full = (id: SceneId, mood: Mood): PixelBuffer => {
    try {
      return renderFull(sceneOf(id), time, mood)
    } catch (error) {
      if (!cast.broken.has(id)) {
        cast.broken.add(id)
        cast.onBreak(id, error)
      }

      return renderFull(cast.scenes[FALLBACK_SCENE]!, time, mood)
    }
  }
  const reaction = shot.reaction ? cast.reactions[shot.reaction.id] : null
  const reactionT = shot.reaction?.t ?? 0
  let frame = full(shot.base, reaction?.mood?.(reactionT) ?? null)
  if (shot.wipe) frame = wipe(full(shot.wipe.from, null), frame, shot.wipe.progress)
  if (reaction) {
    const layer = createBuffer(STAGE_W, STAGE_H)
    try {
      reaction.draw(layer, reactionT, heroAt(sceneOf(shot.base), time))
    } catch {
      // A reaction that breaks just doesn't show.
    }
    frame = overlay(frame, layer)
  }

  return crop(frame, focusAt(sceneOf(shot.base), time), width)
}
