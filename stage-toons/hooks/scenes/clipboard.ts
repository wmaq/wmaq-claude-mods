// Clipboard: Clawd paces back and forth with a clipboard, ticking its lines
// as he goes. On a wider area a filing cabinet stands past him, then
// shelves of binders run on to the edge.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every } from './kit'
import { shelvesOn, WINGS_X } from './wings'

const LOOP = 8
const paceX = (t: number) => 8 + 12 * (t < 4 ? t / 4 : (8 - t) / 4)
const facing = (t: number) => (t < 4 ? 1 : -1)

// The wings: a three-drawer filing cabinet, then a wall of two shelves of
// binders in muted colours, each with a pale label, a gap here and there.
const CABINET_X = WINGS_X + 2
const BINDERS = [C.blue, C.darkGray, C.gray, C.blue, C.darkGray, C.green, C.gray]

function wings(b: PixelBuffer) {
  fillRect(b, CABINET_X, 5, 7, 9, C.gray)
  for (const y of [5, 8, 11]) {
    fillRect(b, CABINET_X, y, 7, 1, C.darkGray)
    fillRect(b, CABINET_X + 2, y + 1, 3, 1, C.white)
  }
  shelvesOn(b, CABINET_X + 10, [8, 13], 14, 3, (x, y, k) => {
    if (k % 9 === 4) return
    fillRect(b, x, y - 3, 2, 4, BINDERS[k % BINDERS.length]!)
    setPixel(b, x, y - 2, C.paper)
  })
}

export const clipboard: Scene = {
  id: 'clipboard',
  loop: LOOP,
  still: 2,
  fadesAtLoop: true,
  focusX: 24,
  backdrop: wings,
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
