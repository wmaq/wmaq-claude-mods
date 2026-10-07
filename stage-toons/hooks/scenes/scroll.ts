// Scroll: Clawd sits writing with a quill while a long scroll unrolls
// across the floor towards the area's right edge, its roll turning as it
// goes and two lines of writing showing behind it; then it rolls back up to
// his claw, and the loop starts again where it began. Behind, quiet and
// dim: a library's arcade of round arches, a candle burning in every other
// bay.

import { fillRect, type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { type Area, areaOf, CLAWD_TOP, type Scene } from '../scene'
import { blinking, C, every, lerp, reach, still } from './kit'
import { fade } from './layers'

const LOOP = 10
// It unrolls over UNROLL seconds, lies open, then rolls up from ROLL_UP_AT
// to the loop's end.
const UNROLL = 7.5
const ROLL_UP_AT = 8.6
// The scroll: from column 18, by Clawd's quill, up to 150 columns on and 5
// short of the edge (the roll's width and two); rows 9 to 13, its edges
// shaded, the writing on rows 10 and 12.
const START_X = 18
const MAX = 150
const SHORTEST = 2
const ROLL_W = 3
const TOP = 9

// The library, faded with distance: the arcade far, the candles nearer.
const STONE = fade(C.gray, 0.8)
const STONE_DARK = fade(C.gray, 0.86)
const CANDLE = fade(C.paperShade, 0.6)
const STAND = fade(C.woodDark, 0.35)
const FLAME = fade(C.gold, 0.5)
const FLAME_LOW = fade(C.gold, 0.62)

// A small hash, for the words' lengths.
const hash = (n: number) => {
  let h = Math.imul(n + 5, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)

  return ((h ^ (h >>> 13)) >>> 0) / 0x100000000
}

const longestOn = (area: Area) => Math.max(SHORTEST, reach(area, START_X, MAX, ROLL_W + 2))

// How far the scroll is open at t: out at a steady pace, then back fast,
// slowing as it reaches the start.
function openAt(t: number, area: Area): number {
  const longest = longestOn(area)
  if (t < ROLL_UP_AT) return Math.round(lerp(SHORTEST, longest, t / UNROLL))
  const u = (t - ROLL_UP_AT) / (LOOP - ROLL_UP_AT)

  return Math.round(lerp(longest, SHORTEST, 1 - (1 - u) * (1 - u)))
}

// The arcade across the area, still: a round arch every BAY columns on its
// pillars, the arches' tops as high as the area allows (row -2 at most);
// in every other bay (not the one behind Clawd) a candle on its stand, its
// flame flickering.
const BAY = 24
function drawLibrary(b: PixelBuffer, t: number) {
  const { left } = areaOf(b)
  const right = rightOf(b)
  const top = Math.max(topOf(b) + 1, -2)
  for (let k = Math.floor((left - BAY) / BAY); k * BAY < right; k++) {
    const x = k * BAY
    // The arch: a quarter circle down from its crown to each pillar, 4 rows.
    const half = BAY / 2 - 1
    for (let c = 0; c <= BAY - 2; c++) {
      const d = Math.abs(c - half) / half
      const y = top + Math.round(4 * (1 - Math.sqrt(1 - d * d)))
      setPixel(b, x + 1 + c, y, STONE)
      setPixel(b, x + 1 + c, y + 1, STONE_DARK)
    }
    fillRect(b, x, top + 4, 2, 14 - top - 4, STONE)
    if (k % 2 === 0) continue
    // The candle, in the bay's middle: a stand, a candle, the flame.
    const cx = x + BAY / 2
    fillRect(b, cx - 1, 13, 3, 1, STAND)
    fillRect(b, cx, 7, 1, 6, STAND)
    fillRect(b, cx - 1, 6, 3, 1, STAND)
    fillRect(b, cx, 4, 1, 2, CANDLE)
    const isHigh = (every(t, 0.2) + k) % 3 !== 0
    setPixel(b, cx, 3, isHigh ? FLAME : FLAME_LOW)
    if (isHigh) setPixel(b, cx, 2, FLAME_LOW)
  }
}

// The scroll, open n columns: the paper, the two lines of words behind the
// roll (each word 1 to 4 columns, two between), and the roll at its
// open end, a dark stripe turning on it as it rolls, the rod's ends above
// and below.
function drawScroll(b: PixelBuffer, n: number) {
  fillRect(b, START_X, TOP, n, 5, C.paper)
  fillRect(b, START_X, TOP, n, 1, C.paperShade)
  fillRect(b, START_X, TOP + 4, n, 1, C.paperShade)
  for (const [line, y] of [
    [0, TOP + 1],
    [1, TOP + 3],
  ] as const) {
    let x = START_X + 2 + line * 3
    for (let w = 0; x < START_X + n - 2; w++) {
      const len = 1 + Math.floor(hash(w * 2 + line) * 4)
      fillRect(b, x, y, Math.min(len, START_X + n - 2 - x), 1, C.ink)
      x += len + 2
    }
  }
  const rx = START_X + n
  fillRect(b, rx, TOP - 1, ROLL_W, 6, C.paperShade)
  fillRect(b, rx + 1, TOP - 1, 1, 6, C.paper)
  setPixel(b, rx + 1, TOP - 2, C.woodDark)
  setPixel(b, rx + ROLL_W - 1 - (Math.floor(n / 2) % ROLL_W), TOP + (Math.floor(n / 2) % 4), C.woodDark)
}

export const scroll: Scene = {
  id: 'scroll',
  loop: LOOP,
  still: 5.1,
  focusX: 17,
  backdrop: drawLibrary,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(2, CLAWD_TOP),
      look: t => ({ pose: 'sit', isBlinking: blinking(t, 0.2), look: { x: 1, y: t < UNROLL ? 1 : 0 }, arms: { left: 'down', right: 'out' } }),
    },
  ],
  front: (b, t) => {
    drawScroll(b, openAt(t, areaOf(b)))
    // The quill in Clawd's claw, which ends at column 16 of row 10: the
    // shaft runs through the claw's tip at 17 to the nib on the scroll's
    // first column, and the feather leans back over the claw, wagging while
    // he writes.
    const isWagging = t < UNROLL && every(t, 0.15) % 2 === 0
    setPixel(b, 18, 11, C.ink)
    setPixel(b, 17, 10, C.white)
    setPixel(b, 16, 9, C.white)
    setPixel(b, isWagging ? 16 : 15, 8, C.white)
  },
}
