// The area below the bar: 48 x 14 pixels (7 rows) that play the demo, the
// waiting toon or the idle routine, cut to the band's width from the left,
// where Clawd stands.

import { IDLE_COLS, IDLE_ROWS } from './idle'
import { createBuffer, EMPTY, type PixelBuffer } from './pixels'
import { crop, STAGE_H, STAGE_W } from './scene'

// The idle box sits at the area's bottom-left, so Clawd stands on the
// scenes' floor.
export const IDLE_TOP = STAGE_H - IDLE_ROWS * 2

// The box on the area, over the routine's background when it has one: the
// background shows wherever the box draws nothing.
export function placeIdle(box: PixelBuffer, background: PixelBuffer | null = null): PixelBuffer {
  const b = background ? { w: STAGE_W, h: STAGE_H, px: background.px.slice() } : createBuffer(STAGE_W, STAGE_H)
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < Math.min(box.w, IDLE_COLS); x++) {
      const color = box.px[y * box.w + x]!
      if (color !== EMPTY) b.px[(IDLE_TOP + y) * STAGE_W + x] = color
    }
  }

  return b
}

// The area's left part, width columns wide.
export const cropLeft = (full: PixelBuffer, width: number): PixelBuffer => crop(full, 0, width)
