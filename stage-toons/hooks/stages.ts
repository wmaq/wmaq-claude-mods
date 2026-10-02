// The workflow's stages: ten on the track, in order, and Other beside it,
// with how a move from one to another changes the saved progress.

import type { HistoryEntry, Progress, StageId, TrackStageId } from '../types'

export const TRACK: readonly TrackStageId[] = [
  'roadmap',
  'brainstorm',
  'spec',
  'spec-audit',
  'plan',
  'plan-audit',
  'develop',
  'claude-test',
  'user-test',
  'cleanup',
]
export const STAGE_IDS: readonly StageId[] = [...TRACK, 'other']

export const STAGES: Record<StageId, { label: string; message: string }> = {
  roadmap: { label: 'Roadmap', message: 'Discussing the roadmap and new features' },
  brainstorm: { label: 'Brainstorm', message: 'Brainstorming the feature' },
  spec: { label: 'Spec', message: 'Writing the spec' },
  'spec-audit': { label: 'Spec audit', message: 'Fable is auditing the spec' },
  plan: { label: 'Plan', message: 'Writing the implementation plan' },
  'plan-audit': { label: 'Plan audit', message: 'Fable is auditing the plan' },
  develop: { label: 'Develop', message: 'Building it' },
  'claude-test': { label: 'Claude testing', message: 'Claude is testing the work' },
  'user-test': { label: 'Your testing', message: 'Over to you for testing' },
  cleanup: { label: 'Cleanup', message: 'Cleaning up leftovers, chores and docs' },
  other: { label: 'Other', message: 'Work outside the usual stages' },
}

export const MESSAGE_MAX = 80
export const FEATURE_MAX = 40
export const NOT_TRACKED = 'Not tracked yet'
const HISTORY_MAX = 50

export const isStageId = (x: unknown): x is StageId => typeof x === 'string' && (STAGE_IDS as readonly string[]).includes(x)
export const isTrack = (s: StageId): s is TrackStageId => s !== 'other'
export const rank = (s: TrackStageId | null): number => (s === null ? -1 : TRACK.indexOf(s))

// One line, whitespace collapsed, cut with an ellipsis to at most max.
export function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()

  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

// A stage as /stage takes it: its number on the track, its id, or 0 or ?
// for Other.
export function parseStage(arg: string): StageId | undefined {
  const a = arg.trim().toLowerCase()
  if (a === '0' || a === '?') return 'other'
  if (/^\d+$/.test(a)) {
    const n = Number(a)

    return n >= 1 && n <= TRACK.length ? TRACK[n - 1] : undefined
  }

  return isStageId(a) ? a : undefined
}

export function freshProgress(now: number): Progress {
  return { v: 1, stage: 'other', lastTrackStage: null, feature: null, message: NOT_TRACKED, history: [], updatedAt: now }
}

export type Move = { stage: StageId; message?: string; feature?: string; by: 'claude' | 'user'; at: number }

export function applyMove(p: Progress, m: Move): Progress {
  const isNewStage = m.stage !== p.stage
  const message = m.message !== undefined ? cut(m.message, MESSAGE_MAX) : isNewStage ? STAGES[m.stage].message : p.message
  const feature = m.feature !== undefined ? cut(m.feature, FEATURE_MAX) || null : p.feature
  const lastTrackStage = isTrack(m.stage) ? m.stage : p.lastTrackStage
  const history: HistoryEntry[] = isNewStage ? [...p.history, { stage: m.stage, at: m.at, by: m.by }].slice(-HISTORY_MAX) : p.history

  return { ...p, stage: m.stage, lastTrackStage, feature, message, history, updatedAt: m.at }
}

// Where the work stands on the track: the stage itself, or, from Other, the
// last track stage it left.
const standing = (p: Progress): number => (isTrack(p.stage) ? rank(p.stage) : rank(p.lastTrackStage))

export function nextStage(p: Progress): StageId {
  if (!isTrack(p.stage) && p.lastTrackStage === null) return 'roadmap'

  return TRACK[Math.min(standing(p) + 1, TRACK.length - 1)]!
}

export function backStage(p: Progress): StageId {
  if (!isTrack(p.stage)) return p.lastTrackStage ?? 'other'

  return TRACK[Math.max(rank(p.stage) - 1, 0)]!
}

export const isAdvance = (before: Progress, after: Progress): boolean => isTrack(after.stage) && rank(after.stage) > standing(before)

export const stageLabel = (stage: StageId): string =>
  isTrack(stage) ? `${rank(stage) + 1}/${TRACK.length} ${STAGES[stage].label}` : `? ${STAGES.other.label}`

export const position = (p: Progress): string => stageLabel(p.stage)

export const describe = (p: Progress): string => `${position(p)} · ${p.feature ?? 'no feature'} · "${p.message}"`
