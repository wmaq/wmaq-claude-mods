// Ladder: Clawd builds a ladder rung by rung, climbs it, cheers at the top,
// climbs down and walks back; the rungs come off again, top first. On a
// wider area a wall of shelves stands past the ladder, boxes on them.

import type { ClawdLook } from '../clawd'
import { fillRect, type PixelBuffer } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp } from './kit'
import { shelvesOn, WINGS_X } from './wings'

const LOOP = 10
const RAILS = [28, 32]
const RUNGS = [12, 10, 8, 6, 4, 2]
const RUNG_EVERY = 0.45
const BUILT = 0.2 + RUNG_EVERY * RUNGS.length
const HOME = 11
const ON_LADDER = 23
const TOP = 0
// Clawd's moves: [from, to, x from, x to, y from, y to].
const MOVES: [number, number, number, number, number, number][] = [
  [3, 4, HOME, ON_LADDER, CLAWD_TOP, CLAWD_TOP],
  [4, 6, ON_LADDER, ON_LADDER, CLAWD_TOP, TOP],
  [6, 7, ON_LADDER, ON_LADDER, TOP, TOP],
  [7, 8.5, ON_LADDER, ON_LADDER, TOP, CLAWD_TOP],
  [8.5, 9.5, ON_LADDER, HOME, CLAWD_TOP, CLAWD_TOP],
]
const TAKE_DOWN = 9.5

// The wings: three shelves as tall as the ladder, with cardboard boxes of
// two sizes on them (their lids a shade darker) and a gap here and there.
const CRATES: Sprite = {
  palette: { b: C.road, d: C.dust },
  frames: [
    ['ddddd', 'bbbbb', 'bbbbb'],
    ['....', 'dddd', 'bbbb'],
  ],
}

function storeroom(b: PixelBuffer) {
  shelvesOn(b, WINGS_X + 2, [5, 9, 13], 15, 6, (x, y, k, row) => {
    const n = (k + row * 2) % 5
    if (n !== 3) drawSprite(b, CRATES, n % 2, x, y - 2)
  })
}

function where(t: number) {
  const m = MOVES.find(([from, to]) => t >= from && t < to)
  if (!m) return { x: HOME, y: CLAWD_TOP }
  const k = (t - m[0]) / (m[1] - m[0])

  return { x: Math.round(lerp(m[2], m[3], k)), y: Math.round(lerp(m[4], m[5], k)) }
}

function look(t: number): Partial<ClawdLook> {
  const isClimbing = (t >= 4 && t < 6) || (t >= 7 && t < 8.5)
  if (isClimbing) {
    const isLeft = every(t, 0.3) % 2 === 0

    return { pose: 'walk', stride: every(t, 0.3), look: { x: 0, y: t < 6 ? -1 : 1 }, arms: { left: isLeft ? 'up' : 'out', right: isLeft ? 'out' : 'up' } }
  }
  if (t >= 6 && t < 7) return { pose: 'jump', eyes: 'wide', arms: { left: 'up', right: 'up' } }
  if ((t >= 3 && t < 4) || (t >= 8.5 && t < 9.5)) return { pose: 'walk', stride: every(t, 0.15), facing: t < 4 ? 1 : -1, arms: { left: 'down', right: 'down' } }
  const isPlacing = t < BUILT && (t - 0.2) % RUNG_EVERY < 0.2

  return { isBlinking: blinking(t, 0.5), look: { x: 1, y: 0 }, arms: { left: 'down', right: isPlacing ? 'out' : 'down' } }
}

export const ladder: Scene = {
  id: 'ladder',
  loop: LOOP,
  still: 2.5,
  focusX: 28,
  backdrop: (b, t) => {
    storeroom(b)
    for (const x of RAILS) fillRect(b, x, 1, 1, 13, C.wood)
    RUNGS.forEach((y, k) => {
      const isUp = t >= 0.2 + k * RUNG_EVERY
      // Taken down top first, one every 0.08 s.
      const isDown = t >= TAKE_DOWN + (RUNGS.length - 1 - k) * 0.08
      if (isUp && !isDown) fillRect(b, RAILS[0]! + 1, y, RAILS[1]! - RAILS[0]! - 1, 1, C.woodDark)
    })
  },
  actors: [{ kind: 'clawd', isHero: true, at: where, look }],
}
