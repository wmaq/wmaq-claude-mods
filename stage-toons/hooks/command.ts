// /stage: what its arguments ask for, the move it makes, and what it shows.

import type { Progress, StageId, Workflow } from '../types'
import { DEMO_MAX, DEMO_MIN, DEMO_SECONDS } from './demo'
import { applyMove, backStage, describe, nextStage, parseStage, stageLabel } from './stages'
import { zeroStage } from './workflow'

export type Command =
  | { kind: 'show' }
  | { kind: 'move'; stage: StageId }
  | { kind: 'next' }
  | { kind: 'back' }
  | { kind: 'feature'; name: string }
  | { kind: 'message'; text: string }
  | { kind: 'hide' }
  | { kind: 'demo'; seconds: number }
  | { kind: 'demo-stop' }
  | { kind: 'usage' }

export function usage(w: Workflow): string {
  const zero = zeroStage(w)
  const stages = [...w.track.map((s, i) => `${i + 1} ${s.id}`), ...w.side.map(s => (s === zero ? `0 ${s.id}` : s.id))]

  return [
    'Usage: /stage [n | id | next | back | feature <name> | message <text> | hide | demo [seconds]]',
    '  /stage                  show the current stage and the recent moves',
    `  /stage 5, /stage plan   move to a stage${zero ? ` (0 or ? for ${zero.label})` : ''}`,
    '  /stage next, /stage back',
    '  /stage feature <name>   name the feature (/stage feature - clears it)',
    '  /stage message <text>   set the status message',
    '  /stage hide             hide or show the bar and the cartoons',
    `  /stage demo [seconds]   play every scene, ${DEMO_SECONDS} s each (${DEMO_MIN} to ${DEMO_MAX}); /stage demo stop ends it`,
    `Stages: ${stages.join(', ')}`,
  ].join('\n')
}

export function parseCommand(w: Workflow, args: string): Command {
  const text = args.trim()
  if (text === '') return { kind: 'show' }
  const head = text.split(/\s+/)[0] ?? ''
  const tail = text.slice(head.length).trim()
  const word = head.toLowerCase()
  if (word === 'feature') return tail ? { kind: 'feature', name: tail } : { kind: 'usage' }
  if (word === 'message') return tail ? { kind: 'message', text: tail } : { kind: 'usage' }
  if (word === 'demo') return parseDemo(tail.toLowerCase())
  if (tail !== '') return { kind: 'usage' }
  if (word === 'next' || word === 'back' || word === 'hide') return { kind: word }
  const stage = parseStage(w, word)

  return stage ? { kind: 'move', stage } : { kind: 'usage' }
}

function parseDemo(arg: string): Command {
  if (arg === '') return { kind: 'demo', seconds: DEMO_SECONDS }
  if (arg === 'stop') return { kind: 'demo-stop' }
  const seconds = /^\d+$/.test(arg) ? Number(arg) : NaN

  return seconds >= DEMO_MIN && seconds <= DEMO_MAX ? { kind: 'demo', seconds } : { kind: 'usage' }
}

export function moveFor(w: Workflow, p: Progress, cmd: Command, now: number): Progress {
  const by = 'user'
  switch (cmd.kind) {
    case 'move':
      return applyMove(w, p, { stage: cmd.stage, by, at: now })
    case 'next':
      return applyMove(w, p, { stage: nextStage(w, p), by, at: now })
    case 'back':
      return applyMove(w, p, { stage: backStage(w, p), by, at: now })
    case 'feature':
      return applyMove(w, p, { stage: p.stage, feature: cmd.name === '-' ? '' : cmd.name, by, at: now })
    case 'message':
      return applyMove(w, p, { stage: p.stage, message: cmd.text, by, at: now })
    default:
      return p
  }
}

const ago = (ms: number): string =>
  ms < 60_000 ? 'just now' : ms < 3_600_000 ? `${Math.floor(ms / 60_000)}m ago` : ms < 86_400_000 ? `${Math.floor(ms / 3_600_000)}h ago` : `${Math.floor(ms / 86_400_000)}d ago`

export function showText(w: Workflow, p: Progress, now: number): string {
  const lines = [`Stage ${describe(w, p)}`]
  const recent = p.history.slice(-5).reverse()
  if (recent.length > 0) lines.push('Recent moves:', ...recent.map(h => `  ${stageLabel(w, h.stage)} by ${h.by}, ${ago(now - h.at)}`))

  return lines.join('\n')
}
