// Test tubes: test tubes bubble and a green tick pops over each. On a wider
// area the rack carries on to the edge, its tubes bubbling in turn.

import { type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, still, TICK, TUBE } from './kit'

const TUBES = [24, 31, 38]
const TUBE_EVERY = 7

// The core's tubes, and on a wider area one every 7 columns from 45 (the
// one at 45 only then: at 48 columns the rack is the core's three).
function tubesOn(b: PixelBuffer): number[] {
  const edge = rightOf(b)
  if (edge <= 48) return TUBES
  const more: number[] = []
  for (let x = 45; x < edge; x += TUBE_EVERY) more.push(x)

  return [...TUBES, ...more]
}

export const testTubes: Scene = {
  id: 'test-tubes',
  loop: 6,
  focusX: 24,
  backdrop: (b, t) => {
    // Each bubbles a little after the one before it; a bubble's cycle is
    // 0.75 s, 8 to a loop, so the wings stay seamless.
    tubesOn(b).forEach((x, i) => {
      drawSprite(b, TUBE, 0, x, 7)
      for (let k = 0; k < 2; k++) {
        const phase = (t * 2 + i * 0.7 + k * 0.5) % 1.5
        const y = 11 - Math.floor(phase * 3)
        if (y >= 8) setPixel(b, x + 1, y, C.white)
      }
    })
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => ({ facing: 1, look: { x: 1, y: 0 }, isBlinking: blinking(t, 0.8), arms: { left: 'down', right: t % 2 < 1 ? 'out' : 'up' } }),
    },
  ],
  front: (b, t) => {
    TUBES.forEach((x, i) => {
      if (t >= 1.5 + i * 1.2) drawSprite(b, TICK, 0, x, 2)
    })
  },
}
