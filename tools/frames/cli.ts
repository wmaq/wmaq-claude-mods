// The frame tool's command line: renders stage-toons' drawing to a PNG
// contact sheet. From the repository root:
//   npx -y tsx tools/frames/cli.ts scene bricklaying
//   npx -y tsx tools/frames/cli.ts idle classic --doze
//   npx -y tsx tools/frames/cli.ts waiting --agents fable,sonnet --scene rowing
//   npx -y tsx tools/frames/cli.ts band --stage plan --feature "frame tool" --agents opus
//   npx -y tsx tools/frames/cli.ts stills scenes
// See README.md beside this file for every option.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import type { Workflow } from '../../stage-toons/types'
import { AREA_ROWS } from '../../stage-toons/hooks/band'
import type { AreaSize } from '../../stage-toons/hooks/scene'
import { STAGE_SCENES } from '../../stage-toons/hooks/scenes'
import { FALLBACK_WAITING } from '../../stage-toons/hooks/waiting/deal'
import { parseWidth, WIDTH_MAX } from '../../stage-toons/hooks/width'
import { parseWorkflow } from '../../stage-toons/hooks/workflow'
import { type Canvas, toRgba } from './grid'
import { encodePng } from './png'
import { contactSheet } from './sheet'
import { bandFrames, djFrames, idleFrames, sceneFrames, STILL_KINDS, stillFrames, turnFrames, waitingFrames, workDemoFrames } from './sources'

const USAGE = `usage: npx -y tsx tools/frames/cli.ts <what> [options]
  scene <id> [--reaction advance|failure] [--auditing]
        [--mode thinking|responding] [--phase <phase>] [--what text] [--say line]
  idle <routine> [--doze]
  waiting --agents fable,sonnet,... [--scene id]
  waiting --demo [--scene id]
  dj [--track "Artist - Title"] [--agents a,b] [--changed-at MS] [--working] [--party]
  dj --demo [--party]
  band --stage <id> [--feature F] [--message M] [--columns N] [--max-rows N] [--width N|full]
       [--agents a,b] [--auditing] [--working] [--scene id] [--workflow file.json] [--idle routine]
       [--tasks done/total]
  turn [--stage id] [--scene id] [--idle routine] [--start MS] [--end MS]
  demo-work [--stage id] [--scene id] [--workflow file.json] [--seconds N]
  stills scenes|idle|waiting   every picture's still in calm mode, one frame each
calm mode: --calm on scene, idle, waiting (not --demo), dj (not --demo), band and turn
the area (all but band): --columns N[,N...] (120; scene's --width is another name) --rows N (7 to 9; 9)
common: --from MS (0) --every MS (250; 500 for turn) --count N (16; 4 with several --columns)
        --columns-per-row N (4; 2 for frames over 64 columns; a row per width with several --columns)
        --scale N (1) --out file.png`

const FLAGS = new Set(['auditing', 'calm', 'demo', 'doze', 'party', 'working'])

// The options each command takes, beside the common ones: anything else is
// an error, so a mistyped option is not drawn with its default.
const COMMON = ['from', 'every', 'count', 'columns-per-row', 'scale', 'out']
const OPTIONS: Record<string, readonly string[]> = {
  scene: ['reaction', 'auditing', 'width', 'columns', 'rows', 'mode', 'phase', 'what', 'say', 'calm'],
  idle: ['doze', 'columns', 'rows', 'calm'],
  waiting: ['agents', 'columns', 'rows', 'scene', 'demo', 'calm'],
  dj: ['track', 'agents', 'changed-at', 'working', 'demo', 'columns', 'rows', 'calm', 'party'],
  band: ['stage', 'feature', 'message', 'columns', 'max-rows', 'width', 'agents', 'auditing', 'working', 'scene', 'workflow', 'idle', 'tasks', 'calm'],
  turn: ['stage', 'scene', 'idle', 'start', 'end', 'columns', 'rows', 'calm'],
  'demo-work': ['stage', 'scene', 'seconds', 'workflow', 'columns', 'rows'],
}
// The area's size when not given: the width setting's default, and the
// most rows.
const AREA_COLUMNS = 120
const BAND_COLUMNS = 100

type Args = { what: string; id: string | undefined; opts: Map<string, string> }

export function parseArgs(argv: readonly string[]): Args {
  const [what, ...rest] = argv
  if (what === undefined) throw new Error(USAGE)
  const opts = new Map<string, string>()
  let id: string | undefined
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!
    if (!arg.startsWith('--')) {
      if (id !== undefined) throw new Error(`unexpected "${arg}"\n${USAGE}`)
      id = arg
      continue
    }
    const name = arg.slice(2)
    if (FLAGS.has(name)) opts.set(name, 'true')
    else {
      const value = rest[i + 1]
      if (value === undefined) throw new Error(`--${name} needs a value\n${USAGE}`)
      opts.set(name, value)
      i++
    }
  }

  return { what, id, opts }
}

// --tasks 3/8: three of eight tasks done.
function tasksOpt(opts: Map<string, string>): { done: number; total: number } | undefined {
  const raw = opts.get('tasks')
  if (raw === undefined) return undefined
  const m = /^(\d+)\/(\d+)$/.exec(raw)
  if (!m || Number(m[1]) > Number(m[2]) || Number(m[2]) === 0) throw new Error(`--tasks must be done/total, as 3/8, not "${raw}"`)

  return { done: Number(m[1]), total: Number(m[2]) }
}

function numberOpt(opts: Map<string, string>, name: string, fallback: number, min = 0): number {
  const raw = opts.get(name)
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} must be a whole number, not "${raw}"`)
  if (n < min) throw new Error(`--${name} must be at least ${min}, not "${raw}"`)

  return n
}

const listOpt = (opts: Map<string, string>, name: string): string[] =>
  (opts.get(name) ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '')

// --columns 48,80,120 (scene's --width too): the widths to draw, each a
// whole number from 1 (for the area, to 512); band's is the band's width.
function columnsOpt(opts: Map<string, string>, what: string): number[] {
  if (what === 'scene' && opts.has('width') && opts.has('columns')) throw new Error('scene takes --columns or --width (another name for it), not both')
  const name = what === 'scene' && opts.has('width') ? 'width' : 'columns'
  const raw = opts.get(name)
  if (raw === undefined) return [what === 'band' ? BAND_COLUMNS : AREA_COLUMNS]

  return raw.split(',').map(part => {
    const n = Number(part.trim())
    if (part.trim() === '' || !Number.isInteger(n) || n < 0) throw new Error(`--${name} must be whole numbers, as 120 or 48,80,120, not "${raw}"`)
    if (n < 1) throw new Error(`--${name} must be at least 1, not "${part.trim()}"`)
    if (what !== 'band' && n > WIDTH_MAX) throw new Error(`--${name} must be at most ${WIDTH_MAX}, not "${part.trim()}"`)

    return n
  })
}

// --rows: the area's rows, 7 to 9.
function rowsOpt(opts: Map<string, string>): number {
  const raw = opts.get('rows')
  if (raw === undefined) return AREA_ROWS
  const n = Number(raw)
  if (![7, 8, 9].includes(n)) throw new Error(`--rows must be 7, 8 or 9, not "${raw}"`)

  return n
}

// band's --width: the width setting, a number from 48 to 512 or full.
function widthOpt(opts: Map<string, string>) {
  const raw = opts.get('width')
  if (raw === undefined) return undefined
  const width = parseWidth(raw.toLowerCase())
  if (width === null) throw new Error(`--width must be a whole number from 48 to ${WIDTH_MAX}, or full, not "${raw}"`)

  return width
}

function workflowOpt(opts: Map<string, string>): Workflow | undefined {
  const path = opts.get('workflow')
  if (path === undefined) return undefined
  if (!existsSync(path)) throw new Error(`no workflow file at ${path}`)
  const parsed = parseWorkflow(readFileSync(path, 'utf8'), STAGE_SCENES)
  if ('errors' in parsed) throw new Error(`${path} has errors:\n  ${parsed.errors.join('\n  ')}`)

  return parsed.workflow
}

// The frames a request asks for at one width (the area's; band's, the
// band's), and the file they go to by default.
function render(args: Args, times: readonly number[], columns: number): { frames: Canvas[]; name: string } {
  const { what, id, opts } = args
  const known = OPTIONS[what]
  if ((what === 'band' || what === 'waiting' || what === 'turn' || what === 'demo-work' || what === 'dj') && id !== undefined) throw new Error(`unexpected "${id}" for ${what}\n${USAGE}`)
  if (known !== undefined) {
    for (const name of opts.keys()) {
      if (!known.includes(name) && !COMMON.includes(name)) throw new Error(`unknown option --${name} for ${what}\n${USAGE}`)
    }
  }
  const size: AreaSize = { columns, rows: rowsOpt(opts) }
  const need = () => {
    if (id === undefined) throw new Error(`${what} needs an id\n${USAGE}`)

    return id
  }
  switch (what) {
    case 'scene': {
      const reaction = opts.get('reaction')
      if (reaction !== undefined && reaction !== 'advance' && reaction !== 'failure') throw new Error(`--reaction is advance or failure, not "${reaction}"`)
      const frames = sceneFrames(
        need(),
        {
          reaction,
          auditing: opts.has('auditing'),
          mode: opts.get('mode') as 'thinking' | 'responding' | undefined,
          phase: opts.get('phase'),
          what: opts.get('what'),
          say: opts.get('say'),
          calm: opts.has('calm'),
        },
        times,
        size,
      )

      return { frames, name: `frames-scene-${id}.png` }
    }
    case 'idle':
      return { frames: idleFrames(need(), opts.has('doze'), times, size, opts.has('calm')), name: `frames-idle-${id?.replace(/[:*]/g, '-')}${opts.has('doze') ? '-doze' : ''}.png` }
    case 'waiting': {
      const agents = listOpt(opts, 'agents')
      const scene = opts.get('scene') ?? FALLBACK_WAITING
      const isDemo = opts.has('demo')
      if (isDemo && opts.has('agents')) throw new Error(`waiting takes --agents or --demo, not both\n${USAGE}`)
      const frames = waitingFrames(isDemo ? 'demo' : agents, times, size, scene, opts.has('calm'))

      return { frames, name: `frames-waiting-${scene}-${isDemo ? 'demo' : agents.join('-')}.png` }
    }
    case 'dj': {
      const agents = listOpt(opts, 'agents')
      const frames = djFrames(
        {
          track: opts.get('track'),
          agents: opts.has('agents') ? agents : undefined,
          changedAt: opts.has('changed-at') ? numberOpt(opts, 'changed-at', 0) : undefined,
          working: opts.has('working'),
          calm: opts.has('calm'),
          demo: opts.has('demo'),
          party: opts.has('party'),
        },
        times,
        size,
      )

      return { frames, name: `frames-dj${opts.has('demo') ? '-demo' : ''}${agents.length > 0 ? `-${agents.join('-')}` : ''}.png` }
    }
    case 'band': {
      const stage = opts.get('stage')
      if (stage === undefined) throw new Error(`band needs --stage\n${USAGE}`)
      const frames = bandFrames(
        {
          stage,
          feature: opts.get('feature'),
          message: opts.get('message'),
          columns,
          maxRows: opts.has('max-rows') ? numberOpt(opts, 'max-rows', 0) : undefined,
          width: widthOpt(opts),
          agents: listOpt(opts, 'agents'),
          auditing: opts.has('auditing'),
          working: opts.has('working'),
          scene: opts.get('scene'),
          workflow: workflowOpt(opts),
          idle: opts.get('idle'),
          tasks: tasksOpt(opts),
          calm: opts.has('calm'),
        },
        times,
      )

      return { frames, name: `frames-band-${stage}.png` }
    }
    case 'turn': {
      const frames = turnFrames(
        {
          stage: opts.get('stage'),
          scene: opts.get('scene'),
          idle: opts.get('idle'),
          start: opts.has('start') ? numberOpt(opts, 'start', 0) : undefined,
          end: opts.has('end') ? numberOpt(opts, 'end', 0) : undefined,
          calm: opts.has('calm'),
        },
        times,
        size,
      )

      return { frames, name: `frames-turn-${opts.get('scene') ?? opts.get('stage') ?? 'standing'}.png` }
    }
    case 'demo-work': {
      const frames = workDemoFrames(
        {
          stage: opts.get('stage'),
          scene: opts.get('scene'),
          seconds: opts.has('seconds') ? numberOpt(opts, 'seconds', 3, 1) : undefined,
          workflow: workflowOpt(opts),
        },
        times,
        size,
      )

      return { frames, name: `frames-demo-work-${opts.get('scene') ?? opts.get('stage') ?? 'standing'}.png` }
    }
    default:
      throw new Error(`unknown "${what}"\n${USAGE}`)
  }
}

// stills <kind>: one frame per picture, at each width asked for (a row of
// pictures per width with a list).
function stills(args: Args): { path: string; width: number; height: number } {
  const { id: kind, opts } = args
  if (kind === undefined) throw new Error(`stills needs a kind: ${STILL_KINDS.join(', ')}\n${USAGE}`)
  for (const name of opts.keys()) {
    if (!['columns', 'rows', 'columns-per-row', 'scale', 'out'].includes(name)) throw new Error(`unknown option --${name} for stills\n${USAGE}`)
  }
  const widths = columnsOpt(opts, 'stills')
  const isList = widths.length > 1
  const drawn = widths.map(columns => ({ columns, ...stillFrames(kind, { columns, rows: rowsOpt(opts) }) }))
  const frames = drawn.flatMap(d => d.frames)
  const captions = drawn.flatMap(d => d.captions.map(c => (isList ? `${c}, ${d.columns} cols` : c)))
  const isWide = Math.max(...frames.map(f => f.cols)) > 64
  const sheet = contactSheet(frames, captions, numberOpt(opts, 'columns-per-row', isList ? Math.max(...drawn.map(d => d.frames.length)) : isWide ? 2 : 4, 1))
  const { width, height, rgba } = toRgba(sheet, numberOpt(opts, 'scale', 1, 1))
  const path = opts.get('out') ?? `frames-stills-${kind}.png`
  writeFileSync(path, encodePng(width, height, rgba))

  return { path, width, height }
}

export function main(argv: readonly string[]): { path: string; width: number; height: number } {
  const args = parseArgs(argv)
  if (args.what === 'stills') return stills(args)
  // The work demo's defaults: the middle of each of its 14 steps.
  const isWork = args.what === 'demo-work'
  const seconds = isWork && args.opts.has('seconds') ? numberOpt(args.opts, 'seconds', 3, 1) : 3
  const from = numberOpt(args.opts, 'from', isWork ? seconds * 500 : 0)
  const every = numberOpt(args.opts, 'every', args.what === 'turn' ? 500 : isWork ? seconds * 1000 : 250)
  const widths = columnsOpt(args.opts, args.what)
  // Several widths: a row of frames per width.
  const isList = widths.length > 1
  const count = numberOpt(args.opts, 'count', isWork ? 14 : isList ? 4 : 16)
  if (count < 1) throw new Error('--count must be at least 1')
  const times = Array.from({ length: count }, (_, i) => from + i * every)
  const rendered = widths.map(columns => render(args, times, columns))
  const frames = rendered.flatMap(r => r.frames)
  const captions = widths.flatMap(columns => times.map(t => (isList ? `${columns} cols, t=${t}ms` : `t=${t}ms`)))
  const isWide = Math.max(...frames.map(f => f.cols)) > 64
  const sheet = contactSheet(frames, captions, numberOpt(args.opts, 'columns-per-row', isList ? count : isWide ? 2 : 4, 1))
  const { name } = rendered[0]!
  const { width, height, rgba } = toRgba(sheet, numberOpt(args.opts, 'scale', 1, 1))
  const path = args.opts.get('out') ?? name
  writeFileSync(path, encodePng(width, height, rgba))

  return { path, width, height }
}

if (require.main === module) {
  try {
    const { path, width, height } = main(process.argv.slice(2))
    console.log(`wrote ${path} (${width}x${height})`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
