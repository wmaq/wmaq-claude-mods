// Dominoes: Clawd sets up a row of dominoes one by one, tips the first, and
// cheers as they all fall.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, still } from './kit'

const LOOP = 7
const COUNT = 8
const SET_EVERY = 0.45
const TIP_AT = 4.2
const FALL_GAP = 0.18
const FALLING_FOR = 0.12
const DONE = TIP_AT + COUNT * FALL_GAP
const xOf = (i: number) => 21 + i * 3

function drawDomino(b: PixelBuffer, x: number, fall: number) {
  if (fall < 0) {
    fillRect(b, x, 9, 1, 4, C.paper)
    setPixel(b, x, 10, C.ink)
  } else if (fall < FALLING_FOR) {
    setPixel(b, x, 12, C.paper)
    setPixel(b, x + 1, 11, C.paper)
    setPixel(b, x + 2, 10, C.paper)
  } else {
    fillRect(b, x, 12, 4, 1, C.paper)
    setPixel(b, x + 1, 12, C.ink)
  }
}

export const dominoes: Scene = {
  id: 'dominoes',
  loop: LOOP,
  fadesAtLoop: true,
  focusX: 28,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => {
        const isReaching = (t < COUNT * SET_EVERY && t % SET_EVERY < 0.2) || (t >= TIP_AT - 0.3 && t < TIP_AT)

        return t >= DONE
          ? { eyes: 'wide', arms: { left: 'up', right: 'up' } }
          : { isBlinking: blinking(t, 0.9), look: { x: 1, y: 1 }, arms: { left: 'down', right: isReaching ? 'out' : 'down' } }
      },
    },
  ],
  front: (b, t) => {
    for (let i = 0; i < COUNT; i++) if (t >= i * SET_EVERY) drawDomino(b, xOf(i), t - (TIP_AT + i * FALL_GAP))
  },
}
