// Flashlight: a dark storeroom runs the area's width, far shelves of books
// and jars along the back wall, nearer crates and barrels on the floor.
// Clawd's torch throws a pool of light that shows them in their colours,
// its cone half lit; the unlit room is the terminal's own background, the
// crates faint shapes in it. The pool sweeps out towards the far edge and
// back, and ends on the bug: it lights up red, Clawd's eyes widen and a
// "!" appears.

import { fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, BOX, C, lerp, reach, still } from './kit'
import { drawLit } from './layers'

const LOOP = 8
const LENS = { x: 20, y: 8 }
// The sweep: out towards the far edge, back past the bug, onto it, held.
const OUT = 3.4
const BACK = 5.6
const SPOT = { rx: 7, ry: 5.5 }
const START = { x: 30, y: 4 }
const BUG_Y = 12
// The shelves' uprights stand every BAY columns from SHELVES_X; the bug
// sits mid-bay.
const SHELVES_X = 22
const BAY = 26

// How far out the pool goes: up to 150 columns past its start, 9 short of
// the edge.
const farOf = (area: Area) => START.x + reach(area, START.x, 150, 9)
// The bug's left column: mid-bay, about 60% across (on the core alone,
// at 38), never past the pool's reach.
function bugX(area: Area): number {
  if (area.right <= 48) return 38
  const target = Math.min(area.right * 0.62, farOf(area) - 4)

  return SHELVES_X + 11 + BAY * Math.max(0, Math.round((target - 35) / BAY))
}

const ease = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, k)))
const swayY = (t: number) => START.y + Math.sin(t * 2.1) * 4
// Where the pool of light is at t.
function aimAt(t: number, area: Area): { x: number; y: number } {
  const far = farOf(area)
  const onBug = { x: bugX(area) + 2, y: BUG_Y - 1 }
  if (t < OUT) return { x: lerp(START.x, far, ease(t / OUT)), y: swayY(t) }
  if (t < BACK) {
    // Back past the bug, a little high, then onto it.
    const k = ease((t - OUT) / (BACK - OUT))

    return { x: lerp(far, onBug.x, k), y: lerp(swayY(OUT), onBug.y, k) - Math.sin(k * Math.PI) * 3 }
  }

  return onBug
}

// How lit a pixel is: 1 in the pool's middle, 0.7 at its rim, 0.3 in the
// cone from the lens, 0 in the dark.
function lightAt(x: number, y: number, aim: { x: number; y: number }): number {
  const d = ((x - aim.x) / SPOT.rx) ** 2 + ((y - aim.y) / SPOT.ry) ** 2
  if (d <= 0.4) return 1
  if (d <= 1) return 0.7
  if (x <= LENS.x || x >= aim.x) return 0
  const k = (x - LENS.x) / (aim.x - LENS.x)
  const middle = lerp(LENS.y, aim.y, k)
  const half = lerp(0.5, SPOT.ry * 0.55, k)

  return Math.abs(y - middle) <= half ? 0.3 : 0
}

const BOOKS = [C.red, C.blue, C.green, C.gold, C.paperShade, C.violet]
const hash = (n: number) => {
  let h = Math.imul(n + 11, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)

  return ((h ^ (h >>> 13)) >>> 0) / 0x100000000
}

// The far layer: two shelves along the back wall from SHELVES_X to the
// edge, books, jars and the odd box along them, with gaps; the uprights.
function drawShelves(b: PixelBuffer) {
  for (const plank of [0, 6]) {
    fillRect(b, SHELVES_X, plank, rightOf(b) - SHELVES_X, 1, C.wood)
    let x = SHELVES_X + 2
    for (let i = plank * 100; x < rightOf(b); i++) {
      const r = hash(i)
      if (r < 0.55) {
        const h = 2 + Math.floor(hash(i + 7) * 3)
        fillRect(b, x, plank - h, 1, h, BOOKS[Math.floor(hash(i + 3) * BOOKS.length)]!)
        x += 1
      } else if (r < 0.68) {
        fillRect(b, x, plank - 3, 2, 3, C.glass)
        setPixel(b, x, plank - 1, C.liquid)
        setPixel(b, x + 1, plank - 1, C.liquid)
        x += 3
      } else if (r < 0.78) {
        fillRect(b, x, plank - 3, 4, 3, C.paperShade)
        x += 5
      } else x += 2 + Math.floor(hash(i + 5) * 4)
    }
  }
  for (let x = SHELVES_X; x < rightOf(b); x += BAY) fillRect(b, x, -4, 1, 18, C.woodDark)
}

const BARREL: Sprite = { palette: { w: C.wood, d: C.woodDark, g: C.gray }, frames: [['.ddd.', 'wwwww', 'ggggg', 'wwwww', 'wwwww', 'ggggg', '.ddd.']] }
const SMALL_BOX: Sprite = { palette: { b: C.wood, d: C.woodDark }, frames: [['ddddd', 'dbbbd', 'dbbbd', 'ddddd']] }

// The near layer: crates, boxes and barrels on the floor, the floor kept
// clear round the bug.
function drawCrates(b: PixelBuffer) {
  const bx = bugX(areaOf(b))
  for (let x = 26, i = 0; x < rightOf(b); i++) {
    const r = hash(i + 500)
    if (x + 10 > bx - 8 && x < bx + 12) {
      x = bx + 12
      continue
    }
    if (r < 0.4) {
      drawSprite(b, BOX, 0, x, 7)
      if (hash(i + 600) < 0.4) drawSprite(b, SMALL_BOX, 0, x + 2, 3)
      x += 10 + Math.floor(hash(i + 700) * 8)
    } else if (r < 0.65) {
      drawSprite(b, BARREL, 0, x, 7)
      x += 7 + Math.floor(hash(i + 700) * 8)
    } else {
      drawSprite(b, SMALL_BOX, 0, x, 10)
      drawSprite(b, SMALL_BOX, 0, x + 5, 10)
      x += 12 + Math.floor(hash(i + 700) * 8)
    }
  }
}

const BUG: Sprite = { palette: { r: C.red, d: C.ink, l: C.darkGray }, frames: [['.rr.', 'drrd', 'l..l'], ['.rr.', 'drrd', '.ll.']] }

export const flashlight: Scene = {
  id: 'flashlight',
  loop: LOOP,
  still: 6.5,
  fadesAtLoop: true,
  // A narrow raster keeps Clawd and his torch in view.
  focusX: 19,
  backdrop: (b, t) => {
    const area = areaOf(b)
    const aim = aimAt(t, area)
    const light = (x: number, y: number) => lightAt(x, y, aim)
    // The back wall shows only in the light; the shelves are nearly gone in
    // the dark, the crates faint shapes, the bug a dim one.
    drawLit(b, drawShelves, light, { dark: 1, bare: C.beam })
    drawLit(b, drawCrates, light, { dark: 0.84 })
    drawLit(b, layer => drawSprite(layer, BUG, Math.floor(t * 6), bugX(area), BUG_Y - 1), light, { dark: 0.92 })
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(4, CLAWD_TOP),
      look: (t, area) => {
        const isFound = t >= BACK
        const aim = aimAt(t, area)

        return {
          eyes: isFound ? 'wide' : 'open',
          isBlinking: !isFound && blinking(t, 0.6),
          look: { x: 1, y: aim.y > 9 ? 1 : aim.y < 2 ? -1 : 0 },
          arms: { left: 'down', right: 'out' },
        }
      },
    },
  ],
  front: (b, t) => {
    // The torch in the right claw: its body, then the lens.
    setPixel(b, LENS.x - 1, LENS.y, C.gray)
    setPixel(b, LENS.x, LENS.y, C.white)
    // Found: a red "!" over the bug.
    if (t >= BACK + 0.2) {
      const x = bugX(areaOf(b)) + 1
      fillRect(b, x, BUG_Y - 9, 1, 3, C.red)
      setPixel(b, x, BUG_Y - 5, C.red)
    }
  },
}
