// What some scenes' themed wings share: a set piece repeated across the
// wings, and a strip of water run on to the area's right edge. The wings
// start at column 48, past the core, so on a 48-column area nothing of them
// is drawn.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { STAGE_W } from '../scene'
import { C } from './kit'

// Draws a set piece at column from and every period columns after it, the
// k-th at from + k * period, while it starts inside the area; the last may
// be cut by the edge.
export function tileOn(b: PixelBuffer, from: number, period: number, draw: (x: number, k: number) => void): void {
  for (let k = 0, x = from; x < rightOf(b); k++, x += period) draw(x, k)
}

// Water from column from to the edge, rows y and y + 1, its light ripples
// every RIPPLE_EVERY columns, the lower row's half a period on from the
// upper's. shift moves them right; a whole RIPPLE_EVERY brings them back.
export const RIPPLE_EVERY = 8
export function waterOn(b: PixelBuffer, from: number, y: number, shift: number): void {
  const edge = rightOf(b)
  if (from >= edge) return
  fillRect(b, from, y, edge - from, 2, C.blue)
  for (let x = from; x < edge; x++) {
    const at = (((x - STAGE_W - shift) % RIPPLE_EVERY) + RIPPLE_EVERY) % RIPPLE_EVERY
    if (at === 0) setPixel(b, x, y, C.glass)
    if (at === RIPPLE_EVERY / 2) setPixel(b, x, y + 1, C.glass)
  }
}
