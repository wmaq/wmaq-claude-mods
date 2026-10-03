// A stage's id, as the workflow names it (StageDef.id).
export type StageId = string

export type HistoryEntry = { stage: StageId; at: number; by: 'claude' | 'user' }

export type Progress = {
  v: 2
  // null: the work has not entered a stage yet.
  stage: StageId | null
  lastTrackStage: StageId | null
  feature: string | null
  message: string
  history: HistoryEntry[]
  updatedAt: number
}

// One stage of a workflow (hooks/workflow.ts): what set_stage and /stage
// take, what the bar shows, the status line on entering it, the line that
// tells Claude when to move here, and the scene it plays.
export type StageDef = { id: string; label: string; message: string; when: string; scene: string }

// The stages the work moves through: the track, in order, and the side
// stages, entered from any point and left again.
export type Workflow = { track: readonly StageDef[]; side: readonly StageDef[] }

// The session's workflow and where it came from.
export type SessionWorkflow = { workflow: Workflow; source: 'file' | 'default' }

declare module 'claude-code' {
  interface PluginState {
    'stage-toons': {
      progress: Progress | null
      auditing: boolean
      hidden: boolean
      workflowText: string | null
      workflow: SessionWorkflow | null
      warned: boolean
    }
  }
}
