// Bug net: a bug flutters about while Clawd watches, net held up: it loops
// round behind him and back out in front, and as it heads off again he
// swings, catches it and lifts the net with the bug inside, as the next bug
// flies in. On a wider area a meadow's flowers grow along the ground past
// him, and the next bug flies in from above.

import { fillRect, type PixelBuffer, rightOf, setPixel, topOf } from '../pixels'
import { CLAWD_TOP, drawSprite, type Scene, type Sprite } from '../scene'
import { blinking, C, every, lerp, line, still } from './kit'
import { tileOn, WINGS_X } from './wings'

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
// How far left the bug's loop takes it: past Clawd's body (x 7 to 19).
const LOOP_LEFT = 24
// The loop's dip below the catch's height, deepening as it goes: behind
// Clawd it skims his back, half hidden; in front it crosses his middle.
const dipAt = (t: number) => 2 + 3 * (t / CAUGHT_AT)
// Halfway round, at Clawd's left, the bug comes from behind him to in front.
const isBehind = (t: number) => t < CAUGHT_AT / 2

// The free bug, if one is flying: the one Clawd catches, looping round him
// first, or the next one coming in from the right.
function bugAt(t: number) {
  if (t < CAUGHT_AT) {
    const k = Math.sin((t / CAUGHT_AT) * Math.PI)

    return { x: Math.round(CATCH.x - LOOP_LEFT * k), y: Math.round(CATCH.y + dipAt(t) * k) }
  }
  if (t >= NEXT_AT) return { x: Math.round(lerp(50, CATCH.x, (t - NEXT_AT) / (LOOP - NEXT_AT))), y: flutterY(t) }

  return null
}

// On an area wider than 50 columns the entry from x 50 would show the
// next bug popping up mid-air, so it flies in from above the area instead,
// a little from the right, over the same 0.6 s, and is at the catch as
// the loop ends, as before.
function fromAbove(t: number, top: number) {
  const k = (t - NEXT_AT) / (LOOP - NEXT_AT)

  return { x: Math.round(lerp(CATCH.x + 6, CATCH.x, k)), y: Math.round(lerp(top - 2, CATCH.y, k)) }
}

// The wings: a flower every FLOWER_EVERY columns, its head a cross of
// petals round a centre at one of a few heights, on a stem with a leaf.
const FLOWER_EVERY = 6
const HEADS = [9, 10, 8, 10, 9, 11]
const PETALS = [C.red, C.white, C.gold, C.blue]

function meadow(b: PixelBuffer) {
  tileOn(b, WINGS_X + 2, FLOWER_EVERY, (x, k) => {
    const y = HEADS[k % HEADS.length]!
    const petals = PETALS[k % PETALS.length]!
    fillRect(b, x, y + 1, 1, 13 - y, C.green)
    setPixel(b, x + (k % 2 === 0 ? 1 : -1), 12, C.green)
    fillRect(b, x - 1, y, 3, 1, petals)
    fillRect(b, x, y - 1, 1, 3, petals)
    setPixel(b, x, y, petals === C.gold ? C.white : C.gold)
  })
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
  still: 0,
  focusX: 26,
  backdrop: meadow,
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
          look: { x: bug !== null && bug.x < 13 ? -1 : 1, y: bug === null || bug.y < 3 ? -1 : 0 },
          arms: { left: 'down', right: isSwung(t) ? 'out' : 'up' },
        }
      },
    },
    // The free bug: behind Clawd on its way round, in front on the way back.
    {
      kind: 'prop',
      z: t => (isBehind(t) ? -1 : 1),
      draw: (b, t) => {
        const bug = t >= NEXT_AT && rightOf(b) > 50 ? fromAbove(t, topOf(b)) : bugAt(t)
        if (bug) drawSprite(b, BUG, every(t, 0.1), bug.x - 1, bug.y - 1)
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
  },
}
