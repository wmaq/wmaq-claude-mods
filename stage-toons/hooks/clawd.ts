// Clawd, the Claude Code mascot, in pixel art: a rounded block with two
// eyes and four little feet, 14 pixels wide and 8 tall, two pixels to a
// terminal cell.
//
// Ported from claude-toons (https://github.com/achimala/claude-toons),
// hooks/clawd.ts, Copyright (c) 2026 Anshu Chimala, MIT License; see NOTICE.
// Trimmed to scale 1 on the pixel grid, with colors as 0xRRGGBB and an
// optional monocle for Fable.

import { type PixelBuffer, type Point, setPixel } from './pixels'

export const CLAWD_W = 14
export const CLAWD_H = 8

// The body: B is the body, E an eye's resting place (body-colored; the eyes
// are drawn over it). The claws are drawn per pose beside it.
const BODY = [
  '..BBBBBBBBBB..',
  '..BBBBBBBBBB..',
  '.BBBEBBBBBEBB.',
  '.BBBEBBBBBEBB.',
  '.BBBBBBBBBBBB.',
  '..BBBBBBBBBB..',
]

export type Arm = 'up' | 'out' | 'down'

// A claw's pixels for each pose, for the left side (x from the body's left
// edge at 1, so 0 is just outside it); the right side mirrors them. Each
// ends at its tip, where things are held.
const CLAWS: Record<Arm, { pixels: [number, number][]; tip: [number, number] }> = {
  up: { pixels: [[0, 1], [0, 2]], tip: [0, 0] },
  out: { pixels: [[-1, 2], [0, 2]], tip: [-2, 2] },
  down: { pixels: [[0, 3], [0, 4]], tip: [0, 5] },
}
const BODY_H = BODY.length
const FEET = [3, 5, 8, 10]
const EYES = [4, 9] as const
const EYE_ROW = 2

export const CLAWD_ORANGE = 0xd97757
export const FABLE_VIOLET = 0x8b7ae8
export const EYE_DARK = 0x2a1610
export const MONOCLE = 0xf0e6c8

export type Pose = 'stand' | 'walk' | 'jump' | 'sit'
export type Eyes = 'open' | 'closed' | 'wide'

export type ClawdLook = {
  pose: Pose
  // Which walk frame (0 to 3) while walking.
  stride: number
  // -1 left, 0 ahead, 1 right: where the eyes look and the feet swing.
  facing: number
  eyes: Eyes
  // The eyes shifted from where they rest, in pixels: a glance.
  look: Point
  isBlinking: boolean
  color: number
  eyeColor: number
  arms: { left: Arm; right: Arm }
  hasMonocle: boolean
}

export const LOOK: ClawdLook = {
  pose: 'stand',
  stride: 0,
  facing: 0,
  eyes: 'open',
  look: { x: 0, y: 0 },
  isBlinking: false,
  color: CLAWD_ORANGE,
  eyeColor: EYE_DARK,
  arms: { left: 'up', right: 'up' },
  hasMonocle: false,
}

// Fable, the auditor: the same body in violet, with a monocle.
export const FABLE: Partial<ClawdLook> = { color: FABLE_VIOLET, hasMonocle: true }

export type Pixel = { x: number; y: number; c: number }
export type Anchors = { top: Point; left: Point; right: Point; feet: Point }

// The sprite's pixels from its top-left, body first and eyes last so a body
// pixel never covers an eye that glanced aside.
export function clawdPixels(partial: Partial<ClawdLook> = {}): Pixel[] {
  const look: ClawdLook = { ...LOOK, ...partial }
  const pixels: Pixel[] = []
  // A claw held out reaches a pixel past the box on either side.
  const add = (x: number, y: number, c: number) => {
    if (x >= -1 && x <= CLAWD_W && y >= 0 && y < CLAWD_H) pixels.push({ x, y, c })
  }
  // Sitting, the body rests on the ground where the feet would be.
  const drop = look.pose === 'sit' ? CLAWD_H - BODY_H : 0
  BODY.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') add(x, y + drop, look.color)
  })
  for (const [px, py] of CLAWS[look.arms.left].pixels) add(px, py + drop, look.color)
  for (const [px, py] of CLAWS[look.arms.right].pixels) add(CLAWD_W - 1 - px, py + drop, look.color)
  // The feet before the eyes, so the eyes stay last.
  if (look.pose !== 'sit') {
    const ground = CLAWD_H - 1
    const dir = look.facing || 1
    FEET.forEach((x0, i) => {
      // The left pair and the right pair swing against each other.
      const isFront = i < 2
      let swing = 0
      let isLifted = false
      if (look.pose === 'walk') {
        // A four-beat step: the pairs swing past each other, and the pair
        // mid-swing is off the ground.
        const beat = ((Math.round(look.stride) % 4) + 4) % 4
        if (beat === 0) swing = isFront ? 1 : -1
        else if (beat === 2) swing = isFront ? -1 : 1
        else isLifted = beat === 1 ? !isFront : isFront
      } else if (look.pose === 'jump') {
        isLifted = true
      }
      const x = x0 + swing * dir
      for (let y = BODY_H; y <= (isLifted ? ground - 1 : ground); y++) add(x, y, look.color)
    })
  }
  const ex = Math.max(-1, Math.min(1, Math.round(look.look.x))) || look.facing
  const ey = Math.max(-1, Math.min(1, Math.round(look.look.y)))
  for (const x0 of EYES) {
    const x = x0 + ex
    const y = EYE_ROW + ey + drop
    if (look.eyes === 'closed' || look.isBlinking) {
      // A line where the eye's lower pixel was.
      add(x, y + 1, look.eyeColor)
      add(x + (x0 === EYES[0] ? -1 : 1), y + 1, look.eyeColor)
    } else if (look.eyes === 'wide') {
      for (let dx = -1; dx <= 0; dx++) for (let dy = 0; dy <= 1; dy++) add(x + dx, y + dy, look.eyeColor)
    } else {
      add(x, y, look.eyeColor)
      add(x, y + 1, look.eyeColor)
    }
  }
  if (look.hasMonocle) {
    // A rim beside and above the right eye.
    const x = EYES[1] + ex
    const y = EYE_ROW + ey + drop
    add(x + 1, y, MONOCLE)
    add(x + 1, y + 1, MONOCLE)
    add(x, y - 1, MONOCLE)
  }

  return pixels
}

export function clawdAnchors(partial: Partial<ClawdLook> = {}): Anchors {
  const look: ClawdLook = { ...LOOK, ...partial }
  const drop = look.pose === 'sit' ? CLAWD_H - BODY_H : 0
  const leftTip = CLAWS[look.arms.left].tip
  const rightTip = CLAWS[look.arms.right].tip

  return {
    top: { x: CLAWD_W / 2, y: drop - 1 },
    left: { x: leftTip[0], y: leftTip[1] + drop },
    right: { x: CLAWD_W - 1 - rightTip[0], y: rightTip[1] + drop },
    feet: { x: CLAWD_W / 2, y: CLAWD_H },
  }
}

// Draws Clawd with its top-left at (x, y) and answers its anchors there.
export function drawClawd(b: PixelBuffer, x: number, y: number, partial: Partial<ClawdLook> = {}): Anchors {
  for (const p of clawdPixels(partial)) setPixel(b, x + p.x, y + p.y, p.c)
  const a = clawdAnchors(partial)
  const at = (p: Point): Point => ({ x: x + p.x, y: y + p.y })

  return { top: at(a.top), left: at(a.left), right: at(a.right), feet: at(a.feet) }
}
