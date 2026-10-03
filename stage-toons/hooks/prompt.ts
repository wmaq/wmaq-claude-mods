// What the model is told: the set_stage tool and the system-prompt section
// that lists the stages.

import type { Progress, StageDef, Workflow } from '../types'
import { describe } from './stages'
import { stageIds } from './workflow'

export const TOOL = 'set_stage'
export const COMMAND = 'stage'
export const SECTION_ID = 'stage-toons:workflow'

export const toolNameFor = (plugin: string): string => `mcp__${plugin}__${TOOL}`

export const TOOL_DESCRIPTION =
  'Moves the workflow progress bar (stage-toons) to a stage and sets its short status message. ' +
  'Call it when the work moves to a different stage (forwards, backwards or skipping are all fine), ' +
  'and when the focus within a stage changes notably, at most every few minutes. ' +
  "Only the main conversation moves the stage: a subagent's call is refused."

export function toolSchema(w: Workflow) {
  return {
    type: 'object',
    properties: {
      stage: { type: 'string', enum: stageIds(w) },
      message: { type: 'string', description: 'What is happening now, present tense, under 80 characters' },
      feature: { type: 'string', description: "The feature's short name, when it is known or changes" },
    },
    required: ['stage', 'message'],
  }
}

const listed = (stages: readonly StageDef[]): string => stages.map(s => `${s.id} (${s.when})`).join(', ')

// The same text for the same workflow, progress and tool name, byte for
// byte: the section sits in the cached part of the prompt.
export function workflowText(w: Workflow, p: Progress, toolName: string): string {
  const lines = ["Workflow tracker (stage-toons). This project's work moves through these", `stages, in order: ${listed(w.track)}.`]
  if (w.side.length > 0) lines.push(`Side stages, entered from any point and left again: ${listed(w.side)}.`)
  lines.push(
    'When the work moves to a different stage, forwards, backwards or',
    `skipping, call ${toolName} with the stage and a short present-tense`,
    'message. Also call it when the focus within a stage changes notably, but',
    'not more than every few minutes. Its result and any "[stage-toons]" note',
    'are the current state.',
    `If ${toolName} is listed as a deferred tool, load it first with ToolSearch (query "select:${toolName}").`,
    `At session start: ${describe(w, p)}.`,
  )

  return lines.join('\n')
}
