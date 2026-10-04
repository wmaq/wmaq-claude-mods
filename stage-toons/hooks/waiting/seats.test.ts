import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, ended, type Roster, spawned } from '../agents'
import { ARRIVAL_GAP, CLAWD_ASIDE, CLAWD_HOME, clawdX, EMPTY_LOG, freesAt, HOP, helperAt, seat, type SeatLog, WALK_SPEED } from './seats'

const T = 100_000
const rosterOf = (...ids: string[]): Roster => ids.reduce<Roster>((r, id) => spawned(r, id, 'sonnet', 0), EMPTY_ROSTER)
// The log moved on in 50 ms steps from `from` to `to`, the roster fixed.
function run(log: SeatLog, roster: Roster, from: number, to: number, isShown = true): { log: SeatLog; endedAt: number | null } {
  let endedAt: number | null = null
  for (let now = from; now <= to; now += 50) {
    const r = seat(log, roster, now, isShown)
    log = r.log
    endedAt ??= r.endedAt
  }

  return { log, endedAt }
}
const seats = (log: SeatLog) => log.entries.map(e => [e.agentId, e.seat])
// From the seat at x 16 to past the area's edge (48), at WALK_SPEED.
const WALK_FROM_SEAT_0 = ((48 - 16) / WALK_SPEED) * 1000

test('agents at work take the lowest free seats, half a second apart, when the toon is shown', () => {
  const { log } = seat(EMPTY_LOG, rosterOf('a', 'b', 'c'), T, true)
  expect(seats(log)).toEqual([['a', 0], ['b', 1], ['c', 2]])
  expect(log.entries.map(e => e.arrivedAt - T)).toEqual([0, ARRIVAL_GAP, 2 * ARRIVAL_GAP])
  expect(log.since).toBe(T)
  expect(log.walk).toEqual({ at: T, fromX: CLAWD_HOME, toX: CLAWD_ASIDE })
})

test('nothing is stamped while the toon is not shown; agents walk in when it is', () => {
  const hidden = seat(EMPTY_LOG, rosterOf('a'), T, false).log
  expect(hidden).toEqual(EMPTY_LOG)
  const shown = seat(hidden, rosterOf('a'), T + 5000, true).log
  expect(shown.entries[0]?.arrivedAt).toBe(T + 5000)
  expect(helperAt(shown.entries[0]!, T + 5000)?.pose).toBe('walk-in')
})

test('a fifth agent waits for a seat and takes the first one freed, after its helper walked out', () => {
  let roster = rosterOf('a', 'b', 'c', 'd', 'e')
  let { log } = run(EMPTY_LOG, roster, T, T + 4000)
  expect(log.queue).toEqual(['e'])
  roster = ended(roster, 'b', T + 4000)
  log = seat(log, roster, T + 4000, true).log
  const leaving = log.entries.find(e => e.agentId === 'b')!
  expect(leaving.leftAt).toBe(T + 4000)
  // Still walking out: the seat is held.
  log = run(log, roster, T + 4050, freesAt(leaving) - 50).log
  expect(log.queue).toEqual(['e'])
  log = run(log, roster, freesAt(leaving) - 50 + 50, freesAt(leaving) + 100).log
  expect(seats(log)).toEqual([['a', 0], ['c', 2], ['d', 3], ['e', 1]])
  expect(log.queue).toEqual([])
})

test('a seated helper hops, then walks off; its seat frees when it is out of the area', () => {
  let roster = rosterOf('a')
  let { log } = run(EMPTY_LOG, roster, T, T + 3000)
  roster = ended(roster, 'a', T + 3000)
  log = seat(log, roster, T + 3000, true).log
  const e = log.entries[0]!
  expect(freesAt(e)).toBe(T + 3000 + HOP + WALK_FROM_SEAT_0)
  expect(helperAt(e, T + 3100)?.pose).toBe('hop')
  expect(helperAt(e, T + 3000 + HOP + 10)?.pose).toBe('walk-out')
  expect(helperAt(e, freesAt(e))).toBeNull()
})

test('an agent that ends before its helper shows is dropped; one that ends mid walk-in turns round', () => {
  let roster = rosterOf('a', 'b')
  let log = seat(EMPTY_LOG, roster, T, true).log
  // b arrives at T + 500: ending at T + 100, it never shows.
  roster = ended(roster, 'b', T + 100)
  log = seat(log, roster, T + 100, true).log
  expect(seats(log)).toEqual([['a', 0]])
  // a is mid walk-in at T + 600 (it needs 1.33 s to reach seat 0).
  roster = ended(roster, 'a', T + 600)
  log = seat(log, roster, T + 600, true).log
  const a = log.entries[0]!
  const x = helperAt(a, T + 600)!.x
  expect(helperAt(a, T + 650)).toMatchObject({ pose: 'walk-out' })
  expect(helperAt(a, T + 650)!.x).toBeGreaterThanOrEqual(x)
  expect(freesAt(a)).toBeLessThan(T + 600 + HOP + WALK_FROM_SEAT_0)
})

test('the last helper out: Clawd walks back for a second, then the period ends there', () => {
  let roster = rosterOf('a')
  let { log } = run(EMPTY_LOG, roster, T, T + 3000)
  roster = ended(roster, 'a', T + 3000)
  const out = T + 3000 + HOP + WALK_FROM_SEAT_0
  const r = run(log, roster, T + 3000, out + 2000)
  expect(Math.round(r.endedAt!)).toBe(Math.round(out + 1000))
  expect(r.log).toEqual(EMPTY_LOG)
  log = run(log, roster, T + 3000, out + 500).log
  expect(clawdX(log, out + 500)).toBe(6)
})

test('a newcomer during the walk back sends Clawd aside again from where he stands', () => {
  let roster = rosterOf('a')
  let { log } = run(EMPTY_LOG, roster, T, T + 3000)
  roster = ended(roster, 'a', T + 3000)
  const out = T + 3000 + HOP + WALK_FROM_SEAT_0
  log = run(log, roster, T + 3000, out + 500).log
  const x = clawdX(log, out + 500)
  roster = spawned(roster, 'b', 'opus', out + 550)
  log = seat(log, roster, out + 550, true).log
  expect(log.until).toBeNull()
  expect(log.walk).toMatchObject({ at: out + 550, toX: CLAWD_ASIDE })
  expect(Math.abs(log.walk!.fromX - x)).toBeLessThanOrEqual(1)
  expect(clawdX(log, out + 550)).toBe(log.walk!.fromX)
  expect(seats(log)).toEqual([['b', 0]])
})

test('hidden: helpers of agents that stopped vanish, and with nobody at work the period ends at once', () => {
  let roster = rosterOf('a', 'b')
  let { log } = run(EMPTY_LOG, roster, T, T + 3000)
  roster = ended(roster, 'a', T + 3000)
  log = seat(log, roster, T + 3000, false).log
  expect(seats(log)).toEqual([['b', 1]])
  roster = ended(roster, 'b', T + 4000)
  const r = seat(log, roster, T + 4000, false)
  expect(r.log).toEqual(EMPTY_LOG)
  expect(r.endedAt).toBe(T + 4000)
})

test('helpers already walking off vanish when the toon is hidden', () => {
  let roster = rosterOf('a', 'b')
  let { log } = run(EMPTY_LOG, roster, T, T + 3000)
  roster = ended(roster, 'a', T + 3000)
  log = seat(log, roster, T + 3000, true).log
  log = seat(log, roster, T + 3100, false).log
  expect(seats(log)).toEqual([['b', 1]])
})
