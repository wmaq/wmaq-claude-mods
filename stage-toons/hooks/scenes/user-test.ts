// Your testing: Clawd pushes a gift your way, waits while you take it, and
// walks back for the next one.

import { setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, every, GIFT, lerp } from './kit'

// Pushing until 1.5 s, waiting until 5 s, then walking back.
const clawdX = (t: number) => (t < 1.5 ? lerp(4, 10, t / 1.5) : t < 5 ? 10 : lerp(10, 4, t - 5))
const giftX = (t: number) => (t < 1.5 ? clawdX(t) + 16 : lerp(26, 34, t - 1.5))

export const userTest: Scene = {
  id: 'user-test',
  loop: 6,
  focusX: 24,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: clawdX(t), y: CLAWD_TOP }),
      look: t =>
        t < 1.5
          ? { pose: 'walk', stride: Math.floor(clawdX(t) * 2), facing: 1, arms: { left: 'out', right: 'out' } }
          : t < 5
            ? {
                pose: t > 3 && every(t, 0.3) % 2 === 1 ? 'walk' : 'stand',
                stride: 1,
                facing: 0,
                look: { x: 0, y: 1 },
                isBlinking: blinking(t, 0.3),
                arms: { left: 'down', right: 'down' },
              }
            : { pose: 'walk', stride: Math.floor(clawdX(t) * 2), facing: -1, arms: { left: 'down', right: 'down' } },
    },
  ],
  front: (b, t) => {
    // The gift is yours from 5 s on: it is gone when Clawd walks back.
    if (t >= 5) return
    drawSprite(b, GIFT, 0, Math.round(giftX(t)), 6)
    if (t >= 2.5 && every(t, 0.3) % 2 === 0) setPixel(b, 40, 5, C.gold)
  },
}
