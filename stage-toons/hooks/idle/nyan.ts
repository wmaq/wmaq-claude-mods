// Nyan: Clawd flies through space, paddling, a rainbow streaming behind him
// and a starfield drifting past across the whole area, in three depths, on
// the navy of the Nyan Cat video. He bobs up and down through the area's
// height, and the rainbow follows in a wave: each block of it is where his
// body was a moment before.
//
// All of it is the routine's background, drawn on the whole area: the idle
// box is only the bottom four rows, and he flies above it.

import { drawClawd } from '../clawd'
import { fillRect, type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { C, drawStarfield, every } from '../scenes/kit'
import { CLAWD_X } from './doze'
import type { IdleRoutine } from './routine'

const LOOP = 4
const STRIPES = [C.red, C.orange, C.gold, C.green, C.blue, C.violet]
// The night sky of the Nyan Cat video: a deep navy.
export const NYAN_SKY = 0x0d3b66
// One bob up and down every BOB seconds (two a loop), and how far behind
// him in time each block of 3 columns of the rainbow is.
const BOB = 2
const LAG = 0.12
const BLOCK = 3
// His sprite's height: he flies between the area's top and the bottom row.
const CLAWD_H = 8

// His top row at a moment of the loop, on this area: a smooth bob around
// the area's middle, 2 pixels each way on a 7-row area, 3 on a taller one.
export function nyanTop(b: PixelBuffer, t: number): number {
  const top = topOf(b)
  const low = 14 - CLAWD_H
  const middle = (top + low) / 2
  const reach = Math.min(3, Math.floor((low - top) / 2) - 1)

  return Math.round(middle - reach * Math.sin((t / BOB) * Math.PI * 2))
}

function drawNyan(b: PixelBuffer, time: number) {
  const t = ((time % LOOP) + LOOP) % LOOP
  fillRect(b, 0, topOf(b), rightOf(b), 14 - topOf(b), NYAN_SKY)
  drawStarfield(b, time, ['far', 'middle', 'near'])
  // The rainbow: blocks of 3 columns from under his body back to the left
  // edge, each at his height LAG seconds further back than the last. It
  // runs 2 columns into his sprite box, under his body (drawn after it),
  // so it starts right behind him.
  for (let x = 0; x < CLAWD_X + 2; x++) {
    const back = Math.floor((CLAWD_X + 1 - x) / BLOCK)
    const y = nyanTop(b, t - back * LAG)
    STRIPES.forEach((color, i) => setPixel(b, x, y + 1 + i, color))
  }
  drawClawd(b, CLAWD_X, nyanTop(b, t), { pose: 'walk', stride: every(t, 0.25) % 4, facing: 1, look: { x: 1, y: 0 }, arms: { left: 'down', right: 'down' } })
}

export const nyan: IdleRoutine = {
  id: 'nyan',
  loop: LOOP,
  // In the box: nothing; he is drawn with his sky.
  draw: () => undefined,
  background: drawNyan,
}
