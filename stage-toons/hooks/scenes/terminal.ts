// Terminal: Clawd sits typing at a computer while lines of code scroll up
// its screen. On a wider area the desk runs on to the edge.

import { fillRect, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, plankOn, still } from './kit'

const LINE_EVERY = 0.4
const LENGTHS = [8, 5, 10, 3, 7, 9, 4, 6, 10, 2, 8, 5]
const COLORS = [C.green, C.blue, C.gold]
// Twelve lines, a new one every 0.4 s: the loop ends where it began.
const LOOP = LINE_EVERY * LENGTHS.length

export const terminal: Scene = {
  id: 'terminal',
  loop: LOOP,
  focusX: 26,
  backdrop: b => {
    fillRect(b, 25, 1, 16, 10, C.darkGray)
    fillRect(b, 26, 2, 14, 8, C.ink)
    fillRect(b, 32, 11, 2, 1, C.darkGray)
    fillRect(b, 18, 12, 26, 1, C.wood)
    fillRect(b, 19, 13, 1, 1, C.woodDark)
    fillRect(b, 42, 13, 1, 1, C.woodDark)
    // The desk ends at 43 on 48 columns; on a wider area it runs on from 44,
    // a leg every 23 columns after its right leg (42).
    if (rightOf(b) > 48) plankOn(b, 44, 12, 1, 42 + 23, 23)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => ({ pose: 'sit', isBlinking: blinking(t, 0.5), look: { x: 1, y: -1 }, arms: { left: 'down', right: every(t, 0.15) % 2 === 0 ? 'out' : 'down' } }),
    },
  ],
  front: (b, t) => {
    // The keyboard under the typing claw.
    fillRect(b, 19, 11, 7, 1, C.gray)
    const first = every(t, LINE_EVERY)
    for (let k = 0; k < 3; k++) {
      const n = first + k
      fillRect(b, 27, 3 + k * 2, LENGTHS[n % LENGTHS.length]!, 1, COLORS[n % COLORS.length]!)
    }
    if (every(t, 0.25) % 2 === 0) setPixel(b, 27, 9, C.white)
  },
}
