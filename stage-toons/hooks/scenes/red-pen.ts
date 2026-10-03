// Red pen: Clawd reads a page, circles each mistake in red, and each circle
// turns into a green tick once the mistake is fixed.

import { fillRect, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'

const LOOP = 6
const PER_MISTAKE = 1.5
const CIRCLED_FOR = 0.9
const MISTAKES = [
  { x: 31, y: 4 },
  { x: 28, y: 7 },
  { x: 33, y: 10 },
]
const RING: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [0, 1], [1, 1]]
const TICKED: [number, number][] = [[-1, 0], [0, 1], [1, 0], [2, -1]]

export const redPen: Scene = {
  id: 'red-pen',
  loop: LOOP,
  focusX: 26,
  backdrop: b => {
    fillRect(b, 24, 2, 13, 11, C.paper)
    for (const y of [4, 7, 10]) fillRect(b, 26, y, 9, 1, C.paperShade)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(8, CLAWD_TOP),
      look: t => ({
        isBlinking: blinking(t, 0.2),
        look: { x: 1, y: every(t, PER_MISTAKE) % 2 === 0 ? -1 : 1 },
        arms: { left: 'down', right: t < MISTAKES.length * PER_MISTAKE && t % PER_MISTAKE < CIRCLED_FOR ? 'out' : 'down' },
      }),
    },
  ],
  front: (b, t) => {
    MISTAKES.forEach((m, i) => {
      const age = t - i * PER_MISTAKE
      if (age < 0 || age < CIRCLED_FOR) setPixel(b, m.x, m.y, C.ink)
      if (age < 0) return
      const isCircled = age < CIRCLED_FOR
      for (const [dx, dy] of isCircled ? RING : TICKED) setPixel(b, m.x + dx, m.y + dy, isCircled ? C.red : C.green)
    })
  },
}
