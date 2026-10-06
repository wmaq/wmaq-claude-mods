// Yo-yo: Clawd plays with a yo-yo at his side: down and up three times,
// then once around the world.

import { drawClawd } from '../clawd'
import { drawSprite, type Sprite } from '../scene'
import { blinking, C, line } from '../scenes/kit'
import { CLAWD_X } from './doze'
import type { IdleRoutine } from './routine'

const LOOP = 4
const BOB = 0.8
const AROUND_AT = BOB * 3
// The left claw's tip, held out; the yo-yo hangs from it.
const HAND = { x: 10, y: 2 }
const YOYO: Sprite = { palette: { r: C.red, d: C.darkGray }, frames: [['rr', 'dd']] }
const CENTRE = { x: 7, y: 3 }
const RADIUS = 3

// The yo-yo's top-left: bobbing under the hand, or circling CENTRE from
// the hand's side and back.
function yoyoAt(t: number) {
  if (t < AROUND_AT) return { x: HAND.x - 1, y: HAND.y + 1 + Math.round(3 * Math.abs(Math.sin((t / BOB) * Math.PI))) }
  const angle = ((t - AROUND_AT) / (LOOP - AROUND_AT)) * Math.PI * 2

  return { x: Math.round(CENTRE.x + RADIUS * Math.cos(angle)) - 1, y: Math.round(CENTRE.y - RADIUS * Math.sin(angle)) }
}

export const yoYo: IdleRoutine = {
  id: 'yo-yo',
  loop: LOOP,
  still: 2,
  draw: (b, t) => {
    const at = yoyoAt(t)
    line(b, HAND.x, HAND.y, at.x + 1, at.y, C.gray)
    drawSprite(b, YOYO, 0, at.x, at.y)
    drawClawd(b, CLAWD_X, 0, {
      isBlinking: blinking(t, 0.4),
      look: { x: -1, y: at.y > 4 ? 1 : at.y < 2 ? -1 : 0 },
      arms: { left: 'out', right: 'down' },
    })
  },
}
