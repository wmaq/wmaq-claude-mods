// Building, a waiting scene: each helper stands in front of a brick wall
// that rises behind it in its seat's seven columns, a course every 1.5 s,
// the helper lifting each brick over its head; at five courses a flag goes
// up, and after 12 s the wall starts over.

import { fillRect, type PixelBuffer, setPixel } from '../pixels'
import { drawSprite } from '../scene'
import { C, FLAG } from '../scenes/kit'
import { drawStanding, HELPER_COLORS, type WaitingCtx, type WaitingScene, workTime } from './draw'
import { type Helper, seatX } from './seats'

export const COURSE_S = 1.5
export const COURSES = 5
export const WALL_CYCLE_S = 12
// The wall a shade darker than the kit's brick, so a helper in Clawd's
// orange stands out in front of it; the brick it lifts in the kit's.
export const WALL = 0x7f3a2a
export const WALL_MORTAR = 0xa88f74
// The helper's top row: it stands on the bottom row.
const TOP = 9

// The wall's courses at a helper's work time, whether its flag is up, and
// whether the helper is lifting the next brick.
export function wallAt(work: number): { courses: number; hasFlag: boolean; isLifting: boolean } {
  if (work < 0) return { courses: 0, hasFlag: false, isLifting: false }
  const cycle = work % WALL_CYCLE_S
  const courses = Math.min(COURSES, Math.floor(cycle / COURSE_S))

  return { courses, hasFlag: courses === COURSES, isLifting: courses < COURSES && cycle % COURSE_S >= COURSE_S / 2 }
}

// Course k (from 0, the bottom) of a wall at column x: two rows of brick,
// a mortar joint every fourth column, staggered every other course.
function drawCourse(b: PixelBuffer, x: number, k: number) {
  const y = 12 - 2 * k
  fillRect(b, x, y, 7, 2, WALL)
  for (let i = 0; i < 7; i++) {
    if ((i + 2 * (k % 2)) % 4 !== 3) continue
    setPixel(b, x + i, y, WALL_MORTAR)
    setPixel(b, x + i, y + 1, WALL_MORTAR)
  }
}

// The walls stand while their helpers are at their seats, hop off and walk
// out, held as they were when the helper got up.
function drawWalls(b: PixelBuffer, { helpers, now }: WaitingCtx) {
  for (const h of helpers) {
    if (h.pose === 'walk-in') continue
    const x = seatX(h.entry.seat)
    const wall = wallAt(workTime(h, now))
    for (let k = 0; k < wall.courses; k++) drawCourse(b, x, k)
    if (wall.hasFlag) drawSprite(b, FLAG, 0, x + 2, 0)
  }
}

function drawBuilder(b: PixelBuffer, h: Helper, { now }: WaitingCtx) {
  // A jump up off its spot, the wall left standing.
  if (h.pose === 'hop') return drawStanding(b, h, h.x, TOP - 1, 'out')
  if (!wallAt(workTime(h, now)).isLifting) return drawStanding(b, h, h.x, TOP, 'out')
  // A brick held over its head, a claw on either side of it.
  drawStanding(b, h, h.x, TOP, 'none')
  const color = HELPER_COLORS[h.entry.kind]
  setPixel(b, h.x + 1, TOP - 1, color)
  setPixel(b, h.x + 5, TOP - 1, color)
  fillRect(b, h.x + 2, TOP - 1, 3, 1, C.brick)
}

export const BUILDING: WaitingScene = { under: drawWalls, helper: drawBuilder }
