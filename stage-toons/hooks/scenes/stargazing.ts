// Stargazing: Clawd looks through a telescope while the stars come out one
// by one, and a shooting star crosses the sky; dim far stars drift
// slowly behind it all.

import { setPixel } from '../pixels'
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

export const stargazing: Scene = {
  id: 'stargazing',
  loop: LOOP,
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
    STARS.slice(0, out).forEach((s, i) => setPixel(b, s.x, s.y, (every(t, 0.4) + i) % 5 === 0 ? C.gold : C.white))
    if (t >= SHOOT && t < SHOOT + 0.6) {
      const k = (t - SHOOT) / 0.6
      const x = Math.round(46 - k * 16)
      const y = Math.round(k * 4)
      for (let i = 0; i < 3; i++) setPixel(b, x + i, y - Math.floor(i / 2), i === 0 ? C.white : C.gold)
    }
  },
}
