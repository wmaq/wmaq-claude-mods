// Sweeping: Clawd sweeps back and forth while the docs fill a shelf. On a
// wider area the shelf runs on to the edge, full of docs shelved already.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { BROOM, C, every } from './kit'

const sweepX = (t: number) => 6 + 10 * (t < 4 ? t / 4 : (8 - t) / 4)
const facing = (t: number) => (t < 4 ? 1 : -1)
const BOOKS = [C.blue, C.red, C.green, C.gold]
// The core shelves its 8 books at 37 to 44, on a plank from 36 to 46.
const SHELF_Y = 7
const CORE_BOOKS_X = 37
const CORE_BOOKS = 8
// Past the core's books, on a wider area, the shelf is full to the edge
// from 45, so the eighth book closes the row: the four colours, mostly in
// a dimmer shade (the wings stay quiet) and one book in four as bright as
// the core's, in an order that doesn't repeat to the eye, no two of a
// colour side by side; most books as tall as the core's (4), some a row
// shorter. None is taller: the rows above stay clear for what shows over
// Clawd's head.
const DIM_BOOKS = [0x3d5c99, 0x96413b, 0x41804c, 0xa68a3c]
const WING_BOOKS_X = CORE_BOOKS_X + CORE_BOOKS

// A small integer hash of a number, the same on every frame and size.
function hashOf(n: number): number {
  let h = Math.imul(n ^ 0x5bd1e995, 0x2c1b3c6d)
  h ^= h >>> 13
  h = Math.imul(h, 0x297a2d39)

  return (h ^ (h >>> 15)) >>> 0
}

function shelf(b: PixelBuffer) {
  fillRect(b, 36, SHELF_Y, 11, 1, C.woodDark)
  const edge = rightOf(b)
  // Column 47 and the books past the core's only on a wider area: at 48
  // columns the shelf ends at 46, bare past the eighth book.
  if (edge <= 48) return
  fillRect(b, 47, SHELF_Y, edge - 47, 1, C.woodDark)
  // Each book's colour steps on from its left neighbour's by 1 to 3 of the
  // 4, so never the same; the steps, shades and heights come from the
  // column. The first steps on from the core's last book, gold.
  let k = BOOKS.length - 1
  for (let x = WING_BOOKS_X; x < edge; x++) {
    k = (k + 1 + (hashOf(x) % (BOOKS.length - 1))) % BOOKS.length
    const isBright = hashOf(x * 7 + 3) % 4 === 0
    const height = hashOf(x * 13 + 5) % 4 === 0 ? 3 : 4
    fillRect(b, x, SHELF_Y - height, 1, height, (isBright ? BOOKS : DIM_BOOKS)[k]!)
  }
}

export const sweeping: Scene = {
  id: 'sweeping',
  loop: 8,
  fadesAtLoop: true,
  focusX: 24,
  backdrop: shelf,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: sweepX(t), y: CLAWD_TOP }),
      look: t => ({ pose: 'walk', stride: Math.floor(t * 6), facing: facing(t), arms: { left: 'out', right: 'out' } }),
    },
  ],
  front: (b, t) => {
    const x = Math.round(sweepX(t)) + (facing(t) > 0 ? 15 : -3)
    drawSprite(b, BROOM, 0, x, 8)
    for (let k = 0; k < 4; k++) {
      const phase = (t * 3 + k * 0.25) % 1
      setPixel(b, x + 1 - facing(t) * (2 + k * 2), 13 - Math.floor(phase * 3), C.dust)
    }
    const shelved = Math.min(CORE_BOOKS, every(t, 1) + 1)
    for (let i = 0; i < shelved; i++) fillRect(b, CORE_BOOKS_X + i, 3, 1, 4, BOOKS[i % BOOKS.length]!)
  },
}
