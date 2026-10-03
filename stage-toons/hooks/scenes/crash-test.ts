// Crash test: a cart rolls faster and faster into a brick wall, bounces
// back, and Clawd notes the result on his clipboard; then he wheels it back.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, lerp, still } from './kit'

const LOOP = 6
const START = 22
const HIT = 36
const BOUNCED = 30
const ROLL_FROM = 0.4
const HIT_AT = 1.6
const SETTLED_AT = 2.2
const BACK_FROM = 5
const WALL_X = 43
const CART: Sprite = { palette: { b: C.blue, d: C.darkGray }, frames: [['.bbbbb.', 'bbbbbbb', '.d...d.']] }
const NOTE_FROM = 2.4
const NOTE_FOR = 1.2

function cartX(t: number): number {
  if (t < ROLL_FROM) return START
  if (t < HIT_AT) return Math.round(START + (HIT - START) * ((t - ROLL_FROM) / (HIT_AT - ROLL_FROM)) ** 2)
  if (t < SETTLED_AT) return Math.round(lerp(HIT, BOUNCED, Math.sqrt((t - HIT_AT) / (SETTLED_AT - HIT_AT))))
  if (t < BACK_FROM) return BOUNCED

  return Math.round(lerp(BOUNCED, START, (t - BACK_FROM) / (LOOP - BACK_FROM)))
}

function drawWall(b: PixelBuffer) {
  fillRect(b, WALL_X, 3, 4, 11, C.brick)
  for (let y = 4; y < 14; y += 2) fillRect(b, WALL_X, y, 4, 1, C.mortar)
  for (let y = 3; y < 14; y += 2) setPixel(b, WALL_X + ((y - 3) % 4 === 0 ? 1 : 3), y, C.mortar)
}

export const crashTest: Scene = {
  id: 'crash-test',
  loop: LOOP,
  // Left of the action's middle, so a 30-column crop keeps Clawd in it.
  focusX: 22,
  backdrop: b => drawWall(b),
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(1, CLAWD_TOP),
      look: t => {
        if (t >= HIT_AT && t < HIT_AT + 0.5) return { eyes: 'wide', look: { x: 1, y: 0 }, arms: { left: 'up', right: 'out' } }
        const isNoting = t >= NOTE_FROM && t < NOTE_FROM + NOTE_FOR

        return { isBlinking: blinking(t, 0.9), look: { x: 1, y: isNoting ? 1 : 0 }, arms: { left: 'down', right: 'out' } }
      },
    },
  ],
  front: (b, t) => {
    drawSprite(b, CART, 0, cartX(t), 11)
    if (t >= HIT_AT && t < HIT_AT + 0.4) {
      // The bang: a burst of gold and smoke at the wall.
      for (const [dx, dy] of [[-1, -1], [0, -2], [-2, 0], [-1, 1]] as const) setPixel(b, WALL_X - 1 + dx, 11 + dy, C.gold)
      setPixel(b, WALL_X - 2, 9, C.smoke)
    }
    // The clipboard in Clawd's claw, a line more written while he notes it.
    fillRect(b, 16, 5, 5, 6, C.paper)
    fillRect(b, 17, 4, 3, 1, C.darkGray)
    fillRect(b, 17, 6, 3, 1, C.ink)
    const written = t < NOTE_FROM ? 0 : Math.min(3, Math.floor(((t - NOTE_FROM) / NOTE_FOR) * 3) + 1)
    if (t < BACK_FROM) fillRect(b, 17, 8, written, 1, C.red)
  },
}
