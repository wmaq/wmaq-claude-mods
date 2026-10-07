// /stage: what its arguments ask for, the move it makes, and what it shows.

import type { Progress, StageDef, StageId, WidthSetting, Workflow, WorkflowSettings } from '../types'
import { ruleText } from './auto'
import { DEMO_MAX, DEMO_MIN, DEMO_SECONDS, DJ_DEMO_SECONDS, WORK_DEMO_SECONDS } from './demo'
import { ago, LOG_DEFAULT } from './history'
import { type Music, trackLine } from './nowplaying'
import { applyMove, backStage, describe, HISTORY_MAX, nextStage, parseStage, stageLabel } from './stages'
import { isWaitingScene, WAITING_SCENE_IDS, type WaitingSceneId } from './waiting/deal'
import { DEFAULT_WIDTH, parseWidth, WIDTH_MAX, widthSettingWords } from './width'
import { allStages, DONE_ID, doneOf, RESERVED_IDS, stageIds, zeroStage } from './workflow'

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
  | { kind: 'demo-work'; seconds: number }
  | { kind: 'demo-waiting'; scene: WaitingSceneId | null }
  | { kind: 'demo-dj'; seconds: number }
  | { kind: 'demo-stop' }
  | { kind: 'workflow' }
  | { kind: 'workflow-init' }
  | { kind: 'workflow-reload' }
  | { kind: 'auto'; isOn: boolean | null }
  | { kind: 'bubbles'; isOn: boolean | null }
  | { kind: 'calm'; isOn: boolean | null }
  | { kind: 'dj'; isOn: boolean | null }
  | { kind: 'width'; width: WidthSetting | null }
  | { kind: 'width-usage' }
  | { kind: 'log'; count: number }
  | { kind: 'time' }
  | { kind: 'help' }
  | { kind: 'usage' }

export const WORKFLOW_FILE = '.claude/stage-toons.json'

export function usage(w: Workflow): string {
  const zero = zeroStage(w)
  const stages = [...w.track.map((s, i) => `${i + 1} ${s.id}`), DONE_ID, ...w.side.map(s => (s === zero ? `0 ${s.id}` : s.id))]

  return [
    'Usage: /stage [n | id | next | back | feature <name> | message <text> | hide | demo [<stage> | idle | work | dj] [seconds] | demo waiting [scene] | demo stop | workflow [init | reload] | auto [on | off] | bubbles [on | off] | calm [on | off] | dj [on | off] | width [<n> | full] | log [n] | time | help]',
    '  /stage                  show the current stage and the recent moves',
    `  /stage 5, /stage plan   move to a stage${zero ? ` (0 or ? for ${zero.label})` : ''}`,
    '  /stage next, /stage back',
    '  /stage done             the feature is finished (merged); the next move starts a new one',
    '  /stage feature <name>   name the feature (/stage feature - clears it)',
    '  /stage message <text>   set the status message',
    '  /stage hide             hide or show the bar and the cartoons',
    `  /stage demo [<stage> | idle] [seconds]  play every scene, one stage's scenes, or the idle routines, ${DEMO_SECONDS} s each (${DEMO_MIN} to ${DEMO_MAX}); /stage demo stop ends it`,
    `  /stage demo waiting [scene]  play the toon shown while Claude waits on agents, about 25 s, in one of its scenes (${WAITING_SCENE_IDS.join(', ')}), or the next one dealt`,
    `  /stage demo work [seconds]  play what Clawd shows while Claude works: thinking, each kind of tool, his lines, ${WORK_DEMO_SECONDS} s each`,
    `  /stage demo dj [seconds]  play Clawd DJ: a long title, a track change, two helpers dancing, ${DJ_DEMO_SECONDS} s`,
    '  /stage workflow [init | reload]  show the workflow; write the default to .claude/stage-toons.json; read the file again',
    "  /stage auto [on | off]  show the workflow's rules for moving the stage by itself; turn them on or off",
    "  /stage bubbles [on | off]  whether Clawd's pop-ups show: what Claude is doing over his head, and what he says",
    '  /stage calm [on | off]  whether the cartoons hold still, changing only when something happens',
    "  /stage dj [on | off]    Clawd DJ: while Spotify plays, Clawd at the decks and the track's name (Windows)",
    `  /stage width [<n> | full]  how wide the cartoons may grow under the bar (${DEFAULT_WIDTH} columns by default, ${WIDTH_MAX} at most)`,
    `  /stage log [n]          the last n moves (${LOG_DEFAULT}; up to ${HISTORY_MAX}) with how long each stage lasted`,
    '  /stage time             time per feature and per stage, wall-clock and Claude working',
    '  /stage help             this list',
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
  if (word === 'auto' || word === 'bubbles' || word === 'calm' || word === 'dj') {
    const sub = tail.toLowerCase()
    if (sub === '') return { kind: word, isOn: null }

    return sub === 'on' || sub === 'off' ? { kind: word, isOn: sub === 'on' } : { kind: 'usage' }
  }
  if (word === 'width') {
    if (tail === '') return { kind: 'width', width: null }
    const width = parseWidth(tail.toLowerCase())

    return width === null ? { kind: 'width-usage' } : { kind: 'width', width }
  }
  if (word === 'log') {
    if (tail === '') return { kind: 'log', count: LOG_DEFAULT }
    const count = /^\d+$/.test(tail) ? Number(tail) : NaN

    return count >= 1 && count <= HISTORY_MAX ? { kind: 'log', count } : { kind: 'usage' }
  }
  if (word === 'workflow') {
    const sub = tail.toLowerCase()
    if (sub === '') return { kind: 'workflow' }
    if (sub === 'init') return { kind: 'workflow-init' }
    if (sub === 'reload') return { kind: 'workflow-reload' }

    return { kind: 'usage' }
  }
  if (tail !== '') return { kind: 'usage' }
  if (word === 'next' || word === 'back' || word === 'hide') return { kind: word }
  if (word === 'time') return { kind: 'time' }
  if (word === 'help') return { kind: 'help' }
  const stage = parseStage(w, word)

  return stage ? { kind: 'move', stage } : { kind: 'usage' }
}

// A /stage it doesn't understand: one line, with the stage it may have
// meant when a word names one (/stage set plan), unless the first word is
// a command of its own whose argument was wrong (/stage demo plan 99).
export function unknownText(w: Workflow, args: string): string {
  const words = args.trim().split(/\s+/)
  // done is reserved, but it is a stage: /stage done now may mean it.
  const first = words[0]!.toLowerCase()
  const isCommand = first !== DONE_ID && (RESERVED_IDS as readonly string[]).includes(first)
  const meant = isCommand ? undefined : words.map(word => parseStage(w, word)).find(id => id !== undefined)

  return `Not a /stage command: ${words.join(' ')}.${meant ? ` Did you mean /stage ${meant}?` : ''} /stage help lists them all.`
}

// Seconds as /stage demo takes them: none for the default, else 2 to 60.
function secondsOf(word: string | undefined, fallback = DEMO_SECONDS): number | null {
  if (word === undefined) return fallback
  const seconds = /^\d+$/.test(word) ? Number(word) : NaN

  return seconds >= DEMO_MIN && seconds <= DEMO_MAX ? seconds : null
}

// demo [<stage id> | idle | work | dj] [seconds], demo waiting [scene], or demo stop. A bare
// number is the seconds: stages are named by id only.
function parseDemo(w: Workflow, arg: string): Command {
  const [first, second, ...rest] = arg === '' ? [] : arg.split(/\s+/)
  if (rest.length > 0) return { kind: 'usage' }
  if (first === 'stop') return second === undefined ? { kind: 'demo-stop' } : { kind: 'usage' }
  if (first === 'waiting') {
    if (second === undefined) return { kind: 'demo-waiting', scene: null }

    return isWaitingScene(second) ? { kind: 'demo-waiting', scene: second } : { kind: 'usage' }
  }
  if (first === undefined || /^\d+$/.test(first)) {
    const seconds = second === undefined ? secondsOf(first) : null

    return seconds === null ? { kind: 'usage' } : { kind: 'demo', seconds, stage: null }
  }
  const seconds = secondsOf(second, first === 'work' ? WORK_DEMO_SECONDS : first === 'dj' ? DJ_DEMO_SECONDS : DEMO_SECONDS)
  if (seconds === null) return { kind: 'usage' }
  if (first === 'idle') return { kind: 'demo-idle', seconds }
  if (first === 'dj') return { kind: 'demo-dj', seconds }
  if (first === 'work') return { kind: 'demo-work', seconds }

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

export function showText(w: Workflow, p: Progress, now: number): string {
  const lines = [`Stage ${describe(w, p)}`]
  const recent = p.history.slice(-5).reverse()
  if (recent.length > 0) lines.push('Recent moves:', ...recent.map(h => `  ${stageLabel(w, h.stage)} by ${h.by}${h.via ? ` (${h.via})` : ''}, ${ago(now - h.at)}`))

  return lines.join('\n')
}

// What the project's workflow file starts the session with, or null when
// it sets nothing.
// What a workflow file's settings start, as words: 'automatic moves off and
// the bar hidden'; null when it sets none.
export function settingsWords(settings: WorkflowSettings | undefined): string | null {
  const parts: string[] = []
  if (settings?.auto !== undefined) parts.push(`automatic moves ${settings.auto ? 'on' : 'off'}`)
  if (settings?.hide !== undefined) parts.push(`the bar ${settings.hide ? 'hidden' : 'shown'}`)
  if (settings?.bubbles !== undefined) parts.push(`Clawd's pop-ups ${settings.bubbles ? 'on' : 'off'}`)
  if (settings?.calm !== undefined) parts.push(`calm mode ${settings.calm ? 'on' : 'off'}`)
  if (settings?.width !== undefined) parts.push(widthSettingWords(settings.width))

  return parts.length === 0 ? null : parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

export function settingsText(settings: WorkflowSettings | undefined): string | null {
  const words = settingsWords(settings)

  return words === null ? null : `This project's workflow file starts ${words}.`
}

export function workflowSummary(w: Workflow, source: 'file' | 'default', settings?: WorkflowSettings): string {
  const zero = zeroStage(w)
  const starts = settingsText(settings)
  const lines = [
    source === 'file' ? `Workflow: from ${WORKFLOW_FILE}` : `Workflow: the default (no ${WORKFLOW_FILE}; /stage workflow init writes it there to edit)`,
    ...(starts ? [starts] : []),
    'Track:',
    ...w.track.map((s, i) => `  ${i + 1} ${s.id}: ${s.label} (${s.scenes.join(', ')})${rulesOf(s)}`),
    'Past the track:',
    `  ${DONE_ID}: ${doneOf(w).label} (${doneOf(w).scenes.join(', ')})${rulesOf(doneOf(w))}`,
  ]
  if (w.side.length > 0) lines.push('Side:', ...w.side.map(s => `  ${s === zero ? '0 ' : ''}${s.id}: ${s.label} (${s.scenes.join(', ')})${rulesOf(s)}`))

  return lines.join('\n')
}

const rulesOf = (s: StageDef): string => (s.auto && s.auto.length > 0 ? ` · auto: ${s.auto.map(ruleText).join('; ')}` : '')

// /stage auto: whether the stage moves by itself, and on what; fileAuto,
// what the project's workflow file starts the session with, if it says.
export function autoText(w: Workflow, isOn: boolean, fileAuto?: boolean): string {
  const stages = allStages(w).filter(s => s.auto && s.auto.length > 0)
  const state = isOn ? 'Automatic moves are on: /stage auto off turns them off.' : 'Automatic moves are off: /stage auto on turns them on.'
  const head = fileAuto === undefined ? [state] : [state, `This project's workflow file starts it ${fileAuto ? 'on' : 'off'}.`]
  if (stages.length === 0) return [...head, `This workflow has no rules: give a stage an "auto" list in ${WORKFLOW_FILE}.`].join('\n')
  const rows = stages.map(s => `  ${s.id}: ${s.auto!.map(ruleText).join('; ')}`)

  return [...head, 'Rules, by the stage they move the work to (only forward on the track, into Done, or into a side stage; from Done only a skill you type):', ...rows].join('\n')
}

// /stage bubbles' answer; fileBubbles, what the project's workflow file
// starts the session with, if it says.
export function bubblesText(isOn: boolean, fileBubbles?: boolean): string {
  const state = isOn
    ? "Clawd's pop-ups are on: what Claude is doing over his head, and what he says. /stage bubbles off turns them off."
    : "Clawd's pop-ups are off. /stage bubbles on turns them on."

  return fileBubbles === undefined ? state : `${state} This project's workflow file starts them ${fileBubbles ? 'on' : 'off'}.`
}

// /stage calm's answer; fileCalm, what the project's workflow file starts
// the session with, if it says.
export function calmText(isOn: boolean, fileCalm?: boolean): string {
  const state = isOn
    ? 'Calm mode is on: the cartoons hold still and change only when something happens. /stage calm off brings the motion back.'
    : 'Calm mode is off: the cartoons move. /stage calm on holds them still.'

  return fileCalm === undefined ? state : `${state} This project's workflow file starts it ${fileCalm ? 'on' : 'off'}.`
}

// /stage dj's answer: whether DJ mode is on, and what the last read
// heard. The track goes to the person only (the answer's text, never
// Claude's context).
export const DJ_NEEDS_WINDOWS = "DJ mode needs Claude Code in a Windows terminal: it reads Spotify through Windows' media session."
export function djText(isOn: boolean, music: Music): string {
  if (!isOn) return "DJ mode is off. /stage dj on: while Spotify plays, Clawd DJs and the track's name shows."
  if (music.isPlaying && music.track) return `DJ mode on: ${trackLine(music.track)}`

  return 'DJ mode on: waiting for Spotify to play. /stage dj off turns it off.'
}

// What a demo's answer adds while calm mode is on.
export const CALM_DEMO_LINE = 'Calm mode is on: the demo moves anyway, and the stills come back when it ends.'

// /stage hide's answer; fileHide, what the project's workflow file starts
// the session with, if it says.
export function hideText(isHidden: boolean, fileHide?: boolean): string {
  const state = isHidden ? 'stage-toons is hidden. /stage hide shows it again.' : 'stage-toons is shown.'

  return fileHide === undefined ? state : `${state} This project's workflow file starts it ${fileHide ? 'hidden' : 'shown'}.`
}
