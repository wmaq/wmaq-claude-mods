// Bricklaying: Clawd hammers while a brick wall grows; the finished wall
// slides away to the right, out at the area's edge however wide it is, and
// he starts the next one.

import { clawdAnchors } from '../clawd'
import { fillRect, rightOf, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, BRICK, C, every, still } from './kit'

const WALL_X = 26
const CLAWD_X = 6
const brickAt = (i: number) => {
  const row = Math.floor(i / 5)

  return { x: WALL_X + (i % 5) * 4 + (row % 2 === 1 ? 2 : 0), y: 12 - row * 2 }
}
const BRICKS = 20
const PER_BRICK = 0.5
const BUILT_AT = BRICKS * PER_BRICK
const SLIDE_FROM = BUILT_AT + 0.5
const LOOP = 12
// Far enough for the whole wall, from its left end at WALL_X, to leave the
// area: 22 on a bare stage. On a wider area it goes out at the real edge in
// the same time, a faster whoosh.
const slideBy = (edge: number) => edge - WALL_X
const isStriking = (t: number) => t < BUILT_AT && every(t, 0.25) % 2 === 1

export const bricklaying: Scene = {
  id: 'bricklaying',
  loop: LOOP,
  still: 7.5,
  focusX: 24,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(CLAWD_X, CLAWD_TOP),
      look: t => ({ facing: 1, isBlinking: blinking(t, 1.5), arms: { left: 'down', right: isStriking(t) ? 'out' : 'up' } }),
    },
  ],
  front: (b, t) => {
    const laid = Math.min(BRICKS, every(t, PER_BRICK))
    const slid = t < SLIDE_FROM ? 0 : Math.round(((t - SLIDE_FROM) / (LOOP - SLIDE_FROM)) * slideBy(rightOf(b)))
    for (let i = 0; i < laid; i++) {
      const { x, y } = brickAt(i)
      drawSprite(b, BRICK, 0, x + slid, y)
    }
    // The hammer in Clawd's right claw: raised, or struck out with a spark.
    const tip = clawdAnchors({ arms: { left: 'down', right: isStriking(t) ? 'out' : 'up' } }).right
    const x = CLAWD_X + tip.x
    const y = CLAWD_TOP + tip.y
    if (isStriking(t)) {
      fillRect(b, x + 1, y - 1, 1, 3, C.gray)
      setPixel(b, x + 2, y, C.gold)
    } else {
      fillRect(b, x - 1, y - 1, 3, 1, C.gray)
    }
  },
}
