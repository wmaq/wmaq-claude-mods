// /stage demo waiting: a made-up waiting period of about 25 s. Four
// helpers, one of each known model, arrive in turn; a fifth, of an unknown
// model, waits for a seat and takes the first one freed; they leave one by
// one, Clawd walks back, and the idle routine plays the last seconds.

import type { ModelKind } from '../agents'
import { CLAWD_ASIDE, CLAWD_HOME, CLAWD_SPEED, freesAt, type SeatEntry, type SeatLog } from './seats'

export const WAITING_DEMO_MS = 25_000

// Each helper: its seat, kind, and when it arrives and leaves, from the
// demo's start; the fifth arrives when the first seat frees.
const CAST: { id: string; seat: number; kind: ModelKind; arrives: number | 'first-free'; leaves: number }[] = [
  { id: 'demo-sonnet', seat: 0, kind: 'sonnet', arrives: 0, leaves: 10_000 },
  { id: 'demo-opus', seat: 1, kind: 'opus', arrives: 1_500, leaves: 13_000 },
  { id: 'demo-fable', seat: 2, kind: 'fable', arrives: 3_000, leaves: 15_000 },
  { id: 'demo-haiku', seat: 3, kind: 'haiku', arrives: 4_500, leaves: 17_000 },
  { id: 'demo-other', seat: 0, kind: 'unknown', arrives: 'first-free', leaves: 19_000 },
]

function entriesFrom(start: number): SeatEntry[] {
  const entries: SeatEntry[] = []
  for (const c of CAST) {
    const arrivedAt = c.arrives === 'first-free' ? freesAt(entries[0]!) : start + c.arrives
    entries.push({ agentId: c.id, seat: c.seat, kind: c.kind, arrivedAt, leftAt: start + c.leaves })
  }

  return entries
}

// The demo's seat log at a moment, or, once Clawd is back, how long the
// idle routine has played.
export function waitingDemoAt(start: number, now: number): { log: SeatLog } | { idleMs: number } {
  const entries = entriesFrom(start)
  const backAt = Math.max(...entries.map(freesAt))
  const until = backAt + ((CLAWD_HOME - CLAWD_ASIDE) / CLAWD_SPEED) * 1000
  if (now >= until) return { idleMs: now - until }
  const walk = now < backAt ? { at: start, fromX: CLAWD_HOME, toX: CLAWD_ASIDE } : { at: backAt, fromX: CLAWD_ASIDE, toX: CLAWD_HOME }

  return { log: { entries, queue: [], since: start, until: now < backAt ? null : until, walk } }
}
