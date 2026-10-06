// Stepping stones: boxes on a checklist get ticked while Clawd lays stepping stones.
// On a wider area the ground runs on to the right of Clawd, under a
// mountain range: grey peaks with snow on the tall ones, and on the
// tallest, near the area's right edge, a red flag, the goal the stones
// lead to.

import { fillRect, type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, still, STONE } from './kit'
import { WINGS_X } from './wings'

const ROWS = [5, 8, 11]
const STONES = [18, 24, 30]
const LOOP = 6

// The ground's two rows, and the row the mountains stand on (the one above).
const GROUND = 12
const FOOT = GROUND - 1
// A range of peaks, each a fraction of the goal's height, at its column in
// a pattern of `every` columns repeated from column 48 to the edge; its
// sides fall a pixel a column. Peaks this tall or more (a fraction of the
// goal's height) wear snow.
type Range = { every: number; color: number; peaks: readonly { dx: number; f: number }[] }
const FAR: Range = {
  every: 46,
  color: C.darkGray,
  peaks: [
    { dx: 8, f: 0.7 },
    { dx: 21, f: 0.85 },
    { dx: 35, f: 0.6 },
  ],
}
const NEAR: Range = {
  every: 34,
  color: C.gray,
  peaks: [
    { dx: 3, f: 0.35 },
    { dx: 15, f: 0.55 },
    { dx: 26, f: 0.4 },
  ],
}
const SNOW_FROM = 0.5
// The snow's lowest row under its peak's top, by columns out from the peak:
// a cap stepping down the slopes.
const SNOW_LINE = [1, 1, 2]
// The goal's peak: its column, this far in from the area's right edge (it
// stands only on an area wide enough to show it whole past the core).
const GOAL_IN = 14
// The flag on it, fluttering every half second.
const GOAL_FLAG: Sprite = {
  palette: { p: C.woodDark, f: C.red },
  frames: [
    ['pff', 'pf.', 'p..', 'p..'],
    ['pf.', 'pff', 'p..', 'p..'],
  ],
}

// The goal's height in pixels on this area: its peak four rows (the flag's
// height) under the area's top.
const goalHeight = (b: PixelBuffer): number => FOOT - (topOf(b) + 4) + 1
const goalX = (b: PixelBuffer): number | null => (rightOf(b) - GOAL_IN - goalHeight(b) >= WINGS_X ? rightOf(b) - GOAL_IN : null)

// A range in the wings: per column, its highest side, the peak that side
// belongs to, and on a tall one, snow down to SNOW_LINE.
function drawRange(b: PixelBuffer, range: Range, goal: { x: number; h: number } | null) {
  const edge = rightOf(b)
  const tall = goalHeight(b)
  const peaks = [...Array(Math.ceil((edge - WINGS_X) / range.every) + 1).keys()].flatMap(k =>
    range.peaks.map(p => ({ x: WINGS_X + k * range.every + p.dx, h: Math.round(p.f * tall) })),
  )
  if (goal) peaks.push(goal)
  const heights = new Array<number>(edge - WINGS_X).fill(0)
  const owners = new Array<{ x: number; h: number } | null>(edge - WINGS_X).fill(null)
  for (const p of peaks) {
    for (let x = Math.max(WINGS_X, p.x - p.h + 1); x < Math.min(edge, p.x + p.h); x++) {
      const side = p.h - Math.abs(x - p.x)
      if (side > heights[x - WINGS_X]!) {
        heights[x - WINGS_X] = side
        owners[x - WINGS_X] = p
      }
    }
  }
  for (let x = WINGS_X; x < edge; x++) {
    const height = heights[x - WINGS_X]!
    const best = owners[x - WINGS_X]
    if (!best) continue
    const d = Math.abs(x - best.x)
    const snow = best.h >= SNOW_FROM * tall && d < SNOW_LINE.length ? FOOT - best.h + 1 + SNOW_LINE[d]! : -Infinity
    for (let y = FOOT - height + 1; y <= FOOT; y++) setPixel(b, x, y, y <= snow ? C.white : range.color)
  }
}

export const steppingStones: Scene = {
  id: 'stepping-stones',
  loop: LOOP,
  focusX: 24,
  backdrop: (b, t) => {
    fillRect(b, 2, 3, 11, 10, C.paper)
    for (const y of ROWS) {
      fillRect(b, 4, y - 1, 2, 2, C.paperShade)
      fillRect(b, 7, y, 5, 1, C.ink)
    }
    const edge = rightOf(b)
    if (edge <= WINGS_X) return
    const x = goalX(b)
    const goal = x === null ? null : { x, h: goalHeight(b) }
    drawRange(b, FAR, goal)
    drawRange(b, NEAR, null)
    if (goal) drawSprite(b, GOAL_FLAG, every(t, 0.5), goal.x, FOOT - goal.h + 1 - 4)
    fillRect(b, WINGS_X, GROUND, edge - WINGS_X, 1, C.green)
    fillRect(b, WINGS_X, GROUND + 1, edge - WINGS_X, 1, C.woodDark)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(33, CLAWD_TOP),
      look: t => ({ facing: -1, isBlinking: blinking(t, 0.5), arms: { left: t % 1.5 < 0.5 ? 'out' : 'down', right: 'down' } }),
    },
  ],
  front: (b, t) => {
    ROWS.forEach((y, i) => {
      if (t >= 1 + i * 1.5) fillRect(b, 4, y - 1, 2, 2, C.green)
    })
    STONES.forEach((x, i) => {
      if (t >= 0.5 + i * 1.5) drawSprite(b, STONE, 0, x, 12)
    })
  },
}
