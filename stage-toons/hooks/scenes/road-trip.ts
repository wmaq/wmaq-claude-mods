// Road trip: Clawd walks, nearly in place, while the world goes by in
// layers, right to left, each slower the further off it is: clouds in the
// headroom, a far range of slate mountains with snow on the tallest, pine
// hills, and nearest a fence with flags by a dashed road. A crescent moon
// stands still over it all. Every layer is behind Clawd, each fainter with
// distance, and each repeats at its own period, so they never line up.

import { fillRect, type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { CLAWD_TOP, type Scene } from '../scene'
import { blinking, C } from './kit'
import { eachColumn, eachItem, fade, type LayerSpec, scrolled, wrap } from './layers'

// Each layer's speed (columns a second) and how far it fades.
export const LAYERS = {
  clouds: { speed: 0.4, fade: 0.78 },
  mountains: { speed: 1, fade: 0.72 },
  hills: { speed: 2.5, fade: 0.66 },
  near: { speed: 6, fade: 0.3 },
} as const satisfies Record<string, LayerSpec>

const CLOUD = fade(C.sky, LAYERS.clouds.fade)
const MOUNTAIN = fade(C.skyShade, LAYERS.mountains.fade)
const MOUNTAIN_LIT = fade(C.skyShade, 0.58)
const SNOW = fade(C.paperShade, 0.55)
const MOON = fade(C.paper, 0.45)
const HILL = fade(C.green, 0.78)
const HILL_EDGE = fade(C.green, LAYERS.hills.fade)
const TREE = fade(C.green, 0.55)
const TREE_DARK = fade(C.green, 0.68)
const TRUNK = fade(C.woodDark, 0.35)
const ROAD = fade(C.road, LAYERS.near.fade)
const ROAD_GAP = fade(C.road, 0.6)
const RAIL = fade(C.wood, 0.45)
const POST = fade(C.woodDark, LAYERS.near.fade)
const POLE = POST
const PENNANTS = [fade(C.red, LAYERS.near.fade), fade(C.blue, LAYERS.near.fade)] as const

// The far range: peaks (column in the pattern, top row), each slope a row a
// column; the pattern repeats every FAR_P columns.
const FAR_P = 150
const PEAKS = [
  { x: 8, y: 3 },
  { x: 27, y: 0 },
  { x: 44, y: 2 },
  { x: 63, y: 1 },
  { x: 84, y: 4 },
  { x: 101, y: -1 },
  { x: 118, y: 2 },
  { x: 134, y: 1 },
]
function mountainTop(u: number): { y: number; peak: number; isLit: boolean } {
  let best = { y: 99, peak: 99, isLit: true }
  for (const p of PEAKS) {
    const right = wrap(u - p.x, FAR_P)
    const left = wrap(p.x - u, FAR_P)
    const y = p.y + Math.min(left, right)
    if (y < best.y) best = { y, peak: p.y, isLit: left <= right }
  }

  return best
}

// The hills: a rolling line repeating every MID_P columns, pines along it.
const MID_P = 128
const hillTop = (u: number) =>
  Math.round(8.2 + 1.4 * Math.sin((u / MID_P) * Math.PI * 4) + 0.9 * Math.sin((u / MID_P) * Math.PI * 6 + 1.3))
const PINES = [6, 11, 30, 52, 57, 61, 88, 103, 109]

// The near layer: a fence post every 8 columns, a flag every 48.
const NEAR_P = 96
const FLAGS = [20, 68]
const CLOUDS_P = 130
const CLOUDS = [10, 58, 95]

const PINE_TALL = ['.t.', '.t.', 'ttt', '.t.', 'ttt', 'ddd', '.k.']
const PINE_SHORT = ['.t.', 'ttt', '.t.', 'ttt', '.k.']
function drawPine(b: PixelBuffer, x: number, base: number, isTall: boolean) {
  const rows = isTall ? PINE_TALL : PINE_SHORT
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < 3; dx++) {
      const ch = row[dx]
      const color = ch === 't' ? TREE : ch === 'd' ? TREE_DARK : ch === 'k' ? TRUNK : null
      if (color !== null) setPixel(b, x + dx, base - rows.length + 1 + dy, color)
    }
  })
}

const MOON_ROWS = ['.mmm.', 'mm..m', 'mm...', 'mm..m', '.mmm.']

function drawWorld(b: PixelBuffer, time: number) {
  const top = topOf(b)
  // Clouds in the headroom (on 7 rows, the sky's top), drifting slowest.
  const cloudOff = scrolled(time, LAYERS.clouds.speed)
  for (const p of CLOUDS) {
    eachItem(b, cloudOff, CLOUDS_P, p, x => {
      const y = top + (p % 3)
      fillRect(b, x + 1, y, 6, 1, CLOUD)
      fillRect(b, x, y + 1, 9, 1, CLOUD)
    })
  }
  // The moon, farthest of all, never moves; the mountains rise in front of it.
  const mx = Math.max(30, rightOf(b) - 12)
  MOON_ROWS.forEach((row, dy) => {
    for (let dx = 0; dx < 5; dx++) if (row[dx] === 'm') setPixel(b, mx + dx, top + dy, MOON)
  })
  // The far range, snow on the tallest peaks, ragged on the shaded side.
  eachColumn(b, scrolled(time, LAYERS.mountains.speed), FAR_P, (x, u) => {
    const { y: peakTop, peak, isLit } = mountainTop(u)
    for (let y = peakTop; y <= 11; y++) setPixel(b, x, y, isLit ? MOUNTAIN_LIT : MOUNTAIN)
    if (peak <= 1) for (let y = peakTop; y < peak + (isLit ? 3 : 2); y++) setPixel(b, x, y, SNOW)
  })
  // The hills, then their pines.
  const midOff = scrolled(time, LAYERS.hills.speed)
  eachColumn(b, midOff, MID_P, (x, u) => {
    const hill = hillTop(u)
    setPixel(b, x, hill, HILL_EDGE)
    for (let y = hill + 1; y <= 12; y++) setPixel(b, x, y, HILL)
  })
  PINES.forEach((p, i) => eachItem(b, midOff, MID_P, p, x => drawPine(b, x - 1, hillTop(p), i % 3 !== 1)))
  // The near layer: the dashed road, the fence's rail and posts, the flags.
  const nearOff = scrolled(time, LAYERS.near.speed)
  eachColumn(b, nearOff, NEAR_P, (x, u) => {
    setPixel(b, x, 13, wrap(u, 6) < 3 ? ROAD : ROAD_GAP)
    setPixel(b, x, 10, RAIL)
  })
  for (let p = 0; p < NEAR_P; p += 8) eachItem(b, nearOff, NEAR_P, p, x => fillRect(b, x, 9, 1, 4, POST))
  FLAGS.forEach((p, i) =>
    eachItem(b, nearOff, NEAR_P, p, x => {
      fillRect(b, x, 4, 1, 9, POLE)
      // The pennant flaps: long, then short.
      const isLong = Math.floor(time * 4 + i) % 2 === 0
      fillRect(b, x + 1, 4, isLong ? 3 : 2, 1, PENNANTS[i]!)
      fillRect(b, x + 1, 5, isLong ? 2 : 3, 1, PENNANTS[i]!)
    }),
  )
}

// Clawd strolls a little forward and back on the spot, his stride keeping
// pace with the road.
const LOOP = 4
const clawdX = (t: number) => 9 + Math.round(Math.sin((t / LOOP) * Math.PI * 2) * 1.5)

export const roadTrip: Scene = {
  id: 'road-trip',
  loop: LOOP,
  still: 3,
  focusX: 18,
  background: drawWorld,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: clawdX(t), y: CLAWD_TOP }),
      look: t => ({
        pose: 'walk',
        stride: Math.floor(t * 8),
        facing: 1,
        isBlinking: blinking(t, 0.4),
        arms: { left: 'down', right: 'down' },
      }),
    },
  ],
}
