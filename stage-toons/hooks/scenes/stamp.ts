// Stamp: pages slide along a desk one at a time; each stops under Clawd's
// stamp, gets stamped with a green tick, and slides on.

import { createBuffer, fillRect, type PixelBuffer, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, still, TICK } from './kit'

const PER_PAGE = 1.5
const MOVE_FOR = 1
const GAP = 24
const PAGES = 3
const LOOP = PER_PAGE * PAGES
// Where a page stops under the stamp, and where the desk starts.
const UNDER = 21
const DESK_X = 14
const DOWN_FROM = 1.15
const DOWN_TO = 1.35
const STAMP: Sprite = { palette: { h: C.woodDark, b: C.darkGray, r: C.red }, frames: [['.hh.', '.hh.', 'bbbb', 'rrrr']] }

// How far the pages have moved, in pixels: 24 per page, then a pause.
function travel(t: number): number {
  const n = every(t, PER_PAGE)
  const f = t - n * PER_PAGE

  return GAP * (n + Math.min(1, f / MOVE_FOR))
}

// A page with a line of text, or stamped with a tick. Columns left of the
// desk are behind Clawd and not drawn.
function drawPage(b: PixelBuffer, x: number, isStamped: boolean) {
  const page = createBuffer(6, 4)
  fillRect(page, 0, 0, 6, 4, C.paper)
  if (isStamped) drawSprite(page, TICK, 0, 1, 0)
  else fillRect(page, 1, 1, 4, 1, C.paperShade)
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 6; dx++) if (x + dx >= DESK_X) setPixel(b, x + dx, 8 + dy, page.px[dy * 6 + dx]!)
}

const isDown = (t: number) => t % PER_PAGE >= DOWN_FROM && t % PER_PAGE < DOWN_TO

export const stamp: Scene = {
  id: 'stamp',
  loop: LOOP,
  focusX: 24,
  backdrop: (b, t) => {
    fillRect(b, DESK_X, 12, 48 - DESK_X, 1, C.wood)
    fillRect(b, DESK_X + 1, 13, 1, 1, C.woodDark)
    fillRect(b, 46, 13, 1, 1, C.woodDark)
    const moved = travel(t)
    for (let i = 0; i < PAGES; i++) {
      // Pages stop at UNDER - GAP (gone behind Clawd), UNDER and UNDER + GAP.
      const x = UNDER - GAP + ((((GAP * (i + 2) - moved) % (GAP * PAGES)) + GAP * PAGES) % (GAP * PAGES))
      const isStamped = x < UNDER || (x === UNDER && t % PER_PAGE >= (DOWN_FROM + DOWN_TO) / 2)
      drawPage(b, x, isStamped)
    }
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(7, CLAWD_TOP),
      look: t => ({
        eyes: isDown(t) ? 'closed' : 'open',
        isBlinking: blinking(t, 0.8),
        look: { x: 1, y: 1 },
        arms: { left: 'down', right: isDown(t) ? 'out' : 'up' },
      }),
    },
  ],
  front: (b, t) => drawSprite(b, STAMP, 0, UNDER, isDown(t) ? 4 : 2),
}
