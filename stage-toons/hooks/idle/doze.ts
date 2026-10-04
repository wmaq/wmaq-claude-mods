// The doze every routine turns into after a minute: Clawd sits, closes his
// eyes, and one z at a time rises at his left.

import { drawClawd } from '../clawd'
import type { PixelBuffer } from '../pixels'
import { drawSprite, type Sprite } from '../scene'
import { C } from '../scenes/kit'

export const DOZE_MS = 60_000
// After this long dozing Clawd is deep asleep: one still picture, and the
// area stops repainting until something happens.
export const DEEP_SLEEP_MS = 5 * 60_000
// The z of the still picture: halfway up.
export const STILL_T = 1
export const Z_COLOR = C.smoke
// Clawd's column in the box, in every routine and the doze: the right edge,
// so nothing jumps when the doze takes over.
export const CLAWD_X = 12

const Z: Sprite = { palette: { z: Z_COLOR }, frames: [['zzz', '.z.', 'zzz']] }
// One z at a time rises from the bottom row to the top in Z_RISE seconds:
// two in one column would run together into one shape.
const Z_RISE = 2
const Z_X = 8

export function drawDoze(b: PixelBuffer, t: number): void {
  drawClawd(b, CLAWD_X, 0, { pose: 'sit', eyes: 'closed', arms: { left: 'down', right: 'down' } })
  const phase = (t / Z_RISE) % 1
  drawSprite(b, Z, 0, Z_X, 5 - Math.floor(phase * 6))
}
