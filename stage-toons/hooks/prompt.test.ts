import { expect, test } from 'claude-code/testing'

import { TOOL_DESCRIPTION, TOOL_SCHEMA, toolNameFor, workflowText } from './prompt'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW, stageIds } from './workflow'

test('the workflow section lists every stage, the tool, and the state at session start', () => {
  const p = applyMove(DEFAULT_WORKFLOW, freshProgress(0), { stage: 'plan', feature: 'stage-toons', by: 'claude', at: 1 })
  const text = workflowText(p, 'mcp__stage-toons__set_stage')
  for (const id of stageIds(DEFAULT_WORKFLOW)) expect(text).toContain(id)
  expect(text).toContain('mcp__stage-toons__set_stage')
  expect(text.split('\n').at(-1)).toBe('At session start: 5/10 Plan · stage-toons · "Writing the implementation plan".')
  expect(workflowText({ ...p }, 'x')).toBe(workflowText(p, 'x'))
})

test('the tool schema offers exactly the stage ids', () => {
  expect(TOOL_SCHEMA.properties.stage.enum).toEqual(stageIds(DEFAULT_WORKFLOW))
  expect(TOOL_SCHEMA.required).toEqual(['stage', 'message'])
  expect(toolNameFor('stage-toons')).toBe('mcp__stage-toons__set_stage')
})

test("the tool's description says only the main conversation may call it", () => {
  expect(TOOL_DESCRIPTION).toContain('subagent')
})
