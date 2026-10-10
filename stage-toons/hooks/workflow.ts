// A workflow: the stages the work moves through, on the track in order and
// beside it, each naming the scenes it may play. Data and lookups; the default
// is the workflow stage-toons ships with.

import type { AutoRule, DoneDef, StageDef, Workflow, WorkflowSettings } from '../types'
import { chars, hasControl, quoted, rulesAt, unknownFrom } from './auto'
import { STAGE_W } from './scene'
import type { LibraryScene } from './scenes'
import { allStages, DONE_ID, DONE_MESSAGE, DONE_SCENES, doneOf } from './track'
import { isWidth, WIDTH_MAX } from './width'

export type { DoneDef, StageDef, Workflow, WorkflowSettings }
export { allStages, DONE_ID, doneOf, isDone, isTrack, rank } from './track'

// What plays while the work is in no stage of the workflow.
export const UNTRACKED_SCENE: LibraryScene = 'mystery-box'

// A default stage names scenes of the library only: a misspelt one is a tsc
// error. (A workflow file's stages are checked when it is read.)
type DefaultStage = StageDef & { scenes: readonly LibraryScene[] }

// The default's rules into Done: a push to main or master, or a pull
// request merged, from Your testing or Cleanup only, so a stray push early
// in a feature doesn't end it. A push counts when core saw it go through
// (not up to date, a dry run, a rejection or a deleted branch; a quiet
// push, -q, shows core nothing: /stage done). gh pr merge matches a
// command at the start of a line (spaces before it allowed) or after ;,
// &, |: a commit message or an echo that mentions one does not; --auto
// merges nothing yet.
const MERGE_RULES: readonly AutoRule[] = [
  { push: 'main', from: ['user-test', 'cleanup'] },
  { push: 'master', from: ['user-test', 'cleanup'] },
  { bash: `(?:^|[;&|\\n])\\s*gh\\s+pr\\s+merge\\b(?![^;&|\\n]*--auto)`, from: ['user-test', 'cleanup'] },
]

export const DEFAULT_WORKFLOW: Workflow = {
  track: [
    { id: 'roadmap', label: 'Roadmap', message: 'Discussing the roadmap and new features', when: 'roadmap discussion, new features brainstorming', scenes: ['road-trip', 'stargazing', 'treasure-map'] },
    { id: 'brainstorm', label: 'Brainstorm', message: 'Brainstorming the feature', when: "one feature's brainstorming", scenes: ['light-bulbs', 'sticky-notes', 'thought-clouds'], auto: [{ skill: 'superpowers:brainstorming' }] },
    { id: 'spec', label: 'Spec', message: 'Writing the spec', when: 'writing the spec', scenes: ['writing-desk', 'blueprint', 'scroll'], auto: [{ write: 'docs/superpowers/specs/**' }] },
    { id: 'spec-audit', label: 'Spec audit', message: 'Fable is auditing the spec', when: 'a Fable subagent audits the spec', scenes: ['proofread-page', 'red-pen', 'stamp'], auto: [{ agent: 'fable', from: ['brainstorm', 'spec'] }] },
    {
      id: 'plan',
      label: 'Plan',
      message: 'Writing the implementation plan',
      when: 'writing the implementation plan',
      scenes: ['stepping-stones', 'dominoes', 'ladder'],
      auto: [{ skill: 'superpowers:writing-plans' }, { write: 'docs/superpowers/plans/**' }],
    },
    { id: 'plan-audit', label: 'Plan audit', message: 'Fable is auditing the plan', when: 'a Fable subagent audits the plan', scenes: ['proofread-checklist', 'clipboard', 'scales'], auto: [{ agent: 'fable', from: ['plan'] }] },
    {
      id: 'develop',
      label: 'Develop',
      message: 'Building it',
      when: 'building it',
      scenes: ['bricklaying', 'terminal', 'workbench'],
      auto: [{ skill: 'superpowers:executing-plans' }, { skill: 'superpowers:subagent-driven-development' }],
    },
    { id: 'claude-test', label: 'Claude testing', message: 'Claude is testing the work', when: 'Claude verifies the work', scenes: ['test-tubes', 'control-panel', 'crash-test', 'bowling'] },
    { id: 'user-test', label: 'Your testing', message: 'Over to you for testing', when: 'the user tests it', scenes: ['gift', 'waiting-bench', 'cake'] },
    { id: 'cleanup', label: 'Cleanup', message: 'Cleaning up leftovers, chores and docs', when: 'leftovers, chores, docs', scenes: ['sweeping', 'dishes', 'recycling'], auto: [{ skill: 'superpowers:finishing-a-development-branch' }] },
  ],
  side: [
    { id: 'debugging', label: 'Debugging', message: 'Hunting a bug', when: 'finding and fixing a bug, at any point', scenes: ['bug-hunt', 'flashlight', 'bug-net'], auto: [{ skill: 'superpowers:systematic-debugging' }] },
    { id: 'other', label: 'Other', message: 'Work outside the usual stages', when: 'work that fits none of the stages', scenes: ['mystery-box', 'fishing', 'dice'] },
  ],
  done: { message: DONE_MESSAGE, scenes: ['fireworks', 'rocket', 'victory-lap'], auto: MERGE_RULES },
} satisfies { track: readonly DefaultStage[]; side: readonly DefaultStage[]; done: DoneDef & { scenes: readonly LibraryScene[] } }

export const stageIds = (w: Workflow): string[] => allStages(w).map(s => s.id)

export const stageOf = (w: Workflow, id: string | null): StageDef | undefined =>
  id === null ? undefined : id === DONE_ID ? doneOf(w) : (w.track.find(s => s.id === id) ?? w.side.find(s => s.id === id))

// Where /stage 0 and /stage ? go: Other, else the first side stage.
export const zeroStage = (w: Workflow): StageDef | undefined => w.side.find(s => s.id === 'other') ?? w.side[0]

export function stageList(w: Workflow): string {
  const track = `track: ${w.track.map(s => s.id).join(', ')}, then ${DONE_ID}`

  return w.side.length > 0 ? `${track}; side: ${w.side.map(s => s.id).join(', ')}` : track
}

export const RESERVED_IDS = ['next', 'back', 'hide', 'demo', 'feature', 'message', 'workflow', 'auto', 'bubbles', 'calm', 'dj', 'width', 'log', 'time', 'help', 'done'] as const
export const TRACK_MAX = 15
export const SIDE_MAX = 5

export const SCENES_MAX = 5
const TEXT_FIELDS = ['id', 'label', 'message', 'when'] as const
type TextField = (typeof TEXT_FIELDS)[number]
const FIELDS = [...TEXT_FIELDS, 'scene', 'scenes', 'auto'] as const
const LIMITS: Record<TextField, number> = { id: 24, label: 20, message: 80, when: 120 }
const ID = /^[a-z][a-z0-9-]{0,23}$/
// Library scenes a stage can't use, and why.
const NOT_FOR_STAGES: Record<string, string> = {
  'fable-audit': 'plays while a Fable subagent runs, whatever the stage',
  standing: 'is the fallback for a scene that breaks',
}

// A scene name a stage may use; otherwise its error, at `at`.
function isStageScene(name: string, at: string, errors: string[], sceneNames: readonly string[]): boolean {
  if (NOT_FOR_STAGES[name] !== undefined) errors.push(`${at} "${name}" ${NOT_FOR_STAGES[name]}; a stage can't use it`)
  else if (!sceneNames.includes(name)) errors.push(`${at} ${quoted(name)} is not a scene (${sceneNames.join(', ')})`)
  else return true

  return false
}

// A stage's scenes: its list, or the one scene an older file gives.
function scenesAt(raw: Record<string, unknown>, path: string, errors: string[], sceneNames: readonly string[]): string[] | null {
  const one = raw.scene
  const list = raw.scenes
  if (one !== undefined && list !== undefined) {
    errors.push(`${path}: has both scene and scenes; give one`)

    return null
  }
  if (one !== undefined) {
    if (typeof one !== 'string') errors.push(`${path}.scene: must be text`)
    else if (one.trim() === '') errors.push(`${path}.scene: empty`)
    else if (isStageScene(one.trim(), `${path}.scene`, errors, sceneNames)) return [one.trim()]

    return null
  }
  if (list === undefined) {
    errors.push(`${path}.scenes: missing`)

    return null
  }
  if (!Array.isArray(list) || !list.every(n => typeof n === 'string')) {
    errors.push(`${path}.scenes: must be a list of scene names`)

    return null
  }
  const names = (list as string[]).map(n => n.trim())
  if (names.length === 0) errors.push(`${path}.scenes: empty`)
  else if (names.length > SCENES_MAX) errors.push(`${path}.scenes: ${names.length} scenes; at most ${SCENES_MAX}`)
  if (names.length === 0 || names.length > SCENES_MAX) return null
  const before = errors.length
  names.forEach((name, i) => {
    const first = names.indexOf(name)
    // A name given again is reported once, where it first repeats.
    if (first !== i) {
      if (names.indexOf(name, first + 1) === i) errors.push(`${path}.scenes: names ${quoted(name)} twice`)
    } else {
      isStageScene(name, `${path}.scenes[${i}]`, errors, sceneNames)
    }
  })

  return errors.length === before ? names : null
}

function stageAt(item: unknown, path: string, errors: string[], sceneNames: readonly string[]): StageDef | null {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    errors.push(`${path}: not a stage (an object with ${FIELDS.join(', ')})`)

    return null
  }
  const raw = item as Record<string, unknown>
  const before = errors.length
  for (const key of Object.keys(raw)) if (!(FIELDS as readonly string[]).includes(key)) errors.push(`${path}.${key}: not a field (${FIELDS.join(', ')})`)
  const text: Partial<Record<TextField, string>> = {}
  for (const field of TEXT_FIELDS) {
    const value = raw[field]
    if (value === undefined) errors.push(`${path}.${field}: missing`)
    else if (typeof value !== 'string') errors.push(`${path}.${field}: must be text`)
    else if (value.trim() === '') errors.push(`${path}.${field}: empty`)
    else if (chars(value.trim()) > LIMITS[field]) errors.push(`${path}.${field}: ${chars(value.trim())} characters, at most ${LIMITS[field]}`)
    else if (hasControl(value)) errors.push(`${path}.${field}: control characters`)
    else text[field] = value.trim()
  }
  const { id } = text
  if (id !== undefined && !ID.test(id)) errors.push(`${path}.id ${quoted(id)}: lowercase letters, digits and dashes, starting with a letter`)
  else if (id !== undefined && (RESERVED_IDS as readonly string[]).includes(id)) {
    errors.push(`${path}.id "${id}" is one of /stage's words (${RESERVED_IDS.join(', ')})`)
  }
  const scenes = scenesAt(raw, path, errors, sceneNames)
  const auto = raw.auto === undefined ? undefined : rulesAt(raw.auto, `${path}.auto`, errors)
  if (errors.length !== before || !scenes) return null

  return { id: text.id!, label: text.label!, message: text.message!, when: text.when!, scenes, ...(auto && auto.length > 0 ? { auto } : {}) }
}

function stagesAt(value: unknown, name: 'track' | 'side', min: number, max: number, errors: string[], sceneNames: readonly string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${name}: missing, or not a list of stages`)

    return []
  }
  if (value.length < min) errors.push(`${name}: ${value.length} stages, at least ${min}`)
  if (value.length > max) {
    errors.push(`${name}: ${value.length} stages, at most ${max}`)

    return []
  }
  const found: { path: string; stage: StageDef }[] = []
  value.forEach((item, i) => {
    const stage = stageAt(item, `${name}[${i}]`, errors, sceneNames)
    if (stage) found.push({ path: `${name}[${i}]`, stage })
  })

  return found
}

// The file's top-level fields: the stages, Done, and the settings for the
// start.
const TOP_FIELDS = ['track', 'side', 'done', 'auto', 'hide', 'bubbles', 'calm', 'width'] as const
const DONE_FIELDS = ['message', 'scenes', 'auto'] as const

// The file's "done": what it sets of Done's message, scenes and rules, or
// null with its mistakes listed. Rules' from ids are checked with the rest.
function doneAt(value: unknown, errors: string[], sceneNames: readonly string[]): DoneDef | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`done: not an object (with ${DONE_FIELDS.join(', ')}, each optional)`)

    return null
  }
  const raw = value as Record<string, unknown>
  const before = errors.length
  for (const key of Object.keys(raw)) if (!(DONE_FIELDS as readonly string[]).includes(key)) errors.push(`done.${key}: not a field (${DONE_FIELDS.join(', ')})`)
  let message: string | undefined
  if (raw.message !== undefined) {
    if (typeof raw.message !== 'string') errors.push('done.message: must be text')
    else if (raw.message.trim() === '') errors.push('done.message: empty')
    else if (chars(raw.message.trim()) > LIMITS.message) errors.push(`done.message: ${chars(raw.message.trim())} characters, at most ${LIMITS.message}`)
    else if (hasControl(raw.message)) errors.push('done.message: control characters')
    else message = raw.message.trim()
  }
  const scenes = raw.scenes === undefined ? undefined : scenesAt({ scenes: raw.scenes }, 'done', errors, sceneNames)
  const auto = raw.auto === undefined ? undefined : rulesAt(raw.auto, 'done.auto', errors)
  if (errors.length !== before) return null

  return { ...(message ? { message } : {}), ...(scenes ? { scenes } : {}), ...(auto && auto.length > 0 ? { auto } : {}) }
}
const SETTINGS = ['auto', 'hide', 'bubbles', 'calm'] as const

// A workflow file's text: the workflow and the settings it gives (absent
// when it gives none), or every mistake in it with where it is. sceneNames
// are the library scenes a stage may use.
export function parseWorkflow(json: string, sceneNames: readonly string[]): { workflow: Workflow; settings?: WorkflowSettings } | { errors: string[] } {
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
  for (const key of Object.keys(top)) if (!(TOP_FIELDS as readonly string[]).includes(key)) errors.push(`${key}: not a field (${TOP_FIELDS.join(', ')})`)
  const track = stagesAt(top.track, 'track', 1, TRACK_MAX, errors, sceneNames)
  const side = top.side === undefined ? [] : stagesAt(top.side, 'side', 0, SIDE_MAX, errors, sceneNames)
  const seen = new Set<string>()
  for (const { path, stage } of [...track, ...side]) {
    if (seen.has(stage.id)) errors.push(`${path}.id "${stage.id}" is used twice`)
    seen.add(stage.id)
  }
  const done = top.done === undefined ? undefined : doneAt(top.done, errors, sceneNames)
  // A rule may fire from Done too.
  const ids = [...seen, DONE_ID]
  for (const { path, stage } of [...track, ...side]) errors.push(...unknownFrom(stage.auto ?? [], `${path}.auto`, ids))
  errors.push(...unknownFrom(done?.auto ?? [], 'done.auto', ids))
  const settings: WorkflowSettings = {}
  for (const name of SETTINGS) {
    const value = top[name]
    if (typeof value === 'boolean') settings[name] = value
    else if (value !== undefined) errors.push(`${name}: must be true or false`)
  }
  if (isWidth(top.width)) settings.width = top.width
  else if (top.width !== undefined) errors.push(`width: must be a whole number from ${STAGE_W} to ${WIDTH_MAX}, or "full"`)
  if (errors.length > 0) return { errors }
  const workflow: Workflow = { track: track.map(f => f.stage), side: side.map(f => f.stage), ...(done ? { done } : {}) }

  return { workflow: listsRules(top) ? workflow : withDefaultRules(workflow), ...(Object.keys(settings).length > 0 ? { settings } : {}) }
}

// Whether any stage of the file has an "auto" field, an empty list
// included: a file that has none (as /stage workflow init wrote before
// 0.6) takes the default's rules.
const listsRules = (top: Record<string, unknown>): boolean =>
  [top.track, top.side].some(list => Array.isArray(list) && list.some(item => typeof item === 'object' && item !== null && 'auto' in item)) ||
  (typeof top.done === 'object' && top.done !== null && 'auto' in top.done)

// Each stage the default has by id, with the default's rules; the file's
// own stages get none. Done gets the default's rules too, each one's from
// cut to the file's stages, a rule left with none dropped.
function withDefaultRules(w: Workflow): Workflow {
  const ruled = (s: StageDef): StageDef => {
    const auto = stageOf(DEFAULT_WORKFLOW, s.id)?.auto

    return auto ? { ...s, auto } : s
  }
  const ids = [...w.track, ...w.side].map(s => s.id)
  const doneRules = (DEFAULT_WORKFLOW.done?.auto ?? []).flatMap(rule => {
    if (rule.from === undefined) return [rule]
    const from = rule.from.filter(id => ids.includes(id))

    return from.length > 0 ? [{ ...rule, from }] : []
  })
  const done = doneRules.length > 0 ? { message: DONE_MESSAGE, scenes: DONE_SCENES, ...w.done, auto: doneRules } : w.done

  return { ...w, track: w.track.map(ruled), side: w.side.map(ruled), ...(done ? { done } : {}) }
}

// The file /stage workflow init writes: two-space JSON, a trailing newline.
export const workflowJson = (w: Workflow): string =>
  `${JSON.stringify({ track: w.track, side: w.side, ...(w.done ? { done: w.done } : {}) }, null, 2)}\n`

export const sameWorkflow = (a: Workflow, b: Workflow): boolean => workflowJson(a) === workflowJson(b)

// A workflow as an older version kept it in $.state (each stage with one
// scene), read as this version's: each stage with its scenes.
export function withScenes(w: Workflow): Workflow {
  const fit = (s: StageDef): StageDef => {
    const old = s as StageDef & { scene?: string }
    if (Array.isArray(old.scenes)) return s

    return { id: old.id, label: old.label, message: old.message, when: old.when, scenes: [old.scene ?? UNTRACKED_SCENE] }
  }

  return { ...w, track: w.track.map(fit), side: w.side.map(fit) }
}
