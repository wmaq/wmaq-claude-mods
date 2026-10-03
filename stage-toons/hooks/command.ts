// /stage: what its arguments ask for, the move it makes, and what it shows.

import type { Progress, StageId, Workflow } from '../types'
import { DEMO_MAX, DEMO_MIN, DEMO_SECONDS } from './demo'
import { applyMove, backStage, describe, nextStage, parseStage, stageLabel } from './stages'
import { stageIds, zeroStage } from './workflow'

export type Command =
  | { kind: 'show' }
  | { kind: 'move'; stage: StageId }
  | { kind: 'next' }
  | { kind: 'back' }
  | { kind: 'feature'; name: string }
  | { kind: 'message'; text: string }
  | { kind: 'hide' }
  | { kind: 'demo'; seconds: number; stage: StageId | null }
  | { kind: 'demo-idle'; seconds: number }
  | { kind: 'demo-stop' }
  | { kind: 'workflow' }
  | { kind: 'workflow-init' }
  | { kind: 'workflow-reload' }
  | { kind: 'usage' }

export const WORKFLOW_FILE = '.claude/stage-toons.json'

export function usage(w: Workflow): string {
  const zero = zeroStage(w)
  const stages = [...w.track.map((s, i) => `${i + 1} ${s.id}`), ...w.side.map(s => (s === zero ? `0 ${s.id}` : s.id))]

  return [
    'Usage: /stage [n | id | next | back | feature <name> | message <text> | hide | demo [<stage> | idle] [seconds] | workflow [init | reload]]',
    '  /stage                  show the current stage and the recent moves',
    `  /stage 5, /stage plan   move to a stage${zero ? ` (0 or ? for ${zero.label})` : ''}`,
    '  /stage next, /stage back',
    '  /stage feature <name>   name the feature (/stage feature - clears it)',
    '  /stage message <text>   set the status message',
    '  /stage hide             hide or show the bar and the cartoons',
    `  /stage demo [<stage> | idle] [seconds]  play every scene, one stage's scenes, or the idle routines, ${DEMO_SECONDS} s each (${DEMO_MIN} to ${DEMO_MAX}); /stage demo stop ends it`,
    '  /stage workflow [init | reload]  show the workflow; write the default to .claude/stage-toons.json; read the file again',
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
  if (word === 'demo') return parseDemo(w, tail.toLowerCase())
  if (word === 'workflow') {
    const sub = tail.toLowerCase()
    if (sub === '') return { kind: 'workflow' }
    if (sub === 'init') return { kind: 'workflow-init' }
    if (sub === 'reload') return { kind: 'workflow-reload' }

    return { kind: 'usage' }
  }
  if (tail !== '') return { kind: 'usage' }
  if (word === 'next' || word === 'back' || word === 'hide') return { kind: word }
  const stage = parseStage(w, word)

  return stage ? { kind: 'move', stage } : { kind: 'usage' }
}

// Seconds as /stage demo takes them: none for the default, else 2 to 60.
function secondsOf(word: string | undefined): number | null {
  if (word === undefined) return DEMO_SECONDS
  const seconds = /^\d+$/.test(word) ? Number(word) : NaN

  return seconds >= DEMO_MIN && seconds <= DEMO_MAX ? seconds : null
}

// demo [<stage id> | idle] [seconds], or demo stop. A bare number is the
// seconds: stages are named by id only.
function parseDemo(w: Workflow, arg: string): Command {
  const [first, second, ...rest] = arg === '' ? [] : arg.split(/\s+/)
  if (rest.length > 0) return { kind: 'usage' }
  if (first === 'stop') return second === undefined ? { kind: 'demo-stop' } : { kind: 'usage' }
  if (first === undefined || /^\d+$/.test(first)) {
    const seconds = second === undefined ? secondsOf(first) : null

    return seconds === null ? { kind: 'usage' } : { kind: 'demo', seconds, stage: null }
  }
  const seconds = secondsOf(second)
  if (seconds === null) return { kind: 'usage' }
  if (first === 'idle') return { kind: 'demo-idle', seconds }

  return stageIds(w).includes(first) ? { kind: 'demo', seconds, stage: first } : { kind: 'usage' }
}

export function moveFor(w: Workflow, p: Progress, cmd: Command, now: number): Progress {
  const by = 'user'
  switch (cmd.kind) {
    case 'move':
      return applyMove(w, p, { stage: cmd.stage, by, at: now })
    case 'next':
      return applyMove(w, p, { stage: nextStage(w, p), by, at: now })
    case 'back': {
      const stage = backStage(w, p)

      return stage === null ? p : applyMove(w, p, { stage, by, at: now })
    }
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

export function workflowSummary(w: Workflow, source: 'file' | 'default'): string {
  const zero = zeroStage(w)
  const lines = [
    source === 'file' ? `Workflow: from ${WORKFLOW_FILE}` : `Workflow: the default (no ${WORKFLOW_FILE}; /stage workflow init writes it there to edit)`,
    'Track:',
    ...w.track.map((s, i) => `  ${i + 1} ${s.id}: ${s.label} (${s.scenes.join(', ')})`),
  ]
  if (w.side.length > 0) lines.push('Side:', ...w.side.map(s => `  ${s === zero ? '0 ' : ''}${s.id}: ${s.label} (${s.scenes.join(', ')})`))

  return lines.join('\n')
}
