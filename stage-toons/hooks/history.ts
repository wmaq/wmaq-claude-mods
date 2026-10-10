// Stage history: Claude's working time and what its turns cost credited to
// the current entry, and what /stage log and /stage time show. Times are
// wall-clock from one entry to the next (the last runs to now) and Claude's
// working time.

import type { ModelUsage } from 'claude-code'

import type { HistoryEntry, Progress, StageId, Workflow } from '../types'
import { cellWidth, stageLabel } from './stages'
import { isDone, stageIds } from './workflow'

export const LOG_DEFAULT = 15

// The entry the work is in: the last, while its stage is the stage the
// work is in; -1 when there is none (untracked, or the stage moved in
// memory by reconcile).
export function currentIndex(p: Progress): number {
  const i = p.history.length - 1

  return i >= 0 && p.stage !== null && p.history[i]!.stage === p.stage ? i : -1
}

// An entry as working time finds it again after another session's copy
// was adopted: its stage and when it began.
export type EntryKey = { stage: StageId; at: number }

export function currentEntry(p: Progress): EntryKey | null {
  const i = currentIndex(p)

  return i < 0 ? null : { stage: p.history[i]!.stage, at: p.history[i]!.at }
}

// What turns cost: dollars, input tokens (uncached, cache read and cache
// write) and output tokens.
export type Cost = NonNullable<HistoryEntry['cost']>

export const NO_COST: Cost = { usd: 0, in: 0, out: 0 }

const hasCost = (c: Cost | undefined): c is Cost => c !== undefined && (c.usd > 0 || c.in > 0 || c.out > 0)

export const addCost = (a: Cost, b: Cost): Cost => ({ usd: a.usd + b.usd, in: a.in + b.in, out: a.out + b.out })

// A turn's token counts as a cost of no dollars; none when it counted nothing.
export function tokensOf(usage: ModelUsage | undefined): Cost {
  if (usage === undefined) return NO_COST
  const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0)

  return { usd: 0, in: n(usage.input_tokens) + n(usage.cache_read_input_tokens) + n(usage.cache_creation_input_tokens), out: n(usage.output_tokens) }
}

// Claude's working time, and what its turns cost, added to the entry they
// were spent in (the last one so named); with none, or nothing above zero
// to add, the progress as it was. The time is added only when above zero,
// the cost only when any of it is.
export function creditAt(p: Progress, key: EntryKey | null, ms: number, cost?: Cost): Progress {
  const i = key === null ? -1 : p.history.findLastIndex(h => h.stage === key.stage && h.at === key.at)
  const isTime = ms > 0
  const isCost = hasCost(cost)
  if (i < 0 || (!isTime && !isCost)) return p

  return {
    ...p,
    history: p.history.map((h, j) => {
      if (j !== i) return h
      const next = isTime ? { ...h, workMs: (h.workMs ?? 0) + Math.round(ms) } : { ...h }
      if (isCost) next.cost = addCost(h.cost ?? NO_COST, cost)

      return next
    }),
  }
}

export function duration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`

  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export const ago = (ms: number): string =>
  ms < 60_000 ? 'just now' : ms < 3_600_000 ? `${Math.floor(ms / 60_000)}m ago` : ms < 86_400_000 ? `${Math.floor(ms / 3_600_000)}h ago` : `${Math.floor(ms / 86_400_000)}d ago`

// An entry with the time it lasted: to the next entry, or to now for the
// last (none for Done: sitting there is no work on the feature); running is
// the working time of a turn under way, which counts for the current entry.
type Span = { entry: HistoryEntry; wallMs: number; workMs: number; isLast: boolean; isDone: boolean }

function spansOf(p: Progress, now: number, runningMs: number): Span[] {
  const current = currentIndex(p)

  return p.history.map((entry, i) => {
    const end = p.history[i + 1]?.at ?? now
    const isDoneEntry = isDone(entry.stage)

    return {
      entry,
      wallMs: isDoneEntry ? 0 : Math.max(0, end - entry.at),
      workMs: (entry.workMs ?? 0) + (i === current ? Math.max(0, runningMs) : 0),
      isLast: i === p.history.length - 1,
      isDone: isDoneEntry,
    }
  })
}

const featureOf = (entry: HistoryEntry): string | null => entry.feature ?? null
const featureName = (feature: string | null): string => feature ?? '(no feature)'

// A token count as /stage log shows it: 850, 1.2k, 48k, 1.2M, 25M.
export function tokenCount(n: number): string {
  const r = Math.round(Math.max(0, n))
  if (r < 1000) return String(r)
  const [size, unit] = r < 999_500 ? [1e3, 'k'] : r < 999_500_000 ? [1e6, 'M'] : [1e9, 'B']
  const v = r / size

  return `${v < 9.95 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)}${unit}`
}

// A cost as shown: dollars to the cent (rounded here only), then the
// tokens; each left out when zero, so a cost of nothing reads as ''.
export function costText(c: Cost): string {
  const parts: string[] = []
  if (c.usd > 0) parts.push(c.usd < 0.005 ? '<$0.01' : `$${c.usd.toFixed(2)}`)
  if (c.in > 0 || c.out > 0) parts.push(`${tokenCount(c.in)} in, ${tokenCount(c.out)} out`)

  return parts.join(' · ')
}

// isDone: Done's line, which says "done" where the duration would be.
function times(wallMs: number, workMs: number, soFar = false, cost?: Cost, isDone = false): string {
  const spent = cost === undefined ? '' : costText(cost)
  const lasted = isDone ? 'done' : `${duration(wallMs)}${soFar ? ' so far' : ''}`

  return `${lasted} (Claude ${duration(workMs)}${spent === '' ? '' : ` · ${spent}`})`
}
// Columns line up in terminal cells, as the band's text does.
const widest = (texts: string[]): number => texts.reduce((n, t) => Math.max(n, cellWidth(t)), 0)
const pad = (text: string, width: number): string => text + ' '.repeat(Math.max(0, width - cellWidth(text)))

const EMPTY = 'No moves yet: the history starts when the work enters a stage.'
// Under a list that shows a cost: the dollars start at each session's load
// of the mod, so they can fall short of /cost's.
const COST_NOTE = 'Costs count from when stage-toons loaded in each session, so /cost can show more.'
const withCostNote = (lines: string[], spans: Span[]): string[] => (spans.some(s => s.entry.cost !== undefined) ? [...lines, COST_NOTE] : lines)

// /stage log: the last n entries, oldest first, grouped under their feature.
export function logText(w: Workflow, p: Progress, now: number, n: number, runningMs = 0): string {
  const shown = spansOf(p, now, runningMs).slice(-n)
  if (shown.length === 0) return EMPTY
  const labels = shown.map(s => stageLabel(w, s.entry.stage))
  const width = widest(labels)
  const timeWidth = widest(shown.map(s => times(s.wallMs, s.workMs, s.isLast, s.entry.cost, s.isDone)))
  const lines = [`Stage history, last ${shown.length} move${shown.length === 1 ? '' : 's'}:`]
  let group: string | null | undefined
  shown.forEach((s, i) => {
    const feature = featureOf(s.entry)
    if (i === 0 || feature !== group) lines.push(featureName(feature))
    group = feature
    const by = `by ${s.entry.by}${s.entry.via ? `: ${s.entry.via}` : ''}`
    lines.push(`  ${pad(labels[i]!, width)}   ${pad(times(s.wallMs, s.workMs, s.isLast, s.entry.cost, s.isDone), timeWidth)}   ${pad(ago(now - s.entry.at), 8)}   ${by}`)
  })

  return withCostNote(lines, shown).join('\n')
}

// A line's sums; cost only when one of its entries has one.
type Total = { wallMs: number; workMs: number; cost?: Cost }

function add<K>(totals: Map<K, Total>, key: K, s: Span) {
  const t = totals.get(key) ?? { wallMs: 0, workMs: 0 }
  const cost = s.entry.cost === undefined ? t.cost : addCost(t.cost ?? NO_COST, s.entry.cost)
  totals.set(key, { wallMs: t.wallMs + s.wallMs, workMs: t.workMs + s.workMs, ...(cost === undefined ? {} : { cost }) })
}

// /stage time: the kept history's time per feature, the most recent first,
// and per stage, in workflow order and then stages no longer in it.
export function timeText(w: Workflow, p: Progress, now: number, runningMs = 0): string {
  const spans = spansOf(p, now, runningMs)
  if (spans.length === 0) return EMPTY
  const byFeature = new Map<string | null, Total>()
  const lastSeen = new Map<string | null, number>()
  const byStage = new Map<StageId, Total>()
  spans.forEach((s, i) => {
    const key = featureOf(s.entry)
    add(byFeature, key, s)
    lastSeen.set(key, i)
    add(byStage, s.entry.stage, s)
  })
  const features = [...byFeature.keys()].sort((a, b) => lastSeen.get(b)! - lastSeen.get(a)!)
  const ids = stageIds(w)
  const stages = [...ids.filter(id => byStage.has(id)), ...[...byStage.keys()].filter(id => !ids.includes(id))]
  const featureLabels = features.map(featureName)
  const stageLabels = stages.map(id => stageLabel(w, id))
  const width = widest([...featureLabels, ...stageLabels])
  const row = (label: string, t: Total, isDoneRow = false) => `  ${pad(label, width)}   ${times(t.wallMs, t.workMs, false, t.cost, isDoneRow)}`

  return withCostNote([
    'Time per feature:',
    ...features.map((k, i) => row(featureLabels[i]!, byFeature.get(k)!)),
    'Time per stage:',
    ...stages.map((id, i) => row(stageLabels[i]!, byStage.get(id)!, isDone(id))),
    `From the last ${spans.length} move${spans.length === 1 ? '' : 's'}, since ${ago(now - spans[0]!.entry.at)}.`,
  ], spans).join('\n')
}
