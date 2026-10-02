// Develop: Clawd hammers while a brick wall grows, then starts again.

import { clawdAnchors } from '../clawd'
import { fillRect, setPixel } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene } from '../scene'
import { blinking, BRICK, C, every, still } from './kit'

const WALL_X = 26
const CLAWD_X = 6
const brickAt = (i: number) => {
  const row = Math.floor(i / 5)

  return { x: WALL_X + (i % 5) * 4 + (row % 2 === 1 ? 2 : 0), y: 10 - row * 2 }
}
const isStriking = (t: number) => every(t, 0.25) % 2 === 1

export const develop: Scene = {
  id: 'develop',
  loop: 12,
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
    const laid = Math.min(20, every(t, 0.5))
    for (let i = 0; i < laid; i++) {
      const { x, y } = brickAt(i)
      drawSprite(b, BRICK, 0, x, y)
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
