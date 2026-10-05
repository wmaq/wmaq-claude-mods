// Blueprint: Clawd draws a plan on a drafting board, line by line, and
// looks it over.

import { fillRect, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'

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

export const blueprint: Scene = {
  id: 'blueprint',
  loop: LOOP,
  fadesAtLoop: true,
  focusX: 28,
  backdrop: b => {
    fillRect(b, 26, 2, 17, 11, C.blue)
    fillRect(b, 27, 13, 1, 1, C.woodDark)
    fillRect(b, 41, 13, 1, 1, C.woodDark)
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
