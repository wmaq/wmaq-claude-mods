// Treasure map: Clawd unrolls a map, a dotted path runs across it with pins
// popping in along the way to a red X, and he rolls it up again. On a wider
// area the sea lies in the wings, its waves tiled, with a small island; the
// map unrolls as far as ever.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite, STAGE_W } from '../scene'
import { blinking, C, lerp, still } from './kit'
import { tileOn } from './wide-d'

const LOOP = 8
const MAP_X = 23
const MAP_Y = 3
const MAP_W = 22
const MAP_H = 9
const UNROLL_FOR = 1.5
const PATH_FROM = 1.5
const PATH_FOR = 3
const ROLL_UP_AT = 6.5
const WAYPOINTS: [number, number][] = [[26, 9], [31, 5], [36, 9], [41, 5]]
// The dots in the order they are drawn: every other pixel along the legs.
const DOTS: [number, number][] = []
for (let i = 1; i < WAYPOINTS.length; i++) {
  const [x0, y0] = WAYPOINTS[i - 1]!
  const [x1, y1] = WAYPOINTS[i]!
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  for (let k = 0; k < n; k += 2) DOTS.push([Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n)])
}
// A pin pops in at each middle waypoint as the path reaches it; the X at
// the end.
const PINS = [WAYPOINTS[1]!, WAYPOINTS[2]!]
const X_AT = PATH_FROM + PATH_FOR

// How far the map is unrolled, in columns.
const width = (t: number) => Math.round(t < ROLL_UP_AT ? lerp(1, MAP_W, t / UNROLL_FOR) : lerp(MAP_W, 1, (t - ROLL_UP_AT) / (LOOP - ROLL_UP_AT)))

// The sea: rows 11 to 13 from the core's edge to the area's, a wave every
// WAVE_EVERY columns on its top row, still, with a light crest. The island,
// a sandbank with a palm, stands a little way out.
const SEA_Y = 11
const WAVE_EVERY = 6
const ISLAND_X = 62
const ISLAND: Sprite = {
  palette: { g: C.green, t: C.woodDark, s: C.road },
  frames: [['..ggg.....', '.g.t.g....', '....t.....', '....t.....', '..sssss...', 'sssssssss.']],
}

function drawSea(b: PixelBuffer) {
  const edge = rightOf(b)
  if (STAGE_W >= edge) return
  fillRect(b, STAGE_W, SEA_Y + 1, edge - STAGE_W, 2, C.blue)
  tileOn(b, STAGE_W, WAVE_EVERY, x => {
    fillRect(b, x + 1, SEA_Y, 3, 1, C.blue)
    setPixel(b, x + 2, SEA_Y, C.glass)
  })
  drawSprite(b, ISLAND, 0, ISLAND_X, SEA_Y - 4)
}

function drawX(b: PixelBuffer, x: number, y: number) {
  for (const d of [-1, 0, 1]) {
    setPixel(b, x + d, y + d, C.red)
    setPixel(b, x + d, y - d, C.red)
  }
}

export const treasureMap: Scene = {
  id: 'treasure-map',
  loop: LOOP,
  focusX: 28,
  backdrop: drawSea,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(7, CLAWD_TOP),
      look: t => ({
        eyes: t >= X_AT && t < X_AT + 0.6 ? 'wide' : 'open',
        isBlinking: blinking(t, 0.9),
        look: { x: 1, y: 0 },
        arms: { left: 'down', right: 'out' },
      }),
    },
  ],
  front: (b, t) => {
    const w = width(t)
    const edge = MAP_X + w
    fillRect(b, MAP_X, MAP_Y, w, MAP_H, C.paper)
    // The two rollers: one in Clawd's claw, one at the unrolled edge.
    fillRect(b, MAP_X - 1, MAP_Y - 1, 1, MAP_H + 2, C.woodDark)
    fillRect(b, edge, MAP_Y - 1, 1, MAP_H + 2, C.woodDark)
    const inside = ([x]: [number, number]) => x < edge - 1
    const drawn = t < PATH_FROM ? 0 : Math.min(DOTS.length, Math.floor(((t - PATH_FROM) / PATH_FOR) * DOTS.length) + 1)
    for (const [x, y] of DOTS.slice(0, drawn).filter(inside)) setPixel(b, x, y, C.ink)
    PINS.forEach((p, i) => {
      if (t < PATH_FROM + ((i + 1) / (WAYPOINTS.length - 1)) * PATH_FOR || !inside(p)) return
      setPixel(b, p[0], p[1] - 2, C.red)
      setPixel(b, p[0], p[1] - 1, C.darkGray)
    })
    const end = WAYPOINTS.at(-1)!
    if (t >= X_AT && inside(end)) drawX(b, end[0], end[1])
  },
}
