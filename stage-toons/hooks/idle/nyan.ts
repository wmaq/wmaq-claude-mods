// Nyan: Clawd flies through space, paddling, a rainbow streaming behind him
// and stars rushing past on the rows it leaves free.

import { drawClawd } from '../clawd'
import { type PixelBuffer, setPixel } from '../pixels'
import { C, every } from '../scenes/kit'
import { CLAWD_X } from './doze'
import type { IdleRoutine } from './routine'

const LOOP = 4
const WIDTH = 26
const STRIPES = [C.red, C.orange, C.gold, C.green, C.blue, C.violet]
const STARS = [
  { x: 4, y: 0 },
  { x: 17, y: 0 },
  { x: 10, y: 7 },
  { x: 23, y: 7 },
]

function drawStars(b: PixelBuffer, t: number) {
  STARS.forEach((s, i) => {
    // Each star crosses the box once a loop, right to left, and twinkles:
    // half of them show at a time, trading every 0.25 s.
    if ((every(t, 0.25) + i) % 2 === 1) return
    // Rounded up to WIDTH, a star wraps to column 0 rather than leave the box.
    const x = Math.round((((s.x - (t / LOOP) * WIDTH) % WIDTH) + WIDTH) % WIDTH) % WIDTH
    setPixel(b, x, s.y, C.white)
  })
}

export const nyan: IdleRoutine = {
  id: 'nyan',
  loop: LOOP,
  draw: (b, t) => {
    drawStars(b, t)
    // The step-wave: blocks of 3 columns, every other one a pixel lower,
    // trading places every 0.25 s. It runs 2 columns into Clawd's sprite
    // box, under his body (drawn after it), so it starts right behind him.
    const flip = every(t, 0.25) % 2
    for (let x = 0; x < CLAWD_X + 2; x++) {
      const drop = (Math.floor(x / 3) + flip) % 2
      STRIPES.forEach((color, i) => setPixel(b, x, 1 + drop + i, color))
    }
    drawClawd(b, CLAWD_X, 0, { pose: 'walk', stride: every(t, 0.25) % 4, facing: 1, look: { x: 1, y: 0 }, arms: { left: 'down', right: 'down' } })
  },
}
