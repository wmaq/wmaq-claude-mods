// /stage help: a guide to the mod, a page per feature, and the full list
// of commands. Each command line is written once, with the topics it
// belongs to; the list keeps the order /stage help always had.

import type { Workflow } from '../types'
import { DEMO_MAX, DEMO_MIN, DEMO_SECONDS, DJ_DEMO_SECONDS, WORK_DEMO_SECONDS } from './demo'
import { LOG_DEFAULT } from './history'
import { HISTORY_MAX } from './stages'
import { STAGE_W } from './scene'
import { WAITING_SCENE_IDS } from './waiting/deal'
import { DEFAULT_WIDTH, WIDTH_MAX } from './width'
import { DONE_ID, zeroStage } from './workflow'

export const HELP_TOPICS = ['bar', 'auto', 'scenes', 'popups', 'waiting', 'idle', 'done', 'calm', 'width', 'dj', 'history'] as const
export type HelpTopic = (typeof HELP_TOPICS)[number]

export const isHelpTopic = (word: string | null): word is HelpTopic => (HELP_TOPICS as readonly (string | null)[]).includes(word)

const TOPICS: Record<HelpTopic, { summary: string; about: string }> = {
  bar: {
    summary: 'the stages of your workflow, above the prompt',
    about:
      'The bar above the prompt shows where the work is in your workflow: the stage, the feature, a status message under it, and a count of Claude\'s tasks while it keeps a list. Claude moves it with its set_stage tool as the work moves on, and you can move it yourself. Side stages (Debugging, Other) can be entered from any point and left again. Progress is saved per project directory; a project can define its own stages in .claude/stage-toons.json.',
  },
  auto: {
    summary: 'rules that move the bar by themselves',
    about:
      "Some steps are plain to see from what Claude does: loading a skill, writing a spec or a plan, starting a Fable subagent, a push to main that went through. The workflow's rules move the bar on them, only forward on the track, into Done or into a side stage, and only for the main conversation; Claude is told of each move. /stage workflow init writes the rules to .claude/stage-toons.json to edit.",
  },
  scenes: {
    summary: "Clawd's cartoon of the stage while Claude works",
    about:
      'While Claude works, the area below the bar plays the stage\'s scene: 41 pixel-art scenes, a few per stage, dealt like a shuffled deck so each shows before any repeats. When a Fable subagent audits, a violet Clawd with a monocle walks on to review the work. Every change of picture dissolves into the next. The workflow picks each stage\'s scenes; /stage workflow lists them.',
  },
  popups: {
    summary: "what Claude is doing, over Clawd's head",
    about:
      "Over Clawd's head the area shows what Claude is doing: thought puffs while it thinks, an icon and a label for the tool at work (auth.ts, npm test), a speech bubble while it writes the answer. At a few moments he says a line: All green!, Red tests., Committed!, Pushed!, Onward!. The lines are fixed: no model is asked for them.",
  },
  waiting: {
    summary: 'helpers at work beside Clawd while agents run',
    about: `When Claude's turn ends while agents still work (background subagents, a Fable audit, teammates), Clawd steps aside with a coffee and a helper works for each agent, in its model's colour: Sonnet magenta, Opus orange, Fable violet, Haiku teal. Each wait plays one of ${WAITING_SCENE_IDS.length} scenes (${WAITING_SCENE_IDS.join(', ')}); a helper walks off when its agent finishes.`,
  },
  idle: {
    summary: 'Clawd between turns',
    about:
      "When Claude isn't working, Clawd stands at the area's left in one of five routines (classic, Nyan Clawd, coffee, reading, yo-yo), picked each turn; after a minute he sits down and dozes. After the work moves forward on the track, he shows off the finished step's prop once: a map, a light bulb, a scroll, a hammer...",
  },
  done: {
    summary: 'the feature merged and finished',
    about:
      "Past the track's last stage is Done: the track lights up, the bar reads ✓ Done, one of Done's scenes plays (fireworks, a rocket, a victory lap) and Clawd celebrates under confetti between turns. A push to main or gh pr merge moves there by itself. The next move starts a new feature; a move back to the stage Done came from reopens it.",
  },
  calm: {
    summary: 'cartoons that hold still',
    about:
      'Calm mode holds the cartoons still: each picture is one held frame, and the area changes only when something happens (Claude starting or stopping, a move, a helper arriving), dissolving into the next still. The pop-ups stay, held still, and the demos move anyway. For a quieter screen or a slow terminal.',
  },
  width: {
    summary: 'how wide the area under the bar grows',
    about: `The area under the bar is as wide as the band, up to ${DEFAULT_WIDTH} columns by default (${STAGE_W} to ${WIDTH_MAX}, or the band's whole width), and 7 to 9 rows high. Scenes keep their picture at the left and spread their set to the right edge. In a terminal under 35 columns, or too short, the bar shows as text alone.`,
  },
  dj: {
    summary: 'Clawd at the decks while Spotify plays',
    about:
      "Clawd DJ: while Spotify plays, Clawd bobs behind a booth with two turntables, the helpers of agents at work dance on the floor, and from 72 columns a box names the track. It reads Spotify on this computer (Windows' media session, osascript on macOS, playerctl on Linux), with no account or token; the track isn't saved or sent to Claude. The party lights are off by default, for long sessions.",
  },
  history: {
    summary: 'moves, time and cost per stage',
    about: `Each move is kept with its feature, who made it (Claude, you, or auto and why) and how long Claude worked, for the last ${HISTORY_MAX} moves. /stage log lists the recent ones with how long each stage lasted; /stage time totals wall-clock and Claude's working time per feature and per stage, with what the work cost in dollars and tokens.`,
  },
}

export type CommandLine = { topics: HelpTopic[]; text: (w: Workflow) => string }

const line = (topics: HelpTopic[], text: string | ((w: Workflow) => string)): CommandLine => ({ topics, text: typeof text === 'string' ? () => text : text })

export const COMMAND_LINES: CommandLine[] = [
  line(['bar'], '  /stage                  show the current stage and the recent moves'),
  line(['bar'], w => {
    const zero = zeroStage(w)

    return `  /stage 5, /stage plan   move to a stage${zero ? ` (0 or ? for ${zero.label})` : ''}`
  }),
  line(['bar', 'done'], '  /stage next, /stage back'),
  line(['done'], '  /stage done             the feature is finished (merged); the next move starts a new one'),
  line(['bar'], '  /stage feature <name>   name the feature (/stage feature - clears it)'),
  line(['bar'], '  /stage message <text>   set the status message'),
  line(['bar'], '  /stage hide             hide or show the bar and the cartoons'),
  line(['scenes', 'idle'], `  /stage demo [<stage> | idle] [seconds]  play every scene, one stage's scenes, or the idle routines, ${DEMO_SECONDS} s each (${DEMO_MIN} to ${DEMO_MAX}); /stage demo stop ends it`),
  line(['waiting'], `  /stage demo waiting [scene]  play the toon shown while Claude waits on agents, about 25 s, in one of its scenes (${WAITING_SCENE_IDS.join(', ')}), or the next one dealt`),
  line(['popups'], `  /stage demo work [seconds]  play what Clawd shows while Claude works: thinking, each kind of tool, his lines, ${WORK_DEMO_SECONDS} s each`),
  line(['dj'], `  /stage demo dj [seconds]  play Clawd DJ: a long title, a track change, two helpers dancing, ${DJ_DEMO_SECONDS} s`),
  line(['bar', 'auto'], '  /stage workflow [init | reload]  show the workflow; write the default to .claude/stage-toons.json; read the file again'),
  line(['auto'], "  /stage auto [on | off]  show the workflow's rules for moving the stage by itself; turn them on or off"),
  line(['popups'], "  /stage bubbles [on | off]  whether Clawd's pop-ups show: what Claude is doing over his head, and what he says"),
  line(['calm'], '  /stage calm [on | off]  whether the cartoons hold still, changing only when something happens'),
  line(['dj'], "  /stage dj [on | off]    Clawd DJ: while Spotify plays, Clawd at the decks and the track's name (Windows, macOS, Linux)"),
  line(['dj'], "  /stage dj party [on | off]  the DJ's full light show: speakers, floor, booth and box lighting up with the beat (off by default)"),
  line(['width'], `  /stage width [<n> | full]  how wide the cartoons may grow under the bar (${DEFAULT_WIDTH} columns by default, ${WIDTH_MAX} at most)`),
  line(['history'], `  /stage log [n]          the last n moves (${LOG_DEFAULT}; up to ${HISTORY_MAX}) with how long each stage lasted`),
  line(['history'], '  /stage time             time per feature and per stage, wall-clock and Claude working'),
  line([], '  /stage help             the guide: /stage help <topic> for one feature, /stage help commands for this list'),
]

// /stage help commands: every command, and the workflow's stages.
export function usage(w: Workflow): string {
  const zero = zeroStage(w)
  const stages = [...w.track.map((s, i) => `${i + 1} ${s.id}`), DONE_ID, ...w.side.map(s => (s === zero ? `0 ${s.id}` : s.id))]

  return [
    'Usage: /stage [n | id | next | back | feature <name> | message <text> | hide | demo [<stage> | idle | work | dj] [seconds] | demo waiting [scene] | demo stop | workflow [init | reload] | auto [on | off] | bubbles [on | off] | calm [on | off] | dj [on | off | party [on | off]] | width [<n> | full] | log [n] | time | help [<topic> | commands]]',
    ...COMMAND_LINES.map(l => l.text(w)),
    `Stages: ${stages.join(', ')}`,
  ].join('\n')
}

// /stage help [topic]: the overview, a topic's page (with now, what the
// feature's own command answers, when it has a setting), the commands, or
// the topics for a word that names none.
export function helpText(w: Workflow, topic: string | null, now?: string): string {
  if (topic === 'commands') return usage(w)
  if (topic === null) {
    const pad = Math.max(...HELP_TOPICS.map(id => id.length)) + 2

    return [
      'stage-toons: a progress bar of your workflow above the prompt, and Clawd acting out the work in the area below it.',
      '',
      ...HELP_TOPICS.map(id => `  ${id.padEnd(pad)}${TOPICS[id].summary}`),
      '',
      '/stage help <topic> for more on one; /stage help commands for every command.',
    ].join('\n')
  }
  if (!isHelpTopic(topic)) return `No help topic "${topic}". Topics: ${HELP_TOPICS.join(', ')}, commands.`
  const commands = COMMAND_LINES.filter(l => l.topics.includes(topic)).map(l => l.text(w))
  const state = now === undefined ? [] : ['', 'Now:', ...now.split('\n').map(l => `  ${l}`)]

  return [TOPICS[topic].about, '', ...commands, ...state].join('\n')
}
