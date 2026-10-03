import { expect, test } from 'claude-code/testing'

import { TOOL_DESCRIPTION, toolNameFor, toolSchema, workflowText } from './prompt'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW as W, stageIds, type Workflow } from './workflow'

const SMALL: Workflow = {
  track: [
    { id: 'plan', label: 'Plan', message: 'Planning', when: 'planning the work', scene: 'stepping-stones' },
    { id: 'build', label: 'Build', message: 'Building', when: 'writing the code', scene: 'bricklaying' },
  ],
  side: [{ id: 'debugging', label: 'Debugging', message: 'Hunting a bug', when: 'finding and fixing a bug', scene: 'mystery-box' }],
}

test('the workflow section lists every stage, the tool, and the state at session start', () => {
  const p = applyMove(W, freshProgress(0), { stage: 'plan', feature: 'stage-toons', by: 'claude', at: 1 })
  const text = workflowText(W, p, 'mcp__stage-toons__set_stage')
  for (const id of stageIds(W)) expect(text).toContain(id)
  expect(text).toContain('mcp__stage-toons__set_stage')
  expect(text).toContain('If mcp__stage-toons__set_stage is listed as a deferred tool, load it first with ToolSearch (query "select:mcp__stage-toons__set_stage").')
  expect(text.split('\n').at(-1)).toBe('At session start: 5/10 Plan · stage-toons · "Writing the implementation plan".')
  expect(workflowText(W, { ...p }, 'x')).toBe(workflowText(W, p, 'x'))
})

test('the section is built from the workflow: the track in order, then the side stages, each with when', () => {
  const text = workflowText(SMALL, freshProgress(0), 'set_stage')
  expect(text).toContain('stages, in order: plan (planning the work), build (writing the code).')
  expect(text).toContain('Side stages, entered from any point and left again: debugging (finding and fixing a bug).')
  expect(workflowText({ track: SMALL.track, side: [] }, freshProgress(0), 'set_stage')).not.toContain('Side stages')
})

test('the tool schema offers exactly the stage ids', () => {
  expect(toolSchema(W).properties.stage.enum).toEqual(stageIds(W))
  expect(toolSchema(SMALL).properties.stage.enum).toEqual(['plan', 'build', 'debugging'])
  expect(toolSchema(W).required).toEqual(['stage', 'message'])
  expect(toolNameFor('stage-toons')).toBe('mcp__stage-toons__set_stage')
})

test("the tool's description says only the main conversation may call it", () => {
  expect(TOOL_DESCRIPTION).toContain('subagent')
})
