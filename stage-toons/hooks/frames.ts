// Which frame the area shows at a moment, from the mod's state and the time
// alone: no engine. Composing moves the mod on as the loop goes (the seat
// log, the director's clock, the dissolve), and failures go to the log
// passed in.

import type { IdleId } from '../types'
import { cropLeft, placeIdle } from './area'
import { demoAt, demoStep, idleDemoAt, workDemoAt } from './demo'
import { type Director, heldShot, restarted, type Shot, tick } from './director'
import { drawLayer } from './layer'
import { DOZE_MS, dozeFrame, idleBackground, routineFrame } from './idle'
import { isFading, type Mod, type Picture, reseat } from './mod'
import { encodeCells, type PixelBuffer } from './pixels'
import { type AreaSize, dissolve, FADE_MS } from './scene'
import { REACTIONS, SCENES } from './scenes'
import { type Cast, composeFrame, heroOnScreen } from './toon'
import { FALLBACK_WAITING, waitingFrame, type WaitingSceneId } from './waiting'
import { waitingDemoAt } from './waiting/demo'
import type { SeatLog } from './waiting/seats'
import { type Activity, type Layer, layerAt, settleActivity } from './work'

export type Log = (text: string) => void

// The highest the hero's head may be for the whole layer to show, and for
// the bubble alone (it takes the top two pixel rows and its tail the
// third): above them (a climb, a seat up high) it would cover his face.
export const LAYER_CLEAR_Y = 4
export const BUBBLE_CLEAR_Y = 2

// The part of the layer that fits over a head at row y: all of it, the
// bubble alone, or nothing.
export function layerAbove(layer: Layer, y: number): Layer | null {
  if (y >= LAYER_CLEAR_Y) return layer
  if (y >= BUBBLE_CLEAR_Y && layer.bubble !== null) return { ...layer, badge: null, what: '' }

  return null
}

// A shot of the scene with the activity layer over it: the badge, label
// and bubble above the hero's head, and his eyes up while Claude thinks.
// The layer is as it was worked out for its frame: an outgoing picture
// keeps it through its dissolve.
export function sceneWithLayer(shot: Shot, size: AreaSize, cast: Cast, layer: Layer | null): PixelBuffer {
  if (layer === null) return composeFrame(shot, size, cast)
  const head = heroOnScreen(shot, size, cast)
  const shown = layerAbove(layer, head.y)
  const frame = composeFrame(shown?.badge === 'thinking' ? { ...shot, mood: 'think' } : shot, size, cast)
  if (shown) drawLayer(frame, shown, head.x, head.y > BUBBLE_CLEAR_Y)

  return frame
}

// The layer for a frame of the stage's scene, with the activity settled;
// none while /stage bubbles is off.
export function layerFor(activity: Activity, director: Director, isBubbles: boolean, now: number): { activity: Activity; layer: Layer | null } {
  const settled = settleActivity(activity, now)

  return { activity: settled, layer: isBubbles ? layerAt(settled, director, now) : null }
}

// The mod's one Cast, built on the first frame. It keeps the first log it
// was given: the hooks hand every frame the same one (register.tsx's
// debugLog($)), and the frame tool makes a fresh mod per run.
export function castOf(mod: Mod, log: Log): Cast {
  mod.cast ??= {
    scenes: SCENES,
    reactions: REACTIONS,
    broken: mod.broken,
    onBreak: (id, error) => log(`stage-toons: scene ${id} failed and was replaced by the standing scene: ${String(error)}`),
  }

  return mod.cast
}

// An idle routine started at `since`, on the area: its box over its
// background. It plays on past DOZE_MS (the doze is a picture of its own).
function routinePicture(mod: Mod, name: string, routine: IdleId, since: number, log: Log): Picture {
  const onBreak = (id: string, error: unknown) => log(`stage-toons: idle routine ${id} failed and was replaced by classic: ${String(error)}`)

  return {
    name,
    draw: (now, size) => {
      const box = routineFrame(routine, now - since, mod.brokenIdle, onBreak)

      return cropLeft(placeIdle(box, idleBackground(routine, now - since, mod.brokenIdle, onBreak, size), size), size)
    },
  }
}

// The doze of an idle period started at `since` (its idle time, from 0).
const dozePicture = (name: string, since: number): Picture => ({ name, draw: (now, size) => cropLeft(placeIdle(dozeFrame(now - since), null, size), size) })

const waitingPicture = (name: string, log: SeatLog, scene: WaitingSceneId): Picture => ({ name, draw: (now, size) => cropLeft(waitingFrame(log, now, scene, size), size) })

// What the area shows now, or null once the demo it plays is over: a demo,
// else the stage's scene while Claude works, else the waiting toon while a
// waiting period lasts, else the idle routine, else the doze. Each picture
// is named (the name changes exactly when the picture changes to another)
// and drawn from this frame's state.
function pictureOf(mod: Mod, now: number, log: Log): Picture | null {
  const demo = mod.demo
  if (demo?.kind === 'scenes') {
    const frame = demoAt(demo, now)
    if (!frame) return null
    const start = now - frame.sceneMs
    const cast = castOf(mod, log)

    return { name: `demo:${demo.at}:${frame.index}`, draw: (t, size) => composeFrame({ ...frame.shot, time: (t - start) / 1000 }, size, cast) }
  }
  if (demo?.kind === 'idle') {
    const f = idleDemoAt(demo, now)
    if (!f) return null
    const name = `demo:${demo.at}:${f.index}:${f.routine ?? 'doze'}`

    return f.routine === null ? dozePicture(name, now - f.ms - DOZE_MS) : routinePicture(mod, name, f.routine, now - f.ms, log)
  }
  // The work demo: one picture, the stage's scene playing on from the
  // demo's start under the layer of each step in turn.
  if (demo?.kind === 'work') {
    if (!demoStep(demo, now)) return null
    const cast = castOf(mod, log)

    return {
      name: `demo:${demo.at}:work`,
      draw: (t, size) => {
        const f = workDemoAt(demo, t)

        return sceneWithLayer(heldShot(f.director, t), size, cast, layerAt(f.activity, f.director, t))
      },
    }
  }
  if (demo?.kind === 'waiting') {
    if (!demoStep(demo, now)) return null
    const at = waitingDemoAt(demo.at, now)

    return 'log' in at ? waitingPicture(`demo:${demo.at}:waiting`, at.log, demo.scene) : routinePicture(mod, `demo:${demo.at}:idle`, mod.idle, now - at.idleMs, log)
  }

  // The stage's scene, with Fable's walk and the reactions, as a scene demo
  // is drawn: cropped by the scene's camera. Coming back to it from another
  // picture, it starts over.
  if (mod.isBandWorking) {
    mod.director = tick(mod.director, now)
    if (!mod.shown?.name.startsWith('scene:')) mod.director = restarted(mod.director, now)
    const d = mod.director
    const cast = castOf(mod, log)
    const { activity, layer } = layerFor(mod.activity, d, mod.isBubbles, now)
    mod.activity = activity

    return { name: `scene:${d.base}:${d.baseAt}`, draw: (t, size) => sceneWithLayer(heldShot(d, t), size, cast, layer) }
  }
  if (mod.seats.since !== null && !mod.isWaitingBroken) {
    // With the helpers that left still in it, for the conveyor's marks.
    const seats = { ...mod.seats, entries: [...mod.waiting.past, ...mod.seats.entries] }

    return waitingPicture(`waiting:${mod.seats.since}:${mod.waiting.scene}`, seats, mod.waiting.scene)
  }
  if (now - mod.idleSince >= DOZE_MS) return dozePicture(`doze:${mod.idleSince}`, mod.idleSince)

  return routinePicture(mod, `idle:${mod.idle}:${mod.idleSince}`, mod.idle, mod.idleSince, log)
}

// The area's next frame, at its size, or null once the demo it plays is
// over. The seat log moves on first, whichever plays. When the picture
// changes, the old one (as it was in its last frame, on its own clock)
// dissolves into the new over FADE_MS; a change while a dissolve runs keeps
// dissolving the same old picture.
export function areaCells(mod: Mod, size: AreaSize, now: number, log: Log): string | null {
  reseat(mod, now)
  let picture = pictureOf(mod, now, log)
  // The demo is over: what was shown stays, to dissolve from next frame.
  if (picture === null) return null
  let current: PixelBuffer
  // A waiting scene that throws gives way to the laptops, and the laptops
  // to the idle routine: a cut, as the scene that threw can't be trusted to
  // draw the dissolve's old picture.
  let isCut = false
  for (;;) {
    try {
      current = picture.draw(now, size)
      break
    } catch (error) {
      if (!picture.name.startsWith('waiting:')) throw error
      const { scene } = mod.waiting
      if (scene !== FALLBACK_WAITING) {
        // The laptops show for the rest of the period: the next is dealt another.
        const deal = { ...mod.waiting.deal, last: FALLBACK_WAITING }
        mod.waiting = { ...mod.waiting, scene: FALLBACK_WAITING, deal, broken: new Set([...mod.waiting.broken, scene]) }
        log(`stage-toons: the waiting scene ${scene} failed and was replaced by the laptops: ${String(error)}`)
      } else {
        mod.isWaitingBroken = true
        log(`stage-toons: the waiting toon failed and was replaced by the idle routine: ${String(error)}`)
      }
      picture = pictureOf(mod, now, log)!
      isCut = true
    }
  }
  if (isCut || (mod.fade !== null && !isFading(mod, now))) mod.fade = null
  if (!isCut && mod.shown !== null && mod.shown.name !== picture.name && mod.fade === null) mod.fade = { from: mod.shown, at: now }
  mod.shown = picture
  if (mod.fade === null) return encodeCells(current)
  let from: PixelBuffer
  try {
    from = mod.fade.from.draw(now, size)
  } catch {
    // Its failure was reported while it showed.
    mod.fade = null

    return encodeCells(current)
  }

  return encodeCells(dissolve(from, current, (now - mod.fade.at) / FADE_MS, mod.fade.at))
}
