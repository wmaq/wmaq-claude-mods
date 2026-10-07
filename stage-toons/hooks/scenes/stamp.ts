// Stamp: a belt at Clawd's waist carries blank pages in from the left,
// behind him: he stands on a low crate in front of it, a stamp held up in
// his right claw. Each page stops beside him; he squats to stamp it with a
// red seal, and it rides on down the belt with its mark, into an out-bin at
// the belt's end (up to 140 columns along). The belt beyond him is always
// full of stamped pages. Behind, quiet and dim: a mailroom's pigeonholes,
// letters in some of them.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { type Area, areaOf, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, reach } from './kit'
import { fade, wrap } from './layers'

const PER_PAGE = 1.5
const MOVE_FOR = 0.9
const GAP = 12
// The loop is three pages long: the belt has moved three gaps, and the
// picture meets itself.
const LOOP = PER_PAGE * 3
// Clawd on his crate: his head at row 4, the pop-ups' room left clear.
const CLAWD_X = 12
const CLAWD_Y = 4
const CRATE_Y = 12
// The stamp in his right claw, raised: its handle beside the claw's tip,
// its red face two rows lower; squatting, his body drops two rows and the
// stamp with it, onto the page.
const STAMP_X = CLAWD_X + 14
const STAMP: Sprite = { palette: { h: C.woodDark, b: C.darkGray, r: C.red }, frames: [['hh..', 'bbbb', 'rrrr']] }
const DOWN_FROM = 1.05
const DOWN_TO = 1.3
// Where a page stops under the stamp, its size and top row; the belt's
// top row under it, at Clawd's knees, and its legs behind the crate.
const UNDER = STAMP_X - 1
const PAGE_W = 7
const PAGE_H = 3
const PAGE_TOP = 8
const BELT_Y = 11
// The out-bin at the belt's end.
const BIN_W = 9
const beltEnd = (area: Area) => UNDER + reach(area, UNDER, 140, BIN_W + 3)

// The mailroom's shades: far, faded well towards the background.
const CUBBY = fade(C.wood, 0.84)
const CUBBY_BACK = fade(C.woodDark, 0.93)
const LETTERS = [C.paper, C.paperShade, C.sky].map(c => fade(c, 0.84))

const hashOf = (n: number) => {
  let h = Math.imul(n + 3, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)

  return ((h ^ (h >>> 13)) >>> 0) / 0x100000000
}

// How far the belt has moved, in columns: a gap a page, then a pause.
function travel(t: number): number {
  const n = every(t, PER_PAGE)

  return GAP * (n + Math.min(1, (t - n * PER_PAGE) / MOVE_FOR))
}

const isDown = (t: number) => t % PER_PAGE >= DOWN_FROM && t % PER_PAGE < DOWN_TO
// The page under the stamp has its seal once the stamp is down, and keeps
// it as it moves on (at the next turn's start it is still under the stamp).
const isStampedYet = (t: number) => t % PER_PAGE >= (DOWN_FROM + DOWN_TO) / 2 || t % PER_PAGE < MOVE_FOR

// The mailroom: racks of pigeonholes along the wall, five cubbies wide and
// as many rows as the area has room for above the belt, a gap between
// racks; a letter in about half the cubbies.
function drawMailroom(b: PixelBuffer) {
  const { left, right, top } = areaOf(b)
  const rows = Math.floor((8 - top) / 4)
  const rackTop = 8 - rows * 4
  for (let rx = left + 2; rx < right; rx += 29) {
    fillRect(b, rx, rackTop, 26, rows * 4 + 1, CUBBY_BACK)
    for (let r = 0; r <= rows; r++) fillRect(b, rx, rackTop + r * 4, 26, 1, CUBBY)
    for (let c = 0; c <= 5; c++) fillRect(b, rx + c * 5, rackTop, 1, rows * 4 + 1, CUBBY)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) {
        const h = hashOf(rx * 31 + r * 7 + c)
        // A letter lying in the cubby, or one standing up in it.
        if (h < 0.45) fillRect(b, rx + c * 5 + 1 + (h < 0.15 ? 1 : 0), rackTop + r * 4 + (h < 0.15 ? 1 : 3), h < 0.15 ? 2 : 4, h < 0.15 ? 3 : 1, LETTERS[Math.floor(h * 20) % LETTERS.length]!)
      }
    }
  }
}

// A page with a line of text; stamped, a red seal over it.
function drawPage(b: PixelBuffer, x: number, isStamped: boolean) {
  fillRect(b, x, PAGE_TOP, PAGE_W, PAGE_H, C.paper)
  fillRect(b, x + 1, PAGE_TOP + 1, 5, 1, C.paperShade)
  if (!isStamped) return
  for (const [dx, dy] of [[2, 0], [3, 0], [1, 1], [4, 1], [2, 2], [3, 2]] as const) setPixel(b, x + dx, PAGE_TOP + dy, C.red)
}

// The belt from the left edge to the bin, its surface marked every four
// columns so it is seen to move, legs every 12 columns; the pages on it,
// stamped past the stamp; the bin, its stamped sheets showing over the
// rim; and Clawd's crate, in front of the belt.
function drawBelt(b: PixelBuffer, t: number) {
  const { left } = areaOf(b)
  const end = beltEnd(areaOf(b))
  const moved = Math.floor(travel(t))
  for (let x = left; x < end + 2; x++) setPixel(b, x, BELT_Y, wrap(x - moved, 4) === 0 ? C.gray : C.darkGray)
  for (let x = left + 3; x < end; x += 12) fillRect(b, x, BELT_Y + 1, 1, 13 - BELT_Y, C.darkGray)
  const shift = wrap(moved, GAP)
  for (let x = UNDER + shift - GAP * Math.ceil((UNDER + shift - left + PAGE_W) / GAP); x < end + 2; x += GAP) {
    drawPage(b, x, x > UNDER || (x === UNDER && isStampedYet(t)))
  }
  // The bin, in front of the pages it swallows.
  fillRect(b, end + 1, PAGE_TOP - 1, BIN_W, 1, C.paper)
  setPixel(b, end + 4, PAGE_TOP - 1, C.red)
  setPixel(b, end + 5, PAGE_TOP - 1, C.red)
  fillRect(b, end, PAGE_TOP - 2, BIN_W + 2, 1, C.paperShade)
  fillRect(b, end, PAGE_TOP, BIN_W + 2, 14 - PAGE_TOP, C.gray)
  fillRect(b, end + 1, PAGE_TOP + 1, BIN_W, 1, C.darkGray)
  fillRect(b, CLAWD_X - 1, CRATE_Y, 16, 2, C.woodDark)
  fillRect(b, CLAWD_X, CRATE_Y, 14, 1, C.wood)
  setPixel(b, CLAWD_X + 3, CRATE_Y + 1, C.wood)
  setPixel(b, CLAWD_X + 10, CRATE_Y + 1, C.wood)
}

export const stamp: Scene = {
  id: 'stamp',
  loop: LOOP,
  // Just after the second page's stamp: its seal under the lifted stamp.
  still: PER_PAGE + 1.4,
  focusX: STAMP_X,
  backdrop: drawMailroom,
  actors: [
    { kind: 'prop', z: -1, draw: drawBelt },
    {
      kind: 'clawd',
      isHero: true,
      at: () => ({ x: CLAWD_X, y: CLAWD_Y }),
      look: t => ({
        pose: isDown(t) ? 'sit' : 'stand',
        eyes: isDown(t) ? 'closed' : 'open',
        isBlinking: blinking(t, 0.8),
        look: { x: 1, y: 1 },
        arms: { left: 'down', right: 'up' },
      }),
    },
  ],
  // The handle level with the claw's tip: his top row, two lower squatting.
  front: (b, t) => drawSprite(b, STAMP, 0, STAMP_X, CLAWD_Y + (isDown(t) ? 2 : 0)),
}
