// Stamp: pages slide along a desk one at a time; each stops beside Clawd,
// who stands on a crate holding a stamp by its knob, and squats to stamp
// it with a green tick before it slides on.

import { createBuffer, fillRect, type PixelBuffer, rightOf, setPixel } from '../pixels'
import { drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, plankOn, still } from './kit'

const PER_PAGE = 1.5
const MOVE_FOR = 1
const GAP = 24
// The loop is three pages long.
const LOOP = PER_PAGE * 3
// Where a page stops under the stamp, and where the desk starts: pages
// further left have gone behind the crate.
const UNDER = 20
const DESK_X = 20
const PAGE_W = 6
const PAGE_H = 3
const PAGE_TOP = 9
// Clawd's top row standing on the crate; squatting, his body drops two
// rows and the stamp with it.
const CLAWD_Y = 2
const CRATE_TOP = 10
const DOWN_FROM = 1.15
const DOWN_TO = 1.35
// The knob is held in Clawd's right claw, which ends at the column before
// the stamp: x 21, the knob's lower row level with the claw.
const STAMP_X = 21
const STAMP: Sprite = { palette: { h: C.woodDark, b: C.darkGray, r: C.red }, frames: [['.hh.', '.hh.', 'bbbb', 'rrrr']] }
// A small tick, three rows like the page.
const SMALL_TICK: Sprite = { palette: { x: C.green }, frames: [['..x', 'x.x', '.x.']] }

// How far the pages have moved, in pixels: 24 per page, then a pause.
function travel(t: number): number {
  const n = every(t, PER_PAGE)
  const f = t - n * PER_PAGE

  return GAP * (n + Math.min(1, f / MOVE_FOR))
}

// A page with a line of text, or stamped with a tick. Columns left of the
// desk are behind the crate and not drawn.
function drawPage(b: PixelBuffer, x: number, isStamped: boolean) {
  const page = createBuffer(PAGE_W, PAGE_H)
  fillRect(page, 0, 0, PAGE_W, PAGE_H, C.paper)
  if (isStamped) drawSprite(page, SMALL_TICK, 0, 1, 0)
  else fillRect(page, 1, 1, 4, 1, C.paperShade)
  for (let dy = 0; dy < PAGE_H; dy++) for (let dx = 0; dx < PAGE_W; dx++) if (x + dx >= DESK_X) setPixel(b, x + dx, PAGE_TOP + dy, page.px[dy * PAGE_W + dx]!)
}

const isDown = (t: number) => t % PER_PAGE >= DOWN_FROM && t % PER_PAGE < DOWN_TO

export const stamp: Scene = {
  id: 'stamp',
  loop: LOOP,
  still: 2.25,
  focusX: 24,
  backdrop: (b, t) => {
    // The crate under Clawd, and the desk beside it.
    fillRect(b, 8, CRATE_TOP, 12, 4, C.woodDark)
    fillRect(b, 9, CRATE_TOP + 1, 10, 2, C.wood)
    fillRect(b, DESK_X, 12, 48 - DESK_X, 1, C.wood)
    fillRect(b, DESK_X + 1, 13, 1, 1, C.woodDark)
    fillRect(b, 46, 13, 1, 1, C.woodDark)
    // On a wider area the desk runs on to the edge, a leg every 25 columns.
    plankOn(b, 48, 12, 1, 46 + 25, 25)
    // A page every GAP columns from the one just past the stamp (gone
    // behind the crate) on to the edge, so pages come in from it rather
    // than out of thin air: the one under the stamp stops at UNDER, the
    // rest at UNDER + GAP and on.
    const behind = ((travel(t) % GAP) + GAP) % GAP
    for (let x = UNDER - behind; x < rightOf(b); x += GAP) {
      const isStamped = x < UNDER || (x === UNDER && t % PER_PAGE >= (DOWN_FROM + DOWN_TO) / 2)
      drawPage(b, x, isStamped)
    }
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(7, CLAWD_Y),
      look: t => ({
        pose: isDown(t) ? 'sit' : 'stand',
        eyes: isDown(t) ? 'closed' : 'open',
        isBlinking: blinking(t, 0.8),
        look: { x: 1, y: 1 },
        arms: { left: 'down', right: 'out' },
      }),
    },
  ],
  // The claw is at row 4 standing and row 6 squatting: the knob's lower row.
  front: (b, t) => drawSprite(b, STAMP, 0, STAMP_X, isDown(t) ? 5 : 3),
}
