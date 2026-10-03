// Stepping stones: boxes on a checklist get ticked while Clawd lays stepping stones.

import { fillRect } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, still, STONE } from './kit'

const ROWS = [5, 8, 11]
const STONES = [18, 24, 30]

export const steppingStones: Scene = {
  id: 'stepping-stones',
  loop: 6,
  focusX: 24,
  backdrop: b => {
    fillRect(b, 2, 3, 11, 10, C.paper)
    for (const y of ROWS) {
      fillRect(b, 4, y - 1, 2, 2, C.paperShade)
      fillRect(b, 7, y, 5, 1, C.ink)
    }
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(33, CLAWD_TOP),
      look: t => ({ facing: -1, isBlinking: blinking(t, 0.5), arms: { left: t % 1.5 < 0.5 ? 'out' : 'down', right: 'down' } }),
    },
  ],
  front: (b, t) => {
    ROWS.forEach((y, i) => {
      if (t >= 1 + i * 1.5) fillRect(b, 4, y - 1, 2, 2, C.green)
    })
    STONES.forEach((x, i) => {
      if (t >= 0.5 + i * 1.5) drawSprite(b, STONE, 0, x, 12)
    })
  },
}
