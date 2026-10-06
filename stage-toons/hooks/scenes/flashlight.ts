// Flashlight: in the dark, Clawd sweeps a torch's beam about until it lands
// on the bug, holds it there wide-eyed, and sweeps on.

import { setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, lerp, still } from './kit'

const LOOP = 6
const FOUND = 3
const LOST = 4.5
const LENS = { x: 20, y: 8 }
const BUG_X = 38
const BUG_Y = 12
const LIT_BUG: Sprite = { palette: { r: C.red, d: C.darkGray }, frames: [['.rr.', 'drrd']] }
const DARK_BUG: Sprite = { palette: { d: C.darkGray }, frames: [['.dd.', 'dddd']] }
// The slope that puts the beam's middle on the bug's middle.
const ON_BUG = (BUG_Y + 0.5 - LENS.y) / (BUG_X + 1.5 - LENS.x)
const START = -0.3

const slopeAt = (t: number) => (t < FOUND ? lerp(START, ON_BUG, t / FOUND) : t < LOST ? ON_BUG : lerp(ON_BUG, START, (t - LOST) / (LOOP - LOST)))
const halfWidth = (dx: number) => 0.5 + dx * 0.12
// Past the core's last column the beam narrows to nothing over 12 more,
// so on a wider area it ends in a point rather than at the core's edge.
const LAST = 47
const TAPER = 12
const isLit = (t: number) => {
  const dx = BUG_X + 1.5 - LENS.x

  return Math.abs(LENS.y + slopeAt(t) * dx - (BUG_Y + 0.5)) <= halfWidth(dx)
}

export const flashlight: Scene = {
  id: 'flashlight',
  loop: LOOP,
  focusX: 28,
  backdrop: (b, t) => {
    const slope = slopeAt(t)
    for (let x = LENS.x + 1; x < LAST + TAPER; x++) {
      const dx = x - LENS.x
      const middle = LENS.y + slope * dx
      const half = x <= LAST ? halfWidth(dx) : halfWidth(LAST - LENS.x) * (1 - (x - LAST) / TAPER)
      for (let y = Math.ceil(middle - half); y <= Math.floor(middle + half); y++) setPixel(b, x, y, C.beam)
    }
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => ({
        eyes: isLit(t) ? 'wide' : 'open',
        isBlinking: !isLit(t) && blinking(t, 0.6),
        look: { x: 1, y: slopeAt(t) > 0.1 ? 1 : 0 },
        arms: { left: 'down', right: 'out' },
      }),
    },
  ],
  front: (b, t) => {
    // The torch in the right claw: its body, then the lens.
    setPixel(b, LENS.x - 1, LENS.y, C.gray)
    setPixel(b, LENS.x, LENS.y, C.white)
    drawSprite(b, isLit(t) ? LIT_BUG : DARK_BUG, 0, BUG_X, BUG_Y)
  },
}
