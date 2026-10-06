// Recycling: Clawd tosses balls of crumpled paper into a bin. Two go in;
// the third sails past, bounces and rolls away; on a wider area it rolls
// up against a second bin in the wings and lies there, and past that bin
// a row of sorting bins (paper, glass, plastic) runs on to the edge.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, lerp, still } from './kit'
import { tileOn } from './wings'

const LOOP = 6.4
const FLIGHT = 0.8
const HOLD_FOR = 0.8
const WIND_UP = 0.25
// Clawd at x 8: his right claw's tip held out, and raised.
const HAND = { x: 23, y: 7 }
const RAISED = { x: 21, y: 6 }
const BIN = { x: 36, y: 8, w: 6 }
const THROWS = [
  { at: 0.4, to: { x: 38, y: 7 } },
  { at: 2, to: { x: 38, y: 7 } },
  { at: 3.6, to: { x: 44, y: 12 } },
]
const MISSED = THROWS[2]!
const LANDED = MISSED.at + FLIGHT
const ROLL_FROM = LANDED + 0.4
const ROLL_FOR = 1.2
// The second bin, past 50 columns: the missed ball stops against its side,
// rolling at the same speed, and lies there until the loop ends.
const SECOND_BIN_X = 50
const ROLL_TO = 49
const STOP_AT = SECOND_BIN_X - 2
const BALL: Sprite = { palette: { w: C.white, s: C.paperShade }, frames: [['ws', 'sw']] }
// Past the second bin, a row of sorting bins to the edge, as far apart as
// the first two (14 columns): paper, glass and plastic in turn, each in its
// usual colour, muted so the wings stay quiet, with a darker lid and a
// small sign of what goes in, in a light shade of its colour (4 x 4, in the
// rows under the lid): a page with a folded corner, a bottle, a carrier bag.
const BIN_EVERY = SECOND_BIN_X - BIN.x
type SortingBin = { body: number; lid: number; sign: number; shape: readonly string[] }
const SORTING_BINS: readonly SortingBin[] = [
  { body: 0x4a6aa8, lid: 0x34497a, sign: 0x93acdc, shape: ['xxx.', 'x.xx', 'x..x', 'xxxx'] },
  { body: 0x4a8a55, lid: 0x33613b, sign: 0x8fc699, shape: ['.xx.', '.xx.', 'xxxx', 'xxxx'] },
  { body: 0xa89040, lid: 0x76652d, sign: 0xdcc683, shape: ['.xx.', 'x..x', 'xxxx', 'xxxx'] },
]

// The ball in Clawd's claw before a throw, if any: each comes HOLD_FOR
// before its throw (the first one at the end of the loop before).
const holding = (t: number) => THROWS.find(th => (t >= th.at - HOLD_FOR && t < th.at) || (th === THROWS[0] && t >= LOOP - HOLD_FOR + th.at))
const isWindingUp = (t: number) => THROWS.some(th => t >= th.at - WIND_UP && t < th.at)

// A bin, drawn in front, so a ball dropping in goes out of sight.
function drawBin(b: PixelBuffer, x: number) {
  fillRect(b, x, BIN.y, BIN.w, 14 - BIN.y, C.gray)
  fillRect(b, x - 1, BIN.y - 1, BIN.w + 2, 1, C.darkGray)
  for (const [dx, dy] of [[2, 2], [3, 2], [1, 3], [4, 3], [2, 4], [3, 4]] as const) setPixel(b, x + dx, BIN.y + dy, C.green)
}

// A sorting bin, the same size and in the same place in its slot as the grey ones.
function drawSortingBin(b: PixelBuffer, x: number, bin: SortingBin) {
  fillRect(b, x, BIN.y, BIN.w, 14 - BIN.y, bin.body)
  fillRect(b, x - 1, BIN.y - 1, BIN.w + 2, 1, bin.lid)
  bin.shape.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === 'x') setPixel(b, x + 1 + dx, BIN.y + 1 + dy, bin.sign)
  })
}

export const recycling: Scene = {
  id: 'recycling',
  loop: LOOP,
  still: 2.1,
  focusX: 28,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(8, CLAWD_TOP),
      look: t => ({
        eyes: t >= LANDED && t < LANDED + 0.6 ? 'wide' : 'open',
        isBlinking: blinking(t, 2.3),
        look: { x: 1, y: t >= LANDED && t < ROLL_FROM + ROLL_FOR ? 1 : 0 },
        arms: { left: 'down', right: isWindingUp(t) ? 'up' : holding(t) ? 'out' : 'down' },
      }),
    },
  ],
  front: (b, t) => {
    if (holding(t)) {
      const at = isWindingUp(t) ? RAISED : HAND
      drawSprite(b, BALL, 0, at.x, at.y - 1)
    }
    for (const th of THROWS) {
      const k = (t - th.at) / FLIGHT
      if (k < 0 || k >= 1) continue
      const x = lerp(HAND.x, th.to.x, k)
      const y = lerp(HAND.y, th.to.y, k) - 6 * 4 * k * (1 - k)
      drawSprite(b, BALL, 0, Math.round(x), Math.round(y) - 1)
    }
    const hasSecondBin = rightOf(b) > SECOND_BIN_X
    if (t >= LANDED && (hasSecondBin || t < ROLL_FROM + ROLL_FOR)) {
      const bounce = t < ROLL_FROM && t - LANDED < 0.2 ? 1 : 0
      const x = Math.round(lerp(MISSED.to.x, ROLL_TO, (t - ROLL_FROM) / ROLL_FOR))
      drawSprite(b, BALL, 0, hasSecondBin ? Math.min(x, STOP_AT) : x, MISSED.to.y - bounce)
    }
    drawBin(b, BIN.x)
    if (hasSecondBin) drawBin(b, SECOND_BIN_X)
    // Only whole bins, lid and all: a sliver of one at the edge reads as a stray pixel.
    tileOn(b, SECOND_BIN_X + BIN_EVERY, BIN_EVERY, (x, k) => {
      if (x + BIN.w + 1 <= rightOf(b)) drawSortingBin(b, x, SORTING_BINS[k % SORTING_BINS.length]!)
    })
  },
}
