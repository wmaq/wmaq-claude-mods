// The seating log: the roster's agents at work as helpers at the desk row,
// each with when it walked in and when it got up to leave, and Clawd's walk
// aside and back. Pure: seat() moves the log on to a moment; where
// everyone stands at a moment is worked out from the log alone. A wider
// area seats more helpers (the count fixed for the period when it starts),
// and each helper walks in from the area's right edge as it was when it
// arrived, and out to it, so a resize moves nobody.

import { atWork, type ModelKind, type Roster } from '../agents'

// The fewest seats, on a 48-column area, and the most: one more each 8
// columns past 48.
export const SEATS = 4
export const MAX_SEATS = 8
export const AREA_W = 48
export const seatsFor = (columns: number): number => Math.max(SEATS, Math.min(MAX_SEATS, SEATS + Math.floor((columns - AREA_W) / 8)))
// Each seat's left column.
export const seatX = (seat: number): number => 16 + 8 * seat
// Clawd's column in the idle box (CLAWD_X) and standing aside.
export const CLAWD_HOME = 12
export const CLAWD_ASIDE = 0
// Helpers walk 24 pixels a second on a 48-column area, faster on a wider
// one, so the walk to a seat takes about as long up to about 100 columns
// (48 pixels a second at most); Clawd walks 12; arrivals stamped together
// come half a second apart; a leaving helper hops for 0.3 s first.
export const WALK_SPEED = 24
export const MAX_WALK_SPEED = 48
export const CLAWD_SPEED = 12
export const ARRIVAL_GAP = 500
export const HOP = 300

// edge: the area's width (48 at least) when the helper arrived, where it
// walks in from and out to; x, the column it stands at when that isn't its
// seat's (a spot on the DJ's dance floor).
export type SeatEntry = { agentId: string; seat: number; kind: ModelKind; arrivedAt: number; leftAt: number | null; edge: number; x?: number }
// Where a helper stands once it has walked in.
export const homeX = (e: SeatEntry): number => e.x ?? seatX(e.seat)
// Places other than the desk row's seats: how many there are, and each
// one's column (the DJ's dance floor).
export type Spots = { count: number; x: (seat: number) => number }
// Clawd's walk: from fromX at `at`, toward toX, at CLAWD_SPEED.
export type Walk = { at: number; fromX: number; toX: number }
// seats: how many seats the period has (SEATS until one starts).
export type SeatLog = { entries: SeatEntry[]; queue: string[]; since: number | null; until: number | null; walk: Walk | null; seats: number }

export const EMPTY_LOG: SeatLog = { entries: [], queue: [], since: null, until: null, walk: null, seats: SEATS }

const walkMs = (pixels: number, speed: number) => (Math.abs(pixels) / speed) * 1000
// A helper's walking speed, from its edge.
export const walkSpeed = (e: SeatEntry): number => Math.min(MAX_WALK_SPEED, (WALK_SPEED * e.edge) / AREA_W)

// Where a helper walking in from its edge stands at a moment.
const walkInX = (e: SeatEntry, now: number) => Math.max(homeX(e), e.edge - ((now - e.arrivedAt) / 1000) * walkSpeed(e))
// When a helper reaches its seat, walking in.
export const seatedAt = (e: SeatEntry): number => e.arrivedAt + walkMs(e.edge - homeX(e), walkSpeed(e))
// Whether the helper had sat down when it got up.
const satAt = (e: SeatEntry, at: number) => at >= seatedAt(e)
// Where a leaving helper starts walking out: its seat, or (turned round
// mid walk-in) where it stood.
const outFrom = (e: SeatEntry, leftAt: number) => (satAt(e, leftAt) ? homeX(e) : walkInX(e, leftAt))

// When a leaving helper has walked out of the area and its seat is free.
export function freesAt(e: SeatEntry): number {
  if (e.leftAt === null) return Infinity
  const hop = satAt(e, e.leftAt) ? HOP : 0

  return e.leftAt + hop + walkMs(e.edge - outFrom(e, e.leftAt), walkSpeed(e))
}

export type HelperPose = 'walk-in' | 'seated' | 'hop' | 'walk-out'
export type Helper = { entry: SeatEntry; pose: HelperPose; x: number; stride: number }

// A helper as it stands at a moment, or null before it walks in or after
// it has walked out.
export function helperAt(e: SeatEntry, now: number): Helper | null {
  if (now < e.arrivedAt) return null
  if (e.leftAt === null || now < e.leftAt) {
    if (!satAt(e, now)) return { entry: e, pose: 'walk-in', x: Math.round(walkInX(e, now)), stride: strideAt(now - e.arrivedAt) }

    return { entry: e, pose: 'seated', x: homeX(e), stride: 0 }
  }
  if (now >= freesAt(e)) return null
  const hop = satAt(e, e.leftAt) ? HOP : 0
  if (now < e.leftAt + hop) return { entry: e, pose: 'hop', x: homeX(e), stride: 0 }
  const from = outFrom(e, e.leftAt)
  const gone = now - e.leftAt - hop

  return { entry: e, pose: 'walk-out', x: Math.round(from + (gone / 1000) * walkSpeed(e)), stride: strideAt(gone) }
}

// A step every 125 ms, four to a stride.
const strideAt = (ms: number) => Math.floor(ms / 125) % 4

// Clawd's column at a moment.
export function clawdX(log: SeatLog, now: number): number {
  const w = log.walk
  if (!w) return CLAWD_HOME
  const ms = walkMs(w.toX - w.fromX, CLAWD_SPEED)
  const k = ms === 0 ? 1 : Math.max(0, Math.min(1, (now - w.at) / ms))

  return Math.round(w.fromX + (w.toX - w.fromX) * k)
}

// Whether Clawd is on his way at a moment, and his walk frame.
export function clawdWalking(log: SeatLog, now: number): { facing: number; stride: number } | null {
  const w = log.walk
  if (!w || w.fromX === w.toX) return null
  if (now < w.at || now >= w.at + walkMs(w.toX - w.fromX, CLAWD_SPEED)) return null

  return { facing: Math.sign(w.toX - w.fromX), stride: strideAt(now - w.at) }
}

// The log moved on to `now`: helpers whose agents stopped work get up and
// leave (or, unseen, vanish), seats freed by helpers that walked out go to
// the queue, agents new to the log are stamped when the toon is shown, and
// the waiting period starts and ends. endedAt is when a waiting period
// ended, if one ended in this step: the idle clock restarts there.
// columns: the area's width now, which sets a starting period's seats and
// each newcomer's edge; spots, when given, stand in for the desk row's
// seats (their count for the period, each newcomer's column).
export function seat(log: SeatLog, roster: Roster, now: number, isShown: boolean, columns = AREA_W, spots?: Spots): { log: SeatLog; endedAt: number | null } {
  const working = new Set(atWork(roster).map(a => a.id))
  const freed = log.entries.filter(e => freesAt(e) <= now)
  let entries = log.entries.filter(e => freesAt(e) > now)
  entries = entries.flatMap(e => {
    if (e.leftAt !== null) return isShown ? [e] : []
    if (working.has(e.agentId)) return [e]
    if (!isShown || now < e.arrivedAt) return []

    return [{ ...e, leftAt: now }]
  })
  let queue = log.queue.filter(id => working.has(id))
  if (!isShown && working.size === 0) return { log: EMPTY_LOG, endedAt: log.since === null ? null : now }
  const seats = log.since === null ? (spots?.count ?? seatsFor(columns)) : log.seats
  if (isShown) {
    const known = new Set([...entries.map(e => e.agentId), ...queue])
    queue = [...queue, ...[...working].filter(id => !known.has(id))]
    let last = Math.max(-Infinity, ...entries.map(e => e.arrivedAt))
    while (queue.length > 0) {
      const taken = new Set(entries.map(e => e.seat))
      const free = Array.from({ length: seats }, (_, s) => s).find(s => !taken.has(s))
      if (free === undefined) break
      const agentId = queue.shift()!
      const arrivedAt = Math.max(now, last + ARRIVAL_GAP)
      last = arrivedAt
      entries = [...entries, { agentId, seat: free, kind: roster.get(agentId)?.kind ?? 'unknown', arrivedAt, leftAt: null, edge: Math.max(AREA_W, columns), ...(spots ? { x: spots.x(free) } : {}) }]
    }
  }
  let { since, until, walk } = log
  if (since === null) {
    if (entries.length === 0) return { log: { ...EMPTY_LOG, queue }, endedAt: null }
    since = Math.min(...entries.map(e => e.arrivedAt))
    walk = { at: since, fromX: CLAWD_HOME, toX: CLAWD_ASIDE }
  }
  const draft: SeatLog = { entries, queue, since, until, walk, seats }
  if (entries.length === 0 && queue.length === 0) {
    if (until === null) {
      // The last seat freed: Clawd walks back from that moment.
      const at = freed.length > 0 ? Math.max(...freed.map(freesAt)) : now
      const from = clawdX(draft, at)
      const back: Walk = { at, fromX: from, toX: CLAWD_HOME }
      until = at + walkMs(CLAWD_HOME - from, CLAWD_SPEED)
      walk = back
    }
    if (now >= until) return { log: EMPTY_LOG, endedAt: until }

    return { log: { ...draft, until, walk }, endedAt: null }
  }
  if (until !== null) {
    // A newcomer during the walk back: Clawd turns and walks aside again.
    walk = { at: now, fromX: clawdX(draft, now), toX: CLAWD_ASIDE }
    until = null
  }

  return { log: { entries, queue, since, until, walk, seats }, endedAt: null }
}
