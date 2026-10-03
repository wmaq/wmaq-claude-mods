// Control panel: Clawd flips a switch and the lights come on red, then red
// again, then green, and Clawd cheers.

import { fillRect } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'

const LOOP = 6
const TRY = 1.6
const LIT_AFTER = 0.5
const RESULTS = [C.red, C.red, C.green]
const LIGHTS = [27, 32, 37]

const attempt = (t: number) => Math.min(RESULTS.length - 1, every(t, TRY))
const isLit = (t: number) => t - attempt(t) * TRY >= LIT_AFTER

export const controlPanel: Scene = {
  id: 'control-panel',
  loop: LOOP,
  focusX: 26,
  backdrop: b => {
    fillRect(b, 24, 4, 17, 9, C.darkGray)
    fillRect(b, 25, 13, 1, 1, C.darkGray)
    fillRect(b, 39, 13, 1, 1, C.darkGray)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(8, CLAWD_TOP),
      look: t => {
        if (attempt(t) === RESULTS.length - 1 && isLit(t)) return { eyes: 'wide', arms: { left: 'up', right: 'up' } }
        const isFlipping = t < RESULTS.length * TRY && t % TRY < 0.3

        return { isBlinking: blinking(t, 1.3), look: { x: 1, y: 0 }, arms: { left: 'down', right: isFlipping ? 'out' : 'down' } }
      },
    },
  ],
  front: (b, t) => {
    const k = attempt(t)
    for (const x of LIGHTS) fillRect(b, x, 6, 2, 2, isLit(t) ? RESULTS[k]! : C.gray)
    // The switch's slot, and its knob at one end or the other.
    fillRect(b, 31, 10, 4, 1, C.gray)
    fillRect(b, k % 2 === 0 ? 31 : 34, 9, 1, 1, C.white)
  },
}
