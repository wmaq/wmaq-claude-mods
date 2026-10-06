// The pictures the tool draws, built from stage-toons' own modules the way
// its hooks build them, at chosen moments: a scene as the area plays it
// while Claude works, the idle Clawd, the waiting toon, a turn's start and
// end, and the whole band. Each sheet's frames are drawn in time order on
// one mod, as the paint loop draws them, so a dissolve starts at the first
// sample after a change.

import type { Workflow } from '../../stage-toons/types'
import { spawned } from '../../stage-toons/hooks/agents'
import { areaColumns, BAR_TONES, bandLayout, bandMode, type BandSite, type Span } from '../../stage-toons/hooks/band'
import { WORK_DEMO_SECONDS } from '../../stage-toons/hooks/demo'
import { createDirector, react, withAuditing } from '../../stage-toons/hooks/director'
import { areaCells } from '../../stage-toons/hooks/frames'
import { CELEBRATE, DOZE_MS, IDLE_IDS, routineOf, SHOW_OFF_PREFIX } from '../../stage-toons/hooks/idle'
import { createMod, type Mod } from '../../stage-toons/hooks/mod'
import { type Phase, PHASES } from '../../stage-toons/hooks/phase'
import { hex } from '../../stage-toons/hooks/pixels'
import { FALLBACK_SCENE, STAGE_W } from '../../stage-toons/hooks/scene'
import { SCENES } from '../../stage-toons/hooks/scenes'
import { applyMove, freshProgress } from '../../stage-toons/hooks/stages'
import type { TaskCount } from '../../stage-toons/hooks/tasks'
import { TOON_ROWS } from '../../stage-toons/hooks/toon'
import { DEFAULT_WORKFLOW, stageIds, stageOf } from '../../stage-toons/hooks/workflow'
import { said, toolStarted, withMode } from '../../stage-toons/hooks/work'
import { type Canvas, createCanvas, drawCells, drawText, type TextStyle } from './grid'

// Failures the mod would log go nowhere: the picture shows the stand-in.
const quiet = () => undefined

export const SCENE_IDS: readonly string[] = Object.keys(SCENES)

function known(what: string, id: string, ids: readonly string[]) {
  if (!ids.includes(id)) throw new Error(`unknown ${what} "${id}"; known: ${ids.join(', ')}`)
}

// An idle routine: the library's, the celebration, or show-off:<stage>.
function knownRoutine(routine: string) {
  if (routineOf(routine) === undefined) known('idle routine', routine, [...IDLE_IDS, CELEBRATE, `${SHOW_OFF_PREFIX}<stage>`])
}

function cellsCanvas(cells: string, columns: number, rows: number): Canvas {
  const c = createCanvas(columns, rows)
  drawCells(c, 0, 0, cells, columns, rows)

  return c
}

// mode, phase (with what) and say put the activity layer over the scene,
// from time 0 and held for the sheet.
export type SceneOptions = {
  reaction?: 'advance' | 'failure'
  auditing?: boolean
  width?: number
  mode?: 'thinking' | 'responding'
  phase?: string
  what?: string
  say?: string
}
export const MODES: readonly string[] = ['thinking', 'responding']

// A mod whose area plays this scene while Claude works, the scene coming on
// at time 0 (a reaction or Fable's walk-in from 0 too).
function workingMod(id: string, auditing: boolean, reaction?: 'advance' | 'failure'): Mod {
  const mod = createMod()
  mod.isBandWorking = true
  mod.director = createDirector(id, false)
  if (auditing) mod.director = withAuditing(mod.director, true, 0)
  if (reaction) mod.director = react(mod.director, reaction, 0)

  return mod
}

// The area while Claude works, as its paint loop composes it (areaCells).
export function sceneFrames(id: string, opts: SceneOptions, times: readonly number[]): Canvas[] {
  known('scene', id, SCENE_IDS)
  if (opts.mode !== undefined) known('mode', opts.mode, MODES)
  if (opts.phase !== undefined) known('phase', opts.phase, PHASES)
  const width = opts.width ?? STAGE_W
  const mod = workingMod(id, opts.auditing ?? false, opts.reaction)
  if (opts.mode !== undefined) mod.activity = withMode(mod.activity, opts.mode as 'thinking' | 'responding')
  if (opts.phase !== undefined) mod.activity = toolStarted(mod.activity, 'tu-sheet', opts.phase as Phase, opts.what ?? '')
  const say = opts.say
  // A line is said again before each frame, so it holds.
  const before = say === undefined ? undefined : (t: number) => (mod.activity = said(mod.activity, say, t))

  return areaFrames(mod, width, times, before).map(cells => cellsCanvas(cells, width, TOON_ROWS))
}

// The idle Clawd in the band's area, the idle period starting at time 0;
// with doze, from the doze on (still once DEEP_SLEEP_MS has passed).
export function idleFrames(routine: string, doze: boolean, times: readonly number[], columns = STAGE_W): Canvas[] {
  knownRoutine(routine)
  const mod = createMod()
  mod.idle = routine
  mod.idleSince = 0

  return times.map(t => cellsCanvas(areaCells(mod, columns, doze ? DOZE_MS + t : t, quiet) ?? '', columns, TOON_ROWS))
}

// A mod whose band's area is on screen while Claude waits on these agents,
// spawned at time 0 (a name's model family colours its helper).
function waitingMod(agents: readonly string[]): Mod {
  const mod = createMod()
  mod.band.requestId = 'r1'
  mod.isBandWorking = false
  mod.idleSince = 0
  agents.forEach((name, i) => {
    mod.roster = spawned(mod.roster, `agent-${i + 1}`, name, 0)
  })

  return mod
}

// The area's frames over time, on one mod in time order, the area first
// drawn at time 0: the helpers sit down as it first sees them, and a
// working scene comes on then.
function areaFrames(mod: Mod, columns: number, times: readonly number[], before?: (t: number) => void): string[] {
  before?.(0)
  areaCells(mod, columns, 0, quiet)

  return [...times].map(t => {
    before?.(t)

    return areaCells(mod, columns, t, quiet) ?? ''
  })
}

// The work demo (/stage demo work) over a stage's scene (its first) or
// --scene's, started at time 0, seconds per step.
export type WorkDemoOptions = { stage?: string; scene?: string; seconds?: number; workflow?: Workflow }

export function workDemoFrames(opts: WorkDemoOptions, times: readonly number[]): Canvas[] {
  const w = opts.workflow ?? DEFAULT_WORKFLOW
  if (opts.stage !== undefined) known('stage', opts.stage, stageIds(w))
  if (opts.scene !== undefined) known('scene', opts.scene, SCENE_IDS)
  const scene = opts.scene ?? (opts.stage !== undefined ? stageOf(w, opts.stage)?.scenes[0] : undefined) ?? FALLBACK_SCENE
  const mod = createMod()
  mod.band.requestId = 'r1'
  mod.idleSince = 0
  mod.demo = { kind: 'work', at: 0, seconds: opts.seconds ?? WORK_DEMO_SECONDS, scene }

  return areaFrames(mod, STAGE_W, times).map(cells => cellsCanvas(cells, STAGE_W, TOON_ROWS))
}

export function waitingFrames(agents: readonly string[], times: readonly number[], columns = STAGE_W): Canvas[] {
  if (agents.length === 0) throw new Error('waiting needs --agents, for example --agents fable,sonnet')

  return areaFrames(waitingMod(agents), columns, times).map(cells => cellsCanvas(cells, columns, TOON_ROWS))
}

export type BandOptions = {
  stage: string
  feature?: string
  message?: string
  columns?: number
  maxRows?: number
  agents?: readonly string[]
  auditing?: boolean
  working?: boolean
  // The scene under a working bar (the stage's first when not given).
  scene?: string
  workflow?: Workflow
  // The idle routine under the bar (classic when not given).
  idle?: string
  // Claude's task list's count on the bar.
  tasks?: TaskCount
}

const styleOf = (span: Span): TextStyle => {
  const tone = BAR_TONES[span.tone]

  return { color: tone.color === undefined ? undefined : hex(tone.color), bold: tone.bold, dim: tone.dimColor }
}

// The whole band as its hook draws it: the bar's lines, and under them, as
// bandMode decides, the area: the stage's scene while Claude works (agents
// and the idle routine then change nothing), else the waiting toon or the
// idle Clawd.
export function bandFrames(opts: BandOptions, times: readonly number[]): Canvas[] {
  const w = opts.workflow ?? DEFAULT_WORKFLOW
  known('stage', opts.stage, stageIds(w))
  if (opts.idle !== undefined) knownRoutine(opts.idle)
  if (opts.scene !== undefined) known('scene', opts.scene, SCENE_IDS)
  const columns = opts.columns ?? 100
  const progress = applyMove(w, freshProgress(0), {
    stage: opts.stage,
    message: opts.message ?? stageOf(w, opts.stage)!.message,
    feature: opts.feature,
    by: 'claude',
    at: 0,
  })
  const lines = bandLayout(w, progress, opts.auditing ?? false, columns, undefined, opts.tasks ?? null)
  const site: BandSite = {
    surface: 'terminal',
    hasSurvey: false,
    isAgentView: false,
    isHidden: false,
    columns,
    maxRows: opts.maxRows ?? lines.length + TOON_ROWS,
    barLines: lines.length,
  }
  const hasArea = bandMode(site) === 'area'
  const areaWidth = areaColumns(columns)
  const agents = opts.agents ?? []
  let area: string[] = []
  if (hasArea) {
    if (opts.working) {
      area = areaFrames(workingMod(opts.scene ?? stageOf(w, opts.stage)?.scenes[0] ?? FALLBACK_SCENE, opts.auditing ?? false), areaWidth, times)
    } else if (agents.length > 0) area = areaFrames(waitingMod(agents), areaWidth, times)
    else {
      const mod = createMod()
      mod.idleSince = 0
      if (opts.idle !== undefined) mod.idle = opts.idle
      area = times.map(t => areaCells(mod, areaWidth, t, quiet) ?? '')
    }
  }

  return times.map((_, i) => {
    const c = createCanvas(columns, lines.length + (hasArea ? TOON_ROWS : 0))
    lines.forEach((spans, row) => {
      let col = 0
      for (const span of spans) col += drawText(c, col, row, span.text, styleOf(span))
    })
    if (hasArea) drawCells(c, 0, lines.length, area[i]!, areaWidth, TOON_ROWS)

    return c
  })
}

export type TurnOptions = { stage?: string; scene?: string; idle?: string; start?: number; end?: number; columns?: number }

// The area through one turn: the idle Clawd (classic, or the routine asked
// for) until start, the stage's scene (its first, or the one asked for)
// until end, then the idle Clawd again, his idle period starting at end.
// Both edges dissolve.
export function turnFrames(opts: TurnOptions, times: readonly number[]): Canvas[] {
  const w = DEFAULT_WORKFLOW
  if (opts.stage !== undefined) known('stage', opts.stage, stageIds(w))
  if (opts.scene !== undefined) known('scene', opts.scene, SCENE_IDS)
  if (opts.idle !== undefined) knownRoutine(opts.idle)
  const start = opts.start ?? 1000
  const end = opts.end ?? 5000
  if (end < start) throw new Error(`--end (${end}) is before --start (${start})`)
  const columns = opts.columns ?? STAGE_W
  const mod = createMod()
  mod.idleSince = 0
  if (opts.idle !== undefined) mod.idle = opts.idle
  mod.director = createDirector(opts.scene ?? (opts.stage === undefined ? undefined : stageOf(w, opts.stage)?.scenes[0]) ?? FALLBACK_SCENE, false)
  const at = (t: number) => {
    mod.isBandWorking = t >= start && t < end
    if (t >= end && mod.idleSince < end) mod.idleSince = end

    return areaCells(mod, columns, t, quiet) ?? ''
  }
  // The turn's edges are drawn when they come, sampled or not, so each
  // dissolve starts on time.
  let drawnTo = 0
  at(0)

  return times.map(t => {
    for (const edge of [start, end]) if (edge > drawnTo && edge < t) at(edge)
    drawnTo = t

    return cellsCanvas(at(t), columns, TOON_ROWS)
  })
}
