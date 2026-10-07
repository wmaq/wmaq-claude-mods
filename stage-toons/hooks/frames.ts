// Which frame the area shows at a moment, from the mod's state and the time
// alone: no engine. Composing moves the mod on as the loop goes (the seat
// log, the director's clock, the dissolve), and failures go to the log
// passed in.

import type { IdleId } from '../types'
import { cropLeft, placeIdle } from './area'
import { demoAt, demoStep, djDemoAt, idleDemoAt, workDemoAt } from './demo'
import { type Director, heldShot, restarted, type Shot, tick } from './director'
import { drawLayer } from './layer'
import { DEEP_SLEEP_MS, DOZE_MS, dozeFrame, idleBackground, routineFrame, routineStill } from './idle'
import { isDjOn, isFading, type Mod, type Picture, redance, reseat } from './mod'
import { trackText } from './nowplaying'
import { encodeCells, type PixelBuffer, type Point } from './pixels'
import { type AreaSize, dissolve, FADE_MS, stillOf } from './scene'
import { REACTIONS, SCENES } from './scenes'
import { djFrame, djHead, type DjInput } from './scenes/dj'
import { type Cast, composeFrame, heroOnScreen, sceneIn } from './toon'
import { FALLBACK_WAITING, waitingFrame, type WaitingSceneId } from './waiting'
import { calmView, isPresent } from './waiting/calm'
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

// A frame with the layer over a head at this point, as much of it as fits
// (layerAbove); no mood: the head's own look stays.
function withLayer(frame: PixelBuffer, head: Point, layer: Layer | null): PixelBuffer {
  const shown = layer === null ? null : layerAbove(layer, head.y)
  if (shown) drawLayer(frame, shown, head.x, head.y > BUBBLE_CLEAR_Y)

  return frame
}

// The layer for a frame of the stage's scene, with the activity settled;
// none while /stage bubbles is off; held still in calm mode.
export function layerFor(activity: Activity, director: Director, isBubbles: boolean, now: number, isCalm = false): { activity: Activity; layer: Layer | null } {
  const settled = settleActivity(activity, now)

  return { activity: settled, layer: isBubbles ? layerAt(settled, director, now, isCalm) : null }
}

// The shot calm mode holds a director's scene at: the scene's still, with
// no reaction (no jump, no flinch; its line still shows in the layer). A
// broken scene holds the fallback's still, as the fallback is drawn.
export function calmShot(d: Director, cast: Cast): Shot {
  const scene = sceneIn(cast, d.base)

  return { base: d.base, time: stillOf(scene), reaction: null }
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
// Calm, it holds the routine's still.
function routinePicture(mod: Mod, name: string, routine: IdleId, since: number, log: Log, isCalm = false): Picture {
  const onBreak = (id: string, error: unknown) => log(`stage-toons: idle routine ${id} failed and was replaced by classic: ${String(error)}`)
  const idleMs = (now: number) => (isCalm ? routineStill(routine, mod.brokenIdle) * 1000 : now - since)

  return {
    name: isCalm ? `${name}:calm` : name,
    draw: (now, size) => {
      const box = routineFrame(routine, idleMs(now), mod.brokenIdle, onBreak)

      return cropLeft(placeIdle(box, idleBackground(routine, idleMs(now), mod.brokenIdle, onBreak, size), size), size)
    },
  }
}

// The doze of an idle period started at `since` (its idle time, from 0);
// calm, its still from the start.
const dozePicture = (name: string, since: number, isCalm = false): Picture =>
  isCalm
    ? { name: `${name}:calm`, draw: (_now, size) => cropLeft(placeIdle(dozeFrame(DOZE_MS + DEEP_SLEEP_MS), null, size), size) }
    : { name, draw: (now, size) => cropLeft(placeIdle(dozeFrame(now - since), null, size), size) }

const waitingPicture = (name: string, log: SeatLog, scene: WaitingSceneId): Picture => ({ name, draw: (now, size) => cropLeft(waitingFrame(log, now, scene, size), size) })

// The DJ picture (Clawd DJ): the dj scene drawn from what the mod knows,
// on its own clock since it came on. While Claude works the director moves
// on as the stage's scene would have it (Fable's audit, the reactions'
// lines) and Clawd's pop-ups show over his head; he stays at the decks (no
// jump, flinch or eyes up). Moving, it is one picture, `dj`, through track
// changes (the scene draws its own); calm, its still is named by the track
// and the dancers present, so it is drawn again when either changes.
function djPicture(mod: Mod, now: number): Picture {
  if (!mod.shown?.name.startsWith('dj')) mod.djSince = now
  let layer: Layer | null = null
  if (mod.isBandWorking) {
    mod.director = tick(mod.director, now)
    const settled = layerFor(mod.activity, mod.director, mod.isBubbles, now, mod.isCalm)
    mod.activity = settled.activity
    layer = settled.layer
  }
  const { djSince: since, djChangedAt: changedAt, dancers, isCalm, isDjParty: isParty } = mod
  const np = mod.music.track
  // Inside each frame's drawing, so a track that can't be written fails
  // there, where areaCells takes the picture down.
  const input = (t: number): DjInput => ({
    track: np ? trackText(np) : null,
    time: (t - since) / 1000,
    now: t,
    trackTime: (t - Math.max(since, changedAt ?? -Infinity)) / 1000,
    sinceChange: changedAt === null ? null : (t - changedAt) / 1000,
    dancers,
    isCalm,
    isParty,
  })
  let track: string | null = null
  try {
    track = np ? trackText(np) : null
  } catch {
    // Named without it: drawing it fails, where areaCells takes it down.
  }
  const present = dancers.entries.filter(e => isPresent(e, now)).map(e => e.agentId)
  const name = isCalm ? `dj:calm:${track ?? ''}:${present.sort().join(',')}` : 'dj'

  return { name, draw: (t, size) => withLayer(djFrame(input(t), size), djHead(input(t), size), layer) }
}

// /stage demo dj's picture: the demo's script on the DJ picture, from the
// demo's start, with the party lights as /stage dj party has them.
function djDemoPicture(demo: { at: number; seconds: number; kind: 'dj' }, isParty: boolean): Picture {
  return {
    name: `demo:${demo.at}:dj`,
    draw: (t, size) => {
      const f = djDemoAt(demo, t, size.columns)
      const isChanged = t >= f.changedAt

      return djFrame(
        {
          track: trackText(f.track),
          time: (t - demo.at) / 1000,
          now: t,
          trackTime: (t - (isChanged ? f.changedAt : demo.at)) / 1000,
          sinceChange: isChanged ? (t - f.changedAt) / 1000 : null,
          dancers: f.dancers,
          isCalm: false,
          isParty,
        },
        size,
      )
    },
  }
}

// What the area shows now, or null once the demo it plays is over: a demo,
// else the stage's scene while Claude works, else the waiting toon while a
// waiting period lasts, else the idle routine, else the doze. Each picture
// is named (the name changes exactly when the picture changes to another)
// and drawn from this frame's state. In calm mode (never for a demo) each
// picture but a demo holds one frame, its name ending in :calm.
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
  if (demo?.kind === 'dj') return demoStep(demo, now) && !mod.isDjBroken ? djDemoPicture(demo, mod.isDjParty) : null
  if (demo?.kind === 'waiting') {
    if (!demoStep(demo, now)) return null
    const at = waitingDemoAt(demo.at, now, demo.columns)

    return 'log' in at ? waitingPicture(`demo:${demo.at}:waiting`, at.log, demo.scene) : routinePicture(mod, `demo:${demo.at}:idle`, mod.idle, now - at.idleMs, log)
  }

  // While Spotify plays in DJ mode, the DJ picture, whatever else would show.
  if (isDjOn(mod)) return djPicture(mod, now)
  // The stage's scene, with Fable's walk and the reactions, as a scene demo
  // is drawn: cropped by the scene's camera. Coming back to it from another
  // picture, it starts over.
  const isCalm = mod.isCalm
  if (mod.isBandWorking) {
    mod.director = tick(mod.director, now)
    if (!mod.shown?.name.startsWith('scene:')) mod.director = restarted(mod.director, now)
    const d = mod.director
    const cast = castOf(mod, log)
    const { activity, layer } = layerFor(mod.activity, d, mod.isBubbles, now, isCalm)
    mod.activity = activity
    const name = `scene:${d.base}:${d.baseAt}`
    if (isCalm) {
      const held = calmShot(d, cast)

      return { name: `${name}:calm`, draw: (_t, size) => sceneWithLayer(held, size, cast, layer) }
    }

    return { name, draw: (t, size) => sceneWithLayer(heldShot(d, t), size, cast, layer) }
  }
  if (mod.seats.since !== null && !mod.isWaitingBroken) {
    const scene = mod.waiting.scene
    // Calm: the frozen log, built here so that a failure in it is not
    // taken for the waiting scene's (areaCells' fallback).
    if (isCalm) {
      const view = calmView(mod.seats, now)

      return { name: `waiting:${mod.seats.since}:${scene}:calm:${view.present.join(',')}`, draw: (_t, size) => cropLeft(waitingFrame(view.log, view.now, scene, size), size) }
    }
    // With the helpers that left still in it, for the conveyor's marks.
    const seats = { ...mod.seats, entries: [...mod.waiting.past, ...mod.seats.entries] }

    return waitingPicture(`waiting:${mod.seats.since}:${scene}`, seats, scene)
  }
  if (now - mod.idleSince >= DOZE_MS) return dozePicture(`doze:${mod.idleSince}`, mod.idleSince, isCalm)

  return routinePicture(mod, `idle:${mod.idle}:${mod.idleSince}`, mod.idle, mod.idleSince, log, isCalm)
}

// The area's next frame, at its size, or null once the demo it plays is
// over. The seat log moves on first, whichever plays. When the picture
// changes, the old one (as it was in its last frame, on its own clock)
// dissolves into the new over FADE_MS; a change while a dissolve runs keeps
// dissolving the same old picture.
export function areaCells(mod: Mod, size: AreaSize, now: number, log: Log): string | null {
  reseat(mod, now)
  redance(mod, now, isDjOn(mod) && mod.demo === null)
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
      // The DJ picture (or its demo) that throws gives way to the usual
      // pictures for the rest of the load, its demo ending: a cut.
      if (picture.name === 'dj' || picture.name.startsWith('dj:') || picture.name.endsWith(':dj')) {
        mod.isDjBroken = true
        log(`stage-toons: the DJ picture failed and was replaced by the usual pictures: ${String(error)}`)
        const next = pictureOf(mod, now, log)
        if (next === null) return null
        picture = next
        isCut = true
        continue
      }
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
