// Scenes: props, sprites and Clawds moved by time on a 48x14 pixel stage,
// rendered whole and then cropped to the raster's width.

import { type ClawdLook, drawClawd } from './clawd'
import { createBuffer, EMPTY, type PixelBuffer, type Point, setPixel, type TextLayer } from './pixels'
import type { LibraryScene } from './scenes'

export const STAGE_W = 48
export const STAGE_H = 14
// Clawd's top row when it stands on the stage's bottom row.
export const CLAWD_TOP = 6

// A scene's name in the library (scenes/index.ts).
export type SceneId = string
// Fable's scene, played while a Fable subagent runs, and the scene that
// stands in for one that breaks.
export const FABLE_SCENE: LibraryScene = 'fable-audit'
export const FALLBACK_SCENE: LibraryScene = 'standing'
export type ReactionId = 'failure' | 'advance' | 'fable-arrives' | 'fable-leaves'
export type Mood = 'flinch' | 'jump' | null

export type Sprite = { palette: Record<string, number>; frames: string[][] }
export type Paint = (b: PixelBuffer, t: number) => void

// How near the viewer an actor is: higher is nearer, 0 when not given. A
// function of the loop's time moves it, from behind Clawd to in front.
export type Depth = number | ((t: number) => number)

// A prop draws where it likes, at a depth like any actor.
export type Actor =
  | { kind: 'sprite'; sprite: Sprite; frame: (t: number) => number; at: (t: number) => Point; z?: Depth }
  | { kind: 'clawd'; look: (t: number) => Partial<ClawdLook>; at: (t: number) => Point; isHero?: boolean; z?: Depth }
  | { kind: 'prop'; draw: Paint; z?: Depth }

// A looping scene: t runs from 0 to loop seconds. focusX is the column kept
// in view when the raster is narrower than the stage; focus, when given,
// moves it with the action instead (a camera that pans). A frame paints the
// background, the backdrop, the actors by depth (equal depths in the order
// written), then the front. The background is given the scene's time
// unwrapped (seconds since it came on), so it can drift with no jump at the
// loop point; the rest are given the loop's time. A scene that restarts a
// build-up at its loop point fades at it (fadesAtLoop): its last moment,
// held, dissolves into the new loop's start.
export type Scene = {
  id: SceneId
  loop: number
  focusX: number
  focus?: (t: number) => number
  background?: Paint
  backdrop?: Paint
  actors: Actor[]
  front?: Paint
  fadesAtLoop?: true
}

// How long a dissolve takes, from one picture into the next; and how far
// before its loop point a fading scene's last moment is.
export const FADE_MS = 500
export const LOOP_LAST_S = 0.05

// A reaction plays once over a scene, drawn on its own layer relative to
// the hero's head, and may set the hero's mood.
export type ReactionSpec = { id: ReactionId; mood?: (t: number) => Mood; draw: (b: PixelBuffer, t: number, hero: Point) => void }

// isMirrored draws the frame flipped left to right, each row read back to
// front.
export function drawSprite(b: PixelBuffer, sprite: Sprite, frame: number, x: number, y: number, isMirrored = false): void {
  const n = sprite.frames.length
  const rows = sprite.frames[((Math.floor(frame) % n) + n) % n] ?? []
  rows.forEach((row, dy) => {
    const last = row.length - 1
    for (let dx = 0; dx < row.length; dx++) {
      const color = sprite.palette[row[isMirrored ? last - dx : dx]!]
      if (color !== undefined) setPixel(b, x + dx, y + dy, color)
    }
  })
}

export const loopTime = (scene: Scene, time: number): number => ((time % scene.loop) + scene.loop) % scene.loop

const depthOf = (actor: Actor, t: number): number => (typeof actor.z === 'function' ? actor.z(t) : (actor.z ?? 0))

// The actors nearest last; a stable sort keeps equal depths as written.
const byDepth = (actors: readonly Actor[], t: number): Actor[] =>
  actors
    .map((actor, i) => ({ actor, i, z: depthOf(actor, t) }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map(e => e.actor)

// backgroundTime: the background's time, when it is not the scene's (a held
// last moment over a background that drifts on).
export function renderFull(scene: Scene, time: number, mood: Mood = null, backgroundTime = time): PixelBuffer {
  const t = loopTime(scene, time)
  const b = createBuffer(STAGE_W, STAGE_H)
  scene.background?.(b, backgroundTime)
  scene.backdrop?.(b, t)
  for (const actor of byDepth(scene.actors, t)) {
    if (actor.kind === 'prop') {
      actor.draw(b, t)
      continue
    }
    const p = actor.at(t)
    if (actor.kind === 'sprite') {
      drawSprite(b, actor.sprite, actor.frame(t), p.x, p.y)
      continue
    }
    const look = actor.look(t)
    if (actor.isHero && mood === 'jump') drawClawd(b, p.x, p.y - 2, { ...look, pose: 'jump', arms: { left: 'up', right: 'up' } })
    else if (actor.isHero && mood === 'flinch') drawClawd(b, p.x + (Math.floor(time * 20) % 2 === 0 ? 1 : -1), p.y, { ...look, eyes: 'closed', arms: { left: 'out', right: 'out' } })
    else drawClawd(b, p.x, p.y, look)
  }
  scene.front?.(b, t)

  return b
}

// The column a narrow raster keeps in view at a moment.
export const focusAt = (scene: Scene, time: number): number => scene.focus?.(loopTime(scene, time)) ?? scene.focusX

// Where the hero's head is: its centre column and top row.
export function heroAt(scene: Scene, time: number): Point {
  const hero = scene.actors.find((a): a is Extract<Actor, { kind: 'clawd' }> => a.kind === 'clawd' && a.isHero === true)
  if (!hero) return { x: scene.focusX, y: CLAWD_TOP }
  const p = hero.at(loopTime(scene, time))

  return { x: Math.round(p.x) + 7, y: Math.round(p.y) }
}

// The stage cut to the raster's width around focusX, or centred in a wider
// raster.
export function crop(full: PixelBuffer, focusX: number, width: number): PixelBuffer {
  const out = createBuffer(width, full.h)
  const left = width >= full.w ? -Math.floor((width - full.w) / 2) : Math.max(0, Math.min(full.w - width, Math.round(focusX - width / 2)))
  for (let y = 0; y < full.h; y++) {
    for (let x = 0; x < width; x++) {
      const sx = x + left
      if (sx >= 0 && sx < full.w) out.px[y * width + x] = full.px[y * full.w + sx]!
    }
  }

  return out
}

// top over base: its pixels where it has them, and its text. A cell where
// top draws a pixel or a character loses base's character.
export function overlay(base: PixelBuffer, top: PixelBuffer): PixelBuffer {
  const px = base.px.slice()
  for (let i = 0; i < px.length; i++) if (top.px[i] !== EMPTY) px[i] = top.px[i]!
  if (!base.text && !top.text) return { w: base.w, h: base.h, px }
  const n = base.w * Math.ceil(base.h / 2)
  const text: TextLayer = { cp: base.text ? base.text.cp.slice() : new Int32Array(n), fg: base.text ? base.text.fg.slice() : new Int32Array(n) }
  for (let c = 0; c < n; c++) {
    const x = c % base.w
    const y = Math.floor(c / base.w) * 2
    const isCovered = top.px[y * base.w + x] !== EMPTY || (y + 1 < base.h && top.px[(y + 1) * base.w + x] !== EMPTY)
    if ((top.text?.cp[c] ?? 0) !== 0) {
      text.cp[c] = top.text!.cp[c]!
      text.fg[c] = top.text!.fg[c]!
    } else if (isCovered) text.cp[c] = 0
  }

  return { w: base.w, h: base.h, px, text }
}

// Where a terminal cell (a column, two pixel rows) changes over in a
// dissolve: a hash of the cell and the seed, spread evenly over 0 to 1.
export function cellThreshold(x: number, row: number, seed: number): number {
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(row + 1, 0x165667b1) ^ Math.imul(Math.floor(seed) | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16

  return (h >>> 0) / 0x100000000
}

// The old frame breaking up into the new one, cell by cell in a scattered
// order: a cell shows the new frame's two pixels, and its character, once
// its threshold is below progress (0 to 1), so a cell that has changed
// stays changed. Both frames have the same size.
export function dissolve(from: PixelBuffer, to: PixelBuffer, progress: number, seed: number): PixelBuffer {
  const px = from.px.slice()
  for (let y = 0; y < to.h; y++) {
    for (let x = 0; x < to.w; x++) if (cellThreshold(x, Math.floor(y / 2), seed) < progress) px[y * to.w + x] = to.px[y * to.w + x]!
  }
  if (!from.text && !to.text) return { w: from.w, h: from.h, px }
  const n = to.w * Math.ceil(to.h / 2)
  const text: TextLayer = { cp: new Int32Array(n), fg: new Int32Array(n) }
  for (let c = 0; c < n; c++) {
    const source = cellThreshold(c % to.w, Math.floor(c / to.w), seed) < progress ? to.text : from.text
    if (!source) continue
    text.cp[c] = source.cp[c]!
    text.fg[c] = source.fg[c]!
  }

  return { w: from.w, h: from.h, px, text }
}

// The whole stage at a moment, with a fading scene's dissolve at its loop
// point: in its second loop and after, for FADE_MS, its last moment, held,
// breaks up into the new loop (the background drifting on in both).
export function renderSeamed(scene: Scene, time: number, mood: Mood = null): PixelBuffer {
  const now = renderFull(scene, time, mood)
  const into = loopTime(scene, time)
  if (!scene.fadesAtLoop || time < scene.loop || into >= FADE_MS / 1000) return now
  const held = renderFull(scene, time - into - LOOP_LAST_S, mood, time)

  return dissolve(held, now, into / (FADE_MS / 1000), Math.floor(time / scene.loop))
}

export const renderScene = (scene: Scene, time: number, width: number, mood: Mood = null): PixelBuffer =>
  crop(renderSeamed(scene, time, mood), focusAt(scene, time), width)
