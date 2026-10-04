// Stand-ins for the engine beneath stage-toons in the register tests: an
// in-memory store, answers for the calls the mod makes, and a record of
// what it blitted and toasted.

import type { AgentInfo, On, SessionMessage } from 'claude-code'
import { type Engine, mock } from 'claude-code/testing'

export const NOW = 1_000_000
export const BS = String.fromCharCode(92)
export const TOOL_NAME = 'mcp__stage-toons__set_stage'
export const START = { cwd: 'C:/Dev/proj', surface: 'terminal', isInteractive: true } as const
export const KEY = 'progress:c:/dev/proj'
export const SPINNER = { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' } as const
export const COMPOSE = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['terminal'],
  tools: [],
  outputStyle: null,
  traits: [],
} as const

// What a compaction leaves: at least one message.
export const SUMMARY: SessionMessage = { role: 'user', text: 'Summary of the conversation so far.', toolUses: [] }

export const bandProps = (bodyColumns = 100, extra: { hasSurvey?: boolean; agentId?: string; isWorking?: boolean; maxRows?: number } = {}) => ({
  hasSurvey: extra.hasSurvey ?? false,
  isWorking: extra.isWorking ?? false,
  maxRows: extra.maxRows ?? 10,
  bodyColumns,
  scroll: { offset: 0, bodyRows: 10 },
  view: extra.agentId === undefined ? {} : { agentId: extra.agentId },
})

export type Blit = { key: string; cells: string; columns: number; rows: number; requestId?: string }
export type AgentRow = { id: string; description: string; type: string; status: AgentInfo['status'] }
export type World = {
  store: Record<string, unknown>
  isStoreBroken: boolean
  isBlitRefused: boolean
  blits: Blit[]
  invalidations: number
  commands: { description: string; argumentHint: string }[]
  toasts: string[]
  // The project's files as the fs hooks see them, whether they fail, and
  // each set_stage schema registered.
  files: Record<string, string>
  isFsBroken: boolean
  schemas: unknown[]
  agents: AgentRow[]
  spawnModel: string
  spawned: number
  // The session's directory as $.session.cwd() answers it, and the context
  // each prompt entered with.
  cwd: string
  prompts: (readonly string[] | undefined)[]
  // Whether Bash answers with an error (it does unless a test says not),
  // and what $.session.cwd() does: answer world.cwd, or fail.
  isBashFailing: boolean
  isCwdBroken: boolean
  // Whether fs.exists fails, and tool.register.
  isExistsBroken: boolean
  isRegisterBroken: boolean
  // How many times the store was read.
  storeReads: number
}

export function engine(on: On, preset: { store?: Record<string, unknown> } = {}) {
  const world: World = { store: { ...preset.store }, isStoreBroken: false, isBlitRefused: false, blits: [], invalidations: 0, commands: [], toasts: [], files: {}, isFsBroken: false, schemas: [], agents: [], spawnModel: 'claude-sonnet-5-5', spawned: 0, cwd: START.cwd, prompts: [], isBashFailing: true, isCwdBroken: false, isExistsBroken: false, isRegisterBroken: false, storeReads: 0 }
  const clock = mock.clock(on, { now: NOW })
  const guard = () => {
    if (world.isStoreBroken) throw new Error('store unavailable')
  }
  on('store.get', ($, e) => {
    guard()
    world.storeReads += 1

    return { value: world.store[e.key] }
  })
  on('store.keys', () => {
    guard()

    return { value: Object.keys(world.store) }
  })
  on('store.delete', ($, e) => {
    guard()
    delete world.store[e.key]

    return { value: undefined }
  })
  on('store.set', ($, e) => {
    guard()
    world.store[e.key] = e.value

    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', ($, e) => {
    world.prompts.push(e.context)

    return { text: e.text }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('session.cwd', () => {
    if (world.isCwdBroken) throw new Error('no directory')

    return { value: world.cwd }
  })
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' as const }] }))
  on('session.compact', () => ({ messages: [SUMMARY] }))
  on('tool.register', ($, e) => {
    if (world.isRegisterBroken) throw new Error('refused')
    world.schemas.push(e.inputSchema)

    return { value: { tool: `mcp__stage-toons__${e.name}` } }
  })
  // The engine hands these hooks resolved paths: a file is known by its
  // path from .claude/ on, as the tests name it (.claude/stage-toons.json).
  const fileOf = (path: string) => {
    const slashed = path.split(BS).join('/')
    const at = slashed.lastIndexOf('.claude/')

    return at < 0 ? slashed : slashed.slice(at)
  }
  on('fs.exists', ($, e) => {
    if (world.isExistsBroken) throw new Error('EACCES')

    return { value: fileOf(e.path) in world.files }
  })
  on('fs.read', ($, e) => {
    const file = fileOf(e.path)
    if (world.isFsBroken || !(file in world.files)) throw new Error(`ENOENT: ${file}`)

    return { value: world.files[file]! }
  })
  on('fs.write', ($, e) => {
    if (world.isFsBroken) throw new Error('EACCES')
    world.files[fileOf(e.path)] = e.text

    return { value: undefined }
  })
  on('command.register', ($, e) => {
    world.commands.push({ description: e.description, argumentHint: e.argumentHint ?? '' })

    return { value: { command: e.name } }
  })
  on('agent.list', () => ({ value: world.agents }))
  // A spawned agent runs: the list shows it until a test says otherwise.
  // Its row stays running after its turn ends, so a helper comes back once
  // the mod's LIST_LAG_MS has passed: set world.agents to end it for good.
  on('agent.spawn', () => {
    world.spawned += 1
    const agentId = `agent-${world.spawned}`
    world.agents = [...world.agents, { id: agentId, description: 'Audit', type: 'general-purpose', status: 'running' }]

    return { model: world.spawnModel, agentId }
  })
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.blit', ($, e) => {
    if ('cells' in e) world.blits.push({ key: e.key, cells: e.cells, columns: e.columns ?? 0, rows: e.rows ?? 0, requestId: (e as { requestId?: string }).requestId })

    return { value: world.isBlitRefused ? { deny: 'nothing of this plugin is mounted there' } : {} }
  })
  on('ui.invalidate', () => {
    world.invalidations += 1

    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('tool.call', ($, e) => (e.tool === 'Bash' && world.isBashFailing ? { result: 'boom', text: 'boom', isError: true } : e.tool === 'Read' ? { result: 'ok', text: 'ok', context: ['read note'] } : { result: 'ok', text: 'ok' }) as never)

  return { world, clock }
}

// set_stage as the model calls it: its arguments sit on the event itself.
let calls = 0
export function setStage($: Engine, args: Record<string, unknown>) {
  calls += 1

  return $.tool.call({ tool: TOOL_NAME, tool_use_id: `tu-${calls}`, ...args } as never)
}

// A registered tool's result reaches core as given, and core takes only a
// string, an array or nothing there: set_stage answers a string.
export function answerText(answer: unknown): string | undefined {
  const result = (answer as { result?: unknown }).result

  return typeof result === 'string' ? result : undefined
}

// A subagent spawn as the Agent tool raises it. The test's agent.spawn hook
// answers with world.spawnModel. extra adds to the input (parentAgentId).
let spawns = 0
export function spawnAgent($: Engine, model?: string, parentModel = 'claude-opus-5-5', extra: Record<string, unknown> = {}) {
  spawns += 1

  return $.agent.spawn({
    tool_use_id: `tu-spawn-${spawns}`,
    prompt: 'Audit the spec',
    description: 'Audit',
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel,
    background: false,
    fork: false,
    ...(model === undefined ? {} : { model }),
    ...extra,
  })
}

export const runStage = ($: Engine, args: string) => $.command.run({ command: 'stage', args } as never)

export const endTurn = ($: Engine, agentId?: string, durationMs = 1) =>
  $.turn.complete({ answer: '', durationMs, isAborted: false, turnId: 't', reason: 'end_turn', ...(agentId ? { agentId } : {}) } as never)

export const startTurn = ($: Engine) => $.turn.start({ text: 'go', turnId: 't' })

export const submit = ($: Engine, text = 'hi') => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } } as never)

// A built-in tool's call from the main conversation, or a subagent's.
let toolCalls = 0
export function callTool($: Engine, tool: string, args: Record<string, unknown>, agentId?: string) {
  toolCalls += 1

  return $.tool.call({ tool, tool_use_id: `tu-tool-${toolCalls}`, ...args, ...(agentId ? { agentId } : {}) } as never) as Promise<{ context?: readonly string[]; deny?: string }>
}

// The band's text as drawn: the mod's band, the engine's own when the mod
// passes, or nothing.
export async function bandText($: Engine, surface: 'terminal' | 'desktop' = 'terminal', props = bandProps()): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'stage-toons', surface, component: 'AbovePrompt', props })
  const band = await ui.find({ key: 'stage-toons' })
  const engineBand = await ui.find({ type: 'Text', text: 'engine' })
  await ui.unmount()

  return band?.text ?? (engineBand ? '(engine)' : '(nothing)')
}

// The band as the engine mounts it, to be redrawn and searched.
export const mountBand = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal', props = bandProps()) =>
  $.ui.mount({ plugin: 'stage-toons', surface, component: 'AbovePrompt', props })

// The blits of one Raster key.
export const blitsOf = (world: World, key: string) => world.blits.filter(b => b.key === key)

// The spinner under the main conversation, or, given a requestId, the one
// on a background agent's row (its requestId is the agent's id).
export const mountSpinner = ($: Engine, columns?: number, requestId?: string) =>
  $.ui.mount({
    plugin: 'stage-toons',
    surface: 'terminal',
    component: 'Spinner',
    props: SPINNER,
    ...(columns === undefined ? {} : { viewport: { columns, rows: 40 } }),
    ...(requestId === undefined ? {} : { requestId }),
  })

export const decode = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)

// Whether a color shows, as foreground or background, in the given cell
// rows of a blitted frame.
export function colorInRows(blit: Blit | undefined, rows: number[], color: number): boolean {
  if (!blit) return false
  const words = decode(blit.cells)

  return rows.some(row => {
    for (let x = 0; x < blit.columns; x++) {
      const i = (row * blit.columns + x) * 3
      if (words[i + 1] === color || words[i + 2] === color) return true
    }

    return false
  })
}

// The workflow section of the system prompt, as the next request would get it.
export const sectionText = async ($: Engine) => (await $.prompt.compose(COMPOSE as never)).sections.at(-1)?.text ?? ''
