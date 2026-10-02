// Spec: Clawd writes at a desk while finished pages stack up beside it.

import { fillRect, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'

export const spec: Scene = {
  id: 'spec',
  loop: 6,
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
    fillRect(b, 10, 10, 22, 1, C.wood)
    fillRect(b, 11, 11, 1, 1, C.woodDark)
    fillRect(b, 30, 11, 1, 1, C.woodDark)
    fillRect(b, 20, 9, 5, 1, C.paper)
    setPixel(b, 20 + (every(t, 0.25) % 5), 9, C.ink)
    const pages = Math.min(6, every(t, 0.9) + 1)
    for (let i = 0; i < pages; i++) fillRect(b, 36, 11 - i, 6, 1, i % 2 === 0 ? C.paper : C.paperShade)
  },
}
