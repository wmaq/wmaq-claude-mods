// Crash test: a test car, a dummy at the wheel, waits beside Clawd, then
// speeds off across the track, faster and faster, into a small padded
// barrier at the far end: a bump, the pad squashes, sparks and a puff of
// smoke, and the car rolls back a little. The needle of the meter in
// Clawd's claw jumps into the red, and he reads it. The loop fades in the
// next car at the start. Behind, quiet and dim: the test hall's wall with a
// hazard stripe and a marker board every few metres, and the track's
// distance marks on the floor.

import { fillRect, type PixelBuffer, setPixel, topOf } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, lerp, reach, still } from './kit'
import { eachItem, fade, wrap } from './layers'

const LOOP = 7
// The run: waiting, then off at GO, faster and faster, into the barrier at
// HIT; the bounce back until SETTLED; Clawd reads the meter from READ.
const GO = 0.6
const HIT = 3.2
const SETTLED = 3.6
const READ = 4
const BOUNCE = 3
const START = 24
const CAR_W = 9
const BARRIER_W = 4
// How far the run goes: up to 140 columns, the barrier 2 short of the edge.
const MAX = 140
const MARGIN = CAR_W + BARRIER_W + 2
const CAR_Y = 10

// The car, nose to the right: a blue body, its window with the yellow
// crash-test dummy, two wheels.
const CAR: Sprite = {
  palette: { b: C.blue, g: C.glass, y: C.gold, d: C.darkGray },
  frames: [['...bbbb..', '..bgyggb.', 'bbbbbbbbb', '.dd...dd.']],
}

// The meter in Clawd's right claw: a grey case with a bar that shoots up
// at the bump, through green and gold into the red, and settles there.
const METER = { x: 16, y: 3 }
const METER_H = 6
const LEVELS = [C.green, C.green, C.gold, C.gold, C.red, C.red]
const RESTING = 1
const READING = 5

// The scenery's shades: faint, well under Clawd's orange.
const WALL_LINE = fade(C.gray, 0.82)
const STRIPE = fade(C.gold, 0.8)
const STRIPE_DARK = fade(C.darkGray, 0.7)
const BOARD = fade(C.gold, 0.74)
const FLOOR = fade(C.gray, 0.8)
const FLOOR_MARK = fade(C.paper, 0.72)

// The car's left column when it hits, and the barrier's.
const hitOf = (area: Area) => START + reach(area, START, MAX, MARGIN)
const barrierOf = (area: Area) => hitOf(area) + CAR_W

function carX(t: number, area: Area): number {
  const hit = hitOf(area)
  if (t < GO) return START
  if (t < HIT) return Math.round(lerp(START, hit, ((t - GO) / (HIT - GO)) ** 2))
  if (t < SETTLED) return Math.round(hit - BOUNCE * Math.sin(((t - HIT) / (SETTLED - HIT)) * (Math.PI / 2)))

  return hit - BOUNCE
}

// The car's speed in columns a second, while it runs.
const speedOf = (t: number, area: Area) => (t >= GO && t < HIT ? (2 * (hitOf(area) - START) * (t - GO)) / (HIT - GO) ** 2 : 0)

// How far up the bar is: resting low, at the bump right to the top, then
// down a step and up again until it settles on the reading.
function levelAt(t: number): number {
  if (t < HIT) return RESTING
  if (t < HIT + 0.3) return METER_H
  if (t < HIT + 0.5) return READING - 1

  return t < HIT + 0.7 ? METER_H : READING
}

function drawMeter(b: PixelBuffer, t: number) {
  const { x, y } = METER
  fillRect(b, x, y, 5, METER_H + 2, C.darkGray)
  fillRect(b, x + 1, y + 1, 3, METER_H, C.ink)
  const level = levelAt(t)
  for (let i = 0; i < level; i++) fillRect(b, x + 1, y + METER_H - i, 3, 1, LEVELS[i]!)
  // A notch at the red line.
  setPixel(b, x + 4, y + METER_H - 3, C.paper)
}

// The barrier: a padded block, red and white, squashed a column for a
// moment at the bump.
function drawBarrier(b: PixelBuffer, t: number) {
  const x = barrierOf(areaOf(b))
  const isSquashed = t >= HIT && t < HIT + 0.2
  const w = isSquashed ? BARRIER_W - 1 : BARRIER_W
  const left = x + BARRIER_W - w
  for (let y = 7; y < 14; y++) fillRect(b, left, y, w, 1, wrap(Math.floor((y - 7) / 2), 2) === 0 ? C.red : C.paper)
  fillRect(b, x + BARRIER_W, 7, 1, 7, C.darkGray)
}

// The test hall: a hazard stripe along the wall, a marker board (a quartered
// target) every 24 columns past the meter, and the floor's distance marks
// every 8.
function drawHall(b: PixelBuffer) {
  const { left, right } = areaOf(b)
  const top = Math.max(topOf(b), 0)
  for (let x = left; x < right; x++) {
    setPixel(b, x, top, WALL_LINE)
    setPixel(b, x, top + 1, wrap(x + top, 4) < 2 ? STRIPE : STRIPE_DARK)
    setPixel(b, x, 13, FLOOR)
    if (wrap(x - START, 8) === 0) setPixel(b, x, 12, FLOOR_MARK)
  }
  eachItem(
    b,
    0,
    24,
    START + 12,
    x => {
      if (x < START) return
      fillRect(b, x, 4, 2, 2, BOARD)
      fillRect(b, x + 2, 6, 2, 2, BOARD)
    },
    4,
  )
}

export const crashTest: Scene = {
  id: 'crash-test',
  loop: LOOP,
  still: 4.6,
  fadesAtLoop: true,
  focusX: 16,
  // The camera, in a raster narrower than the core: on Clawd, along with
  // the car to the barrier, and back to Clawd for the reading.
  focus: (t, area) => {
    const onBarrier = barrierOf(area) - 4
    if (t < GO || t >= READ) return 16
    if (t < HIT) return Math.round(lerp(16, onBarrier, (carX(t, area) - START) / (hitOf(area) - START)))
    if (t < SETTLED) return onBarrier

    return Math.round(lerp(onBarrier, 16, (t - SETTLED) / (READ - SETTLED)))
  },
  backdrop: drawHall,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(1, CLAWD_TOP),
      look: t => {
        if (t >= HIT && t < HIT + 0.6) return { eyes: 'wide', look: { x: 1, y: 0 }, arms: { left: 'up', right: 'out' } }
        const isReading = t >= READ

        return { isBlinking: !isReading && blinking(t, 0.9), look: { x: 1, y: isReading ? -1 : 0 }, arms: { left: 'down', right: 'out' } }
      },
    },
    // Speed lines behind the car, longer the faster it goes.
    {
      kind: 'prop',
      z: -1,
      draw: (b, t) => {
        const area = areaOf(b)
        const n = Math.min(12, Math.floor(speedOf(t, area) / 8))
        if (n < 2) return
        const x = carX(t, area)
        fillRect(b, x - n - 1, CAR_Y, n, 1, FLOOR_MARK)
        fillRect(b, x - Math.round(n * 0.6) - 1, CAR_Y + 2, Math.round(n * 0.6), 1, FLOOR_MARK)
      },
    },
    {
      kind: 'prop',
      draw: (b, t) => {
        drawBarrier(b, t)
        const area = areaOf(b)
        drawSprite(b, CAR, 0, carX(t, area), CAR_Y)
        if (t >= HIT && t < HIT + 0.4) {
          // The bump: gold sparks at the nose and a puff of smoke above.
          const x = barrierOf(area) - 1
          for (const [dx, dy] of [[0, -2], [-1, -3], [1, -4], [-2, -1]] as const) setPixel(b, x + dx, CAR_Y + 1 + dy, C.gold)
          if (t >= HIT + 0.1) fillRect(b, x - 2, CAR_Y - 5, 2, 1, C.smoke)
        }
      },
    },
  ],
  front: drawMeter,
}
