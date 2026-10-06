// Workbench: Clawd builds a little robot on his bench, legs up to antenna;
// it blinks awake, hops, and walks off along the bench. On a wider area the
// bench runs on to the edge, and the robot walks into a crate of finished
// robots standing on it just past the core; past the crate a pegboard of
// tools hangs on the wall over the bench, then finished robots stand in a
// row, the two repeating to the edge.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, plankOn, still } from './kit'
import { tileOn } from './wings'

const LOOP = 7
const BENCH_Y = 10
const ROBOT_X = 25
// The robot's rows, bottom up, each added in turn: legs, body, head with
// its eyes, antenna.
const PARTS_AT = [0.6, 1.3, 2, 2.7]
const AWAKE_AT = 3.4
const HOP_TO = 4.6
const GONE_AT = 6.4
// e is an eye: dark until the robot wakes, then blue. a is the antenna's tip.
const ROBOT: Sprite = {
  palette: { g: C.gray, d: C.darkGray, e: C.ink, a: C.red },
  frames: [['..a..', '..d..', '.ggg.', '.geg.', 'ggggg', '.ggg.', '.d.d.']],
}
const AWAKE: Sprite = { ...ROBOT, palette: { ...ROBOT.palette, e: C.blue } }
const ROWS = [[6], [4, 5], [2, 3], [0, 1]]
// The crate at x 48 on the bench, where the robot's walk ends: slatted
// wood, two finished robots' heads looking out over its rim. It is drawn
// over the walking robot, which goes in behind its front.
const CRATE_X = 48
const CRATE: Sprite = {
  palette: { a: C.red, g: C.gray, e: C.blue, d: C.woodDark, w: C.wood },
  frames: [['..a....a..', '.ggg..ggg.', '.geg..geg.', 'dddddddddd', 'dwwwwwwwwd', 'dddddddddd', 'dwwwwwwwwd']],
}

// The wings past the crate, every SHOP_EVERY columns (two of the bench's
// legs) from SHOP_X: a pegboard on the wall, rows 2 to 8, a tool hanging
// on it in each of its four places (a hammer, a wrench, a screwdriver and
// a saw), then four finished robots standing on the bench, still.
const SHOP_X = 60
const SHOP_EVERY = 52
const BOARD_W = 19
const BOARD_Y = 2
const BOARD_H = 7
const ROBOTS_X = 23
const ROBOT_EVERY = 7
const ROBOTS = 4
// The tools, drawn over the board from its top-left.
const TOOLS: Sprite = {
  palette: { g: C.gray, w: C.wood, r: C.red },
  frames: [
    [
      '...................',
      '.ggg.g.g..g.....www',
      '..w..ggg..g..gggw.w',
      '..w...g...g.ggggww.',
      '..w...g...r.g.g.g..',
      '..w...g...r........',
      '...................',
    ],
  ],
}

function workshop(b: PixelBuffer) {
  tileOn(b, SHOP_X, SHOP_EVERY, x => {
    fillRect(b, x, BOARD_Y, BOARD_W, BOARD_H, C.woodDark)
    for (let hx = x + 1; hx < x + BOARD_W; hx += 2) for (let hy = BOARD_Y + 1; hy < BOARD_Y + BOARD_H; hy += 2) setPixel(b, hx, hy, C.ink)
    drawSprite(b, TOOLS, 0, x, BOARD_Y)
    for (let i = 0; i < ROBOTS; i++) drawSprite(b, AWAKE, 0, x + ROBOTS_X + i * ROBOT_EVERY, BENCH_Y - 7)
  })
}

function robotAt(t: number) {
  if (t < HOP_TO) return { x: ROBOT_X, y: BENCH_Y - 7 - (t >= AWAKE_AT && every(t - AWAKE_AT, 0.3) % 2 === 1 ? 1 : 0) }

  return { x: Math.round(lerp(ROBOT_X, 48, (t - HOP_TO) / (GONE_AT - HOP_TO))), y: BENCH_Y - 7 }
}

function drawRobot(b: PixelBuffer, t: number) {
  if (t >= GONE_AT || t < PARTS_AT[0]!) return
  const at = robotAt(t)
  const sprite = t >= AWAKE_AT ? AWAKE : ROBOT
  const built = PARTS_AT.filter(p => t >= p).length
  const shown = new Set(ROWS.slice(0, built).flat())
  const rows = sprite.frames[0]!.map((row, y) => (shown.has(y) ? row : '.'.repeat(row.length)))
  // Its antenna's tip blinks gold while it's awake.
  const palette = t >= AWAKE_AT && every(t, 0.25) % 2 === 0 ? { ...sprite.palette, a: C.gold } : sprite.palette
  // Walking, its feet trade places.
  if (t >= HOP_TO && every(t, 0.2) % 2 === 1) rows[6] = 'd...d'
  drawSprite(b, { palette, frames: [rows] }, 0, at.x, at.y)
}

export const workbench: Scene = {
  id: 'workbench',
  loop: LOOP,
  still: 4.8,
  focusX: 26,
  backdrop: b => {
    fillRect(b, 19, BENCH_Y, 29, 1, C.wood)
    fillRect(b, 20, BENCH_Y + 1, 1, 3, C.woodDark)
    fillRect(b, 46, BENCH_Y + 1, 1, 3, C.woodDark)
    // Past the core it runs on, a leg every 26 columns after the right one.
    plankOn(b, 48, BENCH_Y, 3, 46 + 26, 26)
    workshop(b)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(5, CLAWD_TOP),
      look: t => {
        const isBuilding = t >= PARTS_AT[0]! - 0.2 && t < AWAKE_AT
        if (t >= AWAKE_AT && t < HOP_TO) return { eyes: 'wide', look: { x: 1, y: -1 }, arms: { left: 'up', right: 'up' } }

        return { isBlinking: blinking(t, 2.1), look: { x: 1, y: t < AWAKE_AT ? 0 : -1 }, arms: { left: 'down', right: isBuilding && every(t, 0.15) % 2 === 0 ? 'out' : 'down' } }
      },
    },
  ],
  front: (b, t) => {
    drawRobot(b, t)
    drawSprite(b, CRATE, 0, CRATE_X, BENCH_Y - CRATE.frames[0]!.length)
  },
}
