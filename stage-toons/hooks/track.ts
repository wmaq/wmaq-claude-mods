// Where a stage, and the work, sit on the workflow's track. Imports nothing
// but types, so workflow.ts, auto.ts and stages.ts can all use it without an
// import cycle.

import type { Progress, StageId, Workflow } from '../types'

export const isTrack = (w: Workflow, id: StageId | null): boolean => id !== null && w.track.some(s => s.id === id)

// A stage's place on the track from 0, or -1 off it.
export const rank = (w: Workflow, id: StageId | null): number => (id === null ? -1 : w.track.findIndex(s => s.id === id))

// Where the work stands on the track: its track stage, or, from a side
// stage, the last track stage it left; -1 untracked.
export const standing = (w: Workflow, p: Progress): number => (isTrack(w, p.stage) ? rank(w, p.stage) : rank(w, p.lastTrackStage))
