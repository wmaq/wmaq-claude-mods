// Clipboard: Clawd paces back and forth with a clipboard, ticking its lines
// as he goes.

import { fillRect, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every } from './kit'

const LOOP = 8
const paceX = (t: number) => 8 + 12 * (t < 4 ? t / 4 : (8 - t) / 4)
const facing = (t: number) => (t < 4 ? 1 : -1)

export const clipboard: Scene = {
  id: 'clipboard',
  loop: LOOP,
  focusX: 24,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: paceX(t), y: CLAWD_TOP }),
      look: t => ({ pose: 'walk', stride: Math.floor(t * 4), facing: facing(t), isBlinking: blinking(t, 1.7), look: { x: facing(t), y: 1 }, arms: { left: 'out', right: 'out' } }),
    },
  ],
  front: (b, t) => {
    const x = Math.round(paceX(t)) + (facing(t) > 0 ? 15 : -6)
    fillRect(b, x, 7, 5, 6, C.wood)
    fillRect(b, x + 1, 8, 3, 4, C.paper)
    setPixel(b, x + 2, 6, C.gray)
    // One line ticked more every 2 s: 1 to 4.
    const ticked = every(t, 2) + 1
    for (let i = 0; i < 4; i++) {
      setPixel(b, x + 1, 8 + i, i < ticked ? C.green : C.paperShade)
      fillRect(b, x + 2, 8 + i, 2, 1, C.ink)
    }
  },
}
