// What the scenes' themed wings share: a set piece repeated from a column
// to the area's right edge, and a wall of shelves. The
// wings start at column 48 (WINGS_X), past the core, so on a 48-column area
// none of them is drawn.

import { fillRect, type PixelBuffer, rightOf } from '../pixels'
import { C } from './kit'

// Where the wings start: the first column past the core.
export const WINGS_X = 48

// Calls draw at from and every step columns after it, while the column is
// on the area. The places are fixed by the scene, never by the width, so a
// wider area only shows more of them.
export function tileOn(b: PixelBuffer, from: number, step: number, draw: (x: number, k: number) => void): void {
  for (let k = 0; from + k * step < rightOf(b); k++) draw(from + k * step, k)
}

// A wall of shelves from column from to the edge: a wood plank on each of
// the rows given, a woodDark upright at from and every bay columns after
// it, and on each shelf whatever item draws, every pitch columns within a
// bay (x the item's left column, y the row it stands on, the one above the
// plank; k counts the items along a shelf, row the shelves from the top).
export function shelvesOn(
  b: PixelBuffer,
  from: number,
  planks: readonly number[],
  bay: number,
  pitch: number,
  item: (x: number, y: number, k: number, row: number) => void,
): void {
  const top = planks[0]! - 4
  planks.forEach((y, row) => {
    fillRect(b, from, y, rightOf(b) - from, 1, C.wood)
    tileOn(b, from, bay, (bayX, n) => {
      const slots = Math.floor((bay - 2) / pitch)
      for (let i = 0; i < slots; i++) item(bayX + 2 + i * pitch, y - 1, n * slots + i, row)
    })
  })
  tileOn(b, from, bay, x => fillRect(b, x, top, 1, 14 - top, C.woodDark))
}
