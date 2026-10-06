import { expect, test } from 'claude-code/testing'

import { EMPTY_ROSTER, type Roster, spawned } from '../agents'
import { BOX_GAP, beltOrigin, boxesAt } from './conveyor'
import { WAITING_DEMO_MS, waitingDemoAt, waitingDemoMs } from './demo'
import { EMPTY_LOG, helperAt, MAX_WALK_SPEED, seat, seatedAt, seatsFor, seatX, WALK_SPEED, walkSpeed } from './seats'

const T = 100_000
const rosterOf = (...ids: string[]): Roster => ids.reduce<Roster>((r, id) => spawned(r, id, 'sonnet', 0), EMPTY_ROSTER)
const EIGHT = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

test('a wider area seats more helpers: four at 48 columns, one more each 8 columns, eight at most', () => {
  expect([30, 48, 55, 56, 64, 72, 80, 81, 120, 512].map(seatsFor)).toEqual([4, 4, 4, 5, 6, 7, 8, 8, 8, 8])
  expect(EMPTY_LOG.seats).toBe(4)
  expect([0, 4, 7].map(seatX)).toEqual([16, 48, 72])
})

test('the period takes its seat count from the width it starts at', () => {
  const { log } = seat(EMPTY_LOG, rosterOf(...EIGHT), T, true, 80)
  expect(log.seats).toBe(8)
  expect(log.entries.map(e => e.seat)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  const narrow = seat(EMPTY_LOG, rosterOf(...EIGHT), T, true, 48).log
  expect(narrow.seats).toBe(4)
  expect(narrow.entries.length).toBe(4)
  expect(narrow.queue).toEqual(['e', 'f', 'g', 'h'])
})

test('each helper walks in from the edge it arrived at, faster on a wider area', () => {
  const { log } = seat(EMPTY_LOG, rosterOf('a'), T, true, 120)
  const a = log.entries[0]!
  expect(a.edge).toBe(120)
  expect(walkSpeed(a)).toBe(MAX_WALK_SPEED)
  expect(helperAt(a, T)?.x).toBe(120)
  expect(seatedAt(a)).toBe(T + ((120 - 16) / MAX_WALK_SPEED) * 1000)
  expect(walkSpeed({ ...a, edge: 48 })).toBe(WALK_SPEED)
  expect(walkSpeed({ ...a, edge: 72 })).toBe(36)
  // Under 48 columns the helpers still walk from the core's edge.
  expect(seat(EMPTY_LOG, rosterOf('a'), T, true, 30).log.entries[0]?.edge).toBe(48)
})

test('a resize mid-wait moves nobody: seats and edges stay; newcomers take the new edge', () => {
  let log = seat(EMPTY_LOG, rosterOf('a', 'b'), T, true, 120).log
  const before = log.entries.map(e => helperAt(e, T + 700)?.x)
  log = seat(log, rosterOf('a', 'b'), T + 600, true, 60).log
  expect(log.seats).toBe(8)
  expect(log.entries.map(e => e.edge)).toEqual([120, 120])
  expect(log.entries.map(e => helperAt(e, T + 700)?.x)).toEqual(before)
  log = seat(log, rosterOf('a', 'b', 'c'), T + 1200, true, 60).log
  expect(log.entries.map(e => e.edge)).toEqual([120, 120, 60])
})

test('the belt starts past the last seat, and its boxes run on to the edge', () => {
  expect([4, 5, 8].map(beltOrigin)).toEqual([48, 56, 80])
  const xs = boxesAt(0, beltOrigin(4), 120).map(b => b.x)
  // The last box is less than a gap from the edge: the belt is full.
  expect(Math.max(...xs) + BOX_GAP >= 120).toBe(true)
  expect(boxesAt(0, beltOrigin(4), 48).map(b => b.x)).toEqual(boxesAt(0).map(b => b.x))
})

test('the waiting demo keeps four seats, and lasts as long as the walks need at its width', () => {
  expect(waitingDemoMs(48)).toBe(WAITING_DEMO_MS)
  expect(waitingDemoMs(30)).toBe(WAITING_DEMO_MS)
  expect(waitingDemoMs(145)).toBe(WAITING_DEMO_MS)
  expect(waitingDemoMs(512) > WAITING_DEMO_MS).toBe(true)
  const at = waitingDemoAt(0, 5_000, 120)
  expect('log' in at && at.log.seats).toBe(4)
  expect('log' in at && at.log.entries.every(e => e.edge === 120)).toBe(true)
  expect('idleMs' in waitingDemoAt(0, waitingDemoMs(512) - 1, 512)).toBe(true)
})
