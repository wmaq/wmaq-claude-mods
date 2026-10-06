// Writing desk: Clawd writes at a desk while finished pages stack up beside it.
// On a wider area the desk runs on to the edge, and on it, past the core,
// stands a second stack, written already.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, plankOn, still } from './kit'

// The page stack: count pages, bottom up from row y, alternating shades.
function stack(b: PixelBuffer, x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) fillRect(b, x, y - i, 6, 1, i % 2 === 0 ? C.paper : C.paperShade)
}

// The desk ends at 31 on 48 columns; on a wider area it runs on from 32, a
// leg every 19 columns after its right one (30), as far apart as its own.
// The second stack stands on it at x 52, as tall as the first grows.
function wings(b: PixelBuffer) {
  if (rightOf(b) <= 48) return
  plankOn(b, 32, 12, 1, 30 + 19, 19)
  stack(b, 52, 11, 6)
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
    fillRect(b, 10, 12, 22, 1, C.wood)
    fillRect(b, 11, 13, 1, 1, C.woodDark)
    fillRect(b, 30, 13, 1, 1, C.woodDark)
    fillRect(b, 20, 11, 5, 1, C.paper)
    setPixel(b, 20 + (every(t, 0.25) % 5), 11, C.ink)
    wings(b)
    stack(b, 36, 13, Math.min(6, every(t, 0.9) + 1))
  },
}
