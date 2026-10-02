// Claude testing: test tubes bubble and a green tick pops over each.

import { setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, still, TICK, TUBE } from './kit'

const TUBES = [24, 31, 38]

export const claudeTest: Scene = {
  id: 'claude-test',
  loop: 6,
  focusX: 24,
  backdrop: (b, t) => {
    TUBES.forEach((x, i) => {
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
