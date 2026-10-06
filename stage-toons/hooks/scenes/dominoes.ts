// Dominoes: Clawd sets up a row of dominoes one by one, tips the first, and
// cheers as they all fall. On a wider area the row carries on to the edge,
// standing from the start, and falls on faster after the core's eight.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
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
// The wider row's chain ends by this time (a gap after its last tip, as
// DONE is the core's), so every domino lies flat before the loop fades.
const CHAIN_BY = LOOP - 0.3

// The dominoes past the core's eight: one every 3 columns from 45 to the
// edge (the one at 45 only on a wider area: at 48 columns the row is the
// core's eight). Each falls the gap after the one before it, the first
// where a ninth would (DONE), and the gap shrinks on a wide area so the
// chain ends by CHAIN_BY; there several may fall in one frame.
function wings(b: PixelBuffer): { count: number; gap: number } {
  const edge = rightOf(b)
  const count = edge > 48 ? Math.ceil((edge - 45) / 3) : 0

  return { count, gap: count > 0 ? Math.min(0.05, (CHAIN_BY - DONE) / count) : 0 }
}

// When the whole row lies flat, for Clawd's cheer. An actor's look has no
// buffer to read the width from, so the backdrop, drawn before every
// actor, notes it for the frame it draws: look is only right inside a
// render (heroAt reads the actor's at alone, never its look).
let chainEnd = DONE

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
  still: 4.8,
  fadesAtLoop: true,
  focusX: 28,
  backdrop: b => {
    const { count, gap } = wings(b)
    chainEnd = DONE + count * gap
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => {
        const isReaching = (t < COUNT * SET_EVERY && t % SET_EVERY < 0.2) || (t >= TIP_AT - 0.3 && t < TIP_AT)

        return t >= chainEnd
          ? { eyes: 'wide', arms: { left: 'up', right: 'up' } }
          : { isBlinking: blinking(t, 0.9), look: { x: 1, y: 1 }, arms: { left: 'down', right: isReaching ? 'out' : 'down' } }
      },
    },
  ],
  front: (b, t) => {
    for (let i = 0; i < COUNT; i++) if (t >= i * SET_EVERY) drawDomino(b, xOf(i), t - (TIP_AT + i * FALL_GAP))
    const { count, gap } = wings(b)
    for (let j = 0; j < count; j++) drawDomino(b, 45 + 3 * j, t - (DONE + j * gap))
  },
}
