// The roster: the agents the mod knows of, the model each runs on, and
// whether it is at work. Fed by agent.spawn (which knows the model), by an
// agent's own turn ending, and by $.agent.list() (which knows the status).

import type { ModelKind } from '../types'
import { isFableModel } from './activity'

export type { ModelKind }
// spawnedAt: when agent.spawn reported it (null for one the list brought);
// endedAt: when its own turn last ended (null while it works).
export type RosterAgent = { id: string; kind: ModelKind; isAtWork: boolean; spawnedAt: number | null; endedAt: number | null }
export type Roster = ReadonlyMap<string, RosterAgent>
// An agent as $.agent.list() gives it, as far as the roster reads it.
export type ListedAgent = { id: string; status: string }

export const EMPTY_ROSTER: Roster = new Map()
// How far the list may lag behind the events: for this long after a spawn
// an agent the list does not show yet is kept, and after an agent's own
// turn ended the list's word that it still runs is not taken as new work.
export const LIST_LAG_MS = 3000

// pending, running and waiting (held) are at work; idle (a teammate
// between turns) is not, nor are completed, failed and killed.
const AT_WORK = new Set(['pending', 'running', 'waiting'])
const IDLE = 'idle'

// Fable first, then Opus, Sonnet and Haiku: the first match wins.
export function modelKind(model: string | undefined): ModelKind {
  if (model === undefined) return 'unknown'
  if (isFableModel(model)) return 'fable'
  const lower = model.toLowerCase()
  for (const kind of ['opus', 'sonnet', 'haiku'] as const) if (lower.includes(kind)) return kind

  return 'unknown'
}

// A spawned agent, at work; one already known keeps its kind when the
// spawn names no model the roster recognises.
export function spawned(roster: Roster, id: string, model: string | undefined, now: number): Roster {
  const kind = modelKind(model)
  const known = roster.get(id)

  return new Map(roster).set(id, { id, kind: kind === 'unknown' && known ? known.kind : kind, isAtWork: true, spawnedAt: now, endedAt: null })
}

// How many agents' kinds the session's state keeps, the newest.
export const KINDS_KEPT = 32

// The kinds by agent id, with this one's added last; an unknown kind adds
// nothing (the same object comes back, so nothing need be written).
export function rememberKind(kinds: Readonly<Record<string, ModelKind>>, id: string, kind: ModelKind): Readonly<Record<string, ModelKind>> {
  if (kind === 'unknown') return kinds
  const { [id]: _, ...rest } = kinds

  return Object.fromEntries(Object.entries({ ...rest, [id]: kind }).slice(-KINDS_KEPT))
}

// The agent's own turn ended: it finished, or (a teammate) went idle.
export function ended(roster: Roster, id: string, now: number): Roster {
  const known = roster.get(id)
  if (!known) return roster

  return new Map(roster).set(id, { ...known, isAtWork: false, endedAt: now })
}

const isFresh = (at: number | null, now: number) => at !== null && now - at < LIST_LAG_MS

// The roster as the list has it: at work by its status; an idle teammate
// kept, not at work, so it keeps its kind; ended and unlisted agents
// dropped, but for one spawned too lately for the list to show it; an
// agent at work or an idle teammate the roster lacks (from before a
// reload) joined with the kind its spawn left (kinds), else as unknown, so
// the list is polled while it lasts. Roster order first, then the list's.
export function reconcileRoster(roster: Roster, list: readonly ListedAgent[], now: number, kinds: Readonly<Record<string, ModelKind>> = {}): Roster {
  const listed = new Map(list.map(a => [a.id, a.status]))
  const next = new Map<string, RosterAgent>()
  for (const agent of roster.values()) {
    const status = listed.get(agent.id)
    if (status === undefined) {
      if (agent.isAtWork && isFresh(agent.spawnedAt, now)) next.set(agent.id, agent)
      continue
    }
    if (!AT_WORK.has(status) && status !== IDLE) continue
    const isAtWork = AT_WORK.has(status) && !isFresh(agent.endedAt, now)
    next.set(agent.id, { ...agent, isAtWork, endedAt: isAtWork ? null : agent.endedAt })
  }
  for (const { id, status } of list) {
    if (next.has(id) || roster.has(id) || (!AT_WORK.has(status) && status !== IDLE)) continue
    next.set(id, { id, kind: kinds[id] ?? 'unknown', isAtWork: AT_WORK.has(status), spawnedAt: null, endedAt: null })
  }

  return next
}

// The agents at work, in the order they joined.
export const atWork = (roster: Roster): RosterAgent[] => [...roster.values()].filter(a => a.isAtWork)
