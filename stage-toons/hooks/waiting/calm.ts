// The waiting toon held still (calm mode): the seat log turned into a
// frozen log and moment that waitingFrame draws as it draws any frame.
// Every helper present (arrived, not yet left) sits at its seat, as if it
// had sat down at the period's start; the rest are left out; Clawd stands
// aside with his cup. The moment is the period's start plus
// WAITING_STILL_S, so the work is held there: the walls part built, the
// oars at one stroke, each box marked by every present helper whose seat
// it has passed.

import { CLAWD_ASIDE, CLAWD_HOME, type SeatEntry, seatedAt, type SeatLog } from './seats'

// Seconds into the period: no spark over a laptop, every laptop's light lit
// (seats 0 to 7), no box just marked (marks land on the half second, and
// flash for FLASH_MS), and Clawd neither sipping nor blinking.
export const WAITING_STILL_S = 7.93

// Whether a helper is at the scene now: it has arrived and not yet left.
export const isPresent = (e: SeatEntry, now: number): boolean => e.arrivedAt <= now && (e.leftAt === null || now < e.leftAt)

export type CalmView = { log: SeatLog; now: number; present: string[] }

// The frozen log and moment for a waiting period at `now`, and the present
// agents' ids, sorted: the picture changes exactly when they do. A log
// with no period yet is taken to start now.
export function calmView(log: SeatLog, now: number): CalmView {
  const since = log.since ?? now
  const entries = log.entries.filter(e => isPresent(e, now)).map(e => ({ ...e, leftAt: null, arrivedAt: since - (seatedAt(e) - e.arrivedAt) }))
  // Clawd's walk aside, long over.
  const walk = { at: since - 60_000, fromX: CLAWD_HOME, toX: CLAWD_ASIDE }

  return { log: { ...log, since, entries, walk }, now: since + WAITING_STILL_S * 1000, present: entries.map(e => e.agentId).sort() }
}
