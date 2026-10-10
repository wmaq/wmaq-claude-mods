// Writing desk: Clawd sits on a stool at the left end of a long desk,
// writing sheet after sheet with a quill. Each finished sheet slides off
// down the desk to one of the stacks standing along it every GAP columns,
// to the area's right edge, and the stacks grow in turn, nearest first.
// Then he stops and looks along them, and the loop fades back to the
// stacks it began with. Behind, quiet and dim: the study's wall, with tall
// windows far off and bookcases between them.

import { fillRect, type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { type Area, areaOf, type Scene } from '../scene'
import { blinking, C, every, lerp, reach, still, hash as seededHash } from './kit'
import { fade } from './layers'

const LOOP = 13
// How long Clawd writes; the last sheet lands by 11.6 s on any width.
const WRITE = 8

// Clawd sits on a stool at column 5, his head at row 4 (as low as the
// pop-ups allow): his right claw, held out, ends at column 19 of row 8, the
// quill's shaft runs through 20 down to the sheet at 21. The desk's
// top is row 10, its legs under it to the floor.
const CLAWD_X = 5
const CLAWD_Y = 4
const DESK_Y = 10
const DESK_X = 19
const LEG_EVERY = 19
// The sheet being written, on the desk by his claw, and the stacks along it:
// the first at column 28, then every GAP columns, each a sheet wide, as far
// as the area reaches (up to 150 columns on).
const SHEET_X = 21
const SHEET_W = 5
const FIRST = 28
const GAP = 14
const MAX = 150
// The sheets each stack holds at the loop's start, the sheets it gets in a
// loop, and the pace's bounds: on a narrow desk a sheet takes up to 1.2 s,
// on a wide one 0.38 s, so a stack never waits long for its turn.
const HELD = [2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2] as const
const PER_STACK = 3
const SLOWEST = 1.2
const FASTEST = 0.38
// A sheet's slide: a push, then it glides, slowing, at SPEED columns a second
// on average past the first PUSH seconds.
const PUSH = 0.3
const SPEED = 45

// The study, faded with distance: the windows far, the bookcases nearer.
const WINDOW_FRAME = fade(C.wood, 0.76)
const PANE = fade(C.sky, 0.86)
const PANE_LIT = fade(C.sky, 0.78)
const CASE = fade(C.woodDark, 0.5)
const SHELF = fade(C.wood, 0.7)
const SPINES = [fade(C.red, 0.78), fade(C.blue, 0.78), fade(C.green, 0.8), fade(C.paperShade, 0.84), fade(C.gold, 0.84)] as const

// How many stacks fit along the desk on an area.
const stacksOn = (area: Area) => 1 + Math.floor(reach(area, FIRST, MAX, SHEET_W + 1) / GAP)
const stackX = (k: number) => FIRST + k * GAP

// The loop's sheets on an area: how many, and the time each takes to write.
function paceOf(area: Area): { count: number; each: number } {
  const count = Math.min(stacksOn(area) * PER_STACK, Math.floor(WRITE / FASTEST))

  return { count, each: Math.min(SLOWEST, WRITE / count) }
}

// Sheet k's slide: it leaves the writing spot when it is finished and
// glides, slowing, to its stack (k round the stacks), where it lands on top.
function slideOf(k: number, area: Area): { from: number; to: number; stack: number; lands: number } {
  const { each } = paceOf(area)
  const stack = k % stacksOn(area)
  const from = (k + 1) * each

  return { from, to: stackX(stack), stack, lands: from + PUSH + (stackX(stack) - SHEET_X) / SPEED }
}

const isWriting = (t: number, area: Area) => {
  const { count, each } = paceOf(area)

  return t < count * each
}

// A small hash, for the bookcases' books.
const hash = (n: number) => seededHash(n, 11)

// The study's wall across the area, still: in turn a tall window and a
// bookcase, every BAY columns, the first window over Clawd's corner (on 48 columns, a
// window and a bookcase).
const BAY = 48
function drawStudy(b: PixelBuffer) {
  const { left } = areaOf(b)
  const right = rightOf(b)
  const top = Math.max(topOf(b) + 1, -2)
  for (let bay = Math.floor((left - 40) / BAY); bay * BAY < right; bay++) {
    const x = bay * BAY
    // The window: a frame, two tall panes lit at the top, a sill.
    fillRect(b, x + 1, top, 11, 8 - top, WINDOW_FRAME)
    for (const px of [x + 2, x + 7]) {
      fillRect(b, px, top + 1, 4, 2, PANE_LIT)
      fillRect(b, px, top + 3, 4, 4 - top, PANE)
    }
    fillRect(b, x, 7, 13, 1, WINDOW_FRAME)
    // The bookcase: three shelves of books, its top at row 1.
    const cx = x + 22
    fillRect(b, cx, 1, 16, 13, CASE)
    for (const y of [4, 8, 12]) {
      fillRect(b, cx + 1, y, 14, 1, SHELF)
      let bx = cx + 1
      for (let i = 0; bx < cx + 15; i++) {
        const seed = bay * 97 + y * 13 + i
        const h = 2 + Math.floor(hash(seed) * 2)
        if (hash(seed + 5) > 0.15) fillRect(b, bx, y - h, 1, h, SPINES[Math.floor(hash(seed + 3) * SPINES.length)]!)
        bx += 1 + (hash(seed + 9) < 0.3 ? 1 : 0)
      }
    }
  }
}

// A sheet, one row on the desk.
const sheet = (b: PixelBuffer, x: number, y: number, color: number = C.paper) => fillRect(b, x, y, SHEET_W, 1, color)

// The stool under Clawd, and the desk from just past his claw to the edge,
// a leg every LEG_EVERY columns; on it the sheets sliding along, passing
// behind the stacks, and the stacks, alternating shades, each as tall as
// the sheets it held and those landed on it.
function drawDesk(b: PixelBuffer, t: number) {
  const area = areaOf(b)
  const right = rightOf(b)
  fillRect(b, CLAWD_X + 3, 12, 8, 1, C.woodDark)
  fillRect(b, CLAWD_X + 4, 13, 1, 1, C.woodDark)
  fillRect(b, CLAWD_X + 9, 13, 1, 1, C.woodDark)
  fillRect(b, DESK_X, DESK_Y, right - DESK_X, 1, C.wood)
  for (let x = DESK_X + 1; x < right; x += LEG_EVERY) fillRect(b, x, DESK_Y + 1, 1, 13 - DESK_Y, C.woodDark)
  const { count, each } = paceOf(area)
  const heights = Array.from({ length: stacksOn(area) }, (_, i) => HELD[i % HELD.length]!)
  for (let k = 0; k < count; k++) {
    const s = slideOf(k, area)
    if (t < s.from) break
    if (t >= s.lands) {
      heights[s.stack]!++
      continue
    }
    // Pushed, then gliding and slowing to a stop.
    const u = (t - s.from) / (s.lands - s.from)
    sheet(b, Math.round(lerp(SHEET_X, s.to, 1 - (1 - u) * (1 - u))), DESK_Y - 1)
  }
  heights.forEach((h, i) => {
    for (let p = 0; p < h; p++) sheet(b, stackX(i), DESK_Y - 1 - p, p % 2 === 0 ? C.paper : C.paperShade)
  })
  if (!isWriting(t, area)) return
  // The sheet being written: the words appear across it as he writes.
  const into = (t % each) / each
  sheet(b, SHEET_X, DESK_Y - 1)
  for (const i of [1, 3]) if (i < into * SHEET_W) setPixel(b, SHEET_X + i, DESK_Y - 1, C.ink)
}

// The quill in Clawd's claw: the shaft from the sheet's first column up
// through the claw's tip, the feather leaning back over the claw, wagging
// while he writes.
function drawQuill(b: PixelBuffer, t: number) {
  const isWagging = isWriting(t, areaOf(b)) && every(t, 0.15) % 2 === 0
  setPixel(b, SHEET_X - 1, DESK_Y - 2, C.white)
  setPixel(b, SHEET_X - 2, DESK_Y - 3, C.white)
  setPixel(b, isWagging ? SHEET_X - 2 : SHEET_X - 3, DESK_Y - 4, C.white)
}

export const writingDesk: Scene = {
  id: 'writing-desk',
  loop: LOOP,
  still: 6.4,
  fadesAtLoop: true,
  focusX: 16,
  backdrop: drawStudy,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(CLAWD_X, CLAWD_Y),
      // Eyes on the sheet while he writes, then along the stacks.
      look: (t, area) => ({
        pose: 'sit',
        isBlinking: blinking(t, 1),
        look: { x: 1, y: isWriting(t, area) ? 1 : 0 },
        arms: { left: 'down', right: 'out' },
      }),
    },
  ],
  front: (b, t) => {
    drawDesk(b, t)
    drawQuill(b, t)
  },
}
