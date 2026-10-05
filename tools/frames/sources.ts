// The pictures the tool draws, built from stage-toons' own modules the way
// its hooks build them, at chosen moments: a scene under the spinner, the
// idle Clawd, the waiting toon, and the whole band.

import type { Workflow } from '../../stage-toons/types'
import { spawned } from '../../stage-toons/hooks/agents'
import { areaColumns, BAR_TONES, bandLayout, bandMode, type BandSite, type Span } from '../../stage-toons/hooks/band'
import { createDirector, react, withAuditing } from '../../stage-toons/hooks/director'
import { areaCells, siteCells } from '../../stage-toons/hooks/frames'
import { CELEBRATE, DOZE_MS, IDLE_IDS, routineOf, SHOW_OFF_PREFIX } from '../../stage-toons/hooks/idle'
import { createMod, createSite, type Mod } from '../../stage-toons/hooks/mod'
import { hex } from '../../stage-toons/hooks/pixels'
import { FALLBACK_SCENE, STAGE_W } from '../../stage-toons/hooks/scene'
import { SCENES } from '../../stage-toons/hooks/scenes'
import { applyMove, freshProgress } from '../../stage-toons/hooks/stages'
import { TOON_ROWS } from '../../stage-toons/hooks/toon'
import { DEFAULT_WORKFLOW, stageIds, stageOf } from '../../stage-toons/hooks/workflow'
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

export type SceneOptions = { reaction?: 'advance' | 'failure'; auditing?: boolean; width?: number }

// The toon under the spinner, as its paint loop composes it (siteCells),
// the director set up at time 0.
export function sceneFrames(id: string, opts: SceneOptions, times: readonly number[]): Canvas[] {
  known('scene', id, SCENE_IDS)
  const mod = createMod()
  mod.director = createDirector(id, false)
  if (opts.auditing) mod.director = withAuditing(mod.director, true, 0)
  if (opts.reaction) mod.director = react(mod.director, opts.reaction, 0)
  const site = createSite('toon')
  site.columns = opts.width ?? STAGE_W

  return times.map(t => cellsCanvas(siteCells(mod, site, t, quiet) ?? '', site.columns, TOON_ROWS))
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

// The area's frames over time, on one mod in time order: the helpers sit
// down as the area first sees them, at time 0.
function areaFrames(mod: Mod, columns: number, times: readonly number[]): string[] {
  areaCells(mod, columns, 0, quiet)

  return [...times].map(t => areaCells(mod, columns, t, quiet) ?? '')
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
  const lines = bandLayout(w, progress, opts.auditing ?? false, columns, undefined)
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
      const mod = createMod()
      mod.isBandWorking = true
      mod.director = createDirector(opts.scene ?? stageOf(w, opts.stage)?.scenes[0] ?? FALLBACK_SCENE, false)
      if (opts.auditing) mod.director = withAuditing(mod.director, true, 0)
      area = times.map(t => areaCells(mod, areaWidth, t, quiet) ?? '')
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
