// The idle routine a move calls for: Clawd marks the step just finished in
// the next idle period. Into Done he celebrates; out of Done (a new round,
// or a reopen) a random routine takes over, so the celebration ends with
// Done; forward on the track he shows off the prop of the step finished.

import type { IdleId, Progress, Workflow } from '../types'
import { CELEBRATE, pickIdle, showOffId } from './idle'
import { isAdvance } from './stages'
import { isDone, isTrack } from './track'

// The routine for the next idle period, or null to leave the pick as it
// is. The step finished is the track stage left, or, from a side stage, the
// track stage it was entered from. previous: the routine on show, which a
// random pick leaves out.
export function idleForMove(w: Workflow, before: Progress, after: Progress, previous: IdleId | undefined, random: number): IdleId | null {
  if (isDone(after.stage)) return isDone(before.stage) ? null : CELEBRATE
  if (isDone(before.stage)) return pickIdle(previous, random)
  if (!isAdvance(w, before, after)) return null
  const left = isTrack(w, before.stage) ? before.stage : isTrack(w, before.lastTrackStage) ? before.lastTrackStage : null

  return left === null ? null : showOffId(left)
}
