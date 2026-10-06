// One frame of a scene: the base scene at its own time, the reaction on
// top, cropped to the raster. A scene that throws is replaced by the
// standing scene for the rest of the session.

import type { Shot } from './director'
import type { PixelBuffer } from './pixels'
import type { Point } from './pixels'
import { type AreaSize, areaBuffer, areaShape, crop, cropStart, FALLBACK_SCENE, focusAt, heroAt, type Mood, overlay, type ReactionId, type ReactionSpec, renderSeamed, type Scene, type SceneId, STAGE_H } from './scene'

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

// Where the hero's head is on an area of this size: its centre column and
// top row, the core's origin added and the crop's start taken off.
export function heroOnScreen(shot: Shot, size: AreaSize, cast: Cast): Point {
  const scene = sceneIn(cast, shot.base)
  const head = heroAt(scene, shot.time)
  const { w, ox, oy } = areaShape(size, scene.coreX)

  return { x: head.x + ox - cropStart(w, focusOf(shot, scene), size.columns), y: head.y + oy }
}

export function composeFrame(shot: Shot, size: AreaSize, cast: Cast): PixelBuffer {
  const time = shot.time
  const sceneOf = (id: SceneId) => sceneIn(cast, id)
  const full = (id: SceneId, mood: Mood): PixelBuffer => {
    try {
      return renderSeamed(sceneOf(id), time, mood, size)
    } catch (error) {
      if (!cast.broken.has(id)) {
        cast.broken.add(id)
        cast.onBreak(id, error)
      }

      return renderSeamed(cast.scenes[FALLBACK_SCENE]!, time, mood, size)
    }
  }
  const reaction = shot.reaction ? cast.reactions[shot.reaction.id] : null
  const reactionT = shot.reaction?.t ?? 0
  let frame = full(shot.base, reaction?.mood?.(reactionT) ?? shot.mood ?? null)
  if (reaction) {
    const layer = areaBuffer(size, sceneOf(shot.base).coreX)
    try {
      reaction.draw(layer, reactionT, heroAt(sceneOf(shot.base), time))
    } catch {
      // A reaction that breaks just doesn't show.
    }
    frame = overlay(frame, layer)
  }

  return crop(frame, focusOf(shot, sceneOf(shot.base)), size.columns)
}
