// Scroll: Clawd sits writing with a quill while a scroll unrolls across the
// floor, then rolls it back up.

import { fillRect, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, lerp, still } from './kit'

const LOOP = 7
const START_X = 18
const LONGEST = 27
const WRITE_FOR = 5.5
const ROLL_UP_AT = 6.2

const length = (t: number) => Math.round(t < ROLL_UP_AT ? lerp(2, LONGEST, t / WRITE_FOR) : lerp(LONGEST, 2, (t - ROLL_UP_AT) / (LOOP - ROLL_UP_AT)))

export const scroll: Scene = {
  id: 'scroll',
  loop: LOOP,
  focusX: 20,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(2, CLAWD_TOP),
      look: t => ({ pose: 'sit', isBlinking: blinking(t, 0.2), look: { x: 1, y: t < WRITE_FOR ? 1 : 0 }, arms: { left: 'down', right: 'out' } }),
    },
  ],
  front: (b, t) => {
    const n = length(t)
    fillRect(b, START_X, 11, n, 3, C.paper)
    // The writing: dashes on the middle row, as far as the scroll is open.
    for (let x = START_X + 1; x < START_X + n - 1; x++) if ((x - START_X) % 6 < 4) setPixel(b, x, 12, C.ink)
    // The roll at the open end.
    fillRect(b, START_X + n, 10, 2, 4, C.paperShade)
    setPixel(b, START_X + n, 11, C.woodDark)
    // The quill in Clawd's claw, wiggling while he writes.
    const dx = t < WRITE_FOR && every(t, 0.15) % 2 === 0 ? 1 : 0
    setPixel(b, 18 + dx, 10, C.ink)
    for (let k = 1; k <= 3; k++) setPixel(b, 18 + dx + k, 10 - k, C.white)
  },
}
