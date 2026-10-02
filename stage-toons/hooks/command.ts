// /stage: what its arguments ask for, the move it makes, and what it shows.

import type { Progress, StageId } from '../types'
import { applyMove, backStage, describe, nextStage, parseStage, stageLabel } from './stages'

export type Command =
  | { kind: 'show' }
  | { kind: 'move'; stage: StageId }
  | { kind: 'next' }
  | { kind: 'back' }
  | { kind: 'feature'; name: string }
  | { kind: 'message'; text: string }
  | { kind: 'hide' }
  | { kind: 'usage' }

export const USAGE = [
  'Usage: /stage [n | id | next | back | feature <name> | message <text> | hide]',
  '  /stage                  show the current stage and the recent moves',
  '  /stage 5, /stage plan   move to a stage (0 or ? for Other)',
  '  /stage next, /stage back',
  '  /stage feature <name>   name the feature (/stage feature - clears it)',
  '  /stage message <text>   set the status message',
  '  /stage hide             hide or show the bar and the cartoons',
  'Stages: 1 roadmap, 2 brainstorm, 3 spec, 4 spec-audit, 5 plan, 6 plan-audit, 7 develop, 8 claude-test, 9 user-test, 10 cleanup, 0 other',
].join('\n')

export function parseCommand(args: string): Command {
  const text = args.trim()
  if (text === '') return { kind: 'show' }
  const head = text.split(/\s+/)[0] ?? ''
  const tail = text.slice(head.length).trim()
  const word = head.toLowerCase()
  if (word === 'feature') return tail ? { kind: 'feature', name: tail } : { kind: 'usage' }
  if (word === 'message') return tail ? { kind: 'message', text: tail } : { kind: 'usage' }
  if (tail !== '') return { kind: 'usage' }
  if (word === 'next' || word === 'back' || word === 'hide') return { kind: word }
  const stage = parseStage(word)

  return stage ? { kind: 'move', stage } : { kind: 'usage' }
}

export function moveFor(p: Progress, cmd: Command, now: number): Progress {
  const by = 'user'
  switch (cmd.kind) {
    case 'move':
      return applyMove(p, { stage: cmd.stage, by, at: now })
    case 'next':
      return applyMove(p, { stage: nextStage(p), by, at: now })
    case 'back':
      return applyMove(p, { stage: backStage(p), by, at: now })
    case 'feature':
      return applyMove(p, { stage: p.stage, feature: cmd.name === '-' ? '' : cmd.name, by, at: now })
    case 'message':
      return applyMove(p, { stage: p.stage, message: cmd.text, by, at: now })
    default:
      return p
  }
}

const ago = (ms: number): string =>
  ms < 60_000 ? 'just now' : ms < 3_600_000 ? `${Math.floor(ms / 60_000)}m ago` : ms < 86_400_000 ? `${Math.floor(ms / 3_600_000)}h ago` : `${Math.floor(ms / 86_400_000)}d ago`

export function showText(p: Progress, now: number): string {
  const lines = [`Stage ${describe(p)}`]
  const recent = p.history.slice(-5).reverse()
  if (recent.length > 0) lines.push('Recent moves:', ...recent.map(h => `  ${stageLabel(h.stage)} by ${h.by}, ${ago(now - h.at)}`))

  return lines.join('\n')
}
