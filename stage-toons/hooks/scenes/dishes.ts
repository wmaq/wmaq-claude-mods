// Dishes: Clawd washes dishes at a sink; bubbles rise, the dirty stack
// shrinks and the clean one grows.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'

const LOOP = 6
const PER_DISH = 1.2
const DISHES = 5

function stack(b: PixelBuffer, x: number, count: number, isDirty: boolean) {
  for (let i = 0; i < count; i++) {
    fillRect(b, x, 12 - i, 5, 1, isDirty ? C.paperShade : C.white)
    if (isDirty) setPixel(b, x + 1 + (i % 3), 12 - i, C.darkGray)
  }
}

export const dishes: Scene = {
  id: 'dishes',
  loop: LOOP,
  focusX: 26,
  backdrop: b => {
    fillRect(b, 22, 9, 14, 5, C.gray)
    fillRect(b, 23, 10, 12, 2, C.glass)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(7, CLAWD_TOP),
      look: t => ({ isBlinking: blinking(t, 0.3), look: { x: 1, y: 1 }, arms: { left: 'down', right: every(t, 0.2) % 2 === 0 ? 'out' : 'down' } }),
    },
  ],
  front: (b, t) => {
    const washed = every(t, PER_DISH)
    stack(b, 38, DISHES - washed, true)
    stack(b, 1, washed, false)
    for (let k = 0; k < 4; k++) {
      const rise = (t * 0.8 + k * 0.25) % 1
      setPixel(b, 25 + k * 3, 9 - Math.floor(rise * 6), C.white)
    }
  },
}
