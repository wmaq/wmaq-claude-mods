// Scroll: Clawd sits writing with a quill while a scroll unrolls across the
// floor, then rolls it back up. On a wider area a rack of scrolls rolled up
// already stands in the wings; the scroll itself unrolls as far as ever.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, still } from './kit'
import { tileOn } from './wide-d'

const LOOP = 7
const START_X = 18
const LONGEST = 27
const WRITE_FOR = 5.5
const ROLL_UP_AT = 6.2

// The rack: two shelves, on rows 8 and 13, from column 50 to the edge, a
// post every BAY columns; two rolled scrolls lie on each shelf of a bay,
// and every other bay has a third on top of its upper two.
const RACK_X = 50
const SHELVES = [8, 13]
const BAY = 16
const ROLLED: Sprite = { palette: { w: C.paper, s: C.paperShade, d: C.woodDark }, frames: [['dwwwwwd', 'dsssssd']] }

function drawRack(b: PixelBuffer) {
  const edge = rightOf(b)
  for (const y of SHELVES) if (RACK_X < edge) fillRect(b, RACK_X, y, edge - RACK_X, 1, C.wood)
  tileOn(b, RACK_X, BAY, (x, k) => {
    fillRect(b, x, 5, 1, 9, C.woodDark)
    for (const y of SHELVES) {
      drawSprite(b, ROLLED, 0, x + 1, y - 2)
      drawSprite(b, ROLLED, 0, x + 9, y - 2)
    }
    if (k % 2 === 0) drawSprite(b, ROLLED, 0, x + 5, SHELVES[0]! - 4)
  })
}

const length = (t: number) => Math.round(t < ROLL_UP_AT ? lerp(2, LONGEST, t / WRITE_FOR) : lerp(LONGEST, 2, (t - ROLL_UP_AT) / (LOOP - ROLL_UP_AT)))

export const scroll: Scene = {
  id: 'scroll',
  loop: LOOP,
  focusX: 20,
  backdrop: drawRack,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(2, CLAWD_TOP),
      look: t => ({ pose: 'sit', isBlinking: blinking(t, 0.2), look: { x: 1, y: t < WRITE_FOR ? 1 : 0 }, arms: { left: 'down', right: 'out' } }),
    },
  ],
  front: (b, t) => {
    const n = length(t)
    fillRect(b, START_X, 11, n, 3, C.paper)
    // The writing: dashes on the middle row, as far as the scroll is open.
    for (let x = START_X + 1; x < START_X + n - 1; x++) if ((x - START_X) % 6 < 4) setPixel(b, x, 12, C.ink)
    // The roll at the open end.
    fillRect(b, START_X + n, 10, 2, 4, C.paperShade)
    setPixel(b, START_X + n, 11, C.woodDark)
    // The quill in Clawd's claw, which ends at column 16 of row 10: the
    // shaft runs through the claw's tip at 17 to the nib on the scroll's
    // edge, and the feather leans back over the claw, wagging while he
    // writes.
    const isWagging = t < WRITE_FOR && every(t, 0.15) % 2 === 0
    setPixel(b, 18, 11, C.ink)
    setPixel(b, 17, 10, C.white)
    setPixel(b, 16, 9, C.white)
    setPixel(b, isWagging ? 16 : 15, 8, C.white)
  },
}
