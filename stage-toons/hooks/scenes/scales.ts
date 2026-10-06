// Scales: a gold weight sits on one pan of a balance; Clawd adds blocks to
// the other until the beam levels, a tick shows, and he takes them off.
// On a wider area, a low shelf runs on to the edge, holding sets of spare
// brass weights, smallest to largest.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, lerp, still, TICK } from './kit'
import { tileOn, WINGS_X } from './wings'

const LOOP = 6
const PIVOT = { x: 31, y: 5 }
const HALF = 8
const BLOCKS_AT = [1.2, 2.6]
const OFF_AT = 5.2
const TIP_FOR = 0.3
const LEVEL_AT = BLOCKS_AT[1]! + TIP_FOR

// Blocks on the left pan at a moment.
const blocks = (t: number) => (t >= OFF_AT ? 0 : BLOCKS_AT.filter(at => t >= at).length)

// How far the right end hangs below the pivot: 2 with no blocks, level with
// two, easing over TIP_FOR after each change.
function tilt(t: number): number {
  const changes = [...BLOCKS_AT, OFF_AT]
  const last = changes.filter(at => t >= at).at(-1)
  const now = 2 - blocks(t)
  if (last === undefined) return now
  const before = 2 - blocks(last - 0.001)

  return lerp(before, now, (t - last) / TIP_FOR)
}

// A pan hanging from a beam end at (x, y), its load on rows y + 2 and y + 3.
function drawPan(b: PixelBuffer, x: number, y: number) {
  fillRect(b, x, y + 1, 1, 3, C.gray)
  fillRect(b, x - 2, y + 4, 5, 1, C.darkGray)
}

// The wings: a wooden shelf unit, its plank on row 11 and an upright at
// each bay's ends, holding sets of brass weights, smallest to largest, the
// set starting over in each bay to the edge. A weight of size 1 to 4 is
// 2s + 1 wide: a body s tall, lit gold down its left side and brass in
// shade elsewhere, a neck and a knob on top (a size 1 is all knob).
const SHELF_Y = 11
const UPRIGHT_TOP = 4
const weightW = (s: number) => 2 * s + 1
function drawWeight(b: PixelBuffer, x: number, s: number) {
  const w = weightW(s)
  const top = SHELF_Y - s
  fillRect(b, x, top, w, s, C.brassDark)
  fillRect(b, x, top, 1, s, C.gold)
  if (s === 1) {
    setPixel(b, x + 1, top - 1, C.gold)

    return
  }
  setPixel(b, x + s, top - 1, C.brassDark)
  fillRect(b, x + s - 1, top - 2, 3, 1, C.brassDark)
  setPixel(b, x + s - 1, top - 2, C.gold)
}
const WEIGHT_SIZES = [1, 2, 3, 4]
const WEIGHT_GAP = 2
// Where each weight of a set starts, from the bay's first weight.
const WEIGHT_AT = WEIGHT_SIZES.map((_, i) => WEIGHT_SIZES.slice(0, i).reduce((sum, s) => sum + weightW(s) + WEIGHT_GAP, 0))
// A bay: a leg, two columns, the set, two columns, the next leg.
const BAY_X = WINGS_X + 1
const BAY = 1 + 2 + WEIGHT_AT.at(-1)! + weightW(WEIGHT_SIZES.at(-1)!) + 2

function shelf(b: PixelBuffer) {
  if (rightOf(b) <= BAY_X) return
  fillRect(b, BAY_X, SHELF_Y, rightOf(b) - BAY_X, 1, C.wood)
  tileOn(b, BAY_X, BAY, x => {
    fillRect(b, x, UPRIGHT_TOP, 1, 14 - UPRIGHT_TOP, C.woodDark)
    WEIGHT_SIZES.forEach((s, i) => drawWeight(b, x + 3 + WEIGHT_AT[i]!, s))
  })
}

export const scales: Scene = {
  id: 'scales',
  loop: LOOP,
  still: 3.75,
  focusX: 24,
  backdrop: b => {
    fillRect(b, PIVOT.x, PIVOT.y + 1, 1, 7, C.woodDark)
    fillRect(b, PIVOT.x - 3, 13, 7, 1, C.woodDark)
    shelf(b)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(5, CLAWD_TOP),
      look: t => {
        const isLevel = t >= LEVEL_AT && t < OFF_AT
        const isReaching = [...BLOCKS_AT, OFF_AT].some(at => t >= at - 0.2 && t < at + 0.2)

        return {
          eyes: isLevel && t < LEVEL_AT + 0.6 ? 'wide' : 'open',
          isBlinking: blinking(t, 1.7),
          look: { x: 1, y: 0 },
          arms: { left: 'down', right: isReaching ? 'out' : 'down' },
        }
      },
    },
  ],
  front: (b, t) => {
    const k = tilt(t)
    for (let dx = -HALF; dx <= HALF; dx++) setPixel(b, PIVOT.x + dx, PIVOT.y + Math.round((k * dx) / HALF), C.wood)
    setPixel(b, PIVOT.x, PIVOT.y, C.gold)
    const leftY = PIVOT.y - Math.round(k)
    const rightY = PIVOT.y + Math.round(k)
    drawPan(b, PIVOT.x - HALF, leftY)
    drawPan(b, PIVOT.x + HALF, rightY)
    // The gold weight on the right pan, the blue blocks side by side on the left.
    fillRect(b, PIVOT.x + HALF - 1, rightY + 2, 3, 2, C.gold)
    for (let i = 0; i < blocks(t); i++) fillRect(b, PIVOT.x - HALF - 2 + i * 3, leftY + 2, 2, 2, C.blue)
    if (t >= LEVEL_AT && t < OFF_AT) drawSprite(b, TICK, 0, PIVOT.x - 1, 0)
  },
}
