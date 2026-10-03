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

export const RESERVED_IDS = ['next', 'back', 'hide', 'demo', 'feature', 'message', 'workflow'] as const
export const TRACK_MAX = 15
export const SIDE_MAX = 5

const FIELDS = ['id', 'label', 'message', 'when', 'scene'] as const
type Field = (typeof FIELDS)[number]
const LIMITS: Record<Field, number> = { id: 24, label: 20, message: 80, when: 120, scene: 64 }
const ID = /^[a-z][a-z0-9-]{0,23}$/
// Library scenes a stage can't use, and why.
const NOT_FOR_STAGES: Record<string, string> = {
  'fable-audit': 'plays while a Fable subagent runs, whatever the stage',
  standing: 'is the fallback for a scene that breaks',
}

const chars = (text: string): number => Array.from(text).length

function stageAt(item: unknown, path: string, errors: string[], sceneNames: readonly string[]): StageDef | null {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    errors.push(`${path}: not a stage (an object with ${FIELDS.join(', ')})`)

    return null
  }
  const raw = item as Record<string, unknown>
  const before = errors.length
  for (const key of Object.keys(raw)) if (!(FIELDS as readonly string[]).includes(key)) errors.push(`${path}.${key}: not a field (${FIELDS.join(', ')})`)
  const text: Partial<Record<Field, string>> = {}
  for (const field of FIELDS) {
    const value = raw[field]
    if (value === undefined) errors.push(`${path}.${field}: missing`)
    else if (typeof value !== 'string') errors.push(`${path}.${field}: must be text`)
    else if (value.trim() === '') errors.push(`${path}.${field}: empty`)
    else if (chars(value.trim()) > LIMITS[field]) errors.push(`${path}.${field}: ${chars(value.trim())} characters, at most ${LIMITS[field]}`)
    else text[field] = value.trim()
  }
  const { id, scene } = text
  if (id !== undefined && !ID.test(id)) errors.push(`${path}.id "${id}": lowercase letters, digits and dashes, starting with a letter`)
  else if (id !== undefined && (RESERVED_IDS as readonly string[]).includes(id)) {
    errors.push(`${path}.id "${id}" is one of /stage's words (${RESERVED_IDS.join(', ')})`)
  }
  if (scene !== undefined && NOT_FOR_STAGES[scene] !== undefined) errors.push(`${path}.scene "${scene}" ${NOT_FOR_STAGES[scene]}; a stage can't use it`)
  else if (scene !== undefined && !sceneNames.includes(scene)) errors.push(`${path}.scene "${scene}" is not a scene (${sceneNames.join(', ')})`)

  return errors.length === before ? { id: text.id!, label: text.label!, message: text.message!, when: text.when!, scene: text.scene! } : null
}

function stagesAt(value: unknown, name: 'track' | 'side', min: number, max: number, errors: string[], sceneNames: readonly string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${name}: missing, or not a list of stages`)

    return []
  }
  if (value.length < min) errors.push(`${name}: ${value.length} stages, at least ${min}`)
  if (value.length > max) errors.push(`${name}: ${value.length} stages, at most ${max}`)
  const found: { path: string; stage: StageDef }[] = []
  value.forEach((item, i) => {
    const stage = stageAt(item, `${name}[${i}]`, errors, sceneNames)
    if (stage) found.push({ path: `${name}[${i}]`, stage })
  })

  return found
}

// A workflow file's text: the workflow, or every mistake in it with where
// it is. sceneNames are the library scenes a stage may use.
export function parseWorkflow(json: string, sceneNames: readonly string[]): { workflow: Workflow } | { errors: string[] } {
  let data: unknown
  try {
    // A byte-order mark, as some Windows editors save, is not JSON.
    data = JSON.parse(json.charCodeAt(0) === 0xfeff ? json.slice(1) : json)
  } catch (error) {
    return { errors: [`not valid JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { errors: ['the file must hold an object with "track" and, if any, "side"'] }
  const top = data as Record<string, unknown>
  const errors: string[] = []
  for (const key of Object.keys(top)) if (key !== 'track' && key !== 'side') errors.push(`${key}: not a field (track, side)`)
  const track = stagesAt(top.track, 'track', 1, TRACK_MAX, errors, sceneNames)
  const side = top.side === undefined ? [] : stagesAt(top.side, 'side', 0, SIDE_MAX, errors, sceneNames)
  const seen = new Set<string>()
  for (const { path, stage } of [...track, ...side]) {
    if (seen.has(stage.id)) errors.push(`${path}.id "${stage.id}" is used twice`)
    seen.add(stage.id)
  }

  return errors.length > 0 ? { errors } : { workflow: { track: track.map(f => f.stage), side: side.map(f => f.stage) } }
}

// The file /stage workflow init writes: two-space JSON, a trailing newline.
export const workflowJson = (w: Workflow): string => `${JSON.stringify({ track: w.track, side: w.side }, null, 2)}\n`

export const sameWorkflow = (a: Workflow, b: Workflow): boolean => workflowJson(a) === workflowJson(b)
