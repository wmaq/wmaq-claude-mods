export type TrackStageId =
  | 'roadmap'
  | 'brainstorm'
  | 'spec'
  | 'spec-audit'
  | 'plan'
  | 'plan-audit'
  | 'develop'
  | 'claude-test'
  | 'user-test'
  | 'cleanup'

export type StageId = TrackStageId | 'other'

export type HistoryEntry = { stage: StageId; at: number; by: 'claude' | 'user' }

export type Progress = {
  v: 1
  stage: StageId
  lastTrackStage: TrackStageId | null
  feature: string | null
  message: string
  history: HistoryEntry[]
  updatedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'stage-toons': {
      progress: Progress | null
      auditing: boolean
      hidden: boolean
      workflowText: string | null
      warned: boolean
    }
  }
}
