// Workbench: Clawd builds a little robot on his bench, legs up to antenna;
// it blinks awake, hops, and walks off along the bench.

import { fillRect } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, still } from './kit'

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

function robotAt(t: number) {
  if (t < HOP_TO) return { x: ROBOT_X, y: BENCH_Y - 7 - (t >= AWAKE_AT && every(t - AWAKE_AT, 0.3) % 2 === 1 ? 1 : 0) }

  return { x: Math.round(lerp(ROBOT_X, 48, (t - HOP_TO) / (GONE_AT - HOP_TO))), y: BENCH_Y - 7 }
}

export const workbench: Scene = {
  id: 'workbench',
  loop: LOOP,
  focusX: 26,
  backdrop: b => {
    fillRect(b, 19, BENCH_Y, 29, 1, C.wood)
    fillRect(b, 20, BENCH_Y + 1, 1, 3, C.woodDark)
    fillRect(b, 46, BENCH_Y + 1, 1, 3, C.woodDark)
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
  },
}
