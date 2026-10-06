// Light bulbs: ideas pop around Clawd and fizzle, until one stays lit: one
// peeks up from behind his head, one pops up in front of him. On a wider
// area, unlit bulbs hang on wires in the wings, at varied heights.

import { type PixelBuffer, setPixel, topOf } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, BULB_OFF, BULB_ON, C, every, still, wave } from './kit'
import { tileOn } from './wide-d'

// z: behind Clawd (-1) or in front of him (1).
const SPOTS = [
  { x: 6, y: 3, z: 0 },
  { x: 38, y: 4, z: 0 },
  { x: 19, y: 4, z: -1 },
  { x: 28, y: 8, z: 1 },
]
const EUREKA = 4.8
// A bulb hanging from its wire: the cap on top, the glass below, unlit.
const HANGING: Sprite = { palette: { y: C.bulbOff, g: C.gray }, frames: [['.g.', 'yyy', 'yyy', '.y.']] }
// The wings' bulbs, one every 9 columns, their tops on these rows in turn.
const HANG_EVERY = 9
const HANG_TOPS = [3, 6, 4, 7, 5]

export const lightBulbs: Scene = {
  id: 'light-bulbs',
  loop: 6,
  focusX: 24,
  backdrop: b => {
    tileOn(b, 51, HANG_EVERY, (x, k) => {
      const top = HANG_TOPS[k % HANG_TOPS.length]!
      for (let y = topOf(b); y < top; y++) setPixel(b, x + 1, y, C.darkGray)
      drawSprite(b, HANGING, 0, x, top)
    })
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(17, CLAWD_TOP),
      look: t =>
        t < EUREKA
          ? { isBlinking: blinking(t), look: { x: wave(t, 2) > 0 ? 1 : -1, y: -1 }, arms: { left: 'down', right: 'down' } }
          : { eyes: 'wide', arms: { left: 'up', right: 'up' } },
    },
    ...SPOTS.map((spot, i) => ({
      kind: 'prop' as const,
      z: spot.z,
      draw: (b: PixelBuffer, t: number) => {
        const age = t - i * 1.2
        if (age >= 0 && age < 0.9) drawSprite(b, age < 0.5 ? BULB_ON : BULB_OFF, 0, spot.x, spot.y)
      },
    })),
  ],
  front: (b, t) => {
    if (t >= EUREKA) {
      drawSprite(b, BULB_ON, 0, 23, 2)
      if (every(t, 0.2) % 2 === 0) {
        setPixel(b, 21, 3, C.gold)
        setPixel(b, 27, 3, C.gold)
      }
    }
  },
}
