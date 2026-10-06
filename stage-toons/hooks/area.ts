// The area below the bar: the band's width (at least the core's 48
// columns, cropped from the left where narrower) by 7 to 9 rows, where the
// demo, the waiting toon or the idle routine plays. Clawd stands at its
// bottom left.

import { IDLE_COLS, IDLE_ROWS } from './idle'
import { EMPTY, type PixelBuffer } from './pixels'
import { type AreaSize, areaBuffer, crop, STAGE_SIZE } from './scene'

// The idle box's top row on an area this many rows tall: it sits at the
// area's bottom-left, so Clawd stands on the scenes' floor.
export const idleTop = (rows: number): number => rows * 2 - IDLE_ROWS * 2

// The box on the area, over the routine's background when it has one: the
// background shows wherever the box draws nothing.
export function placeIdle(box: PixelBuffer, background: PixelBuffer | null = null, size: AreaSize = STAGE_SIZE): PixelBuffer {
  const b = background ? { ...background, px: background.px.slice() } : areaBuffer(size)
  const top = idleTop(size.rows)
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < Math.min(box.w, IDLE_COLS); x++) {
      const color = box.px[y * box.w + x]!
      if (color !== EMPTY) b.px[(top + y) * b.w + x] = color
    }
  }

  return b
}

// The area's left part, as wide as the area.
export const cropLeft = (full: PixelBuffer, size: AreaSize): PixelBuffer => crop(full, 0, size.columns)
