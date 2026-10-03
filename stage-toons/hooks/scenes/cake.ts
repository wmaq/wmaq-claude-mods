// Cake: Clawd carries out a cake with a lit candle, sets it on a table for
// you and waves; then he picks it up again and carries it back.

import { fillRect } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp } from './kit'

const LOOP = 8
const HOME = 2
const AT_TABLE = 16
const WALK_FOR = 1.6
const SET_FOR = 0.4
const PICK_AT = 5.6
const BACK_AT = PICK_AT + SET_FOR
const TABLE = { x: 29, y: 10, w: 13 }
const ON_TABLE = { x: 32, y: TABLE.y - 5 }
// The flame flickers between two frames.
const CAKE: Sprite = {
  palette: { y: C.gold, r: C.red, w: C.white, p: C.paper },
  frames: [
    ['...y...', '...w...', '.wwwww.', 'rrrrrrr', 'ppppppp'],
    ['...r...', '...w...', '.wwwww.', 'rrrrrrr', 'ppppppp'],
  ],
}

function clawdX(t: number): number {
  if (t < WALK_FOR) return Math.round(lerp(HOME, AT_TABLE, t / WALK_FOR))
  if (t < BACK_AT) return AT_TABLE

  return Math.round(lerp(AT_TABLE, HOME, (t - BACK_AT) / WALK_FOR))
}

// Where the cake is: on Clawd's claw (its bottom row at the claw's tip), on
// the table, or moving between them.
function cakeAt(t: number) {
  const held = { x: clawdX(t) + 14, y: CLAWD_TOP + 2 - 4 }
  if (t < WALK_FOR || t >= BACK_AT) return held
  const k = t < PICK_AT ? (t - WALK_FOR) / SET_FOR : 1 - (t - PICK_AT) / SET_FOR

  return { x: Math.round(lerp(held.x, ON_TABLE.x, k)), y: Math.round(lerp(held.y, ON_TABLE.y, k)) }
}

const isWalking = (t: number) => t < WALK_FOR || (t >= BACK_AT && t < BACK_AT + WALK_FOR)
const isWaving = (t: number) => t >= WALK_FOR + SET_FOR + 0.4 && t < PICK_AT - 0.4

export const cake: Scene = {
  id: 'cake',
  loop: LOOP,
  focusX: 23,
  backdrop: b => {
    fillRect(b, TABLE.x, TABLE.y, TABLE.w, 1, C.wood)
    fillRect(b, TABLE.x + 1, TABLE.y + 1, 1, 3, C.woodDark)
    fillRect(b, TABLE.x + TABLE.w - 2, TABLE.y + 1, 1, 3, C.woodDark)
  },
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: t => ({ x: clawdX(t), y: CLAWD_TOP }),
      look: t => {
        if (isWalking(t)) return { pose: 'walk', stride: every(t, 0.15), facing: t < WALK_FOR ? 1 : -1, arms: { left: 'down', right: 'out' } }
        if (isWaving(t)) return { look: { x: 0, y: 1 }, isBlinking: blinking(t, 0.3), arms: { left: every(t, 0.3) % 2 === 0 ? 'up' : 'out', right: 'down' } }

        return { isBlinking: blinking(t, 0.3), look: { x: 1, y: 0 }, arms: { left: 'down', right: 'out' } }
      },
    },
  ],
  front: (b, t) => {
    const at = cakeAt(t)
    drawSprite(b, CAKE, every(t, 0.2), at.x, at.y)
  },
}
