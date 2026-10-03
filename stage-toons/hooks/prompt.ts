// What the model is told: the set_stage tool and the system-prompt section
// that lists the stages.

import type { Progress } from '../types'
import { describe } from './stages'
import { DEFAULT_WORKFLOW, stageIds } from './workflow'

export const TOOL = 'set_stage'
export const COMMAND = 'stage'
export const SECTION_ID = 'stage-toons:workflow'

export const toolNameFor = (plugin: string): string => `mcp__${plugin}__${TOOL}`

export const TOOL_DESCRIPTION =
  'Moves the workflow progress bar (stage-toons) to a stage and sets its short status message. ' +
  'Call it when the work moves to a different stage (forwards, backwards or skipping are all fine), ' +
  'and when the focus within a stage changes notably, at most every few minutes. ' +
  "Only the main conversation moves the stage: a subagent's call is refused."

export const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    stage: { type: 'string', enum: stageIds(DEFAULT_WORKFLOW) },
    message: { type: 'string', description: 'What is happening now, present tense, under 80 characters' },
    feature: { type: 'string', description: "The feature's short name, when it is known or changes" },
  },
  required: ['stage', 'message'],
}

// The same text for the same progress and tool name, byte for byte: the
// section sits in the cached part of the prompt.
export function workflowText(p: Progress, toolName: string): string {
  return [
    "Workflow tracker (stage-toons). This project's work moves through these",
    'stages: roadmap (roadmap discussion, new features brainstorming),',
    "brainstorm (one feature's brainstorming), spec (writing the spec),",
    'spec-audit (a Fable subagent audits the spec), plan (writing the',
    'implementation plan), plan-audit (a Fable subagent audits the plan),',
    'develop, claude-test (Claude verifies the work), user-test (the user',
    'tests it), cleanup (leftovers, chores, docs), and other (work that fits',
    'none of them). When the work moves to a different stage, forwards,',
    `backwards or skipping, call ${toolName} with the stage`,
    'and a short present-tense message. Also call it when the focus within a',
    'stage changes notably, but not more than every few minutes. Its result',
    'and any "[stage-toons]" note are the current state.',
    `At session start: ${describe(DEFAULT_WORKFLOW, p)}.`,
  ].join('\n')
}
