// Stargazing: Clawd looks through a telescope while the stars come out one
// by one, and a shooting star crosses the sky; dim far stars drift
// slowly behind it all. On a wider area more stars shine past the core
// from the start, and the shooting star starts further right.

import { rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, drawStarfield, every, still } from './kit'

const TELESCOPE: Sprite = { palette: { g: C.gray, d: C.darkGray }, frames: [['...dd', '..gg.', '.gg..', 'g....']] }
const STARS = [
  { x: 33, y: 1 },
  { x: 40, y: 3 },
  { x: 29, y: 4 },
  { x: 45, y: 1 },
  { x: 36, y: 5 },
  { x: 4, y: 2 },
]
const LOOP = 6
const SHOOT = 4.2
// The wings' stars, one per 8 columns past the core: where each sits in its
// 8 columns and its row, in cycles of unequal length so the sky doesn't
// look tiled.
const WING_DX = [3, 6, 1, 5, 2, 7, 0, 4, 6]
const WING_Y = [2, 0, 4, 1, 5, 3, 1]

export const stargazing: Scene = {
  id: 'stargazing',
  loop: LOOP,
  still: 3,
  focusX: 24,
  background: (b, time) => drawStarfield(b, time, ['far']),
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(10, CLAWD_TOP),
      look: t => ({ isBlinking: blinking(t, 0.4), look: { x: 1, y: -1 }, arms: { left: 'down', right: 'up' } }),
    },
  ],
  front: (b, t) => {
    // The telescope rests on the raised right claw (its tip at 23, 6).
    drawSprite(b, TELESCOPE, 0, 23, 2)
    const out = Math.min(STARS.length, every(t, 0.6) + 1)
    const twinkle = (i: number) => ((every(t, 0.4) + i) % 5 === 0 ? C.gold : C.white)
    STARS.slice(0, out).forEach((s, i) => setPixel(b, s.x, s.y, twinkle(i)))
    // They twinkle in the core's beat (15 steps a loop, a multiple of 5), so
    // the loop stays seamless.
    const edge = rightOf(b)
    for (let k = 0; 48 + 8 * k < edge; k++) setPixel(b, 48 + 8 * k + WING_DX[k % WING_DX.length]!, WING_Y[k % WING_Y.length]!, twinkle(STARS.length + k))
    if (t >= SHOOT && t < SHOOT + 0.6) {
      // On a wider area it starts up to 24 columns further right, on the
      // same slope over the same time.
      const k = (t - SHOOT) / 0.6
      const x = Math.round(46 + Math.min(edge - 48, 24) - k * 16)
      const y = Math.round(k * 4)
      for (let i = 0; i < 3; i++) setPixel(b, x + i, y - Math.floor(i / 2), i === 0 ? C.white : C.gold)
    }
  },
}
