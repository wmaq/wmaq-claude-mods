// Where a stage, and the work, sit on the workflow's track, and Done, the
// stage past it. Imports nothing but types, so workflow.ts, auto.ts and
// stages.ts can all use it without an import cycle.

import type { Progress, StageDef, StageId, Workflow } from '../types'

// Done: the reserved stage past the track, where a finished feature sits
// (after a merge). Every workflow has it; a workflow file may set its
// message, scenes and rules.
export const DONE_ID = 'done'
export const DONE_MESSAGE = 'Merged and done'
export const DONE_SCENES: readonly string[] = ['fireworks', 'rocket', 'victory-lap']

export const isDone = (id: StageId | null): boolean => id === DONE_ID

// Done as a stage, from what the workflow says about it.
export function doneOf(w: Workflow): StageDef {
  const auto = w.done?.auto

  return {
    id: DONE_ID,
    label: 'Done',
    message: w.done?.message ?? DONE_MESSAGE,
    when: 'merged to main: the feature is finished',
    scenes: w.done?.scenes ?? DONE_SCENES,
    ...(auto && auto.length > 0 ? { auto } : {}),
  }
}

// Every stage, in the order the workflow lists them: the track, Done, the
// side stages.
export const allStages = (w: Workflow): StageDef[] => [...w.track, doneOf(w), ...w.side]

export const isTrack = (w: Workflow, id: StageId | null): boolean => id !== null && w.track.some(s => s.id === id)

// A stage's place on the track from 0, or -1 off it.
export const rank = (w: Workflow, id: StageId | null): number => (id === null ? -1 : w.track.findIndex(s => s.id === id))

// Where the work stands on the track: its track stage, or, from a side
// stage, the last track stage it left; -1 untracked, and in Done, where the
// next round starts from the beginning.
export const standing = (w: Workflow, p: Progress): number =>
  isDone(p.stage) ? -1 : isTrack(w, p.stage) ? rank(w, p.stage) : rank(w, p.lastTrackStage)
