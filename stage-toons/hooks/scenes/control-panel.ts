// Control panel: Clawd flips a switch and the lights come on red, then red
// again, then green, and Clawd cheers. On a wider area more panels stand
// past his, each a bank of small lights blinking slowly over a dial.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'
import { tileOn, WINGS_X } from './wings'

const LOOP = 6
const TRY = 1.6
const LIT_AFTER = 0.5
const RESULTS = [C.red, C.red, C.green]
const LIGHTS = [27, 32, 37]

const attempt = (t: number) => Math.min(RESULTS.length - 1, every(t, TRY))
const isLit = (t: number) => t - attempt(t) * TRY >= LIT_AFTER

// The wings: a panel every PANEL_EVERY columns, lower than Clawd's, with
// four lights, a dial and a slider. Each light steps through a 3 s pattern (on,
// on, off), a second a step, staggered along the bank: 3 s divides the
// loop, so the lights are the same at its end as at its start.
const PANEL_EVERY = 15
const BANK = [C.green, C.gold, C.green, C.red]

function bank(b: PixelBuffer, t: number) {
  tileOn(b, WINGS_X + 2, PANEL_EVERY, (x, p) => {
    fillRect(b, x, 6, 12, 7, C.darkGray)
    fillRect(b, x + 1, 13, 1, 1, C.darkGray)
    fillRect(b, x + 10, 13, 1, 1, C.darkGray)
    BANK.forEach((color, i) => setPixel(b, x + 2 + i * 2, 7, (every(t, 1) + i + p * 2) % 3 === 2 ? C.gray : color))
    fillRect(b, x + 2, 9, 3, 2, C.gray)
    setPixel(b, x + 3 + (p % 2), 9, C.white)
    fillRect(b, x + 6, 10, 4, 1, C.gray)
    setPixel(b, x + 6 + ((p * 3) % 4), 9, C.white)
  })
}

export const controlPanel: Scene = {
  id: 'control-panel',
  loop: LOOP,
  still: 0.9,
  focusX: 26,
  backdrop: (b, t) => {
    fillRect(b, 24, 4, 17, 9, C.darkGray)
    fillRect(b, 25, 13, 1, 1, C.darkGray)
    fillRect(b, 39, 13, 1, 1, C.darkGray)
    bank(b, t)
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
