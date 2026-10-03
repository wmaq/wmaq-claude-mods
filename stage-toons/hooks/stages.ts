// How a move from one stage to another changes the saved progress, and how
// the progress reads, for any workflow (workflow.ts).

import type { HistoryEntry, Progress, StageId } from '../types'
import { isTrack, rank, stageIds, stageOf, type Workflow, zeroStage } from './workflow'

export const MESSAGE_MAX = 80
export const FEATURE_MAX = 40
export const NOT_TRACKED = 'Not tracked yet'
const HISTORY_MAX = 50

// One line, whitespace collapsed, cut with an ellipsis to at most max.
export function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()

  return fitText(clean, max)
}

// Text measured and cut by characters (code points), so a cut never
// splits an emoji's surrogate pair.
export const charCount = (text: string): number => Array.from(text).length

export function fitText(text: string, width: number): string {
  const chars = Array.from(text)
  if (chars.length <= width) return text

  return width < 1 ? '' : `${chars.slice(0, width - 1).join('')}…`
}

// A stage as /stage takes it: its number on the track, its id, or 0 or ?
// for the workflow's zero stage (Other, else its first side stage).
export function parseStage(w: Workflow, arg: string): StageId | undefined {
  const a = arg.trim().toLowerCase()
  if (a === '0' || a === '?') return zeroStage(w)?.id
  if (/^\d+$/.test(a)) {
    const n = Number(a)

    return n >= 1 && n <= w.track.length ? w.track[n - 1]!.id : undefined
  }

  return stageIds(w).includes(a) ? a : undefined
}

export function freshProgress(now: number): Progress {
  return { v: 2, stage: null, lastTrackStage: null, feature: null, message: NOT_TRACKED, history: [], updatedAt: now }
}

// A move to a stage, or, for a feature or message move, to the stage the
// work is in, which may be untracked.
export type Move = { stage: StageId | null; message?: string; feature?: string; by: 'claude' | 'user'; at: number }

export function applyMove(w: Workflow, p: Progress, m: Move): Progress {
  const isNewStage = m.stage !== p.stage
  const entered = stageOf(w, m.stage)?.message ?? p.message
  const message = m.message !== undefined ? cut(m.message, MESSAGE_MAX) : isNewStage ? entered : p.message
  const feature = m.feature !== undefined ? cut(m.feature, FEATURE_MAX) || null : p.feature
  const lastTrackStage = isTrack(w, m.stage) ? m.stage : p.lastTrackStage
  const history: HistoryEntry[] = isNewStage && m.stage !== null ? [...p.history, { stage: m.stage, at: m.at, by: m.by }].slice(-HISTORY_MAX) : p.history

  return { ...p, v: 2, stage: m.stage, lastTrackStage, feature, message, history, updatedAt: m.at }
}

// Where the work stands on the track: the stage itself, or, from a side
// stage, the last track stage it left.
const standing = (w: Workflow, p: Progress): number => (isTrack(w, p.stage) ? rank(w, p.stage) : rank(w, p.lastTrackStage))

export function nextStage(w: Workflow, p: Progress): StageId {
  if (!isTrack(w, p.stage) && rank(w, p.lastTrackStage) < 0) return w.track[0]!.id

  return w.track[Math.min(standing(w, p) + 1, w.track.length - 1)]!.id
}

// From a side stage, back to the track stage left; with none (or from
// untracked), stay put.
export function backStage(w: Workflow, p: Progress): StageId | null {
  if (!isTrack(w, p.stage)) return isTrack(w, p.lastTrackStage) ? p.lastTrackStage! : p.stage

  return w.track[Math.max(rank(w, p.stage) - 1, 0)]!.id
}

export const isAdvance = (w: Workflow, before: Progress, after: Progress): boolean =>
  isTrack(w, after.stage) && rank(w, after.stage) > standing(w, before)

// A stage as the bar and /stage name it; an id the workflow no longer has
// (in history) says so.
export function stageLabel(w: Workflow, stage: StageId): string {
  const def = stageOf(w, stage)
  if (!def) return `${stage} (no longer in the workflow)`

  return isTrack(w, stage) ? `${rank(w, stage) + 1}/${w.track.length} ${def.label}` : `${def.label} (side stage)`
}

export const position = (w: Workflow, p: Progress): string => (p.stage === null ? NOT_TRACKED : stageLabel(w, p.stage))

export const describe = (w: Workflow, p: Progress): string =>
  p.stage === null ? `${NOT_TRACKED} · ${p.feature ?? 'no feature'}` : `${position(w, p)} · ${p.feature ?? 'no feature'} · "${p.message}"`

// The progress fitted to a workflow it may not match: a stage the workflow
// doesn't have goes back to the last track stage, else to untracked; a last
// track stage no longer on the track is forgotten. In memory only: it keeps
// updatedAt and the history, and says what moved.
export function reconcile(w: Workflow, p: Progress): { progress: Progress; moved: string | null } {
  const last = isTrack(w, p.lastTrackStage) ? p.lastTrackStage : null
  if (p.stage === null || stageOf(w, p.stage)) return { progress: last === p.lastTrackStage ? p : { ...p, lastTrackStage: last }, moved: null }
  const stage = last
  const progress = { ...p, stage, lastTrackStage: last, message: stage === null ? NOT_TRACKED : stageOf(w, stage)!.message }
  const where = stage === null ? 'not tracked yet' : `back to ${stageLabel(w, stage)}`

  return { progress, moved: `the saved stage "${p.stage}" is not in this workflow: ${where}` }
}
