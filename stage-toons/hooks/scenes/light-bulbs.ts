// Light bulbs: ideas pop around Clawd and fizzle, until one stays lit: one
// peeks up from behind his head, one pops up in front of him.

import { type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, BULB_OFF, BULB_ON, C, every, still, wave } from './kit'

// z: behind Clawd (-1) or in front of him (1).
const SPOTS = [
  { x: 6, y: 3, z: 0 },
  { x: 38, y: 4, z: 0 },
  { x: 19, y: 4, z: -1 },
  { x: 28, y: 8, z: 1 },
]
const EUREKA = 4.8

export const lightBulbs: Scene = {
  id: 'light-bulbs',
  loop: 6,
  focusX: 24,
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
