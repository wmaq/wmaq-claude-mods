// Nyan: Clawd flies through space, paddling, a rainbow streaming behind him
// and a starfield drifting past across the whole area, in three depths.

import { drawClawd } from '../clawd'
import { setPixel } from '../pixels'
import { C, drawStarfield, every } from '../scenes/kit'
import { CLAWD_X } from './doze'
import type { IdleRoutine } from './routine'

const LOOP = 4
const STRIPES = [C.red, C.orange, C.gold, C.green, C.blue, C.violet]

export const nyan: IdleRoutine = {
  id: 'nyan',
  loop: LOOP,
  background: (b, time) => drawStarfield(b, time, ['far', 'middle', 'near']),
  draw: (b, t) => {
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
