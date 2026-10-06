import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, ended, type Roster, spawned } from '../agents'
import { CLAWD_ORANGE } from '../clawd'
import type { PixelBuffer } from '../pixels'
import { C, FLAG } from '../scenes/kit'
import { CUP, HELPER_COLORS, WAITING_SCENE_IDS, waitingFrame } from '.'
import { COURSE_S, WALL, wallAt } from './building'
import { waitingDemoAt } from './demo'
import { EMPTY_LOG, seat, seatedAt, type SeatLog } from './seats'

const T = 100_000
const where = (b: PixelBuffer, color: number) => [...b.px].flatMap((c, i) => (c === color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))
const inSeat = (b: PixelBuffer, color: number, seat: number) => where(b, color).filter(p => p.x >= 16 + 8 * seat && p.x < 23 + 8 * seat)

// The log with these models' agents seated, moved on in 50 ms steps to `to`.
function seated(models: readonly string[], to = T + 5000): SeatLog {
  const roster = models.reduce<Roster>((r, m, i) => spawned(r, `a${i}`, m, 0), EMPTY_ROSTER)
  let log = EMPTY_LOG
  for (let now = T; now <= to; now += 50) log = seat(log, roster, now, true).log

  return log
}

// The laptops are 0.10.0's toon, pixel for pixel: a hash of its frames over
// the waiting demo, taken on 0.10.0's code before the scenes were split.
test("the laptops draw 0.10.0's waiting toon, pixel for pixel", () => {
  let h = 0x811c9dc5
  for (let ms = 0; ms < 25_000; ms += 50) {
    const at = waitingDemoAt(T, T + ms)
    if (!('log' in at)) continue
    for (const c of waitingFrame(at.log, T + ms, 'laptops').px) h = Math.imul(h ^ (c & 0xffffff), 0x01000193) >>> 0
  }
  expect(h.toString(16)).toBe('d5201a5f')
})

test('every scene: each seated helper in its colour at its seat, Clawd aside at column 0 with his cup', () => {
  const log = seated(['sonnet', 'opus', 'fable', 'haiku'])
  for (const scene of WAITING_SCENE_IDS) {
    for (let s = 5; s < 17; s += 0.5) {
      const b = waitingFrame(log, T + s * 1000, scene)
      for (const [seat, kind] of (['sonnet', 'opus', 'fable', 'haiku'] as const).entries()) expect(inSeat(b, HELPER_COLORS[kind], seat).length).toBeGreaterThan(5)
      expect(where(b, CLAWD_ORANGE).some(p => p.x === 0)).toBe(true)
      expect(where(b, CUP).length).toBeGreaterThan(1)
    }
  }
})

test("building: a course every 1.5 s of the helper's own clock, the lift, five courses and the flag, then over again", () => {
  expect(wallAt(-1)).toEqual({ courses: 0, hasFlag: false, isLifting: false })
  expect(wallAt(0.8)).toEqual({ courses: 0, hasFlag: false, isLifting: true })
  expect(wallAt(1.5).courses).toBe(1)
  expect(wallAt(7.4)).toEqual({ courses: 4, hasFlag: false, isLifting: true })
  expect(wallAt(7.5)).toEqual({ courses: 5, hasFlag: true, isLifting: false })
  expect(wallAt(11.9).hasFlag).toBe(true)
  expect(wallAt(12.1)).toEqual({ courses: 0, hasFlag: false, isLifting: false })
  const log = seated(['opus'])
  const sat = seatedAt(log.entries[0]!)
  const wallTop = (b: PixelBuffer) => Math.min(...inSeat(b, WALL, 0).map(p => p.y))
  expect(inSeat(waitingFrame(log, sat + 1000, 'building'), WALL, 0)).toEqual([])
  expect(wallTop(waitingFrame(log, sat + 3 * COURSE_S * 1000 + 100, 'building'))).toBe(8)
  const flagged = waitingFrame(log, sat + 8000, 'building')
  expect(wallTop(flagged)).toBe(4)
  expect(inSeat(flagged, FLAG.palette.f!, 0).length).toBeGreaterThan(0)
  // Lifting: a brick of the kit's over its head on row 8.
  const lifting = waitingFrame(log, sat + 2 * COURSE_S * 1000 + 1000, 'building')
  expect(inSeat(lifting, C.brick, 0).map(p => p.y)).toEqual([8, 8, 8])
})

test("building: a helper's wall stops when it gets up, stands while it walks out, and goes with it", () => {
  const roster = spawned(EMPTY_ROSTER, 'a0', 'opus', 0)
  const log = seated(['opus'], T + 9000)
  const leftAt = T + 9000
  const gone = seat(log, ended(roster, 'a0', leftAt), leftAt, true).log
  // Above the helpers' rows: the walker covers the wall's foot.
  const high = (b: PixelBuffer) => inSeat(b, WALL, 0).filter(p => p.y < 8).length
  const before = high(waitingFrame(gone, leftAt - 50, 'building'))
  expect(before).toBeGreaterThan(0)
  expect(high(waitingFrame(gone, leftAt + 400, 'building'))).toBe(before)
  expect(high(waitingFrame(gone, leftAt + 1000, 'building'))).toBe(before)
  expect(inSeat(waitingFrame(gone, leftAt + 2000, 'building'), WALL, 0)).toEqual([])
})
