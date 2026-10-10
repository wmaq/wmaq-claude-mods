// Bricklaying: Clawd lays a wall three courses high, bay by bay, from
// column 6 towards the area's right edge, walking right just past its
// growing end with the wall on his left, his hammer at the end; then he
// cheers, and the loop fades in a bare floor. Behind, quiet and dim: slow clouds, two skylines (far
// towers; nearer blocks with a few lit windows that change), and on a wide
// area a tower crane whose trolley creeps along its jib.

import { CLAWD_W, clawdAnchors } from '../clawd'
import { fillRect, type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, lerp, reach, hash as seededHash } from './kit'
import { eachItem, fade, type LayerSpec, mix, scrolled, wrap } from './layers'

// Only the clouds scroll; the skylines and the crane stand still.
export const LAYERS = {
  clouds: { speed: 0.3, fade: 0.84 },
} as const satisfies Record<string, LayerSpec>

const LOOP = 16
const BUILD = 13.5
const WALL_X = 6
const BAY = 4
// How far the wall reaches: up to 150 columns, and short of the edge by
// Clawd's width and the columns he stands past its end.
const MAX = 150
// From the wall's end to Clawd's left column: his left claw, struck out,
// reaches back to it.
const PAST_END = 3
const MARGIN = CLAWD_W + PAST_END

const CLOUD = fade(C.sky, LAYERS.clouds.fade)
const FAR_CITY = fade(C.skyShade, 0.9)
const FAR_CITY_EDGE = fade(C.skyShade, 0.86)
const CITY = fade(C.skyShade, 0.8)
const CITY_EDGE = fade(C.skyShade, 0.72)
const WINDOW = fade(C.gold, 0.72)
const CRANE = fade(C.gold, 0.6)
const CRANE_DARK = fade(C.gold, 0.75)
const CABLE = fade(C.gray, 0.55)
const BRICK_SHADE = mix(C.brick, C.ink, 0.22)

// The wall's bays on an area: as many whole bays as it reaches.
const baysOn = (area: Area) => Math.floor(reach(area, WALL_X, MAX, MARGIN) / BAY)
// How many bricks are down at t: three a bay (bottom, middle, top).
const laidAt = (t: number, area: Area) => Math.min(baysOn(area) * 3, Math.floor((t / BUILD) * baysOn(area) * 3))
const isDone = (t: number) => t >= BUILD
// Clawd's left column: just past the wall's growing end.
const clawdX = (t: number, area: Area) => Math.round(WALL_X + Math.min(1, t / BUILD) * baysOn(area) * BAY + PAST_END)
const isStriking = (t: number) => !isDone(t) && Math.floor(t * 8) % 2 === 1

// A small hash, for the skylines' buildings and the bricks' shades.
const hash = (n: number) => seededHash(n, 7)

type Skyline = { seed: number; top: number; spread: number; body: number; roof: number; hasWindows: boolean; wide: number; gap: number }
const FAR_SKYLINE: Skyline = { seed: 40, top: -2, spread: 5, body: FAR_CITY, roof: FAR_CITY_EDGE, hasWindows: false, wide: 5, gap: 9 }
const NEAR_SKYLINE: Skyline = { seed: 7, top: 4, spread: 3, body: CITY, roof: CITY_EDGE, hasWindows: true, wide: 9, gap: 5 }

// A row of buildings from the area's left edge to its right: widths, gaps
// and roofs from the hash, roofs between rows top and top + spread; an
// antenna or a water tank on a few; a lit window or two on the nearer row,
// some changing every few seconds.
function drawSkyline(b: PixelBuffer, t: number, s: Skyline) {
  let x = areaOf(b).left - 4 + Math.floor(hash(s.seed) * 6)
  for (let i = s.seed; x < rightOf(b); i++) {
    const w = s.wide - 3 + Math.floor(hash(i) * 6)
    const y0 = s.top + Math.floor(hash(i + 100) * (s.spread + 1))
    fillRect(b, x, y0, w, 14 - y0, s.body)
    fillRect(b, x, y0, w, 1, s.roof)
    const r = hash(i + 200)
    if (r < 0.2) fillRect(b, x + 2, y0 - 2, 1, 2, s.roof)
    else if (r < 0.32) fillRect(b, x + 1, y0 - 2, 3, 2, s.roof)
    if (s.hasWindows) {
      for (let k = 0; k < 2; k++) {
        const wx = x + 1 + Math.floor(hash(i * 3 + k + 300) * (w - 2))
        const wy = y0 + 2 + Math.floor(hash(i * 3 + k + 400) * 4)
        const isOn = hash(i * 3 + k + 500) < 0.45 || Math.floor(t / 3 + i + k) % 4 === 0
        if (isOn && wy < 9) setPixel(b, wx, wy, WINDOW)
      }
    }
    x += w + 1 + Math.floor(hash(i + 600) * s.gap)
  }
}

// The crane, on an area 96 columns wide or more with the headroom for its
// jib (9 rows): a lattice mast near the right edge, its jib reaching left,
// the trolley creeping along it and back over the loop with its hook
// hanging.
const JIB = -3
function drawCrane(b: PixelBuffer, t: number) {
  const edge = rightOf(b)
  if (edge < 96 || topOf(b) > JIB) return
  const mast = edge - 18
  const jib = JIB
  for (let y = jib; y <= 13; y++) {
    setPixel(b, mast, y, CRANE)
    setPixel(b, mast + 2, y, CRANE)
    setPixel(b, mast + 1, y, wrap(y, 2) === 0 ? CRANE : CRANE_DARK)
  }
  const tip = Math.max(areaOf(b).left + 30, mast - 52)
  fillRect(b, tip, jib, mast - tip + 9, 1, CRANE)
  for (let x = tip + 1; x < mast; x += 2) setPixel(b, x, jib + 1, CRANE_DARK)
  fillRect(b, mast + 6, jib + 1, 3, 2, CRANE_DARK)
  setPixel(b, mast + 1, jib - 1, CRANE)
  const tx = Math.round(lerp(mast - 8, tip + 4, 0.5 - 0.5 * Math.cos((t / LOOP) * Math.PI * 2)))
  setPixel(b, tx, jib + 1, CRANE)
  fillRect(b, tx, jib + 2, 1, 2, CABLE)
  setPixel(b, tx, jib + 4, CRANE)
}

function drawWall(b: PixelBuffer, t: number) {
  const laid = laidAt(t, areaOf(b))
  for (let i = 0; i < laid; i++) {
    const bay = Math.floor(i / 3)
    const course = i % 3
    const y = 12 - course * 2
    const x = WALL_X + bay * BAY + (course === 1 ? 2 : 0)
    // A few bricks a shade darker, for texture.
    const color = hash(i + 900) < 0.3 ? BRICK_SHADE : C.brick
    fillRect(b, x, y, 3, 2, color)
    fillRect(b, x + 3, y, 1, 2, C.mortar)
    if (course === 1 && bay === 0) {
      // The half brick at the middle course's start.
      fillRect(b, WALL_X, y, 1, 2, color)
      fillRect(b, WALL_X + 1, y, 1, 2, C.mortar)
    }
  }
}

export const bricklaying: Scene = {
  id: 'bricklaying',
  loop: LOOP,
  still: 7,
  fadesAtLoop: true,
  focusX: WALL_X + PAST_END + 7,
  // The camera follows Clawd along the wall.
  focus: (t, area) => clawdX(t, area) + 7,
  background: (b, time) => {
    // Long thin clouds in the headroom, drifting slowest of all.
    const off = scrolled(time, LAYERS.clouds.speed)
    for (const p of [14, 70, 115]) {
      eachItem(
        b,
        off,
        150,
        p,
        x => {
          const y = topOf(b) + (p % 2)
          fillRect(b, x + 2, y, 8, 1, CLOUD)
          fillRect(b, x, y + 1, 14, 1, CLOUD)
        },
        16,
      )
    }
  },
  backdrop: (b, t) => {
    drawSkyline(b, t, FAR_SKYLINE)
    drawSkyline(b, t, NEAR_SKYLINE)
    drawCrane(b, t)
  },
  actors: [
    // The wall, behind Clawd: his claw reaches back over its end.
    { kind: 'prop', z: -1, draw: drawWall },
    {
      kind: 'clawd',
      isHero: true,
      at: (t, area) => ({ x: clawdX(t, area), y: CLAWD_TOP }),
      look: (t, area) =>
        isDone(t)
          ? { facing: 0, eyes: 'wide', arms: { left: 'up', right: 'up' } }
          : {
              pose: 'walk',
              // A step every 2 columns he goes, and at least two a second
              // (on a narrow area the wall grows slowly).
              stride: Math.floor(clawdX(t, area) / 2 + t * 2),
              facing: -1,
              isBlinking: blinking(t, 1.5),
              arms: { left: isStriking(t) ? 'out' : 'up', right: 'down' },
            },
    },
    {
      kind: 'prop',
      z: 1,
      draw: (b, t) => {
        if (isDone(t)) return
        // The hammer in Clawd's left claw: raised, or struck out at the
        // wall's end with a spark.
        const tip = clawdAnchors({ arms: { left: isStriking(t) ? 'out' : 'up', right: 'down' } }).left
        const x = clawdX(t, areaOf(b)) + tip.x
        const y = CLAWD_TOP + tip.y
        if (isStriking(t)) {
          fillRect(b, x - 1, y - 1, 1, 3, C.gray)
          setPixel(b, x - 2, y, C.gold)
        } else {
          fillRect(b, x - 1, y - 1, 3, 1, C.gray)
        }
      },
    },
  ],
}
