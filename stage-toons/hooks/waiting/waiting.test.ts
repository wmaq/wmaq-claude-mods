import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, ended, type Roster, spawned } from '../agents'
import { CLAWD_ORANGE, EYE_DARK, FABLE_VIOLET } from '../clawd'
import type { PixelBuffer } from '../pixels'
import { C } from '../scenes/kit'
import { AREA_H, CUP, HELPER_COLORS, SPARK, waitingFrame } from '.'
import { AREA_W, EMPTY_LOG, seat, type SeatLog } from './seats'

const T = 100_000
const where = (b: PixelBuffer, color: number) => [...b.px].flatMap((c, i) => (c === color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))
const minX = (b: PixelBuffer, color: number) => Math.min(...where(b, color).map(p => p.x))

function seated(...models: string[]): SeatLog {
  const roster = models.reduce<Roster>((r, m, i) => spawned(r, `a${i}`, m, 0), EMPTY_ROSTER)
  let log = EMPTY_LOG
  for (let now = T; now <= T + 5000; now += 50) log = seat(log, roster, now, true).log

  return log
}

test('the frame is the area: 48 x 14 pixels', () => {
  const b = waitingFrame(seated('sonnet'), T + 5000)
  expect([b.w, b.h]).toEqual([AREA_W, AREA_H])
})

test('Clawd walks aside from his idle spot in a second, then stands at the left edge with his cup', () => {
  const log = seated('sonnet')
  // His left claw, held down, is his leftmost pixel: his column.
  expect(minX(waitingFrame(log, T), CLAWD_ORANGE)).toBe(12)
  expect(minX(waitingFrame(log, T + 500), CLAWD_ORANGE)).toBe(6)
  const aside = waitingFrame(log, T + 3500)
  expect(minX(aside, CLAWD_ORANGE)).toBe(0)
  expect(where(aside, CUP).map(p => p.x)).toEqual([14, 15, 14, 15])
})

test('each helper sits at its seat in its model colour, behind a laptop on a desk', () => {
  const b = waitingFrame(seated('claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5'), T + 5000)
  for (const [i, kind] of (['sonnet', 'opus', 'fable', 'haiku'] as const).entries()) {
    const x0 = 16 + 8 * i
    const px = where(b, HELPER_COLORS[kind]).filter(p => p.x >= x0 && p.x < x0 + 8)
    expect(px.length).toBeGreaterThan(12)
    expect(Math.min(...px.map(p => p.y))).toBe(7)
    expect(where(b, C.wood).some(p => p.x === x0 && p.y === 12)).toBe(true)
  }
  expect(HELPER_COLORS.fable).toBe(FABLE_VIOLET)
  expect(HELPER_COLORS.opus).toBe(CLAWD_ORANGE)
  expect(new Set(Object.values(HELPER_COLORS)).size).toBe(5)
  for (const c of [C.violet, C.gray]) expect(Object.values(HELPER_COLORS)).not.toContain(c)
})

test('a helper walking in stands on the bottom row, in front of the desks, eyes ahead', () => {
  const log = seated('sonnet', 'opus')
  const late = seat(log, spawned(spawned(spawned(EMPTY_ROSTER, 'a0', 'sonnet', 0), 'a1', 'opus', 0), 'a2', 'haiku', 0), T + 5050, true).log
  const b = waitingFrame(late, T + 5050 + 600)
  const haiku = where(b, HELPER_COLORS.haiku)
  expect(Math.max(...haiku.map(p => p.y))).toBe(13)
  expect(Math.min(...haiku.map(p => p.x))).toBeGreaterThan(32)
  expect(where(b, EYE_DARK).some(p => p.y === 10)).toBe(true)
})

test('every 2 s a spark pops above one seated helper, moving along the row', () => {
  const log = seated('sonnet', 'opus')
  const sparkX = (s: number) => where(waitingFrame(log, T + s * 1000), SPARK).map(p => p.x)
  expect(sparkX(4.1).length).toBe(5)
  expect(sparkX(4.7)).toEqual([])
  expect(Math.min(...sparkX(4.1))).not.toBe(Math.min(...sparkX(6.1)))
})

test('standing aside, Clawd stays whole and still: column 0 holds his left claw alone, on every frame', () => {
  const log = seated('sonnet')
  for (let s = 1.2; s < 7.2; s += 0.1) {
    const column0 = where(waitingFrame(log, T + s * 1000), CLAWD_ORANGE).filter(p => p.x === 0).map(p => p.y)
    expect(column0).toEqual([9, 10])
  }
})

test("a leaving helper's desk loses its legs as it hops, and is gone while it walks off", () => {
  const roster = spawned(EMPTY_ROSTER, 'a0', 'sonnet', 0)
  const log = seat(seated('sonnet'), ended(roster, 'a0', T + 5050), T + 5050, true).log
  const atSeat = (b: PixelBuffer, color: number) => where(b, color).filter(p => p.x >= 16 && p.x < 24)
  const hop = waitingFrame(log, T + 5050 + 100)
  expect(atSeat(hop, C.woodDark)).toEqual([])
  expect(atSeat(hop, C.wood)).toHaveLength(7)
  const out = waitingFrame(log, T + 5050 + 600)
  expect(atSeat(out, C.wood)).toEqual([])
})
