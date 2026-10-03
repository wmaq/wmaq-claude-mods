// Sweeping: Clawd sweeps back and forth while the docs fill a shelf.

import { fillRect, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { BROOM, C, every } from './kit'

const sweepX = (t: number) => 6 + 10 * (t < 4 ? t / 4 : (8 - t) / 4)
const facing = (t: number) => (t < 4 ? 1 : -1)
const BOOKS = [C.blue, C.red, C.green, C.gold]

export const sweeping: Scene = {
  id: 'sweeping',
  loop: 8,
  focusX: 24,
  backdrop: b => fillRect(b, 36, 7, 11, 1, C.woodDark),
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: sweepX(t), y: CLAWD_TOP }),
      look: t => ({ pose: 'walk', stride: Math.floor(t * 6), facing: facing(t), arms: { left: 'out', right: 'out' } }),
    },
  ],
  front: (b, t) => {
    const x = Math.round(sweepX(t)) + (facing(t) > 0 ? 15 : -3)
    drawSprite(b, BROOM, 0, x, 8)
    for (let k = 0; k < 4; k++) {
      const phase = (t * 3 + k * 0.25) % 1
      setPixel(b, x + 1 - facing(t) * (2 + k * 2), 13 - Math.floor(phase * 3), C.dust)
    }
    const shelved = Math.min(8, every(t, 1) + 1)
    for (let i = 0; i < shelved; i++) fillRect(b, 37 + i, 3, 1, 4, BOOKS[i % BOOKS.length]!)
  },
}
