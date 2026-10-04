// Stage history: Claude's working time credited to the current entry, and
// what /stage log and /stage time show. Times are wall-clock from one
// entry to the next (the last runs to now) and Claude's working time.

import type { HistoryEntry, Progress, StageId, Workflow } from '../types'
import { stageLabel } from './stages'
import { stageIds } from './workflow'

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

// Claude's working time added to the entry it was spent in (the last one
// so named); with none, the progress as it was.
export function creditAt(p: Progress, key: EntryKey | null, ms: number): Progress {
  const i = key === null ? -1 : p.history.findLastIndex(h => h.stage === key.stage && h.at === key.at)
  if (i < 0 || !(ms > 0)) return p

  return { ...p, history: p.history.map((h, j) => (j === i ? { ...h, workMs: (h.workMs ?? 0) + Math.round(ms) } : h)) }
}

// Claude's working time added to the current entry.
export const credit = (p: Progress, ms: number): Progress => creditAt(p, currentEntry(p), ms)

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
// last; running is the working time of a turn under way, which counts for
// the current entry.
type Span = { entry: HistoryEntry; wallMs: number; workMs: number; isLast: boolean }

function spansOf(p: Progress, now: number, runningMs: number): Span[] {
  const current = currentIndex(p)

  return p.history.map((entry, i) => {
    const end = p.history[i + 1]?.at ?? now

    return {
      entry,
      wallMs: Math.max(0, end - entry.at),
      workMs: (entry.workMs ?? 0) + (i === current ? Math.max(0, runningMs) : 0),
      isLast: i === p.history.length - 1,
    }
  })
}

const featureOf = (entry: HistoryEntry): string | null => entry.feature ?? null
const featureName = (feature: string | null): string => feature ?? '(no feature)'
const times = (wallMs: number, workMs: number, soFar = false): string => `${duration(wallMs)}${soFar ? ' so far' : ''} (Claude ${duration(workMs)})`
const widest = (texts: string[]): number => texts.reduce((n, t) => Math.max(n, Array.from(t).length), 0)
const pad = (text: string, width: number): string => text + ' '.repeat(Math.max(0, width - Array.from(text).length))

const EMPTY = 'No moves yet: the history starts when the work enters a stage.'

// /stage log: the last n entries, oldest first, grouped under their feature.
export function logText(w: Workflow, p: Progress, now: number, n: number, runningMs = 0): string {
  const shown = spansOf(p, now, runningMs).slice(-n)
  if (shown.length === 0) return EMPTY
  const labels = shown.map(s => stageLabel(w, s.entry.stage))
  const width = widest(labels)
  const timeWidth = widest(shown.map(s => times(s.wallMs, s.workMs, s.isLast)))
  const lines = [`Stage history, last ${shown.length} move${shown.length === 1 ? '' : 's'}:`]
  let group: string | null | undefined
  shown.forEach((s, i) => {
    const feature = featureOf(s.entry)
    if (i === 0 || feature !== group) lines.push(featureName(feature))
    group = feature
    const by = `by ${s.entry.by}${s.entry.via ? `: ${s.entry.via}` : ''}`
    lines.push(`  ${pad(labels[i]!, width)}   ${pad(times(s.wallMs, s.workMs, s.isLast), timeWidth)}   ${pad(ago(now - s.entry.at), 8)}   ${by}`)
  })

  return lines.join('\n')
}

type Total = { wallMs: number; workMs: number }

function add<K>(totals: Map<K, Total>, key: K, s: Span) {
  const t = totals.get(key) ?? { wallMs: 0, workMs: 0 }
  totals.set(key, { wallMs: t.wallMs + s.wallMs, workMs: t.workMs + s.workMs })
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
  const row = (label: string, t: Total) => `  ${pad(label, width)}   ${times(t.wallMs, t.workMs)}`

  return [
    'Time per feature:',
    ...features.map((k, i) => row(featureLabels[i]!, byFeature.get(k)!)),
    'Time per stage:',
    ...stages.map((id, i) => row(stageLabels[i]!, byStage.get(id)!)),
    `From the last ${spans.length} move${spans.length === 1 ? '' : 's'}, since ${ago(now - spans[0]!.entry.at)}.`,
  ].join('\n')
}
