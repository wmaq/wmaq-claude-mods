// Blueprint: Clawd draws a plan on a drafting board, line by line, and
// looks it over. On a wider area, rolled blueprints stand in a bin past
// the board, and finished sheets are pinned up in a row to the edge.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'
import { tileOn, WINGS_X } from './wings'

const LOOP = 6
const DRAW_FOR = 5

// The plan's pixels in the order they are drawn: the outline, then a wall
// with a doorway.
const PLAN: [number, number][] = []
for (let x = 28; x <= 40; x++) PLAN.push([x, 4])
for (let y = 5; y <= 10; y++) PLAN.push([40, y])
for (let x = 39; x >= 28; x--) PLAN.push([x, 10])
for (let y = 9; y >= 5; y--) PLAN.push([28, y])
for (let y = 5; y <= 7; y++) PLAN.push([34, y])

// The wings: a bin of rolled blueprints (each roll's top a paler end),
// then pinned sheets every SHEET_EVERY columns, each with its own plan.
const BIN_X = WINGS_X + 2
const ROLLS: [number, number][] = [
  [1, 6],
  [2, 4],
  [3, 7],
  [4, 5],
]
const SHEETS_X = BIN_X + 10
const SHEET_EVERY = 12

function wings(b: PixelBuffer) {
  for (const [dx, top] of ROLLS) {
    fillRect(b, BIN_X + dx, top, 1, 9 - top, C.blue)
    setPixel(b, BIN_X + dx, top, C.glass)
  }
  fillRect(b, BIN_X, 9, 6, 5, C.wood)
  fillRect(b, BIN_X, 9, 6, 1, C.woodDark)
  tileOn(b, SHEETS_X, SHEET_EVERY, (x, k) => {
    fillRect(b, x, 5, 7, 6, C.blue)
    // A room's outline in a paler blue than the plan Clawd draws, so the
    // wings stay quiet, and on every other sheet a wall across it.
    fillRect(b, x + 1, 6, 5, 1, C.glass)
    fillRect(b, x + 1, 9, 5, 1, C.glass)
    fillRect(b, x + 1, 7, 1, 2, C.glass)
    fillRect(b, x + 5, 7, 1, 2, C.glass)
    if (k % 2 === 1) setPixel(b, x + 3, 7, C.glass)
    setPixel(b, x + 3, 4, C.red)
  })
}

export const blueprint: Scene = {
  id: 'blueprint',
  loop: LOOP,
  fadesAtLoop: true,
  focusX: 28,
  backdrop: b => {
    fillRect(b, 26, 2, 17, 11, C.blue)
    fillRect(b, 27, 13, 1, 1, C.woodDark)
    fillRect(b, 41, 13, 1, 1, C.woodDark)
    wings(b)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(10, CLAWD_TOP),
      look: t => ({ isBlinking: blinking(t, 0.7), look: { x: 1, y: 0 }, arms: { left: 'down', right: t < DRAW_FOR && every(t, 0.2) % 2 === 0 ? 'out' : 'down' } }),
    },
  ],
  front: (b, t) => {
    const drawn = Math.min(PLAN.length, Math.floor((t / DRAW_FOR) * PLAN.length) + 1)
    for (const [x, y] of PLAN.slice(0, drawn)) setPixel(b, x, y, C.white)
  },
}
