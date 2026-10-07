// Bug net: a bug flits through a flower bed, from flower to flower, always
// a little ahead of Clawd, who chases it along the bed with his net held
// high. On the far flowers it settles at last; he swings, nets it and lifts
// the net with the bug inside, and the loop fades in the next chase. The
// bed runs to the area's edge, its flowers dimmed so the bug stands out.
// The bug stays ahead of Clawd or above him, never over his face.

import { fillRect, type PixelBuffer, type Point, setPixel } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, line, reach } from './kit'
import { fade, wrap } from './layers'

const LOOP = 9
// The chase until ARRIVE (Clawd stops; the bug has settled on the last
// flower at SETTLE), the swing, the catch, the lift.
const SETTLE = 6.4
const ARRIVE = 6.8
const SWING_AT = 7
const CAUGHT_AT = 7.3
const LIFT_AT = 7.8
const LIFTED_AT = 8.3
const HOPS = 9
const FROM = 4
// How far ahead of Clawd's left column the bug's flowers are; the net's
// reach, from his claw held out.
const LEAD = 24
// How far the chase goes: up to 130 columns, the last flower about 8 short
// of the edge.
const MAX = 130
const MARGIN = LEAD + 8

const HOOP: Sprite = { palette: { g: C.gray, s: C.paperShade }, frames: [['.ggg.', 'g.s.g', 'gs.sg', '.ggg.']] }
const BUG: Sprite = { palette: { w: C.white, r: C.red }, frames: [['w.w', '.rr'], ['.w.', '.rr']] }

// The bed: a flower every BED_EVERY columns from BED_X, its head a cross of
// petals at one of a few heights, on a strip of grass. The scenery's shades
// are faded under Clawd's orange.
const BED_X = 22
const BED_EVERY = 6
const HEADS = [9, 10, 8, 10, 9, 11]
const PETALS = [C.red, C.paper, C.gold, C.blue].map(c => fade(c, 0.5))
const CENTRE = fade(C.gold, 0.4)
const STEM = fade(C.green, 0.45)
const GRASS = fade(C.green, 0.6)
const GRASS_DARK = fade(C.green, 0.75)

const flowerX = (k: number) => BED_X + k * BED_EVERY
const headY = (k: number) => HEADS[wrap(k, HEADS.length)]!
// The flower nearest a column, never one before the bed.
const flowerNear = (x: number) => Math.max(0, Math.round((x - BED_X) / BED_EVERY))

// The chase's progress, 0 to 1 by ARRIVE: easing in and out.
const progress = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, t / ARRIVE))
const reachOf = (area: Area) => reach(area, FROM, MAX, MARGIN)
const clawdX = (t: number, area: Area) => Math.round(FROM + progress(t) * reachOf(area))

// The flower the bug sits on after hop h (0 the first, HOPS the last).
const stopOf = (h: number, area: Area) => flowerNear(FROM + LEAD + (h / HOPS) * reachOf(area))

// The free bug, until it is netted: hop by hop, each a flight to the next
// flower (an arc up over the bed, a flutter on the way) and a rest on it,
// the flights quicker than Clawd so it keeps ahead; then still on the last.
function bugAt(t: number, area: Area): Point {
  const s = Math.min(1, t / SETTLE) * HOPS
  const h = Math.min(HOPS - 1, Math.floor(s))
  const from = stopOf(h, area)
  const to = stopOf(h + 1, area)
  const f = Math.min(1, (s - h) / 0.65)
  const x = lerp(flowerX(from), flowerX(to), f)
  const y = lerp(headY(from), headY(to), f) - 2 - 5 * Math.sin(Math.PI * f) + (f < 1 ? every(t, 0.1) % 2 : 0)

  return { x: Math.round(x), y: Math.round(y) }
}

// Clawd's right claw: up while he chases, held out from the swing until
// the net is lifted.
const isSwung = (t: number) => t >= SWING_AT && t < LIFTED_AT
const restOf = (t: number, area: Area): Point => ({ x: clawdX(t, area) + 13, y: 1 })

const move = (from: Point, to: Point, k: number): Point => ({ x: Math.round(lerp(from.x, to.x, k)), y: Math.round(lerp(from.y, to.y, k)) })

function hoopAt(t: number, area: Area): Point {
  const rest = restOf(t, area)
  const bug = bugAt(SETTLE, area)
  if (t < SWING_AT) return rest
  if (t < CAUGHT_AT) return move(rest, bug, (t - SWING_AT) / (CAUGHT_AT - SWING_AT))
  if (t < LIFT_AT) return bug

  return move(bug, rest, (t - LIFT_AT) / (LIFTED_AT - LIFT_AT))
}

function drawBed(b: PixelBuffer) {
  const { left, right } = areaOf(b)
  for (let x = left; x < right; x++) setPixel(b, x, 13, wrap(x, 5) === 0 ? GRASS_DARK : GRASS)
  for (let k = 0; flowerX(k) < right + 1; k++) {
    const x = flowerX(k)
    const y = headY(k)
    const petals = PETALS[k % PETALS.length]!
    fillRect(b, x, y + 1, 1, 13 - y, STEM)
    setPixel(b, x + (k % 2 === 0 ? 1 : -1), 11, STEM)
    fillRect(b, x - 1, y, 3, 1, petals)
    fillRect(b, x, y - 1, 1, 3, petals)
    setPixel(b, x, y, petals === PETALS[2] ? PETALS[1]! : CENTRE)
  }
}

export const bugNet: Scene = {
  id: 'bug-net',
  loop: LOOP,
  still: 6.6,
  fadesAtLoop: true,
  focusX: FROM + 15,
  // The camera follows Clawd and the bug ahead of him.
  focus: (t, area) => clawdX(t, area) + 15,
  backdrop: drawBed,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: (t, area) => ({ x: clawdX(t, area), y: CLAWD_TOP }),
      look: (t, area) => {
        const isWalking = t < ARRIVE
        const bug = t < CAUGHT_AT ? bugAt(t, area) : hoopAt(t, area)

        return {
          pose: isWalking ? 'walk' : 'stand',
          // A step every 2 columns, and at least two a second.
          stride: Math.floor(clawdX(t, area) / 2 + t * 2),
          facing: 1,
          eyes: t >= CAUGHT_AT && t < LIFT_AT ? 'wide' : 'open',
          isBlinking: t < SETTLE && blinking(t, 1.9),
          look: { x: 1, y: bug.y < 5 ? -1 : 0 },
          arms: { left: t >= LIFTED_AT ? 'up' : 'down', right: isSwung(t) ? 'out' : 'up' },
        }
      },
    },
    // The free bug, in front of the flowers.
    {
      kind: 'prop',
      draw: (b, t) => {
        if (t >= CAUGHT_AT) return
        const bug = bugAt(t, areaOf(b))
        drawSprite(b, BUG, every(t, 0.1), bug.x - 1, bug.y - 1)
      },
    },
  ],
  front: (b, t) => {
    const area = areaOf(b)
    const hoop = hoopAt(t, area)
    const x = clawdX(t, area)
    const tip = isSwung(t) ? { x: x + 15, y: CLAWD_TOP + 2 } : { x: x + 13, y: CLAWD_TOP }
    line(b, tip.x, tip.y, hoop.x, hoop.y + 2, C.wood)
    drawSprite(b, HOOP, 0, hoop.x - 2, hoop.y - 1)
    // The caught bug stays in the net.
    if (t >= CAUGHT_AT) drawSprite(b, BUG, every(t, 0.1), hoop.x - 1, hoop.y - 1)
  },
}
