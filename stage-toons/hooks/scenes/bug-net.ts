// Bug net: a bug flutters about while Clawd watches, net held up; he
// swings, catches it and lifts the net with the bug inside, as the next bug
// flies in.

import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, line, still } from './kit'

const LOOP = 6
const SWING_AT = 3.5
const CAUGHT_AT = 4
const LIFT_AT = 4.6
const LIFTED_AT = 5.2
const NEXT_AT = 5.4
// The catch: where the bug's path comes back to at CAUGHT_AT, and where the
// next bug arrives as the loop ends.
const CATCH = { x: 34, y: 4 }
// The hoop's centre at rest, above Clawd's raised claw (19, 6).
const REST = { x: 19, y: 1 }
const UP_TIP = { x: 19, y: 6 }
const OUT_TIP = { x: 21, y: 8 }
const HOOP: Sprite = { palette: { g: C.gray, s: C.paperShade }, frames: [['.ggg.', 'g.s.g', 'gs.sg', '.ggg.']] }
const BUG: Sprite = { palette: { w: C.white, r: C.red }, frames: [['w.w', '.rr'], ['.w.', '.rr']] }

// The bug's flutter, up and down once a second; at CAUGHT_AT and at the
// loop's end it is at CATCH.
const flutterY = (t: number) => Math.round(CATCH.y + 3 * Math.sin(t * Math.PI * 2))

// The free bug, if one is flying: the one Clawd catches, or the next one
// coming in from the right.
function bugAt(t: number) {
  if (t < CAUGHT_AT) return { x: Math.round(CATCH.x + 8 * Math.sin((t / CAUGHT_AT) * Math.PI * 2)), y: flutterY(t) }
  if (t >= NEXT_AT) return { x: Math.round(lerp(50, CATCH.x, (t - NEXT_AT) / (LOOP - NEXT_AT))), y: flutterY(t) }

  return null
}

const move = (from: { x: number; y: number }, to: { x: number; y: number }, k: number) => ({ x: Math.round(lerp(from.x, to.x, k)), y: Math.round(lerp(from.y, to.y, k)) })

function hoopAt(t: number) {
  if (t < SWING_AT) return REST
  if (t < CAUGHT_AT) return move(REST, CATCH, (t - SWING_AT) / (CAUGHT_AT - SWING_AT))
  if (t < LIFT_AT) return CATCH

  return move(CATCH, REST, (t - LIFT_AT) / (LIFTED_AT - LIFT_AT))
}

// The net is out from the swing until it is lifted back up.
const isSwung = (t: number) => t >= SWING_AT && t < LIFTED_AT

export const bugNet: Scene = {
  id: 'bug-net',
  loop: LOOP,
  focusX: 26,
  actors: [
    {
      kind: 'clawd',
      isHero: true,
      at: still(6, CLAWD_TOP),
      look: t => {
        const bug = bugAt(t)

        return {
          eyes: t >= CAUGHT_AT && t < LIFT_AT ? 'wide' : 'open',
          isBlinking: blinking(t, 1.9),
          look: { x: 1, y: bug === null || bug.y < 3 ? -1 : 0 },
          arms: { left: 'down', right: isSwung(t) ? 'out' : 'up' },
        }
      },
    },
  ],
  front: (b, t) => {
    const hoop = hoopAt(t)
    const tip = isSwung(t) ? OUT_TIP : UP_TIP
    line(b, tip.x, tip.y, hoop.x, hoop.y + 2, C.wood)
    drawSprite(b, HOOP, 0, hoop.x - 2, hoop.y - 1)
    // The caught bug stays in the net.
    if (t >= CAUGHT_AT) drawSprite(b, BUG, every(t, 0.1), hoop.x - 1, hoop.y - 1)
    const bug = bugAt(t)
    if (bug) drawSprite(b, BUG, every(t, 0.1), bug.x - 1, bug.y - 1)
  },
}
