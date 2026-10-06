// Terminal: Clawd sits typing at a computer while lines of code scroll up
// its screen. On a wider area the desk runs on to the edge, its props
// standing along it in a fixed order: a steaming mug, a rubber duck, a
// small second monitor with a bar graph, a potted plant and a desk lamp.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, plankOn, still } from './kit'
import { tileOn, WINGS_X } from './wings'

const LINE_EVERY = 0.4
const LENGTHS = [8, 5, 10, 3, 7, 9, 4, 6, 10, 2, 8, 5]
const COLORS = [C.green, C.blue, C.gold]
// Twelve lines, a new one every 0.4 s: the loop ends where it began.
const LOOP = LINE_EVERY * LENGTHS.length

// The props stand on the desk (row 12), their bottom row on row 11, the
// set repeating every PROPS_EVERY columns from the wings' start. Each
// sprite's top-left is given from the set's start.
const PROPS_EVERY = 46
const MUG: Sprite = { palette: { m: C.paperShade }, frames: [['mmmm.', 'mmm.m', 'mmmm.']] }
const DUCK: Sprite = { palette: { y: C.gold, e: C.ink, b: C.orange }, frames: [['...yy.', '...yeb', 'yyyyy.', '.yyyy.']] }
const PLANT: Sprite = {
  palette: { g: C.green, p: C.brick },
  frames: [['..g..', 'g.g.g', '.ggg.', '..g..', 'ppppp', '.ppp.', '.ppp.']],
}
const LAMP: Sprite = {
  palette: { d: C.darkGray, g: C.gray, l: C.beam },
  frames: [['....gg.', '...gggg', '..d.l..', '.d.....', '.d.....', '.d.....', 'ddd....']],
}
const MUG_X = 2
const DUCK_X = 9
const MONITOR_X = 18
const PLANT_X = 30
const LAMP_X = 38
// The mug's steam: two wisps rising a row every STEAM_STEP, rows 7 to 5
// (a row clear of the mug), so a puff takes 1.2 s, four to the loop.
const STEAM_STEP = 0.4
const WISP_A: [number, number][] = [[0, 7], [1, 6], [0, 5]]
const WISP_B: [number, number][] = [[2, 7], [1, 6], [2, 5]]
// The second monitor's three bars, from row 8 up, a new graph every 1.2 s:
// four to the loop.
const GRAPH_STEP = 1.2
const GRAPHS = [[1, 3, 2], [2, 2, 3], [3, 1, 2], [2, 3, 1]]

function deskProps(b: PixelBuffer, t: number) {
  tileOn(b, WINGS_X, PROPS_EVERY, x => {
    drawSprite(b, MUG, 0, x + MUG_X, 9)
    const step = every(t, STEAM_STEP) % 3
    const [ax, ay] = WISP_A[step]!
    const [bx, by] = WISP_B[(step + 1) % 3]!
    setPixel(b, x + MUG_X + ax, ay, C.smoke)
    setPixel(b, x + MUG_X + bx, by, C.smoke)
    drawSprite(b, DUCK, 0, x + DUCK_X, 8)
    // The second monitor: a darkGray frame round a dark screen, on a stand.
    const m = x + MONITOR_X
    fillRect(b, m, 5, 9, 5, C.darkGray)
    fillRect(b, m + 1, 6, 7, 3, C.ink)
    fillRect(b, m + 4, 10, 1, 1, C.darkGray)
    fillRect(b, m + 3, 11, 3, 1, C.darkGray)
    GRAPHS[every(t, GRAPH_STEP) % GRAPHS.length]!.forEach((h, i) => fillRect(b, m + 2 + i * 2, 9 - h, 1, h, C.green))
    drawSprite(b, PLANT, 0, x + PLANT_X, 5)
    drawSprite(b, LAMP, 0, x + LAMP_X, 5)
  })
}

export const terminal: Scene = {
  id: 'terminal',
  loop: LOOP,
  focusX: 26,
  backdrop: b => {
    fillRect(b, 25, 1, 16, 10, C.darkGray)
    fillRect(b, 26, 2, 14, 8, C.ink)
    fillRect(b, 32, 11, 2, 1, C.darkGray)
    fillRect(b, 18, 12, 26, 1, C.wood)
    fillRect(b, 19, 13, 1, 1, C.woodDark)
    fillRect(b, 42, 13, 1, 1, C.woodDark)
    // The desk ends at 43 on 48 columns; on a wider area it runs on from 44,
    // a leg every 23 columns after its right leg (42).
    if (rightOf(b) > 48) plankOn(b, 44, 12, 1, 42 + 23, 23)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => ({ pose: 'sit', isBlinking: blinking(t, 0.5), look: { x: 1, y: -1 }, arms: { left: 'down', right: every(t, 0.15) % 2 === 0 ? 'out' : 'down' } }),
    },
  ],
  front: (b, t) => {
    // The keyboard under the typing claw.
    fillRect(b, 19, 11, 7, 1, C.gray)
    const first = every(t, LINE_EVERY)
    for (let k = 0; k < 3; k++) {
      const n = first + k
      fillRect(b, 27, 3 + k * 2, LENGTHS[n % LENGTHS.length]!, 1, COLORS[n % COLORS.length]!)
    }
    if (every(t, 0.25) % 2 === 0) setPixel(b, 27, 9, C.white)
    deskProps(b, t)
  },
}
