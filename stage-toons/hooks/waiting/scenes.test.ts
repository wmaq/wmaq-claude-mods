import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, ended, type Roster, spawned } from '../agents'
import { CLAWD_ORANGE } from '../clawd'
import { getPixel, type PixelBuffer } from '../pixels'
import { C, FLAG } from '../scenes/kit'
import { CUP, HELPER_COLORS, WAITING_SCENE_IDS, waitingFrame } from '.'
import { COURSE_S, WALL, wallAt } from './building'
import { BOX_GAP, boxesAt, boxX, marksOf } from './conveyor'
import { waitingDemoAt } from './demo'
import { bobAt, OAR, SPLASH, strokeAt, WATER } from './rowing'
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

test('rowing: water and the boat, the oars stroking together, a splash at the end of the pull, the bob', () => {
  expect([strokeAt(0), strokeAt(0.8), strokeAt(1.6)]).toEqual([0, 1, 0])
  expect([bobAt(0.2), bobAt(0.6), bobAt(1.7)]).toEqual([-1, 0, -1])
  const log = seated(['sonnet', 'haiku'])
  const at = (s: number) => waitingFrame(log, T + s * 1000, 'rowing')
  expect(where(at(6.6), WATER).every(p => p.y >= 12 && p.x >= 16)).toBe(true)
  // Forward at 6.0 s of the period: the oar's tip right of its helper; back at 6.75 s, left.
  const tip = (b: PixelBuffer, seat: number) => where(b, OAR).filter(p => p.y === 13 && p.x >= 16 + 8 * seat && p.x < 26 + 8 * seat)[0]?.x
  expect(tip(at(6.1), 0)).toBe(25)
  expect(tip(at(6.8), 0)).toBe(20)
  expect(where(at(6.8), SPLASH).filter(p => p.y === 13)).toEqual([])
  expect(where(at(7.4), SPLASH).filter(p => p.y === 13).map(p => p.x)).toEqual([20, 28])
  // The boat's gunwale a row higher while it bobs.
  const gunwale = (b: PixelBuffer) => Math.min(...where(b, C.woodDark).filter(p => p.x === 46).map(p => p.y))
  expect([gunwale(at(6.2)), gunwale(at(6.7))]).toEqual([10, 11])
})

test('conveyor: boxes move left 8 pixels a second, one every 12, and vanish at the belt\'s end', () => {
  expect(boxX(0, 0)).toBe(48)
  expect(boxX(0, 1)).toBe(40)
  expect(boxX(1, 1) - boxX(0, 1)).toBe(BOX_GAP)
  expect(boxesAt(0).map(b => b.x)).toEqual([24, 36])
  expect(boxesAt(1).map(b => b.x)).toEqual([16, 28, 40])
  expect(boxesAt(1.2).map(b => b.x)).toEqual([27, 39])
})

test("conveyor: a box carries the mark of each seat's helper at work as it passed, in its place on the box, gold at first", () => {
  const log = seated(['sonnet', 'opus', 'fable'])
  // Box 1 passes seat 2 (x 32) at 3.5 s of the period, seat 1 (x 24) at 4.5 s, seat 0 at 5.5 s.
  expect(marksOf(log, 1, T + 3400)).toEqual([])
  expect(marksOf(log, 1, T + 3550)).toEqual([{ seat: 2, kind: 'fable', isNew: true }])
  expect(marksOf(log, 1, T + 5000)).toEqual([
    { seat: 1, kind: 'opus', isNew: false },
    { seat: 2, kind: 'fable', isNew: false },
  ])
  const b = waitingFrame(log, T + 5000, 'conveyor')
  const box = boxX(1, 5)
  expect(box).toBe(20)
  expect(getPixel(b, box + 1, 10)).toBe(C.paper)
  expect(getPixel(b, box + 2, 10)).toBe(HELPER_COLORS.opus)
  expect(getPixel(b, box + 3, 10)).toBe(HELPER_COLORS.fable)
  expect(getPixel(waitingFrame(log, T + 3550, 'conveyor'), boxX(1, 3.55) + 3, 10)).toBe(C.gold)
  // A box that passed before the helpers sat carries no mark.
  expect(marksOf(log, -2, T + 5000)).toEqual([])
})

test("conveyor: a helper that left keeps its marks on the boxes it marked while the log still has its entry", () => {
  const roster = spawned(spawned(EMPTY_ROSTER, 'a0', 'sonnet', 0), 'a1', 'opus', 0)
  const log = seated(['sonnet', 'opus'], T + 5000)
  const left = seat(log, ended(roster, 'a1', T + 5000), T + 5000, true).log
  expect(marksOf(left, 1, T + 5600).map(m => m.seat)).toEqual([0, 1])
})

test("every scene: a leaving helper hops a row up out of its place before it walks", () => {
  const roster = spawned(EMPTY_ROSTER, 'a0', 'opus', 0)
  // Left at 9.6 s of the period: 0.1 s later the hop shows, the boat not bobbing.
  const leftAt = T + 9600
  const gone = seat(seated(['opus'], leftAt), ended(roster, 'a0', leftAt), leftAt, true).log
  const top = (scene: (typeof WAITING_SCENE_IDS)[number]) => Math.min(...inSeat(waitingFrame(gone, leftAt + 100, scene), HELPER_COLORS.opus, 0).map(p => p.y))
  expect(WAITING_SCENE_IDS.map(top)).toEqual([6, 8, 7, 6])
})

test('rowing: a helper standing up out of the boat holds no oar', () => {
  const roster = spawned(EMPTY_ROSTER, 'a0', 'opus', 0)
  const leftAt = T + 9600
  const gone = seat(seated(['opus'], leftAt), ended(roster, 'a0', leftAt), leftAt, true).log
  expect(where(waitingFrame(gone, leftAt - 50, 'rowing'), OAR).length).toBeGreaterThan(0)
  expect(where(waitingFrame(gone, leftAt + 100, 'rowing'), OAR)).toEqual([])
})

test("conveyor: a helper's claws come down onto a box as it passes, then go back out", () => {
  const log = seated(['opus'])
  // Box 1 passes seat 0 (x 16) at 5.5 s of the period; the box covers the
  // left claw, the right one shows at column 22.
  const claw = (s: number) => where(waitingFrame(log, T + s * 1000, 'conveyor'), HELPER_COLORS.opus).filter(p => p.x === 22).map(p => p.y)
  expect(boxX(1, 5.5)).toBe(16)
  expect(claw(5.6)).toEqual([10])
  expect(claw(6)).not.toContain(10)
  expect(claw(6).length).toBeGreaterThan(0)
})
