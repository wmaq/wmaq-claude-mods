// The seating log: the roster's agents at work as helpers at the desk row,
// each with when it walked in and when it got up to leave, and Clawd's walk
// aside and back. Pure: seat() moves the log on to a moment; where
// everyone stands at a moment is worked out from the log alone.

import { atWork, type ModelKind, type Roster } from '../agents'

export const SEATS = 4
// Each seat's left column on the 48-pixel area.
export const SEAT_X = [16, 24, 32, 40] as const
export const AREA_W = 48
// Clawd's column in the idle box (CLAWD_X) and standing aside.
export const CLAWD_HOME = 12
export const CLAWD_ASIDE = 0
// Helpers walk 24 pixels a second, Clawd 12; arrivals stamped together
// come half a second apart; a leaving helper hops for 0.3 s first.
export const WALK_SPEED = 24
export const CLAWD_SPEED = 12
export const ARRIVAL_GAP = 500
export const HOP = 300

export type SeatEntry = { agentId: string; seat: number; kind: ModelKind; arrivedAt: number; leftAt: number | null }
// Clawd's walk: from fromX at `at`, toward toX, at CLAWD_SPEED.
export type Walk = { at: number; fromX: number; toX: number }
export type SeatLog = { entries: SeatEntry[]; queue: string[]; since: number | null; until: number | null; walk: Walk | null }

export const EMPTY_LOG: SeatLog = { entries: [], queue: [], since: null, until: null, walk: null }

const walkMs = (pixels: number, speed: number) => (Math.abs(pixels) / speed) * 1000

// Where a helper walking in from the right edge stands at a moment.
const walkInX = (e: SeatEntry, now: number) => Math.max(SEAT_X[e.seat]!, AREA_W - ((now - e.arrivedAt) / 1000) * WALK_SPEED)
// When a helper reaches its seat, walking in.
export const seatedAt = (e: SeatEntry): number => e.arrivedAt + walkMs(AREA_W - SEAT_X[e.seat]!, WALK_SPEED)
// Whether the helper had sat down when it got up.
const satAt = (e: SeatEntry, at: number) => at >= seatedAt(e)
// Where a leaving helper starts walking out: its seat, or (turned round
// mid walk-in) where it stood.
const outFrom = (e: SeatEntry, leftAt: number) => (satAt(e, leftAt) ? SEAT_X[e.seat]! : walkInX(e, leftAt))

// When a leaving helper has walked out of the area and its seat is free.
export function freesAt(e: SeatEntry): number {
  if (e.leftAt === null) return Infinity
  const hop = satAt(e, e.leftAt) ? HOP : 0

  return e.leftAt + hop + walkMs(AREA_W - outFrom(e, e.leftAt), WALK_SPEED)
}

export type HelperPose = 'walk-in' | 'seated' | 'hop' | 'walk-out'
export type Helper = { entry: SeatEntry; pose: HelperPose; x: number; stride: number }

// A helper as it stands at a moment, or null before it walks in or after
// it has walked out.
export function helperAt(e: SeatEntry, now: number): Helper | null {
  if (now < e.arrivedAt) return null
  if (e.leftAt === null || now < e.leftAt) {
    if (!satAt(e, now)) return { entry: e, pose: 'walk-in', x: Math.round(walkInX(e, now)), stride: strideAt(now - e.arrivedAt) }

    return { entry: e, pose: 'seated', x: SEAT_X[e.seat]!, stride: 0 }
  }
  if (now >= freesAt(e)) return null
  const hop = satAt(e, e.leftAt) ? HOP : 0
  if (now < e.leftAt + hop) return { entry: e, pose: 'hop', x: SEAT_X[e.seat]!, stride: 0 }
  const from = outFrom(e, e.leftAt)
  const gone = now - e.leftAt - hop

  return { entry: e, pose: 'walk-out', x: Math.round(from + (gone / 1000) * WALK_SPEED), stride: strideAt(gone) }
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
export function seat(log: SeatLog, roster: Roster, now: number, isShown: boolean): { log: SeatLog; endedAt: number | null } {
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
  if (isShown) {
    const known = new Set([...entries.map(e => e.agentId), ...queue])
    queue = [...queue, ...[...working].filter(id => !known.has(id))]
    let last = Math.max(-Infinity, ...entries.map(e => e.arrivedAt))
    while (queue.length > 0) {
      const taken = new Set(entries.map(e => e.seat))
      const free = Array.from({ length: SEATS }, (_, s) => s).find(s => !taken.has(s))
      if (free === undefined) break
      const agentId = queue.shift()!
      const arrivedAt = Math.max(now, last + ARRIVAL_GAP)
      last = arrivedAt
      entries = [...entries, { agentId, seat: free, kind: roster.get(agentId)?.kind ?? 'unknown', arrivedAt, leftAt: null }]
    }
  }
  let { since, until, walk } = log
  if (since === null) {
    if (entries.length === 0) return { log: { ...EMPTY_LOG, queue }, endedAt: null }
    since = Math.min(...entries.map(e => e.arrivedAt))
    walk = { at: since, fromX: CLAWD_HOME, toX: CLAWD_ASIDE }
  }
  const draft: SeatLog = { entries, queue, since, until, walk }
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

  return { log: { entries, queue, since, until, walk }, endedAt: null }
}
