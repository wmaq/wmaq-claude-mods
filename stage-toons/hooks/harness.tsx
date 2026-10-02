// Stand-ins for the engine beneath stage-toons in the register tests: an
// in-memory store, answers for the calls the mod makes, and a record of
// what it blitted and toasted.

import type { On, SessionMessage } from 'claude-code'
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

export type Blit = { key: string; cells: string; columns: number; rows: number }
export type AgentRow = { id: string; description: string; type: string; status: string }
export type World = {
  store: Record<string, unknown>
  isStoreBroken: boolean
  isBlitRefused: boolean
  blits: Blit[]
  invalidations: number
  commands: { description: string; argumentHint: string }[]
  toasts: string[]
  agents: AgentRow[]
  spawnModel: string
  spawned: number
}

export function engine(on: On, preset: { store?: Record<string, unknown> } = {}) {
  const world: World = { store: { ...preset.store }, isStoreBroken: false, isBlitRefused: false, blits: [], invalidations: 0, commands: [], toasts: [], agents: [], spawnModel: 'claude-sonnet-5-5', spawned: 0 }
  const clock = mock.clock(on, { now: NOW })
  const guard = () => {
    if (world.isStoreBroken) throw new Error('store unavailable')
  }
  on('store.get', ($, e) => {
    guard()

    return { value: world.store[e.key] }
  })
  on('store.set', ($, e) => {
    guard()
    world.store[e.key] = e.value

    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' as const }] }))
  on('session.compact', () => ({ messages: [SUMMARY] }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__stage-toons__${e.name}` } }))
  on('command.register', ($, e) => {
    world.commands.push({ description: e.description, argumentHint: e.argumentHint ?? '' })

    return { value: { command: e.name } }
  })
  on('agent.list', () => ({ value: world.agents }))
  on('agent.spawn', () => {
    world.spawned += 1

    return { model: world.spawnModel, agentId: `agent-${world.spawned}` }
  })
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.blit', ($, e) => {
    if ('cells' in e) world.blits.push({ key: e.key, cells: e.cells, columns: e.columns ?? 0, rows: e.rows ?? 0 })

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
  on('tool.call', ($, e) => (e.tool === 'Bash' ? { result: 'boom', text: 'boom', isError: true } : { result: 'ok', text: 'ok' }) as never)

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
// answers with world.spawnModel.
let spawns = 0
export function spawnAgent($: Engine, model?: string, parentModel = 'claude-opus-5-5') {
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
  })
}

export const runStage = ($: Engine, args: string) => $.command.run({ command: 'stage', args } as never)

export const endTurn = ($: Engine, agentId?: string) =>
  $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'end_turn', ...(agentId ? { agentId } : {}) } as never)

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
