// /stage demo waiting: a made-up waiting period of about 25 s. Four
// helpers, one of each known model, arrive in turn; a fifth, of an unknown
// model, waits for a seat and takes the first one freed; they leave one by
// one, Clawd walks back, and the idle routine plays the last seconds.
// It keeps four seats at any width, so the fifth helper still waits; its
// helpers walk from the area's edge as it was when the demo started, and
// on a very wide area the demo lasts as long as their walks need.

import type { ModelKind } from '../agents'
import { AREA_W, CLAWD_ASIDE, CLAWD_HOME, CLAWD_SPEED, freesAt, type SeatEntry, type SeatLog, SEATS } from './seats'

// The demo's length on a 48-column area.
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

function entriesFrom(start: number, edge: number): SeatEntry[] {
  const entries: SeatEntry[] = []
  for (const c of CAST) {
    const arrivedAt = c.arrives === 'first-free' ? freesAt(entries[0]!) : start + c.arrives
    entries.push({ agentId: c.id, seat: c.seat, kind: c.kind, arrivedAt, leftAt: start + c.leaves, edge })
  }

  return entries
}

// When the last helper has walked out, and when Clawd is back home.
function backHome(start: number, edge: number): { backAt: number; until: number } {
  const backAt = Math.max(...entriesFrom(start, edge).map(freesAt))

  return { backAt, until: backAt + ((CLAWD_HOME - CLAWD_ASIDE) / CLAWD_SPEED) * 1000 }
}

// The idle routine plays at least this long at the end.
const IDLE_MIN_MS = 2_000

// The demo's length, from the area's width when it started: 25 s while
// that leaves the idle routine its 2 s (up to about 145 columns), and as
// long as the walks need beyond.
export const waitingDemoMs = (columns: number): number => Math.max(WAITING_DEMO_MS, Math.round(backHome(0, Math.max(AREA_W, columns)).until + IDLE_MIN_MS))

// The demo's seat log at a moment, or, once Clawd is back, how long the
// idle routine has played; columns: the area's width when it started.
export function waitingDemoAt(start: number, now: number, columns = AREA_W): { log: SeatLog } | { idleMs: number } {
  const edge = Math.max(AREA_W, columns)
  const entries = entriesFrom(start, edge)
  const { backAt, until } = backHome(start, edge)
  if (now >= until) return { idleMs: now - until }
  const walk = now < backAt ? { at: start, fromX: CLAWD_HOME, toX: CLAWD_ASIDE } : { at: backAt, fromX: CLAWD_ASIDE, toX: CLAWD_HOME }

  return { log: { entries, queue: [], since: start, until: now < backAt ? null : until, walk, seats: SEATS } }
}
