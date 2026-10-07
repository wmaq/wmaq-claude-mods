// Rocket: one of Done's scenes. A small rocket on a pad beside Clawd
// fizzes, lifts off in a cloud of smoke and arcs over the drifting stars,
// turning from upright to sideways, a gold trail fading behind it, and
// pops in a burst of sixteen sparks; Clawd follows it with his eyes and
// cheers at the pop. On a wider area it flies further, up to 150 columns,
// so it is never too quick to follow. The loop fades in the next rocket on
// the pad.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, drawStarfield, every, reach, still } from './kit'

const LOOP = 8
const FIZZ = 0.8
const LIFT = 1.6
const POP = 4.8
const BURST = 1.6
const JUMP = 0.4
const PAD_X = 24

// The flight: a curve from the pad, up past a point over it, to where it
// pops, 8 columns short of the edge at most 150 columns on, high in the
// sky (the headroom's top rows too, on a taller area).
const P0 = { x: PAD_X + 1, y: 7.5 }
const p1Of = (area: Area) => ({ x: PAD_X + 6, y: area.top - 2 })
export const popOf = (area: Area) => ({ x: P0.x + reach(area, P0.x, 150, 8), y: area.top + 5 })
const sOf = (t: number) => Math.max(0, Math.min(1, (t - LIFT) / (POP - LIFT))) ** 1.5
function pointAt(s: number, area: Area) {
  const p1 = p1Of(area)
  const p2 = popOf(area)
  const u = 1 - s

  return { x: u * u * P0.x + 2 * u * s * p1.x + s * s * p2.x, y: u * u * P0.y + 2 * u * s * p1.y + s * s * p2.y }
}
function headingAt(s: number, area: Area) {
  const p1 = p1Of(area)
  const p2 = popOf(area)

  return { x: 2 * (1 - s) * (p1.x - P0.x) + 2 * s * (p2.x - p1.x), y: 2 * (1 - s) * (p1.y - P0.y) + 2 * s * (p2.y - p1.y) }
}

// The rocket at three headings: up, up and right, right. Each with its
// centre (cx, cy) and where its flame comes out.
type Ship = { sprite: Sprite; cx: number; cy: number; flame: { x: number; y: number; dx: number; dy: number } }
const PAL = { r: C.red, w: C.paper, b: C.blue }
const SHIPS: Ship[] = [
  { sprite: { palette: PAL, frames: [['.r.', 'www', 'wbw', 'www', 'rwr', 'r.r']] }, cx: 1, cy: 2.5, flame: { x: 1, y: 6, dx: 0, dy: 1 } },
  { sprite: { palette: PAL, frames: [['....rr', '...wwr', '..wbw.', 'rwww..', '.ww...', '..r...']] }, cx: 2.5, cy: 2.5, flame: { x: 0, y: 5, dx: -1, dy: 1 } },
  { sprite: { palette: PAL, frames: [['rrwww.', '.wwbwr', 'rrwww.']] }, cx: 2.5, cy: 1, flame: { x: -1, y: 1, dx: -1, dy: 0 } },
]
function shipFor(s: number, area: Area): Ship {
  const h = headingAt(s, area)
  const angle = Math.atan2(-h.y, h.x) * (180 / Math.PI)

  return angle > 62 ? SHIPS[0]! : angle > 24 ? SHIPS[1]! : SHIPS[2]!
}

function drawShip(b: PixelBuffer, x: number, y: number, ship: Ship, t: number, isLit: boolean) {
  const left = Math.round(x - ship.cx)
  const top = Math.round(y - ship.cy)
  drawSprite(b, ship.sprite, 0, left, top)
  if (!isLit) return
  const { flame } = ship
  const flicker = every(t, 0.08) % 2 === 0
  setPixel(b, left + flame.x, top + flame.y, flicker ? C.gold : C.white)
  setPixel(b, left + flame.x + flame.dx, top + flame.y + flame.dy, flicker ? C.orange : C.gold)
}

// Sparkles left along the path: bright near the rocket, dimmer and fewer
// further back, twinkling; after the pop they go out from the back.
const TRAIL = 16
function drawTrail(b: PixelBuffer, t: number, area: Area) {
  const s = sOf(t)
  const gone = t > POP ? Math.floor(((t - POP) / 1.2) * TRAIL) : 0
  for (let j = 2; j <= TRAIL - gone; j++) {
    const back = s - j * 0.035
    if (back <= 0.02) break
    const p = pointAt(back, area)
    const twinkle = (every(t, 0.1) + j) % 3
    if (j > 5 && twinkle === 0) continue
    const color = j <= 3 ? C.gold : j <= 7 ? (twinkle === 1 ? C.white : C.gold) : j <= 11 ? C.smoke : C.darkGray
    setPixel(b, p.x + (j % 2 === 0 ? 0 : 1) * (j > 7 ? 1 : 0), p.y, color)
  }
}

// The pop: a white flash, then sixteen sparks in four colours flying out,
// falling a little and twinkling out.
const RAYS = Array.from({ length: 16 }, (_, k) => ({ x: Math.cos((k * Math.PI) / 8), y: Math.sin((k * Math.PI) / 8) }))
const SPARKS = [C.gold, C.blue, C.green, C.red]
function drawPop(b: PixelBuffer, t: number, area: Area) {
  const k = t - POP
  if (k < 0 || k >= BURST) return
  const at = popOf(area)
  if (k < 0.12) {
    fillRect(b, at.x - 1, at.y - 1, 3, 3, C.white)

    return
  }
  const radius = Math.min(6, 1 + k * 12)
  const fall = Math.floor(k * k * 2.5)
  const isFading = k > BURST * 0.55
  RAYS.forEach((ray, i) => {
    const r = i % 2 === 0 ? radius : radius * 0.65
    if (isFading && (every(t, 0.1) + i) % 2 === 0) return
    const x = at.x + Math.round(ray.x * r)
    const y = at.y + Math.round(ray.y * r * 0.85) + fall
    setPixel(b, x, y, SPARKS[i % 4]!)
    if (!isFading && r > 2) setPixel(b, at.x + Math.round(ray.x * (r - 1)), at.y + Math.round(ray.y * (r - 1) * 0.85) + fall, C.white)
  })
}

// The pad: a plate on two legs; at lift-off smoke billows out either side,
// spreading and thinning.
function drawPad(b: PixelBuffer, t: number) {
  fillRect(b, PAD_X - 2, 11, 7, 1, C.gray)
  fillRect(b, PAD_X - 1, 12, 1, 2, C.darkGray)
  fillRect(b, PAD_X + 3, 12, 1, 2, C.darkGray)
  const k = t - (LIFT - 0.3)
  if (k > 0 && k < 1.6) {
    const spread = Math.floor(k * 6)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        if ((every(t, 0.12) + i) % 4 === 0 && k > 0.8) continue
        const x = PAD_X + 1 + side * (3 + spread + i * 2)
        setPixel(b, x, 12 - (i % 2), k > 1 ? C.darkGray : C.smoke)
        setPixel(b, x + side, 13 - (i % 2), C.darkGray)
      }
    }
  }
}

export const rocket: Scene = {
  id: 'rocket',
  loop: LOOP,
  still: 3.4,
  fadesAtLoop: true,
  // A narrow raster keeps Clawd and the pad in view.
  focusX: 19,
  background: (b, time) => drawStarfield(b, time, ['far', 'middle']),
  actors: [
    // The pad and its smoke, a prop behind Clawd (not scenery).
    { kind: 'prop', z: -1, draw: drawPad },
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: t => {
        const pop = t - POP
        const isCheering = pop >= 0 && pop < BURST
        const isWatching = t >= FIZZ && !isCheering

        return {
          pose: pop >= 0 && pop < JUMP ? 'jump' : 'stand',
          eyes: t >= FIZZ && t < LIFT + 0.4 ? 'wide' : 'open',
          isBlinking: !isWatching && !isCheering && blinking(t, 0.3),
          look: { x: 1, y: t < LIFT ? 0 : -1 },
          arms: isCheering ? { left: 'up', right: 'up' } : t < FIZZ ? { left: 'down', right: 'out' } : { left: 'down', right: 'down' },
        }
      },
    },
    {
      kind: 'prop',
      z: 1,
      draw: (b, t) => {
        const area = areaOf(b)
        drawTrail(b, t, area)
        if (t < LIFT) {
          // On the pad, fizzing before it goes: the flame flickers on.
          drawShip(b, P0.x, P0.y, SHIPS[0]!, t, t >= FIZZ && every(t, 0.1) % 3 !== 0)
        } else if (t < POP) {
          const s = sOf(t)
          const p = pointAt(s, area)
          drawShip(b, p.x, p.y, shipFor(s, area), t, true)
        }
        drawPop(b, t, area)
      },
    },
  ],
}
