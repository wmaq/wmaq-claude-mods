// The module's own state, the paint sites it repaints, and the small rules
// over them that need no engine. register.tsx makes one Mod per load.

import type { IdleId, WidthSetting, Workflow } from '../types'
import { EMPTY_ROSTER, type Roster } from './agents'
import type { Heard } from './auto'
import type { BandSite } from './band'
import { COMMAND, toolNameFor } from './prompt'
import type { Demo } from './demo'
import { createDirector, type Director } from './director'
import { type Cost, type EntryKey, NO_COST } from './history'
import { DEEP_SLEEP_MS, DOZE_MS } from './idle'
import type { PixelBuffer } from './pixels'
import { storeKey } from './progress'
import { type AreaSize, FADE_MS, type SceneId, STAGE_W } from './scene'
import { type Cast, TOON_ROWS } from './toon'
import { dealWaiting, FALLBACK_WAITING, NEW_DEAL, type WaitingDeal, type WaitingSceneId } from './waiting/deal'
import { EMPTY_LOG, freesAt, seat, type SeatEntry, type SeatLog } from './waiting/seats'
import { type Activity, createActivity } from './work'
import { DEFAULT_WIDTH } from './width'
import { DEFAULT_WORKFLOW } from './workflow'

export const PLUGIN = 'stage-toons'
// Refused blits in a row before the loop gives up: the band's Raster is
// gone, as when the person collapses the band. Until a blit since the last
// render has been taken, refusals are expected for a moment (after a resize
// the old Raster stays mounted until the new one paints), so it waits longer.
export const MAX_REFUSED = 3
export const MAX_REFUSED_UNSEEN = 24

// The Raster the mod repaints: the band's area, keyed 'area', at the size
// the band's hook worked out (band.ts' areaSize). lastCells
// and blittedAt: the frame the Raster shows and when it was sent; isAsleep:
// the area stopped on its still picture (P1).
export type Site = {
  requestId: string | undefined
  columns: number
  rows: number
  isAnimating: boolean
  isSeen: boolean
  lastCells: string | null
  blittedAt: number
  isAsleep: boolean
  // Wakes the loop from its sleep between frames (paint.ts), while it
  // sleeps.
  wake: (() => void) | null
}

// What the area shows, by name, and how to draw it at any later time and
// size, on its own clock (frames.ts): the name changes exactly when the
// picture changes to another one.
export type Picture = { name: string; draw: (now: number, size: AreaSize) => PixelBuffer }

// Whether the area is dissolving from one picture into the next.
export const isFading = (mod: Mod, now: number): boolean => mod.fade !== null && now - mod.fade.at < FADE_MS

// How often a site repaints: a scene, a demo, the waiting toon and a
// dissolve about twelve times a second; the idle Clawd is calm, and calmer
// dozing.
export function frameMs(mod: Mod, now: number): number {
  if (mod.isBandWorking || mod.demo !== null || (mod.seats.since !== null && !mod.isWaitingBroken) || isFading(mod, now)) return 83

  return now - mod.idleSince >= DOZE_MS ? 333 : 166
}
// How often the area checks the agent list while it knows of agents.
export const AGENT_POLL_MS = 2000

export const createSite = (): Site => ({ requestId: undefined, columns: STAGE_W, rows: TOON_ROWS, isAnimating: false, isSeen: false, lastCells: null, blittedAt: 0, isAsleep: false, wake: null })

// A frame the same as the one shown is not sent again, but one is sent at
// least this often: a blit is how the loop learns its Raster is gone.
export const RESEND_MS = 2000

// Whether the idle Clawd is deep asleep: Claude does not work, nothing
// else plays in the area, nothing dissolves, and he has dozed for
// DEEP_SLEEP_MS. (idleSince is the last turn's end: a long turn must not
// count as dozing.)
export const isDeepAsleep = (mod: Mod, now: number): boolean =>
  !mod.isBandWorking &&
  mod.demo === null &&
  (mod.seats.since === null || mod.isWaitingBroken) &&
  !isFading(mod, now) &&
  now - mod.idleSince >= DOZE_MS + DEEP_SLEEP_MS

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
  // The picture the area showed last, drawn as it was in that frame, and
  // the dissolve from an older one into what shows now, if one runs.
  shown: Picture | null
  fade: { from: Picture; at: number } | null
  broken: Set<SceneId>
  // What Claude is doing right now (work.ts), as the layer over the stage's
  // scene shows it, and whether the layer shows (/stage bubbles).
  activity: Activity
  isBubbles: boolean
  // How wide the area may grow (/stage width).
  width: WidthSetting
  // What the scenes draw with (frames.ts's castOf), built once.
  cast: Cast | null
  // The agents known and their helpers at the desk row; whether the
  // waiting toon threw (the idle routine stands in for the session).
  roster: Roster
  seats: SeatLog
  isWaitingBroken: boolean
  // The waiting period's scene, dealt as it starts; the helpers that left
  // in it (the conveyor's boxes still carry their marks); the scenes that
  // threw this session.
  waiting: { since: number | null; scene: WaitingSceneId; deal: WaitingDeal; past: SeatEntry[]; broken: Set<WaitingSceneId> }
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
  band: createSite(),
  idleSince: 0,
  idle: 'classic',
  nextIdle: 'classic',
  brokenIdle: new Set(),
  isBandWorking: false,
  lastBand: null,
  demo: null,
  demoLineIndex: 0,
  shown: null,
  fade: null,
  broken: new Set(),
  activity: createActivity(),
  isBubbles: true,
  width: DEFAULT_WIDTH,
  cast: null,
  roster: EMPTY_ROSTER,
  seats: EMPTY_LOG,
  isWaitingBroken: false,
  waiting: { since: null, scene: FALLBACK_WAITING, deal: NEW_DEAL, past: [], broken: new Set() },
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

// How long a helper that left is remembered after its seat frees: longer
// than a box takes from the last seat to the belt's end.
export const PAST_MS = 5000

// The seat log moved on to now; a waiting period that starts is dealt its
// scene, one that ended restarts the idle clock where it ended.
export function reseat(mod: Mod, now: number) {
  const before = mod.seats
  const { log, endedAt } = seat(before, mod.roster, now, isWaitingShown(mod))
  mod.seats = log
  if (log.since !== mod.waiting.since) {
    mod.waiting = { ...mod.waiting, since: log.since, past: [] }
    if (log.since !== null) {
      const { scene, deal } = dealWaiting(mod.waiting.deal, mod.waiting.broken, log.since)
      mod.waiting = { ...mod.waiting, scene, deal }
    }
  } else if (log.since !== null) {
    const isKept = (e: SeatEntry) => log.entries.some(n => n.agentId === e.agentId && n.arrivedAt === e.arrivedAt)
    // Only helpers that walked out: one dropped unseen before its walk is
    // done would be drawn walking over its seat's next helper.
    const left = before.entries.filter(e => e.leftAt !== null && !isKept(e) && freesAt(e) <= now)
    const past = mod.waiting.past.filter(e => now - freesAt(e) < PAST_MS)
    if (left.length > 0 || past.length !== mod.waiting.past.length) mod.waiting = { ...mod.waiting, past: [...past, ...left] }
  }
  // Never backwards: a period that ended unseen may report an end before
  // the main turn's own.
  if (endedAt !== null) mod.idleSince = Math.max(mod.idleSince, endedAt)
}

// The next waiting scene from the deck, for a waiting demo that names
// none; seed: the demo's start.
export function takeWaiting(mod: Mod, seed: number): WaitingSceneId {
  const { scene, deal } = dealWaiting(mod.waiting.deal, mod.waiting.broken, seed)
  mod.waiting = { ...mod.waiting, deal }

  return scene
}

// Ends the demo and has the band drawn again without it.
export function endDemo(mod: Mod, invalidate: () => void) {
  mod.demo = null
  invalidate()
}
