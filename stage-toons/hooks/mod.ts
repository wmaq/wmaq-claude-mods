// The module's own state, the paint sites it repaints, and the small rules
// over them that need no engine. register.tsx makes one Mod per load.

import type { IdleId, Workflow } from '../types'
import { EMPTY_ROSTER, type Roster } from './agents'
import type { Heard } from './auto'
import type { BandSite } from './band'
import { COMMAND, toolNameFor } from './prompt'
import type { Demo } from './demo'
import { createDirector, type Director } from './director'
import { type Cost, type EntryKey, NO_COST } from './history'
import { DEEP_SLEEP_MS, DOZE_MS } from './idle'
import { storeKey } from './progress'
import { type SceneId, STAGE_W } from './scene'
import { type Cast, TOON_ROWS } from './toon'
import { EMPTY_LOG, seat, type SeatLog } from './waiting/seats'
import { DEFAULT_WORKFLOW } from './workflow'

export const PLUGIN = 'stage-toons'
// Refused blits in a row before the loop gives up: the spinner it painted is
// gone, as when a background agent's row closes. Until a blit since the last
// render has been taken, refusals are expected for a moment (after a resize
// the old Raster stays mounted until the new one paints), so it waits longer.
export const MAX_REFUSED = 3
export const MAX_REFUSED_UNSEEN = 24

// A Raster the mod repaints: the toon under the spinner, or the band's
// area. Its key is its kind.
export type SiteKind = 'toon' | 'area'
// lastCells and blittedAt: the frame the Raster shows and when it was
// sent; isAsleep: the area stopped on its still picture (P1).
export type Site = {
  requestId: string | undefined
  kind: SiteKind
  columns: number
  rows: number
  isAnimating: boolean
  isSeen: boolean
  lastCells: string | null
  blittedAt: number
  isAsleep: boolean
}

// How often a site repaints: the idle Clawd is calm, and calmer dozing.
export function frameMs(mod: Mod, kind: SiteKind, now: number): number {
  if (kind !== 'area' || mod.demo !== null || (mod.seats.since !== null && !mod.isWaitingBroken)) return 83

  return now - mod.idleSince >= DOZE_MS ? 333 : 166
}
// How often the area checks the agent list while it knows of agents.
export const AGENT_POLL_MS = 2000

export const createSite = (kind: SiteKind): Site => ({ requestId: undefined, kind, columns: STAGE_W, rows: TOON_ROWS, isAnimating: false, isSeen: false, lastCells: null, blittedAt: 0, isAsleep: false })

// A frame the same as the one shown is not sent again, but one is sent at
// least this often: a blit is how the loop learns its Raster is gone.
export const RESEND_MS = 2000

// Whether the idle Clawd is deep asleep: nothing else plays in the area,
// and he has dozed for DEEP_SLEEP_MS.
export const isDeepAsleep = (mod: Mod, now: number): boolean =>
  mod.demo === null && (mod.seats.since === null || mod.isWaitingBroken) && now - mod.idleSince >= DOZE_MS + DEEP_SLEEP_MS

// The module's own state: made fresh by every load, so it starts over on a
// reload. What must outlive a reload is in $.state.
export type Mod = {
  key: string
  // The session's workflow, and whether it came from the project's file.
  workflow: Workflow
  workflowSource: 'file' | 'default'
  toolName: string
  commandName: string
  director: Director
  auditors: Set<string>
  lastFailureAt: number | null
  isHidden: boolean
  surface: string | null
  // The toons under the spinners shown, by requestId: the main one, and a
  // background agent's row's (its requestId is the agent's id). Each has
  // its own paint loop.
  toons: Map<string, Site>
  band: Site
  // When Claude last went idle: the session's start or the main turn's end.
  idleSince: number
  // The idle routine on show, the one picked for the next idle period, and
  // routines that threw this session.
  idle: IdleId
  nextIdle: IdleId
  brokenIdle: Set<IdleId>
  // Whether the band was last drawn while Claude worked, and what it was
  // last drawn in (null before it is first drawn).
  isBandWorking: boolean
  lastBand: BandSite | null
  demo: Demo | null
  // The demo scene the band's text line names.
  demoLineIndex: number
  broken: Set<SceneId>
  // What the toon draws with (frames.ts's castOf), built once.
  cast: Cast | null
  // The agents known and their helpers at the desk row; whether the
  // waiting toon threw (the idle routine stands in for the session).
  roster: Roster
  seats: SeatLog
  isWaitingBroken: boolean
  // Automatic moves: whether they are on, whether the project is on a
  // Windows path (globs ignore case there), and the notes for Claude about
  // moves it has not heard of yet.
  isAuto: boolean
  isWindows: boolean
  notes: string[]
  // A skill the person types: the command heard (command.run) and the
  // skill expanded (skill.prompt), each kept until the other comes, for
  // TYPED_SKILL_MS, or until the main turn's end.
  typedCommand: Heard | null
  expandedSkill: Heard | null
  // Since when Claude's working time is counted for the current history
  // entry: the main turn's start or the last move in it; null between turns.
  workSince: number | null
  // The history entry that time goes to, found again by stage and start
  // in a copy another session saved.
  workEntry: EntryKey | null
  // The tokens of the turns that ended since the main turn's last end (its
  // subagents'), credited with the next main turn's end.
  turnTokens: Cost
  // Whether a newer version's progress is in the store: nothing is saved.
  isReadOnly: boolean
  // Every move runs in turn on this queue.
  queue: Promise<unknown>
}

export const createMod = (): Mod => ({
  key: storeKey(''),
  workflow: DEFAULT_WORKFLOW,
  workflowSource: 'default',
  toolName: toolNameFor(PLUGIN),
  commandName: COMMAND,
  director: createDirector('mystery-box', false),
  auditors: new Set(),
  lastFailureAt: null,
  isHidden: false,
  surface: 'terminal',
  toons: new Map(),
  band: createSite('area'),
  idleSince: 0,
  idle: 'classic',
  nextIdle: 'classic',
  brokenIdle: new Set(),
  isBandWorking: false,
  lastBand: null,
  demo: null,
  demoLineIndex: 0,
  broken: new Set(),
  cast: null,
  roster: EMPTY_ROSTER,
  seats: EMPTY_LOG,
  isWaitingBroken: false,
  isAuto: true,
  isWindows: false,
  notes: [],
  typedCommand: null,
  expandedSkill: null,
  workSince: null,
  workEntry: null,
  turnTokens: NO_COST,
  isReadOnly: false,
  queue: Promise.resolve(),
})

// Runs a move after the moves before it, so each reads the progress the
// last one left. A move that fails does not hold up the next.
export function queued<T>(mod: Mod, run: () => Promise<T>): Promise<T> {
  const done = mod.queue.then(run, run)
  mod.queue = done.catch(() => undefined)

  return done
}

// Whether the real waiting toon is on screen: the band's area mounted, no
// demo over it, not hidden, and Claude not working.
export const isWaitingShown = (mod: Mod): boolean => mod.band.requestId !== undefined && mod.demo === null && !mod.isHidden && !mod.isBandWorking

// The seat log moved on to now; a waiting period that ended restarts the
// idle clock where it ended.
export function reseat(mod: Mod, now: number) {
  const { log, endedAt } = seat(mod.seats, mod.roster, now, isWaitingShown(mod))
  mod.seats = log
  // Never backwards: a period that ended unseen may report an end before
  // the main turn's own.
  if (endedAt !== null) mod.idleSince = Math.max(mod.idleSince, endedAt)
}

// Stops the toon under one spinner: its loop ends at its next frame.
export function stopToon(mod: Mod, id: string) {
  const site = mod.toons.get(id)
  if (!site) return
  site.requestId = undefined
  mod.toons.delete(id)
}

// Ends the demo and has the band drawn again without it.
export function endDemo(mod: Mod, invalidate: () => void) {
  mod.demo = null
  invalidate()
}
