// Brainstorm: ideas pop around Clawd and fizzle, until one stays lit.

import { setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, BULB_OFF, BULB_ON, C, every, still, wave } from './kit'

const SPOTS = [
  { x: 6, y: 1 },
  { x: 38, y: 2 },
  { x: 10, y: 0 },
  { x: 34, y: 0 },
]
const EUREKA = 4.8

export const brainstorm: Scene = {
  id: 'brainstorm',
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
  ],
  front: (b, t) => {
    SPOTS.forEach((spot, i) => {
      const age = t - i * 1.2
      if (age >= 0 && age < 0.9) drawSprite(b, age < 0.5 ? BULB_ON : BULB_OFF, 0, spot.x, spot.y)
    })
    if (t >= EUREKA) {
      drawSprite(b, BULB_ON, 0, 23, 0)
      if (every(t, 0.2) % 2 === 0) {
        setPixel(b, 21, 1, C.gold)
        setPixel(b, 27, 1, C.gold)
      }
    }
  },
}
