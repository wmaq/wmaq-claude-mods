// Scenes: props, sprites and Clawds moved by time on a 48x14 pixel stage,
// rendered whole and then cropped to the raster's width.

import { type ClawdLook, drawClawd } from './clawd'
import { createBuffer, EMPTY, type PixelBuffer, type Point, setPixel } from './pixels'

export const STAGE_W = 48
export const STAGE_H = 14
// Clawd's top row when it stands on the stage's bottom row.
export const CLAWD_TOP = 6

// A scene's name in the library (scenes/index.ts).
export type SceneId = string
// Fable's scene, played while a Fable subagent runs, and the scene that
// stands in for one that breaks.
export const FABLE_SCENE = 'fable-audit'
export const FALLBACK_SCENE = 'standing'
export type ReactionId = 'failure' | 'advance' | 'fable-arrives' | 'fable-leaves'
export type Mood = 'flinch' | 'jump' | null

export type Sprite = { palette: Record<string, number>; frames: string[][] }
export type Paint = (b: PixelBuffer, t: number) => void

export type Actor =
  | { kind: 'sprite'; sprite: Sprite; frame: (t: number) => number; at: (t: number) => Point }
  | { kind: 'clawd'; look: (t: number) => Partial<ClawdLook>; at: (t: number) => Point; isHero?: boolean }

// A looping scene: t runs from 0 to loop seconds. focusX is the column kept
// in view when the raster is narrower than the stage.
export type Scene = { id: SceneId; loop: number; focusX: number; backdrop?: Paint; actors: Actor[]; front?: Paint }

// A reaction plays once over a scene, drawn on its own layer relative to
// the hero's head, and may set the hero's mood.
export type ReactionSpec = { id: ReactionId; mood?: (t: number) => Mood; draw: (b: PixelBuffer, t: number, hero: Point) => void }

export function drawSprite(b: PixelBuffer, sprite: Sprite, frame: number, x: number, y: number): void {
  const n = sprite.frames.length
  const rows = sprite.frames[((Math.floor(frame) % n) + n) % n] ?? []
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = sprite.palette[row[dx]!]
      if (color !== undefined) setPixel(b, x + dx, y + dy, color)
    }
  })
}

export const loopTime = (scene: Scene, time: number): number => ((time % scene.loop) + scene.loop) % scene.loop

export function renderFull(scene: Scene, time: number, mood: Mood = null): PixelBuffer {
  const t = loopTime(scene, time)
  const b = createBuffer(STAGE_W, STAGE_H)
  scene.backdrop?.(b, t)
  for (const actor of scene.actors) {
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

// Where the hero's head is: its centre column and top row.
export function heroAt(scene: Scene, time: number): Point {
  const hero = scene.actors.find(a => a.kind === 'clawd' && a.isHero)
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

export function overlay(base: PixelBuffer, top: PixelBuffer): PixelBuffer {
  const px = base.px.slice()
  for (let i = 0; i < px.length; i++) if (top.px[i] !== EMPTY) px[i] = top.px[i]!

  return { w: base.w, h: base.h, px }
}

// The new frame from the left up to progress (0 to 1), the old one after it.
export function wipe(from: PixelBuffer, to: PixelBuffer, progress: number): PixelBuffer {
  const edge = Math.round(Math.max(0, Math.min(1, progress)) * to.w)
  const px = from.px.slice()
  for (let y = 0; y < to.h; y++) for (let x = 0; x < edge; x++) px[y * to.w + x] = to.px[y * to.w + x]!

  return { w: from.w, h: from.h, px }
}

export const renderScene = (scene: Scene, time: number, width: number, mood: Mood = null): PixelBuffer =>
  crop(renderFull(scene, time, mood), scene.focusX, width)
