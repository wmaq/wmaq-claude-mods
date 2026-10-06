// Scales: a gold weight sits on one pan of a balance; Clawd adds blocks to
// the other until the beam levels, a tick shows, and he takes them off.
// On a wider area, spare weights stand in a row in the wings, smallest to
// largest, the row starting over as it runs on.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, C, lerp, still, TICK } from './kit'
import { tileOn } from './wings'

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

// A weight of size 1 to 5 on the floor from column x: s + 2 wide and s + 1
// tall, its top row a pixel in at each end, a knob on top.
const weightW = (s: number) => s + 2
function drawWeight(b: PixelBuffer, x: number, s: number) {
  const w = weightW(s)
  fillRect(b, x, 13 - s + 1, w, s, C.darkGray)
  fillRect(b, x + 1, 13 - s, w - 2, 1, C.gray)
  setPixel(b, x + Math.floor(w / 2), 12 - s, C.gray)
}
const WEIGHT_SIZES = [1, 2, 3, 4, 5]
const WEIGHT_GAP = 3
// Where each weight of a row starts, from the row's start, and how far
// the next row starts.
const WEIGHT_AT = WEIGHT_SIZES.map((_, i) => WEIGHT_SIZES.slice(0, i).reduce((sum, s) => sum + weightW(s) + WEIGHT_GAP, 0))
const WEIGHT_ROW = WEIGHT_SIZES.reduce((sum, s) => sum + weightW(s) + WEIGHT_GAP, 0)

export const scales: Scene = {
  id: 'scales',
  loop: LOOP,
  focusX: 24,
  backdrop: b => {
    fillRect(b, PIVOT.x, PIVOT.y + 1, 1, 7, C.woodDark)
    fillRect(b, PIVOT.x - 3, 13, 7, 1, C.woodDark)
    tileOn(b, 50, WEIGHT_ROW, x => WEIGHT_SIZES.forEach((s, i) => drawWeight(b, x + WEIGHT_AT[i]!, s)))
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
