// A stage's id, as the workflow names it (StageDef.id).
export type StageId = string

// A move in the history: the stage entered (or the feature changed in it),
// when, by whom, the feature it left, why an automatic move happened, and
// Claude's working time while it was the current entry. Entries an older
// version wrote have no feature, via or workMs.
export type HistoryEntry = {
  stage: StageId
  at: number
  by: 'claude' | 'user' | 'auto'
  feature?: string | null
  via?: string
  workMs?: number
}

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

// A rule that moves the work into a stage by itself (hooks/auto.ts): one
// kind, and perhaps the stages it fires from.
export type AutoRule = ({ skill: string } | { write: string } | { agent: string } | { bash: string }) & { from?: readonly StageId[] }

// One stage of a workflow (hooks/workflow.ts): what set_stage and /stage
// take, what the bar shows, the status line on entering it, the line that
// tells Claude when to move here, the scenes it may play (one is picked
// each time the work enters it), and the rules that move the work here.
export type StageDef = { id: string; label: string; message: string; when: string; scenes: readonly string[]; auto?: readonly AutoRule[] }

// The stages the work moves through: the track, in order, and the side
// stages, entered from any point and left again.
export type Workflow = { track: readonly StageDef[]; side: readonly StageDef[] }

// The session's workflow and where it came from.
export type SessionWorkflow = { workflow: Workflow; source: 'file' | 'default' }

// The scene the work's stage shows, picked when the stage changed, and the
// scene each stage showed last in this session (never pruned).
export type ScenePick = { stage: StageId | null; scene: string; lastByStage: Record<StageId, string> }

// An idle routine's name (hooks/idle/).
export type IdleId = string

// The model family an agent runs on, which colours its helper (hooks/agents.ts).
export type ModelKind = 'sonnet' | 'opus' | 'fable' | 'haiku' | 'unknown'

declare module 'claude-code' {
  interface PluginState {
    'stage-toons': {
      progress: Progress | null
      auditing: boolean
      hidden: boolean
      workflowText: string | null
      workflow: SessionWorkflow | null
      warned: boolean
      scene: ScenePick | null
      idle: IdleId | null
      auto: boolean
      // Each agent's kind, by id, as its spawn told it: a reload's roster
      // starts empty, and the agent list names no model.
      agentKinds: Record<string, ModelKind>
    }
  }
}
