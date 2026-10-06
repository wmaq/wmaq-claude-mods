// Waiting bench: Clawd sits on a bench while a clock ticks, and now and
// then turns and waves at you. On a wider area the bench runs on to the
// edge.

import { fillRect, rightOf, setPixel } from '../pixels'
import type { Scene } from '../scene'
import { blinking, C, every, still } from './kit'

const LOOP = 8
const WAVE_FROM = 4
const WAVE_TO = 5.6
const CLOCK = { x: 39, y: 5 }
const RIM: [number, number][] = [
  [-1, -3], [0, -3], [1, -3], [-2, -2], [2, -2], [-3, -1], [3, -1], [-3, 0], [3, 0], [-3, 1], [3, 1], [-2, 2], [2, 2], [-1, 3], [0, 3], [1, 3],
]
// The hand's tip in eight steps from twelve o'clock; two turns a loop.
const HAND: [number, number][] = [[0, -2], [1, -1], [2, 0], [1, 1], [0, 2], [-1, 1], [-2, 0], [-1, -1]]

export const waitingBench: Scene = {
  id: 'waiting-bench',
  loop: LOOP,
  focusX: 24,
  backdrop: b => {
    fillRect(b, 6, 11, 22, 1, C.wood)
    fillRect(b, 8, 12, 1, 2, C.woodDark)
    fillRect(b, 25, 12, 1, 2, C.woodDark)
    // It ends at 27 on 48 columns; on a wider area it runs on from 28, a leg
    // every 17 columns after its right one (25), as far apart as its own.
    const edge = rightOf(b)
    if (edge <= 48) return
    fillRect(b, 28, 11, edge - 28, 1, C.wood)
    for (let x = 25 + 17; x < edge; x += 17) fillRect(b, x, 12, 1, 2, C.woodDark)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      // Sitting, Clawd's body drops 2 pixels: at y 3 it rests on the seat (row 11).
      at: still(11, 3),
      look: t => {
        const isWaving = t >= WAVE_FROM && t < WAVE_TO

        return {
          pose: 'sit',
          isBlinking: blinking(t, 0.8),
          look: isWaving ? { x: 0, y: 1 } : { x: 1, y: -1 },
          arms: { left: 'down', right: isWaving ? (every(t, 0.25) % 2 === 0 ? 'up' : 'out') : 'down' },
        }
      },
    },
  ],
  front: (b, t) => {
    for (const [dx, dy] of RIM) setPixel(b, CLOCK.x + dx, CLOCK.y + dy, C.paper)
    setPixel(b, CLOCK.x, CLOCK.y, C.ink)
    const [hx, hy] = HAND[every(t, 0.5) % HAND.length]!
    setPixel(b, CLOCK.x + Math.sign(hx), CLOCK.y + Math.sign(hy), C.ink)
    setPixel(b, CLOCK.x + hx, CLOCK.y + hy, C.ink)
  },
}
