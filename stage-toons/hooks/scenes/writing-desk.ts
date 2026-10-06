// Writing desk: Clawd writes at a desk while finished pages stack up on it,
// beside him. The desk runs on to the area's right edge, and on a wider
// area, past the core, stands a second stack, written already.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, plankOn, still } from './kit'

// The desk's top row; the stacks stand on the row above it.
const DESK_Y = 12
const STACK_TOP_PAGES = 6

// The page stack: count pages, bottom up from row y, alternating shades.
function stack(b: PixelBuffer, x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) fillRect(b, x, y - i, 6, 1, i % 2 === 0 ? C.paper : C.paperShade)
}

// The desk's core legs stand at 11 and 30; from 32 its top runs on to the
// edge (past the growing stack), a leg every 19 columns after its right
// one, as far apart as its own. The second stack stands on it at x 52, as
// tall as the first grows.
function desk(b: PixelBuffer) {
  fillRect(b, 10, DESK_Y, 22, 1, C.wood)
  fillRect(b, 11, DESK_Y + 1, 1, 1, C.woodDark)
  fillRect(b, 30, DESK_Y + 1, 1, 1, C.woodDark)
  plankOn(b, 32, DESK_Y, 1, 30 + 19, 19)
  stack(b, 52, DESK_Y - 1, STACK_TOP_PAGES)
}

export const writingDesk: Scene = {
  id: 'writing-desk',
  loop: 6,
  fadesAtLoop: true,
  focusX: 24,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(14, CLAWD_TOP),
      look: t => ({ pose: 'sit', isBlinking: blinking(t, 1), look: { x: 1, y: 1 }, arms: { left: 'down', right: every(t, 0.25) % 2 === 1 ? 'out' : 'down' } }),
    },
  ],
  front: (b, t) => {
    // The desk in front of Clawd, the sheet on it, the pen moving.
    desk(b)
    fillRect(b, 20, 11, 5, 1, C.paper)
    setPixel(b, 20 + (every(t, 0.25) % 5), 11, C.ink)
    // The finished pages, on the desk beside him.
    stack(b, 36, DESK_Y - 1, Math.min(STACK_TOP_PAGES, every(t, 0.9) + 1))
  },
}
