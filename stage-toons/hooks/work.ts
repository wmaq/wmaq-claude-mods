// What Claude is doing right now, as the layer over the stage's scene shows
// it: the spinner's mode and the tools running, as the hooks hear them,
// settled once a frame into what is on show (a display lasts at least
// MIN_SHOW_MS), with the lines Clawd says. Pure: every change takes the
// time it happens at.

import type { Director } from './director'
import type { Phase } from './phase'
import type { ReactionId } from './scene'

export type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'
// A badge over Clawd's head: a phase's, or the thought puffs.
export type Badge = Phase | 'thinking'
// What shows besides a line: a badge with its label, or the typing dots.
export type Display = { badge: Badge | null; what: string; isTyping: boolean }

export const MIN_SHOW_MS = 1000
export const TOOL_HOLD_MS = 2500
export const LINE_MS = 2500
// How often the typing dots grow, and the thought puffs rise, in seconds.
export const DOTS_S = 0.4
export const PUFFS_S = 0.3

const NOTHING: Display = { badge: null, what: '', isTyping: false }

type Running = { id: string; phase: Phase; what: string }

export type Activity = {
  mode: SpinnerMode | null
  // The tools running, in the order they started.
  running: Running[]
  // The last tool started, and when the last running tool ended (null while
  // one runs, or before any).
  last: { phase: Phase; what: string } | null
  endedAt: number | null
  // The last line said by a hook, and when.
  said: { line: string; at: number } | null
  // What is on show, and since when.
  shown: { display: Display; since: number }
}

export const createActivity = (): Activity => ({ mode: null, running: [], last: null, endedAt: null, said: null, shown: { display: NOTHING, since: -Infinity } })

export const withMode = (a: Activity, mode: SpinnerMode | null): Activity => (a.mode === mode ? a : { ...a, mode })

export const toolStarted = (a: Activity, id: string, phase: Phase, what: string): Activity => ({
  ...a,
  running: [...a.running.filter(r => r.id !== id), { id, phase, what }],
  last: { phase, what },
  endedAt: null,
})

// A tool that ends: once none runs, the hold starts.
export function toolEnded(a: Activity, id: string, now: number): Activity {
  if (!a.running.some(r => r.id === id)) return a
  const running = a.running.filter(r => r.id !== id)

  return { ...a, running, endedAt: running.length === 0 ? now : null }
}

export const said = (a: Activity, line: string, now: number): Activity => ({ ...a, said: { line, at: now } })

const same = (x: Display, y: Display) => x.badge === y.badge && x.what === y.what && x.isTyping === y.isTyping

// What wants to show: the newest running tool, else the last one for
// TOOL_HOLD_MS after the last ended, else the thinking badge or the typing
// dots by the mode; requesting and tool-input keep what shows. A tool
// with no badge (a question to the person, a skill) shows nothing.
export function wanted(a: Activity, now: number): Display {
  const top = a.running.at(-1)
  if (top) return { badge: top.phase, what: top.what, isTyping: false }
  if (a.last && a.endedAt !== null && now - a.endedAt < TOOL_HOLD_MS) return { badge: a.last.phase, what: a.last.what, isTyping: false }
  if (a.mode === 'thinking') return { badge: 'thinking', what: '', isTyping: false }
  if (a.mode === 'responding') return { ...NOTHING, isTyping: true }
  if (a.mode === null || a.mode === 'tool-use') return NOTHING
  // A held badge that has run out shows on until the mode says otherwise.
  return a.shown.display
}

// Moves what wants to show on screen, once what shows has lasted
// MIN_SHOW_MS: in a burst of changes, the ones between are skipped.
export function settleActivity(a: Activity, now: number): Activity {
  const next = wanted(a, now)
  if (same(next, a.shown.display) || now - a.shown.since < MIN_SHOW_MS) return a

  return { ...a, shown: { display: next, since: now } }
}

// The lines, by moment. Each is ASCII and at most 12 characters.
export type LineMoment = 'failure' | 'advance' | 'fable' | 'test-fail' | 'test-pass' | 'commit' | 'push' | 'all-done'
export const LINES: Record<LineMoment, readonly string[]> = {
  failure: ['Oops.', 'Hmm.', 'Not quite.'],
  advance: ['Onward!', 'Next stage!'],
  fable: ['Hi, Fable!'],
  'test-fail': ['Red tests.', 'Back to it.'],
  'test-pass': ['All green!', 'Passing!', 'Tests pass!'],
  commit: ['Committed!', 'Saved it.'],
  push: ['Pushed!', 'Off it goes!'],
  'all-done': ['All done!'],
}

// The line of a moment said at a time: picked by a hash of the time, so the
// same moment always says the same line.
export function lineOf(moment: LineMoment, at: number): string {
  const lines = LINES[moment]
  const h = Math.imul(Math.floor(at) | 0, 0x9e3779b1) >>> 0

  return lines[(h >>> 7) % lines.length]!
}

const REACTION_LINES: Partial<Record<ReactionId, LineMoment>> = { failure: 'failure', advance: 'advance', 'fable-arrives': 'fable' }

// The line on show at a moment: a reaction's, from its start, or a hook's,
// whichever was said last, for LINE_MS.
export function lineAt(a: Activity, director: Director, now: number): string | null {
  const r = director.reaction
  const moment = r ? REACTION_LINES[r.id] : undefined
  const fromReaction = r && moment && now - r.at < LINE_MS ? { line: lineOf(moment, r.at), at: r.at } : null
  const fromHook = a.said && now - a.said.at < LINE_MS ? a.said : null
  if (fromReaction && fromHook) return fromHook.at >= fromReaction.at ? fromHook.line : fromReaction.line

  return (fromHook ?? fromReaction)?.line ?? null
}

// What the layer draws at a moment: a badge with its label, a bubble (a
// line, or the typing dots), and the time since the display came on (the
// puffs and dots move with it). A reaction has the space over Clawd's
// head: the badge and the dots give way, a line stays.
export type Layer = { badge: Badge | null; what: string; bubble: string | null; t: number }

export function layerAt(a: Activity, director: Director, now: number): Layer | null {
  const line = lineAt(a, director, now)
  const { display, since } = a.shown
  const ms = Number.isFinite(since) ? now - since : 0
  const t = ms / 1000
  const isReacting = director.reaction !== null
  const badge = isReacting ? null : display.badge
  const dots = !isReacting && display.isTyping ? '.'.repeat(1 + (Math.floor(ms / (DOTS_S * 1000)) % 3)) : null
  const bubble = line ?? dots
  if (badge === null && bubble === null) return null

  return { badge, what: badge === null || badge === 'thinking' ? '' : display.what, bubble, t }
}
