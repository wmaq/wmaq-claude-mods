// A workflow: the stages the work moves through, on the track in order and
// beside it, each naming the scene it plays. Data and lookups; the default
// is the workflow stage-toons ships with.

import type { StageDef, Workflow } from '../types'

export type { StageDef, Workflow }

// What plays while the work is in no stage of the workflow.
export const UNTRACKED_SCENE = 'mystery-box'

export const DEFAULT_WORKFLOW: Workflow = {
  track: [
    { id: 'roadmap', label: 'Roadmap', message: 'Discussing the roadmap and new features', when: 'roadmap discussion, new features brainstorming', scene: 'road-trip' },
    { id: 'brainstorm', label: 'Brainstorm', message: 'Brainstorming the feature', when: "one feature's brainstorming", scene: 'light-bulbs' },
    { id: 'spec', label: 'Spec', message: 'Writing the spec', when: 'writing the spec', scene: 'writing-desk' },
    { id: 'spec-audit', label: 'Spec audit', message: 'Fable is auditing the spec', when: 'a Fable subagent audits the spec', scene: 'proofread-page' },
    { id: 'plan', label: 'Plan', message: 'Writing the implementation plan', when: 'writing the implementation plan', scene: 'stepping-stones' },
    { id: 'plan-audit', label: 'Plan audit', message: 'Fable is auditing the plan', when: 'a Fable subagent audits the plan', scene: 'proofread-checklist' },
    { id: 'develop', label: 'Develop', message: 'Building it', when: 'building it', scene: 'bricklaying' },
    { id: 'claude-test', label: 'Claude testing', message: 'Claude is testing the work', when: 'Claude verifies the work', scene: 'test-tubes' },
    { id: 'user-test', label: 'Your testing', message: 'Over to you for testing', when: 'the user tests it', scene: 'gift' },
    { id: 'cleanup', label: 'Cleanup', message: 'Cleaning up leftovers, chores and docs', when: 'leftovers, chores, docs', scene: 'sweeping' },
  ],
  side: [
    { id: 'debugging', label: 'Debugging', message: 'Hunting a bug', when: 'finding and fixing a bug, at any point', scene: 'bug-hunt' },
    { id: 'other', label: 'Other', message: 'Work outside the usual stages', when: 'work that fits none of the stages', scene: 'mystery-box' },
  ],
}

export const stageIds = (w: Workflow): string[] => [...w.track, ...w.side].map(s => s.id)

export const stageOf = (w: Workflow, id: string | null): StageDef | undefined =>
  id === null ? undefined : (w.track.find(s => s.id === id) ?? w.side.find(s => s.id === id))

export const isTrack = (w: Workflow, id: string | null): boolean => id !== null && w.track.some(s => s.id === id)

// A stage's place on the track from 0, or -1 off it.
export const rank = (w: Workflow, id: string | null): number => (id === null ? -1 : w.track.findIndex(s => s.id === id))

// Where /stage 0 and /stage ? go: Other, else the first side stage.
export const zeroStage = (w: Workflow): StageDef | undefined => w.side.find(s => s.id === 'other') ?? w.side[0]

export const sceneOf = (w: Workflow, id: string | null): string => stageOf(w, id)?.scene ?? UNTRACKED_SCENE

export function stageList(w: Workflow): string {
  const track = `track: ${w.track.map(s => s.id).join(', ')}`

  return w.side.length > 0 ? `${track}; side: ${w.side.map(s => s.id).join(', ')}` : track
}
