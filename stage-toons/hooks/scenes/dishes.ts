// Dishes: Clawd washes dishes at a sink; bubbles rise, the dirty stack
// shrinks and the clean one grows. With all five washed, the clean stack
// slides away to the left and five dirty dishes drop onto the empty spot,
// so the loop starts again where it began.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'

const PER_DISH = 1
const DISHES = 5
const WASHED_AT = PER_DISH * DISHES
// The clean stack slides off, then the dirty dishes drop in, one by one.
const CLEAR_FOR = 0.5
const DROP_EVERY = 0.2
const FALL_FOR = 0.15
const LOOP = WASHED_AT + CLEAR_FOR + DROP_EVERY * DISHES
const DIRTY_X = 38

function dish(b: PixelBuffer, x: number, y: number, i: number, isDirty: boolean) {
  fillRect(b, x, y, 5, 1, isDirty ? C.paperShade : C.white)
  if (isDirty) setPixel(b, x + 1 + (i % 3), y, C.darkGray)
}

function stack(b: PixelBuffer, x: number, count: number, isDirty: boolean) {
  for (let i = 0; i < count; i++) dish(b, x, 12 - i, i, isDirty)
}

const isRestocking = (t: number) => t >= WASHED_AT

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
      look: t =>
        isRestocking(t)
          ? { isBlinking: blinking(t, 0.3), look: { x: 1, y: 0 }, arms: { left: 'down', right: 'down' } }
          : { isBlinking: blinking(t, 0.3), look: { x: 1, y: 1 }, arms: { left: 'down', right: every(t, 0.2) % 2 === 0 ? 'out' : 'down' } },
    },
  ],
  front: (b, t) => {
    if (isRestocking(t)) {
      const since = t - WASHED_AT
      stack(b, 1 - Math.round(Math.min(1, since / CLEAR_FOR) * 6), DISHES, false)
      // Each dirty dish falls from the top to its place on the stack.
      for (let i = 0; i < DISHES; i++) {
        const k = (since - CLEAR_FOR - i * DROP_EVERY) / FALL_FOR
        if (k >= 0) dish(b, DIRTY_X, Math.round(Math.min(1, k) * (12 - i)), i, true)
      }
    } else {
      const washed = every(t, PER_DISH)
      stack(b, DIRTY_X, DISHES - washed, true)
      stack(b, 1, washed, false)
    }
    for (let k = 0; k < 4; k++) {
      const rise = (t * 0.8 + k * 0.25) % 1
      setPixel(b, 25 + k * 3, 9 - Math.floor(rise * 6), C.white)
    }
  },
}
