// Test tubes: test tubes bubble and a green tick pops over each. On a wider
// area the rack carries on to the edge, its tubes bubbling in turn, and the
// ticks run along every tube in the same few seconds, then clear in turn
// before the loop ends.

import { type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, still, TICK, TUBE } from './kit'

const TUBES = [24, 31, 38]
const TUBE_EVERY = 7
// The first tick's moment, and the time the ticks take to reach the last
// tube; on the core's three, one every 1.2 s, and they stay to the loop's
// end. Past 48 columns they clear in turn from CLEAR_FROM over CLEAR_FOR,
// so the wings meet themselves at the loop point.
const FIRST_TICK = 1.5
const TICKS_FOR = 2.4
const CLEAR_FROM = 4.4
const CLEAR_FOR = 1.4

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
  still: 3.6,
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
    const tubes = tubesOn(b)
    const isWide = tubes.length > TUBES.length
    tubes.forEach((x, i) => {
      const isCleared = isWide && t >= CLEAR_FROM + (i * CLEAR_FOR) / (tubes.length - 1)
      if (t >= FIRST_TICK + (i * TICKS_FOR) / (tubes.length - 1) && !isCleared) drawSprite(b, TICK, 0, x, 2)
    })
  },
}
