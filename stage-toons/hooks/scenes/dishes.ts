// Dishes: Clawd washes dishes at a sink; bubbles rise, the dirty stack
// shrinks and the clean one grows. With all five washed, the clean stack
// slides away to the left and five dirty dishes drop onto the empty spot,
// so the loop starts again where it began. On a wider area a drying rack
// of clean plates stands past the sink, then cupboards run on to the edge.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, still } from './kit'
import { tileOn, WINGS_X } from './wide-c'

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

// The wings: a wire rack with plates standing in it on edge, then a row
// of floor cupboards under one counter, each with two doors and their
// knobs.
const RACK_X = WINGS_X + 2
const CUPBOARDS_X = RACK_X + 13
const CUPBOARD_W = 9

function kitchen(b: PixelBuffer) {
  fillRect(b, RACK_X, 13, 10, 1, C.gray)
  fillRect(b, RACK_X, 10, 1, 3, C.gray)
  fillRect(b, RACK_X + 9, 10, 1, 3, C.gray)
  for (let i = 0; i < 4; i++) fillRect(b, RACK_X + 2 + i * 2, 8, 1, 5, C.white)
  if (CUPBOARDS_X < rightOf(b)) fillRect(b, CUPBOARDS_X, 7, rightOf(b) - CUPBOARDS_X, 1, C.gray)
  tileOn(b, CUPBOARDS_X, CUPBOARD_W, x => {
    fillRect(b, x, 8, CUPBOARD_W, 6, C.wood)
    fillRect(b, x, 8, 1, 6, C.woodDark)
    fillRect(b, x + 4, 8, 1, 5, C.woodDark)
    fillRect(b, x, 13, CUPBOARD_W, 1, C.woodDark)
    setPixel(b, x + 3, 10, C.gold)
    setPixel(b, x + 5, 10, C.gold)
  })
}

const isRestocking = (t: number) => t >= WASHED_AT

export const dishes: Scene = {
  id: 'dishes',
  loop: LOOP,
  focusX: 26,
  backdrop: b => {
    fillRect(b, 22, 9, 14, 5, C.gray)
    fillRect(b, 23, 10, 12, 2, C.glass)
    kitchen(b)
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
