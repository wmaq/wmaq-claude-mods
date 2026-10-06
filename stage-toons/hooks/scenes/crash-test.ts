// Crash test: a cart rolls faster and faster into a brick wall, bounces
// back, and Clawd notes the result on his clipboard; then he wheels it back.
// In a raster narrower than the stage the camera follows the cart to the
// wall and comes back to Clawd for the note.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
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
const NOTE_FROM = 2.8
const NOTE_FOR = 1.2
// The camera: on Clawd and the cart, then on the wall from the hit until
// the cart has settled, and back for the note.
const ON_CLAWD = 15
const ON_WALL = 40
const PAN_BACK_FROM = 2.4
const PAN_BACK_FOR = 0.4

function focus(t: number): number {
  if (t < ROLL_FROM) return ON_CLAWD
  if (t < HIT_AT) return Math.round(lerp(ON_CLAWD, ON_WALL, ((t - ROLL_FROM) / (HIT_AT - ROLL_FROM)) ** 2))
  if (t < PAN_BACK_FROM) return ON_WALL

  return Math.round(lerp(ON_WALL, ON_CLAWD, (t - PAN_BACK_FROM) / PAN_BACK_FOR))
}

function cartX(t: number): number {
  if (t < ROLL_FROM) return START
  if (t < HIT_AT) return Math.round(START + (HIT - START) * ((t - ROLL_FROM) / (HIT_AT - ROLL_FROM)) ** 2)
  if (t < SETTLED_AT) return Math.round(lerp(HIT, BOUNCED, Math.sqrt((t - HIT_AT) / (SETTLED_AT - HIT_AT))))
  if (t < BACK_FROM) return BOUNCED

  return Math.round(lerp(BOUNCED, START, (t - BACK_FROM) / (LOOP - BACK_FROM)))
}

// The wall's bricks from column from to the column before to: a mortar
// row every other row, and a joint every 4 columns in each course, a course
// offset by 2 from the one below.
function drawBricks(b: PixelBuffer, from: number, to: number) {
  fillRect(b, from, 3, to - from, 11, C.brick)
  for (let y = 4; y < 14; y += 2) fillRect(b, from, y, to - from, 1, C.mortar)
  for (let y = 3; y < 14; y += 2) {
    const joint = WALL_X + ((y - 3) % 4 === 0 ? 1 : 3)
    for (let x = joint + 4 * Math.ceil((from - joint) / 4); x < to; x += 4) setPixel(b, x, y, C.mortar)
  }
}

// The wall at the core's right, x 43 to 46. On a wider area it carries on
// as a mass of bricks to the edge, column 47 included; on the bare stage
// that column stays empty, as it always was.
function drawWall(b: PixelBuffer) {
  drawBricks(b, WALL_X, WALL_X + 4)
  if (rightOf(b) > 48) drawBricks(b, WALL_X + 4, rightOf(b))
}

export const crashTest: Scene = {
  id: 'crash-test',
  loop: LOOP,
  still: 3.25,
  focusX: ON_CLAWD,
  focus,
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
