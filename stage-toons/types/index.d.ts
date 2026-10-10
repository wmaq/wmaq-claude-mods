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
  // What the turns credited to the entry cost: dollars, and input and
  // output tokens (input counts cache reads and writes).
  cost?: { usd: number; in: number; out: number }
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
export type AutoRule = ({ skill: string } | { write: string } | { agent: string } | { bash: string } | { push: string }) & { from?: readonly StageId[] }

// One stage of a workflow (hooks/workflow.ts): what set_stage and /stage
// take, what the bar shows, the status line on entering it, the line that
// tells Claude when to move here, the scenes it may play (one is picked
// each time the work enters it), and the rules that move the work here.
export type StageDef = { id: string; label: string; message: string; when: string; scenes: readonly string[]; auto?: readonly AutoRule[] }

// What a workflow says about Done, the stage past the track (hooks/track.ts):
// its message on entering, its scenes, and the rules that move the work
// there. Each left to its default where the workflow says nothing.
export type DoneDef = { message?: string; scenes?: readonly string[]; auto?: readonly AutoRule[] }

// The stages the work moves through: the track, in order, the side stages,
// entered from any point and left again, and what the workflow says about
// Done (absent: the defaults, no rules).
export type Workflow = { track: readonly StageDef[]; side: readonly StageDef[]; done?: DoneDef }

// How wide the area under the bar may grow (/stage width): a number of
// columns, 48 to 512, or the band's whole width (hooks/width.ts).
export type WidthSetting = number | 'full'

// What a project's workflow file sets for the session's start: whether
// rules move the stage (auto), whether the bar is hidden (hide), whether
// Clawd's pop-ups show (bubbles), how wide the cartoons grow (width) and
// whether they hold still (calm). Each left out where the file says
// nothing, and the person's own setting holds.
export type WorkflowSettings = { auto?: boolean; hide?: boolean; bubbles?: boolean; width?: WidthSetting; calm?: boolean }

// The session's workflow, where it came from, and the file's settings.
// Settings is absent where an older version kept it, or the file sets none.
export type SessionWorkflow = { workflow: Workflow; source: 'file' | 'default'; settings?: WorkflowSettings }

// The scene the work's stage shows, picked when the stage changed (stage is
// null while untracked), the scene each stage showed last in this session
// (never pruned), and each stage's deck: the scenes it still has to play, in
// order (hooks/deck.ts). decks is optional: a state an older version left
// has none, which reads as every deck empty.
export type ScenePick = { stage: StageId | null; scene: string; lastByStage: Record<StageId, string>; decks?: Record<StageId, string[]> }

// An idle routine's name (hooks/idle/).
export type IdleId = string

// The model family an agent runs on, which colours its helper (hooks/agents.ts).
export type ModelKind = 'sonnet' | 'opus' | 'fable' | 'haiku' | 'unknown'

// A task's status in Claude's task list, and the list by task id
// (hooks/tasks.ts): what the bar counts.
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskList = Record<string, TaskStatus>

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
      // The session's cost (in dollars) already credited to the history, or
      // not yet known: every main turn's end credits the cost since, and
      // moves it to the session's cost. Kept across a reload, so dollars are
      // neither lost nor counted twice.
      usdCredited: number | null
      // The id of the module's load that runs now: each load writes its own,
      // so a paint loop an earlier load left running stops (a hot reload
      // cancels only the waits pending as it lands).
      loadId: string | null
      // Claude's task list, as the main conversation's task tools left it:
      // kept across a reload, so the bar's count stays.
      tasks: TaskList
      // Whether Clawd's pop-ups show (/stage bubbles): kept across a reload,
      // as auto is.
      bubbles: boolean
      // How wide the cartoons grow (/stage width): kept across a reload, as
      // bubbles is.
      width: WidthSetting
      // Whether the cartoons hold still (/stage calm): kept across a
      // reload, as bubbles is.
      calm: boolean
      // Whether DJ mode is on (/stage dj): kept across a reload, as calm
      // is.
      dj: boolean
      // Whether the DJ picture has its full light show (/stage dj party):
      // kept across a reload, as dj is.
      djParty: boolean
      // The tokens of the subagent turns that ended since the main turn's
      // last end, credited with its next end: kept across a reload, so a
      // reload mid-turn loses none.
      turnTokens: { usd: number; in: number; out: number }
    }
  }
}
