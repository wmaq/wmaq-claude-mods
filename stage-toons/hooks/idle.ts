// The idle Clawd beside the bar while Claude waits for you: 18 columns by
// 4 rows. Awake, it blinks, glances down at the prompt and right at the
// bar, and taps a foot; after a minute it sits, closes its eyes and dozes,
// a z rising beside its head.

import { type ClawdLook, drawClawd } from './clawd'
import { createBuffer, type PixelBuffer } from './pixels'
import { drawSprite, type Sprite } from './scene'
import { blinking, C, every } from './scenes/kit'

export const IDLE_COLS = 18
export const IDLE_ROWS = 4
export const DOZE_MS = 60_000
export const Z_COLOR = C.smoke

const AWAKE_LOOP = 8
const Z: Sprite = { palette: { z: Z_COLOR }, frames: [['zzz', '.z.', 'zzz']] }
// One z at a time rises from the bottom row to the top in Z_RISE seconds:
// two in one column would run together into one shape.
const Z_RISE = 2
const Z_X = 15

function awakeLook(t: number): Partial<ClawdLook> {
  const isTapping = t >= 5 && t < 6 && every(t, 0.25) % 2 === 1
  const look = t >= 2 && t < 3.5 ? { x: 0, y: 1 } : t >= 3.5 && t < 5 ? { x: 1, y: 0 } : { x: 0, y: 0 }

  return { pose: isTapping ? 'walk' : 'stand', stride: 1, isBlinking: blinking(t), look, arms: { left: 'down', right: 'down' } }
}

export function idleFrame(idleMs: number): PixelBuffer {
  const b = createBuffer(IDLE_COLS, IDLE_ROWS * 2)
  if (idleMs < DOZE_MS) {
    drawClawd(b, 1, 0, awakeLook((idleMs / 1000) % AWAKE_LOOP))

    return b
  }
  drawClawd(b, 1, 0, { pose: 'sit', eyes: 'closed', arms: { left: 'down', right: 'down' } })
  const t = (idleMs - DOZE_MS) / 1000
  const phase = (t / Z_RISE) % 1
  drawSprite(b, Z, 0, Z_X, 5 - Math.floor(phase * 6))

  return b
}
