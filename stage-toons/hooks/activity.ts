// What counts as the auditor coming into play, when a tracked auditor has
// gone, and how often a failure may play.

export const FAILURE_GAP_MS = 3000

export const isFableModel = (model: string | undefined): boolean => model !== undefined && /fable/i.test(model)

// A spawn that resolved to Fable is the auditor, unless it only inherited
// Fable from a parent that runs on Fable itself (an Explore agent or a fork
// of a Fable session); naming Fable explicitly always counts.
export const isAuditorSpawn = (spawn: { model?: string; parentModel: string }, resolved: string): boolean =>
  isFableModel(resolved) && (!isFableModel(spawn.parentModel) || isFableModel(spawn.model))

// Tracked auditors the agent list no longer shows as running.
export function staleAuditors(tracked: Iterable<string>, agents: readonly { id: string; status: string }[]): string[] {
  const running = new Set(agents.filter(a => a.status === 'running').map(a => a.id))

  return [...tracked].filter(id => !running.has(id))
}

export const isFailureDue = (lastAt: number | null, now: number): boolean => lastAt === null || now - lastAt >= FAILURE_GAP_MS
