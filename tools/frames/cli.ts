// The frame tool's command line: renders stage-toons' drawing to a PNG
// contact sheet. From the repository root:
//   npx -y tsx tools/frames/cli.ts scene bricklaying
//   npx -y tsx tools/frames/cli.ts idle classic --doze
//   npx -y tsx tools/frames/cli.ts waiting --agents fable,sonnet
//   npx -y tsx tools/frames/cli.ts band --stage plan --feature "frame tool" --agents opus
// See README.md beside this file for every option.

import { readFileSync, writeFileSync } from 'node:fs'

import type { Workflow } from '../../stage-toons/types'
import { STAGE_SCENES } from '../../stage-toons/hooks/scenes'
import { parseWorkflow } from '../../stage-toons/hooks/workflow'
import { type Canvas, toRgba } from './grid'
import { encodePng } from './png'
import { contactSheet } from './sheet'
import { bandFrames, idleFrames, sceneFrames, waitingFrames } from './sources'

const USAGE = `usage: npx -y tsx tools/frames/cli.ts <what> [options]
  scene <id> [--reaction advance|failure] [--auditing] [--width N]
  idle <routine> [--doze]
  waiting --agents fable,sonnet,...
  band --stage <id> [--feature F] [--message M] [--columns N] [--max-rows N]
       [--agents a,b] [--auditing] [--working] [--workflow file.json]
common: --from MS (0) --every MS (250) --count N (16) --columns-per-row N (4)
        --scale N (1) --out file.png`

const FLAGS = new Set(['auditing', 'doze', 'working'])

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

function numberOpt(opts: Map<string, string>, name: string, fallback: number): number {
  const raw = opts.get(name)
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} must be a whole number, not "${raw}"`)

  return n
}

const listOpt = (opts: Map<string, string>, name: string): string[] =>
  (opts.get(name) ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '')

function workflowOpt(opts: Map<string, string>): Workflow | undefined {
  const path = opts.get('workflow')
  if (path === undefined) return undefined
  const parsed = parseWorkflow(readFileSync(path, 'utf8'), STAGE_SCENES)
  if ('errors' in parsed) throw new Error(`${path} has errors:\n  ${parsed.errors.join('\n  ')}`)

  return parsed.workflow
}

// The frames a request asks for, and the file they go to by default.
function render(args: Args, times: readonly number[]): { frames: Canvas[]; name: string } {
  const { what, id, opts } = args
  const need = () => {
    if (id === undefined) throw new Error(`${what} needs an id\n${USAGE}`)

    return id
  }
  switch (what) {
    case 'scene': {
      const reaction = opts.get('reaction')
      if (reaction !== undefined && reaction !== 'advance' && reaction !== 'failure') throw new Error(`--reaction is advance or failure, not "${reaction}"`)
      const frames = sceneFrames(need(), { reaction, auditing: opts.has('auditing'), width: opts.has('width') ? numberOpt(opts, 'width', 0) : undefined }, times)

      return { frames, name: `frames-scene-${id}.png` }
    }
    case 'idle':
      return { frames: idleFrames(need(), opts.has('doze'), times), name: `frames-idle-${id}${opts.has('doze') ? '-doze' : ''}.png` }
    case 'waiting': {
      const agents = listOpt(opts, 'agents')

      return { frames: waitingFrames(agents, times), name: `frames-waiting-${agents.join('-')}.png` }
    }
    case 'band': {
      const stage = opts.get('stage')
      if (stage === undefined) throw new Error(`band needs --stage\n${USAGE}`)
      const frames = bandFrames(
        {
          stage,
          feature: opts.get('feature'),
          message: opts.get('message'),
          columns: opts.has('columns') ? numberOpt(opts, 'columns', 100) : undefined,
          maxRows: opts.has('max-rows') ? numberOpt(opts, 'max-rows', 0) : undefined,
          agents: listOpt(opts, 'agents'),
          auditing: opts.has('auditing'),
          working: opts.has('working'),
          workflow: workflowOpt(opts),
        },
        times,
      )

      return { frames, name: `frames-band-${stage}.png` }
    }
    default:
      throw new Error(`unknown "${what}"\n${USAGE}`)
  }
}

export function main(argv: readonly string[]): { path: string; width: number; height: number } {
  const args = parseArgs(argv)
  const from = numberOpt(args.opts, 'from', 0)
  const every = numberOpt(args.opts, 'every', 250)
  const count = numberOpt(args.opts, 'count', 16)
  if (count < 1) throw new Error('--count must be at least 1')
  const times = Array.from({ length: count }, (_, i) => from + i * every)
  const { frames, name } = render(args, times)
  const sheet = contactSheet(frames, times, numberOpt(args.opts, 'columns-per-row', 4))
  const { width, height, rgba } = toRgba(sheet, Math.max(1, numberOpt(args.opts, 'scale', 1)))
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
