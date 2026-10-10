// How a move from one stage to another changes the saved progress, and how
// the progress reads, for any workflow (workflow.ts).

import type { HistoryEntry, Progress, StageId } from '../types'
import { VIA_MAX } from './auto'
import { DONE_ID, isDone, standing } from './track'
import { isTrack, rank, stageIds, stageOf, type Workflow, zeroStage } from './workflow'

export const MESSAGE_MAX = 80
export const FEATURE_MAX = 40
export const NOT_TRACKED = 'Not tracked yet'
export const HISTORY_MAX = 200

// One line, whitespace and control characters (a terminal's escapes)
// collapsed to a space, cut with an ellipsis to at most max.
export function cut(text: string, max: number): string {
  const clean = text.replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, ' ').trim()

  return fitText(clean, max)
}

// Text cut by characters (code points), so a cut never splits an emoji's
// surrogate pair.
export function fitText(text: string, width: number): string {
  const chars = Array.from(text)
  if (chars.length <= width) return text

  return width < 1 ? '' : `${chars.slice(0, width - 1).join('')}…`
}

// Terminal cells, as the band measures its lines: wide characters (CJK,
// fullwidth forms, emoji shown as pictures) take two, combining marks,
// joiners and variation selectors none, the rest one. The track's dots and
// lines (U+25xx, U+2500 box drawing) take one.
const WIDE: readonly [number, number][] = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x25fd, 0x25fe], [0x2614, 0x2615],
  [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5],
  [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd],
  [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757],
  [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
  [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff],
  [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e], [0x1f191, 0x1f19a],
  [0x1f200, 0x1f2ff], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f7e0, 0x1f7eb], [0x1f900, 0x1f9ff], [0x1fa70, 0x1faff], [0x20000, 0x3fffd],
]
const NONE: readonly [number, number][] = [[0x0300, 0x036f], [0x200b, 0x200f], [0x20d0, 0x20ff], [0xfe00, 0xfe0f], [0x1f3fb, 0x1f3ff], [0xe0020, 0xe007f]]

const within = (ranges: readonly [number, number][], code: number): boolean => ranges.some(([from, to]) => code >= from && code <= to)

export function cellsOf(char: string): number {
  const code = char.codePointAt(0) ?? 0
  if (within(NONE, code)) return 0

  return within(WIDE, code) ? 2 : 1
}

// Printable ASCII (every common bar) is one cell a character.
export const cellWidth = (text: string): number =>
  /^[\x20-\x7e]*$/.test(text) ? text.length : Array.from(text).reduce((n, ch) => n + cellsOf(ch), 0)

// Text cut to fit width cells, an ellipsis (one cell) where it was cut;
// never through a character.
export function fitCells(text: string, width: number): string {
  if (cellWidth(text) <= width) return text
  if (width < 1) return ''
  let used = 0
  let kept = ''
  for (const ch of Array.from(text)) {
    if (used + cellsOf(ch) > width - 1) break
    used += cellsOf(ch)
    kept += ch
  }

  return `${kept}…`
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
// work is in, which may be untracked. via: why an automatic move happened.
export type Move = { stage: StageId | null; message?: string; feature?: string; by: HistoryEntry['by']; via?: string; at: number }

// Whether a move out of Done goes back to the track stage it came from: the
// undo of a mistaken Done, which reopens the feature.
export const isReopen = (p: Progress, stage: StageId | null): boolean => isDone(p.stage) && stage !== null && !isDone(stage) && stage === p.lastTrackStage

// A move to another stage, or a change of feature in the stage the work is
// in, adds an entry with the feature it leaves; a message alone, or any
// move while untracked, adds none. Any move out of Done but a reopen starts
// a new round: no feature unless the move names one, no track stage to
// return to.
export function applyMove(w: Workflow, p: Progress, m: Move): Progress {
  const isNewStage = m.stage !== p.stage
  const isNewRound = isDone(p.stage) && isNewStage && !isReopen(p, m.stage)
  const entered = stageOf(w, m.stage)?.message ?? p.message
  const message = m.message !== undefined ? cut(m.message, MESSAGE_MAX) : isNewStage ? entered : p.message
  const feature = m.feature !== undefined ? cut(m.feature, FEATURE_MAX) || null : isNewRound ? null : p.feature
  const lastTrackStage = isTrack(w, m.stage) ? m.stage : isNewRound ? null : p.lastTrackStage
  const entry: HistoryEntry = { stage: m.stage ?? '', at: m.at, by: m.by, feature, ...(m.via ? { via: cut(m.via, VIA_MAX) } : {}) }
  const isRecorded = m.stage !== null && (isNewStage || feature !== p.feature)
  const history: HistoryEntry[] = isRecorded ? [...p.history, entry].slice(-HISTORY_MAX) : p.history

  return { ...p, v: 2, stage: m.stage, lastTrackStage, feature, message, history, updatedAt: m.at }
}

// The stage after the one the work stands at: from the last track stage,
// Done; from Done (a new round) or untracked, the first track stage.
export function nextStage(w: Workflow, p: Progress): StageId {
  if (isDone(p.stage) || (!isTrack(w, p.stage) && rank(w, p.lastTrackStage) < 0)) return w.track[0]!.id
  const at = standing(w, p)

  return at >= w.track.length - 1 ? DONE_ID : w.track[at + 1]!.id
}

// From a side stage, back to the track stage left; with none (or from
// untracked), stay put.
export function backStage(w: Workflow, p: Progress): StageId | null {
  if (!isTrack(w, p.stage)) return isTrack(w, p.lastTrackStage) ? p.lastTrackStage! : p.stage

  return w.track[Math.max(rank(w, p.stage) - 1, 0)]!.id
}

// A move to a later track stage (from Done, any track stage: a new round;
// but not a reopen).
export const isAdvance = (w: Workflow, before: Progress, after: Progress): boolean =>
  isTrack(w, after.stage) && rank(w, after.stage) > standing(w, before) && !isReopen(before, after.stage)

// A stage as the bar and /stage name it; an id the workflow no longer has
// (in history) says so.
export function stageLabel(w: Workflow, stage: StageId): string {
  const def = stageOf(w, stage)
  if (!def) return `${stage} (no longer in the workflow)`
  if (isDone(stage)) return `✓ ${def.label}`

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
