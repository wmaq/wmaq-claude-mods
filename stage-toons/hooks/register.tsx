// stage-toons: wires the workflow progress bar and the toons to Claude
// Code's events. What it decides lives in the modules it imports.
//
// The engine reads this module's source before it loads it: $ may be
// passed only to functions declared at the top of this file, and every
// call on it is spelled $.noun.method(...) where it is made. So the helpers
// below are top-level functions that take $ and the module's state.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { IdleId, Progress, ScenePick, SessionWorkflow, StageId, Workflow } from '../types'
import { isAuditorSpawn, isFailureDue, staleAuditors } from './activity'
import { EMPTY_ROSTER, ended, reconcileRoster, type Roster, spawned } from './agents'
import { autoTarget, hasRules, isWindowsPath, relativePath, type Signal, viaOf } from './auto'
import { cropLeft, placeIdle } from './area'
import { bandLayout, bandMode, type BandSite, type Tone, TOON_MIN } from './band'
import { autoText, moveFor, parseCommand, showText, usage, WORKFLOW_FILE, workflowSummary } from './command'
import { type Demo, demoAt, demoLength, demoLine, demoStep, idleDemoAt, idleDemoLine, WAITING_DEMO_LINE } from './demo'
import { createDirector, type Director, react, shot, tick, withAuditing, withScene } from './director'
import { DOZE_MS, FALLBACK_ROUTINE, IDLE_IDS, idleFrame, pickIdle } from './idle'
import { pickOne } from './pick'
import { creditAt, currentEntry, type EntryKey, logText, timeText } from './history'
import { encodeCells } from './pixels'
import { type KV, loadProgress, PRUNE_EVERY_MS, saveProgress, staleKeys, storeKey, validate } from './progress'
import { COMMAND, SECTION_ID, TOOL, TOOL_DESCRIPTION, toolNameFor, toolSchema, workflowText } from './prompt'
import { type SceneId, STAGE_W } from './scene'
import { DEMO_ORDER, REACTIONS, SCENES, STAGE_SCENES } from './scenes'
import { applyMove, describe, freshProgress, isAdvance, reconcile, stageLabel } from './stages'
import { type Cast, composeFrame, TOON_ROWS } from './toon'
import { waitingFrame } from './waiting'
import { WAITING_DEMO_MS, waitingDemoAt } from './waiting/demo'
import { EMPTY_LOG, seat, type SeatLog } from './waiting/seats'
import { DEFAULT_WORKFLOW, parseWorkflow, sameWorkflow, stageIds, stageList, stageOf, UNTRACKED_SCENE, withScenes, workflowJson } from './workflow'

const PLUGIN = 'stage-toons'
const HIDDEN_KEY = 'hidden'
const AUTO_KEY = 'auto'
const PRUNED_KEY = 'pruned-at'
const UNSAVED = "stage-toons: couldn't save progress; it lasts for this session only"
const BAD_FILE = 'stage-toons: .claude/stage-toons.json has errors; using the default workflow. /stage workflow reload lists them.'
// Refused blits in a row before the loop gives up: the spinner it painted is
// gone, as when a background agent's row closes. Until a blit since the last
// render has been taken, refusals are expected for a moment (after a resize
// the old Raster stays mounted until the new one paints), so it waits longer.
const MAX_REFUSED = 3
const MAX_REFUSED_UNSEEN = 24

// The engine reads each atom's plugin and key from the source, so they are
// written out as literals.
const progressAtom = atom({ plugin: 'stage-toons', key: 'progress' } as const, null)
const auditingAtom = atom({ plugin: 'stage-toons', key: 'auditing' } as const, false)
const hiddenAtom = atom({ plugin: 'stage-toons', key: 'hidden' } as const, false)
const sectionAtom = atom({ plugin: 'stage-toons', key: 'workflowText' } as const, null)
// The session's workflow: kept across a hot reload, so the bar, the tool and
// the cached prompt section keep to the same one until /stage workflow reload.
const workflowAtom = atom({ plugin: 'stage-toons', key: 'workflow' } as const, null)
// Whether the store warning was given: kept across a reload, so it shows once a session.
const warnedAtom = atom({ plugin: 'stage-toons', key: 'warned' } as const, false)
// The idle routine for the next idle period: picked when a turn starts, so
// the band's render (which may not write $.state) only reads it; kept across
// a hot reload.
const idleAtom = atom({ plugin: 'stage-toons', key: 'idle' } as const, null)
// The scene the stage shows: kept across a hot reload, so the toon does not
// change under the person when the module reloads.
const sceneAtom = atom({ plugin: 'stage-toons', key: 'scene' } as const, null)
// Whether rules move the stage by itself: mirrors the store, so a reload
// keeps it when the store fails.
const autoAtom = atom({ plugin: 'stage-toons', key: 'auto' } as const, true)

const TONES: Record<Tone, { color?: string; bold?: boolean; dimColor?: boolean }> = {
  done: { color: '#D97757' },
  current: { color: '#D97757', bold: true },
  future: { dimColor: true },
  label: {},
  tag: { color: '#8B7AE8' },
  message: { dimColor: true },
  note: { dimColor: true },
}

// A Raster the mod repaints: the toon under the spinner, or the band's
// area. Its key is its kind.
type SiteKind = 'toon' | 'area'
type Site = { requestId: string | undefined; kind: SiteKind; columns: number; rows: number; isAnimating: boolean; isSeen: boolean }

// How often a site repaints: the idle Clawd is calm.
const frameMs = (mod: Mod, kind: SiteKind): number => (kind === 'area' && mod.demo === null && mod.seats.since === null ? 166 : 83)
// How often the area checks the agent list while it knows of agents.
const AGENT_POLL_MS = 2000

const createSite = (kind: SiteKind): Site => ({ requestId: undefined, kind, columns: STAGE_W, rows: TOON_ROWS, isAnimating: false, isSeen: false })

// The module's own state: made fresh by every load, so it starts over on a
// reload. What must outlive a reload is in $.state.
type Mod = {
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
  toon: Site
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
  // Since when Claude's working time is counted for the current history
  // entry: the main turn's start or the last move in it; null between turns.
  workSince: number | null
  // The history entry that time goes to, found again by stage and start
  // in a copy another session saved.
  workEntry: EntryKey | null
  // Every move runs in turn on this queue.
  queue: Promise<unknown>
}

const createMod = (): Mod => ({
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
  toon: createSite('toon'),
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
  roster: EMPTY_ROSTER,
  seats: EMPTY_LOG,
  isWaitingBroken: false,
  isAuto: true,
  isWindows: false,
  notes: [],
  workSince: null,
  workEntry: null,
  queue: Promise.resolve(),
})

// Runs a move after the moves before it, so each reads the progress the
// last one left. A move that fails does not hold up the next.
function queued<T>(mod: Mod, run: () => Promise<T>): Promise<T> {
  const done = mod.queue.then(run, run)
  mod.queue = done.catch(() => undefined)

  return done
}

// A queued step of the mod's own (an automatic move, a turn's credit) that
// must not fail the call or event it rides on: a failure goes to the debug log.
function settle($: EngineInterface, what: string, done: Promise<unknown>): Promise<void> {
  return done.then(
    () => undefined,
    error => $.ui.log(`stage-toons: ${what} failed: ${String(error)}`, { to: 'debug' }),
  )
}

// The progress with Claude's working time so far credited to the entry it
// was spent in, and the count restarted: what every move starts from.
function credited(mod: Mod, p: Progress, now: number): Progress {
  if (mod.workSince === null) return p
  const ms = now - mod.workSince
  mod.workSince = now

  return creditAt(p, mod.workEntry, ms)
}

// The working time of the turn under way, not yet credited.
const runningMs = (mod: Mod, now: number): number => (mod.workSince === null ? 0 : Math.max(0, now - mod.workSince))

type ToolArgs = { agentId?: string } & Record<string, unknown>

// The store as progress.ts takes it.
const storeOf = ($: EngineInterface): KV => ({
  get: key => $.store.get(key),
  set: (key, value) => $.store.set(key, value),
})

async function warnUnsaved($: EngineInterface) {
  if (await read($, warnedAtom)) return
  await update($, warnedAtom, () => true)
  $.ui.toast(UNSAVED)
}

async function current($: EngineInterface, now: number): Promise<Progress> {
  return (await read($, progressAtom)) ?? freshProgress(now)
}

// The progress every change starts from: this session's, or the store's
// when another session on the project saved since (adopted, fitted to this
// session's workflow), so a change never writes over another session's
// move. raw: the store's copy as saved, unfitted, when it is this
// session's last save or newer: what a save that is no move of this
// session's (the turn's credit) builds on, so it never rewrites another
// session's stage to fit this session's workflow. Runs on the move queue.
async function latestProgress($: EngineInterface, mod: Mod, now: number): Promise<{ progress: Progress; raw: Progress }> {
  const mine = await current($, now)
  let stored: Progress | null = null
  try {
    stored = validate(await $.store.get(mod.key))
  } catch {
    // The store is unreadable: keep what this session has.
  }
  if (stored === null || stored.updatedAt < mine.updatedAt) return { progress: mine, raw: mine }
  if (stored.updatedAt === mine.updatedAt) return { progress: mine, raw: stored }
  const fitted = reconcile(mod.workflow, stored).progress
  await update($, progressAtom, () => fitted)
  mod.director = withScene(mod.director, await sceneFor($, mod, fitted.stage), now)

  return { progress: fitted, raw: stored }
}

// The scene for the stage the work is in: the one already picked while the
// stage stays and still lists it, else a new pick that leaves out the scene
// the stage showed last. Untracked shows the Other scene and picks nothing.
// Never called while a ui.render hook draws: it writes $.state.
async function sceneFor($: EngineInterface, mod: Mod, stage: StageId | null): Promise<SceneId> {
  if (stage === null) return UNTRACKED_SCENE
  const held = await read($, sceneAtom)
  const scenes = stageOf(mod.workflow, stage)?.scenes ?? [UNTRACKED_SCENE]
  if (held && held.stage === stage && scenes.includes(held.scene)) return held.scene
  const scene = pickOne(scenes, held?.lastByStage[stage], Math.random())
  const next: ScenePick = { stage, scene, lastByStage: { ...held?.lastByStage, [stage]: scene } }
  await update($, sceneAtom, () => next)

  return scene
}

async function commit($: EngineInterface, mod: Mod, before: Progress, after: Progress, now: number) {
  await update($, progressAtom, () => after)
  // Claude's working time goes to the entry the move left the work in.
  mod.workEntry = currentEntry(after)
  mod.director = withScene(mod.director, await sceneFor($, mod, after.stage), now)
  if (isAdvance(mod.workflow, before, after)) mod.director = react(mod.director, 'advance', now)
  if (!(await saveProgress(storeOf($), mod.key, after))) await warnUnsaved($)
}

async function setStage($: EngineInterface, mod: Mod, args: ToolArgs) {
  if (args.agentId !== undefined) return { deny: 'stage-toons: only the main conversation moves the workflow stage.' }
  const { stage, message, feature } = args
  if (typeof stage !== 'string' || !stageIds(mod.workflow).includes(stage) || typeof message !== 'string' || message.trim() === '') {
    return { deny: `stage-toons: set_stage needs "stage" (one of ${stageIds(mod.workflow).join(', ')}) and a non-empty "message".` }
  }
  const now = await $.clock.now()
  const { progress } = await latestProgress($, mod, now)
  const before = credited(mod, progress, now)
  const after = applyMove(mod.workflow, before, { stage, message, feature: typeof feature === 'string' ? feature : undefined, by: 'claude', at: now })
  await commit($, mod, before, after, now)
  // Claude's own move supersedes what it has not heard of yet.
  mod.notes = []

  // Core takes a registered tool's result as a string, an array or nothing.
  return { result: `Stage ${describe(mod.workflow, after)}` }
}

// What a successful tool call of the main conversation did, as rules read
// it: a skill loaded, a file written (relative to the session's directory
// at the call), a command run; or nothing a rule reads.
async function signalOf($: EngineInterface, mod: Mod, args: Record<string, unknown>): Promise<Signal | null> {
  if (args.tool === 'Skill' && typeof args.skill === 'string') return { kind: 'skill', name: args.skill }
  if (args.tool === 'Bash' && typeof args.command === 'string') return { kind: 'bash', command: args.command }
  if ((args.tool === 'Write' || args.tool === 'Edit') && typeof args.file_path === 'string') {
    let cwd = ''
    try {
      cwd = await $.session.cwd()
      mod.isWindows = isWindowsPath(cwd)
    } catch {
      // No directory: the path stays whole and a relative glob misses it.
    }

    return { kind: 'write', path: relativePath(args.file_path, cwd) }
  }

  return null
}

// Moves the work where a rule sends it, if one does, and queues a note for
// Claude. Runs on the move queue.
async function autoMove($: EngineInterface, mod: Mod, signal: Signal) {
  if (!mod.isAuto) return
  const now = await $.clock.now()
  const { progress: p } = await latestProgress($, mod, now)
  const target = autoTarget(mod.workflow, p, signal, mod.isWindows)
  if (target === null) return
  const before = credited(mod, p, now)
  const via = viaOf(signal)
  const after = applyMove(mod.workflow, before, { stage: target, by: 'auto', via, at: now })
  await commit($, mod, before, after, now)
  mod.notes.push(
    `[stage-toons] The stage moved by itself to ${stageLabel(mod.workflow, target)} (${via}). Now: ${describe(mod.workflow, after)}. Call ${mod.toolName} if a more specific message or another stage fits.`,
  )
}

// The main turn's end: the rest of its working time credited and saved,
// so another session on the project picks it up. A turn whose start was
// missed credits its duration, at most the time since the entry began.
async function creditTurn($: EngineInterface, mod: Mod, durationMs: number) {
  const now = await $.clock.now()
  const since = mod.workSince
  const counted = mod.workEntry
  mod.workSince = null
  mod.workEntry = null
  if ((await read($, progressAtom)) === null) return
  const { progress, raw } = await latestProgress($, mod, now)
  const entry = since !== null ? counted : currentEntry(progress)
  if (entry === null) return
  const ms = since !== null ? now - since : Math.min(Math.max(0, durationMs), now - entry.at)
  const after = creditAt(raw, entry, ms)
  if (after === raw) {
    // The entry is gone from the copy (an older version's session cut the history).
    if (ms > 0) $.ui.log(`stage-toons: ${Math.round(ms / 1000)} s of working time had no history entry to go to`, { to: 'debug' })

    return
  }
  // Saved as the store had it, credit added; shown fitted to this workflow.
  const saved = { ...after, updatedAt: now }
  const shown = reconcile(mod.workflow, saved).progress
  await update($, progressAtom, () => shown)
  if (!(await saveProgress(storeOf($), mod.key, saved))) await warnUnsaved($)
}

// Deletes the progress of projects nobody has moved for months, at most
// once a week, so the store (4 MiB for all of it) never fills.
async function pruneStore($: EngineInterface, mod: Mod, now: number) {
  try {
    const last = await $.store.get(PRUNED_KEY)
    if (typeof last === 'number' && now - last < PRUNE_EVERY_MS) return
    await $.store.set(PRUNED_KEY, now)
    const keys = (await $.store.keys()).filter(key => key.startsWith('progress:') && key !== mod.key)
    const entries: [string, unknown][] = []
    for (const key of keys) entries.push([key, await $.store.get(key)])
    for (const key of staleKeys(entries, now, mod.key)) await $.store.delete(key)
  } catch (error) {
    $.ui.log(`stage-toons: pruning old progress failed: ${String(error)}`, { to: 'debug' })
  }
}

// /stage auto on or off, kept for every project.
async function setAuto($: EngineInterface, mod: Mod, isOn: boolean) {
  mod.isAuto = isOn
  await update($, autoAtom, () => isOn)
  try {
    await $.store.set(AUTO_KEY, isOn)
  } catch {
    // Lasts for this session.
  }
}

async function setAuditing($: EngineInterface, mod: Mod, isAuditing: boolean) {
  await update($, auditingAtom, () => isAuditing)
  mod.director = withAuditing(mod.director, isAuditing, await $.clock.now())
}

function castOf($: EngineInterface, mod: Mod): Cast {
  return {
    scenes: SCENES,
    reactions: REACTIONS,
    broken: mod.broken,
    onBreak: (id, error) => $.ui.log(`stage-toons: scene ${id} failed and was replaced by the standing scene: ${String(error)}`, { to: 'debug' }),
  }
}

// Whether the real waiting toon is on screen: the band's area mounted, no
// demo over it, not hidden, and Claude not working.
const isWaitingShown = (mod: Mod): boolean => mod.band.requestId !== undefined && mod.demo === null && !mod.isHidden && !mod.isBandWorking

// The seat log moved on to now; a waiting period that ended restarts the
// idle clock where it ended.
function reseat(mod: Mod, now: number) {
  const { log, endedAt } = seat(mod.seats, mod.roster, now, isWaitingShown(mod))
  mod.seats = log
  // Never backwards: a period that ended unseen may report an end before
  // the main turn's own.
  if (endedAt !== null) mod.idleSince = Math.max(mod.idleSince, endedAt)
}

// The roster as the agent list has it now. A list that fails leaves the
// roster as it was: the next check tries again.
async function checkAgents($: EngineInterface, mod: Mod) {
  try {
    const list = await $.agent.list()
    const now = await $.clock.now()
    mod.roster = reconcileRoster(mod.roster, list, now)
    reseat(mod, now)
  } catch {
    // Checked again at the next poll or turn's end.
  }
}

// The area's next frame, cut to its width, or null once the demo it plays
// is over: a demo, else the waiting toon while a waiting period lasts,
// else the idle routine.
function areaCells($: EngineInterface, mod: Mod, columns: number, now: number): string | null {
  const onBreak = (id: string, error: unknown) => $.ui.log(`stage-toons: idle routine ${id} failed and was replaced by classic: ${String(error)}`, { to: 'debug' })
  const idleAt = (ms: number) => cropLeft(placeIdle(idleFrame(mod.idle, ms, mod.brokenIdle, onBreak)), columns)
  const demo = mod.demo
  if (demo?.kind === 'scenes') {
    const frame = demoAt(demo, now)

    return frame ? encodeCells(composeFrame(frame.shot, frame.sceneMs, columns, castOf($, mod))) : null
  }
  if (demo?.kind === 'idle') {
    const f = idleDemoAt(demo, now)
    if (!f) return null

    return encodeCells(cropLeft(placeIdle(f.routine === null ? idleFrame(FALLBACK_ROUTINE, DOZE_MS + f.ms) : idleFrame(f.routine, f.ms, mod.brokenIdle, onBreak)), columns))
  }
  if (demo?.kind === 'waiting') {
    if (!demoStep(demo, now)) return null
    const at = waitingDemoAt(demo.at, now)

    return encodeCells('log' in at ? cropLeft(waitingFrame(at.log, now), columns) : idleAt(at.idleMs))
  }

  reseat(mod, now)
  if (mod.seats.since !== null && !mod.isWaitingBroken) {
    try {
      return encodeCells(cropLeft(waitingFrame(mod.seats, now), columns))
    } catch (error) {
      mod.isWaitingBroken = true
      $.ui.log(`stage-toons: the waiting toon failed and was replaced by the idle routine: ${String(error)}`, { to: 'debug' })
    }
  }

  return encodeCells(idleAt(now - mod.idleSince))
}

// A site's next frame, or null once the demo it plays is over.
function siteCells($: EngineInterface, mod: Mod, site: Site, now: number): string | null {
  if (site.kind === 'area') return areaCells($, mod, site.columns, now)
  mod.director = tick(mod.director, now)

  return encodeCells(composeFrame(shot(mod.director, now), now, site.columns, castOf($, mod)))
}

// Ends the demo and has the band drawn again without it.
function endDemo($: EngineInterface, mod: Mod) {
  mod.demo = null
  $.ui.invalidate('ui.render')
}

// Repaints a site while it is mounted, detached from the render that
// started it: a sleep inside a dispatch would spend its time budget. The
// site's kind and size may change under it, as the band's do.
function animate($: EngineInterface, mod: Mod, site: Site) {
  if (site.isAnimating) return
  site.isAnimating = true
  void (async () => {
    try {
      let refused = 0
      // The area checks the agent list before its first frame, so an agent
      // that ended while it was away is not drawn seated, then every
      // AGENT_POLL_MS while it knows of agents.
      let polledAt = -Infinity
      while (site.requestId !== undefined && !mod.isHidden && refused < (site.isSeen ? MAX_REFUSED : MAX_REFUSED_UNSEEN)) {
        const { requestId, kind, columns, rows } = site
        const now = await $.clock.now()
        if (kind === 'area' && polledAt === -Infinity) {
          polledAt = now
          await checkAgents($, mod)
        } else if (kind === 'area' && mod.roster.size > 0 && now - polledAt >= AGENT_POLL_MS) {
          polledAt = now
          void checkAgents($, mod)
        }
        const cells = siteCells($, mod, site, now)
        if (cells === null) {
          // The demo is over. Nothing is awaited from here to the loop's
          // end, so the redraw that brings the band back finds it finished.
          site.requestId = undefined
          endDemo($, mod)
          break
        }
        // A blit repaints the scene alone: the line naming it is text, so
        // the band is drawn again when the demo moves on.
        const step = kind !== 'toon' && mod.demo ? demoStep(mod.demo, now) : null
        if (step && step.index !== mod.demoLineIndex) {
          mod.demoLineIndex = step.index
          $.ui.invalidate('ui.render')
        }
        const answer = await $.ui.blit({ requestId, key: kind, cells, columns, rows }).catch(() => ({ deny: 'failed' }))
        if (answer.deny === undefined) {
          refused = 0
          site.isSeen = true
        } else {
          refused += 1
        }
        await $.clock.sleep(frameMs(mod, kind))
      }
      // Refused until it gave up, the band's Raster may be gone for good
      // (the band collapsed) or for now: the hook decides again, and an
      // expanded band repaints instead of standing still.
      if (site.kind !== 'toon' && site.requestId !== undefined && !mod.isHidden) {
        site.requestId = undefined
        $.ui.invalidate('ui.render')
      }
    } finally {
      site.isAnimating = false
    }
  })().catch(() => {
    // The environment unloaded mid-frame (a reload, the session's end).
  })
}

type FileWorkflow = { kind: 'none' } | { kind: 'ok'; workflow: Workflow } | { kind: 'bad'; errors: string[] }

// The project's workflow file: absent, a workflow, or what is wrong with it.
async function readWorkflowFile($: EngineInterface): Promise<FileWorkflow> {
  try {
    if (!(await $.fs.exists(WORKFLOW_FILE))) return { kind: 'none' }
    const text = await $.fs.read(WORKFLOW_FILE)
    const parsed = parseWorkflow(typeof text === 'string' ? text : '', STAGE_SCENES)

    return 'workflow' in parsed ? { kind: 'ok', workflow: parsed.workflow } : { kind: 'bad', errors: parsed.errors }
  } catch (error) {
    return { kind: 'bad', errors: [`could not read it: ${String(error)}`] }
  }
}

const sessionWorkflowOf = (file: FileWorkflow): SessionWorkflow =>
  file.kind === 'ok' ? { workflow: file.workflow, source: 'file' } : { workflow: DEFAULT_WORKFLOW, source: 'default' }

// Registers set_stage for the workflow; false when the engine refused.
async function registerTool($: EngineInterface, mod: Mod): Promise<boolean> {
  try {
    mod.toolName = (await $.tool.register({ name: TOOL, description: TOOL_DESCRIPTION, inputSchema: toolSchema(mod.workflow) })).tool

    return true
  } catch (error) {
    $.ui.log(`stage-toons: could not register set_stage: ${String(error)}`, { to: 'debug' })

    return false
  }
}

async function initWorkflow($: EngineInterface, mod: Mod): Promise<string> {
  try {
    if (await $.fs.exists(WORKFLOW_FILE)) return `${WORKFLOW_FILE} exists; edit it, then /stage workflow reload`
  } catch (error) {
    return `couldn't check for ${WORKFLOW_FILE}: ${String(error)}`
  }
  try {
    await $.fs.write(WORKFLOW_FILE, workflowJson(DEFAULT_WORKFLOW))
  } catch (error) {
    return `couldn't write ${WORKFLOW_FILE}: ${String(error)}`
  }
  // The file holds the stages the session already has: it is now their source.
  if (mod.workflowSource === 'default') {
    const next: SessionWorkflow = { workflow: mod.workflow, source: 'file' }
    mod.workflowSource = 'file'
    await update($, workflowAtom, () => next)
  }

  return `Wrote the default workflow to ${WORKFLOW_FILE}: edit it, then /stage workflow reload.`
}

async function reloadWorkflow($: EngineInterface, mod: Mod, now: number): Promise<{ text: string; context?: string[] }> {
  const file = await readWorkflowFile($)
  if (file.kind === 'bad') return { text: [`${WORKFLOW_FILE} has errors; kept the current workflow:`, ...file.errors.map(e => `  ${e}`)].join('\n') }
  const next = sessionWorkflowOf(file)
  if (sameWorkflow(next.workflow, mod.workflow)) {
    if (next.source === mod.workflowSource) return { text: 'workflow unchanged.' }
    // The same stages from another source: nothing for Claude or the cache.
    mod.workflowSource = next.source
    await update($, workflowAtom, () => next)

    return { text: `workflow unchanged (now ${next.source === 'file' ? `from ${WORKFLOW_FILE}` : 'the default'}).` }
  }
  mod.workflow = next.workflow
  mod.workflowSource = next.source
  await update($, workflowAtom, () => next)
  // On the move queue, so it reads what the last move left.
  const { progress, moved } = await queued(mod, async () => {
    // Read when its turn on the queue comes: a move queued before it may have run.
    const at = await $.clock.now()
    const { progress: base } = await latestProgress($, mod, at)
    const fitted = reconcile(mod.workflow, credited(mod, base, at))
    await update($, progressAtom, () => fitted.progress)
    mod.workEntry = currentEntry(fitted.progress)

    return fitted
  })
  mod.director = withScene(mod.director, await sceneFor($, mod, progress.stage), now)
  const isRegistered = await registerTool($, mod)
  await update($, sectionAtom, () => workflowText(mod.workflow, progress, mod.toolName))
  // The band's lines name stages: draw it again.
  $.ui.invalidate('ui.render')
  const from = next.source === 'file' ? `from ${WORKFLOW_FILE}` : `the default (no ${WORKFLOW_FILE})`
  const lines = [`workflow ${from}: ${mod.workflow.track.length} track stages, ${mod.workflow.side.length} side stages.`]
  if (moved) lines.push(moved)
  if (!isRegistered) lines.push("set_stage could not be registered again (the debug log says why): Claude's tool may still list the old stages.")

  return { text: lines.join('\n'), context: [`[stage-toons] The workflow changed: ${stageList(mod.workflow)}. Now: ${describe(mod.workflow, progress)}`] }
}

// Whether the band last drawn has room for the area under a bar of
// barLines lines (the bar with the demo's line).
const hasRoom = (mod: Mod, barLines: number): boolean =>
  !mod.lastBand || bandMode({ ...mod.lastBand, hasSurvey: false, isAgentView: false, isHidden: false, hasDemo: true, barLines }) === 'area'

// Starts the demo, or says why not. label names what plays; barLines is
// how many lines the bar takes with the demo's line.
function startDemo(mod: Mod, demo: Demo, label: string, now: number, isHidden: boolean, barLines: number): string {
  if (isHidden) return 'stage-toons is hidden; /stage hide shows it.'
  if (mod.surface !== 'terminal') return 'The demo plays in the terminal only.'
  if (!hasRoom(mod, barLines)) return `The band has no room for the demo: it needs 30 columns and ${barLines + TOON_ROWS} rows.`
  const isRestart = mod.demo !== null && demoStep(mod.demo, now) !== null
  mod.demo = demo
  const playing = `${isRestart ? 'Restarting the demo: p' : 'P'}laying`
  if (demo.kind === 'waiting') return `${playing} ${label} (about ${Math.round(WAITING_DEMO_MS / 1000)} s). /stage demo stop ends it.`
  const total = demoLength(demo) * demo.seconds
  const length = total < 60 ? 'under a minute' : `about ${Math.round(total / 60)} min`

  return `${playing} ${label}, ${demo.seconds} s each (${length}). /stage demo stop ends it.`
}

export const register: Register = on => {
  const mod = createMod()

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const now = await $.clock.now()
    mod.key = storeKey(e.cwd)
    let held = await read($, workflowAtom)
    if (held === null) {
      const file = await readWorkflowFile($)
      held = sessionWorkflowOf(file)
      const first = held
      await update($, workflowAtom, () => first)
      if (file.kind === 'bad') $.ui.toast(BAD_FILE)
    }
    mod.workflow = withScenes(held.workflow)
    // A default kept by an older version takes this version's (its rules)
    // while the stages are the same.
    if (held.source === 'default' && !sameWorkflow(mod.workflow, DEFAULT_WORKFLOW) && stageIds(mod.workflow).join() === stageIds(DEFAULT_WORKFLOW).join()) {
      mod.workflow = DEFAULT_WORKFLOW
      const upgraded: SessionWorkflow = { workflow: DEFAULT_WORKFLOW, source: 'default' }
      await update($, workflowAtom, () => upgraded)
    }
    mod.workflowSource = held.source
    mod.isWindows = isWindowsPath(e.cwd)
    const loaded = await loadProgress(storeOf($), mod.key, now)
    if (!loaded.isAvailable) await warnUnsaved($)
    else await pruneStore($, mod, now)
    const progress = reconcile(mod.workflow, loaded.progress).progress
    let isHidden = false
    try {
      isHidden = (await $.store.get(HIDDEN_KEY)) === true
    } catch {
      // Shown, then.
    }
    mod.isHidden = isHidden
    let isAuto = await read($, autoAtom)
    try {
      isAuto = (await $.store.get(AUTO_KEY)) !== false
    } catch {
      // As this session had it.
    }
    mod.isAuto = isAuto
    await update($, autoAtom, () => isAuto)
    mod.surface = e.surface
    mod.idleSince = now
    let routine = await read($, idleAtom)
    if (routine === null) {
      const first = pickIdle(undefined, Math.random())
      await update($, idleAtom, () => first)
      routine = first
    }
    mod.idle = routine
    mod.nextIdle = routine
    // A reload forgets which agents were Fable, so the auditor stands down.
    mod.auditors.clear()
    await update($, progressAtom, () => progress)
    await update($, hiddenAtom, () => isHidden)
    await update($, auditingAtom, () => false)
    mod.director = createDirector(await sceneFor($, mod, progress.stage), false)
    await registerTool($, mod)
    try {
      mod.commandName = (
        await $.command.register({
          name: COMMAND,
          description:
            "Show or move the workflow stage; /stage hide hides the bar and the cartoons; /stage demo plays every scene, a stage's scenes, the idle routines or the waiting toon; /stage workflow shows or reloads the workflow; /stage auto, log and time: the automatic moves, the history, the time spent",
          argumentHint: '[n | id | next | back | feature <name> | message <text> | hide | demo [<stage> | idle] [seconds] | demo waiting | demo stop | workflow [init | reload] | auto [on | off] | log [n] | time]',
          immediate: true,
        })
      ).command
    } catch (error) {
      $.ui.log(`stage-toons: could not register /stage: ${String(error)}`, { to: 'debug' })
    }
    // Computed once per session and kept across reloads: the section sits
    // in the cached part of the prompt.
    if ((await read($, sectionAtom)) === null) await update($, sectionAtom, () => workflowText(mod.workflow, progress, mod.toolName))
    // Agents at work before a reload: the roster starts empty, and the list
    // finds them (their models are lost: grey helpers).
    await checkAgents($, mod)

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    // The routine for the idle period after this turn, leaving out the one
    // just shown. A prompt typed while a turn runs (turnId set) starts no
    // idle period of its own, so it picks nothing. The box keeps the routine
    // on show until the idle clock restarts: switched here, it could paint
    // the new one for a frame before the turn hides it.
    if (e.turnId === undefined) {
      const routine = pickIdle(mod.idle, Math.random())
      mod.nextIdle = routine
      await update($, idleAtom, () => routine)
    }
    // A turn starts: the toon under the spinner takes over from the demo.
    if (mod.demo) endDemo($, mod)
    // Another session on this project may have moved the stage. On the move
    // queue, so a move still running is not overwritten.
    // Fitted to this session's workflow in memory; saved back only with this
    // session's next move or turn's credit.
    const now = await $.clock.now()
    await settle($, "adopting another session's progress", queued(mod, () => latestProgress($, mod, now)))
    if (mod.notes.length === 0) return next(e)
    const notes = mod.notes
    mod.notes = []

    return next({ ...e, context: [...(e.context ?? []), ...notes] })
  })

  // Claude's working time counts from the main turn's start (only the main
  // loop raises turn.start).
  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    mod.workSince = now
    mod.workEntry = currentEntry(await current($, now))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === mod.toolName) return queued(mod, () => setStage($, mod, e as unknown as ToolArgs))
    const result = await next(e)
    if (e.agentId !== undefined || result.deny !== undefined) return result
    if (result.isError === true) {
      const now = await $.clock.now()
      if (isFailureDue(mod.lastFailureAt, now)) {
        mod.lastFailureAt = now
        mod.director = react(mod.director, 'failure', now)
      }
    }
    // Only the model's own calls (the engine's dispatch) move the stage and
    // carry notes: a plugin's $.tool.call result reaches no model.
    if (next.origin.plugin !== 'engine') return result
    if (result.isError !== true && mod.isAuto && hasRules(mod.workflow)) {
      const signal = await signalOf($, mod, e as unknown as Record<string, unknown>)
      if (signal) await settle($, 'an automatic move', queued(mod, () => autoMove($, mod, signal)))
    }
    if (mod.notes.length === 0) return result
    // Claude hears of the moves it has not heard of with this result.
    const notes = mod.notes
    mod.notes = []

    return { ...result, context: [...(result.context ?? []), ...notes] }
  })

  on('command.run', async ($, e, next) => {
    if (e.command !== mod.commandName) return next(e)
    const cmd = parseCommand(mod.workflow, e.args)
    const now = await $.clock.now()
    // Read on the move queue: a move still running (an automatic one just
    // made) shows.
    const before = (await queued(mod, () => latestProgress($, mod, now))).progress
    if (cmd.kind === 'show') return { text: showText(mod.workflow, before, now) }
    if (cmd.kind === 'log') return { text: logText(mod.workflow, before, now, cmd.count, runningMs(mod, now)) }
    if (cmd.kind === 'time') return { text: timeText(mod.workflow, before, now, runningMs(mod, now)) }
    if (cmd.kind === 'auto') {
      if (cmd.isOn !== null) await setAuto($, mod, cmd.isOn)

      return { text: autoText(mod.workflow, mod.isAuto) }
    }
    if (cmd.kind === 'usage') return { text: usage(mod.workflow) }
    if (cmd.kind === 'demo' || cmd.kind === 'demo-idle' || cmd.kind === 'demo-waiting') {
      const stage = cmd.kind === 'demo' && cmd.stage !== null ? stageOf(mod.workflow, cmd.stage) : undefined
      const demo: Demo =
        cmd.kind === 'demo-waiting'
          ? { kind: 'waiting', at: now }
          : cmd.kind === 'demo-idle'
            ? { kind: 'idle', at: now, seconds: cmd.seconds }
            : { kind: 'scenes', at: now, seconds: cmd.seconds, scenes: stage?.scenes ?? DEMO_ORDER }
      const n = demoLength(demo)
      const label =
        cmd.kind === 'demo-waiting'
          ? 'the waiting toon'
          : cmd.kind === 'demo-idle'
            ? `${IDLE_IDS.length} idle routines and the doze`
            : stage
              ? `${n} scene${n === 1 ? '' : 's'} of ${stage.label}`
              : `${n} scenes`
      // The bar's lines with the demo's line under it, at the band's width.
      const barLines = bandLayout(mod.workflow, before, false, mod.lastBand?.columns ?? 100, 'demo').length
      const text = startDemo(mod, demo, label, now, await read($, hiddenAtom), barLines)
      // The band grows to hold it.
      if (mod.demo) $.ui.invalidate('ui.render')

      return { text }
    }
    if (cmd.kind === 'demo-stop') {
      if (!mod.demo) return { text: 'No demo is playing.' }
      endDemo($, mod)

      return { text: 'Demo stopped.' }
    }
    if (cmd.kind === 'workflow') return { text: workflowSummary(mod.workflow, mod.workflowSource) }
    if (cmd.kind === 'workflow-init') return { text: await initWorkflow($, mod) }
    if (cmd.kind === 'workflow-reload') return reloadWorkflow($, mod, now)
    if (cmd.kind === 'hide') {
      const isHidden = !(await read($, hiddenAtom))
      mod.isHidden = isHidden
      await update($, hiddenAtom, () => isHidden)
      try {
        await $.store.set(HIDDEN_KEY, isHidden)
      } catch {
        // Lasts for this session.
      }

      return { text: isHidden ? 'stage-toons is hidden. /stage hide shows it again.' : 'stage-toons is shown.' }
    }
    // Untracked, a message would be shown nowhere and lost at the first stage.
    if (cmd.kind === 'message' && before.stage === null) return { text: 'a message belongs to a stage; set one first (/stage next, or /stage <id>).' }

    return queued(mod, async () => {
      // Read when its turn on the queue comes: a move queued before it may have run.
      const at = await $.clock.now()
      const { progress: base } = await latestProgress($, mod, at)
      const from = credited(mod, base, at)
      const after = moveFor(mod.workflow, from, cmd, at)
      await commit($, mod, from, after, at)

      return { text: `Stage ${describe(mod.workflow, after)}`, context: [`[stage-toons] The user set the stage: ${describe(mod.workflow, after)}`] }
    })
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    let text = await read($, sectionAtom)
    if (text === null) {
      const fresh = workflowText(mod.workflow, await current($, await $.clock.now()), mod.toolName)
      await update($, sectionAtom, () => fresh)
      text = fresh
    }

    return { sections: [...result.sections, { id: SECTION_ID, text, scope: 'session' as const }] }
  })

  // A real compaction rebuilds the cached prompt anyway: the section can
  // catch up with the stage then, and only then.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && result.messages !== undefined) {
      const p = await current($, await $.clock.now())
      await update($, sectionAtom, () => workflowText(mod.workflow, p, mod.toolName))
    }

    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (result.deny !== undefined || result.agentId === undefined) return result
    if (isAuditorSpawn(e, result.model)) {
      const wasIdle = mod.auditors.size === 0
      mod.auditors.add(result.agentId)
      if (wasIdle) await setAuditing($, mod, true)
    }
    // Every agent gets a helper at the desk row, in its model's colour.
    const now = await $.clock.now()
    mod.roster = spawned(mod.roster, result.agentId, result.model, now)
    reseat(mod, now)
    // A spawn of the main conversation's own, not a teammate's, may move the stage.
    if (e.parentAgentId === undefined && e.isTeammate !== true && mod.isAuto && hasRules(mod.workflow)) {
      const signal: Signal = { kind: 'agent', model: result.model, asked: e.model, parentModel: e.parentModel }
      await settle($, 'an automatic move', queued(mod, () => autoMove($, mod, signal)))
    }

    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      // A subagent's turn: the end of an auditor, perhaps, and of the
      // spinner on its row, which carries the agent's id. Its helper gets
      // up at once, whatever the list says yet.
      if (mod.toon.requestId === e.agentId) mod.toon.requestId = undefined
      if (mod.auditors.delete(e.agentId) && mod.auditors.size === 0) await setAuditing($, mod, false)
      const now = await $.clock.now()
      mod.roster = ended(mod.roster, e.agentId, now)
      reseat(mod, now)
      await checkAgents($, mod)

      return next(e)
    }
    mod.toon.requestId = undefined
    await settle($, "crediting the turn's working time", queued(mod, () => creditTurn($, mod, e.durationMs)))
    const now = await $.clock.now()
    mod.idleSince = now
    mod.idle = mod.nextIdle
    try {
      const list = await $.agent.list()
      if (mod.auditors.size > 0) {
        for (const id of staleAuditors(mod.auditors, list)) mod.auditors.delete(id)
        if (mod.auditors.size === 0) await setAuditing($, mod, false)
      }
      mod.roster = reconcileRoster(mod.roster, list, now)
      reseat(mod, now)
    } catch {
      // Checked again at the next turn's end, or the area's next poll.
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await $.clock.now()
    if (mod.demo && !demoStep(mod.demo, now)) mod.demo = null
    // Claude has just stopped: the idle clock starts here if the band hears
    // of it before the turn's end does.
    if (e.props.isWorking) mod.isBandWorking = true
    else if (mod.isBandWorking) {
      mod.isBandWorking = false
      mod.idleSince = now
      mod.idle = mod.nextIdle
    }
    const progress = await read($, progressAtom)
    const columns = e.props.bodyColumns
    const sceneFrame = mod.demo?.kind === 'scenes' ? demoAt(mod.demo, now) : null
    const idleFrameOfDemo = mod.demo?.kind === 'idle' ? idleDemoAt(mod.demo, now) : null
    if (sceneFrame) mod.demoLineIndex = sceneFrame.index
    if (idleFrameOfDemo) mod.demoLineIndex = idleFrameOfDemo.index
    const demoText =
      sceneFrame && mod.demo ? demoLine(sceneFrame, mod.demo, mod.workflow) : idleFrameOfDemo ? idleDemoLine(idleFrameOfDemo) : mod.demo?.kind === 'waiting' ? WAITING_DEMO_LINE : undefined
    const lines = progress === null ? [] : bandLayout(mod.workflow, progress, await read($, auditingAtom), columns, demoText)
    const site: BandSite = {
      surface: e.surface,
      isWorking: e.props.isWorking,
      hasSurvey: e.props.hasSurvey,
      isAgentView: e.props.view.agentId !== undefined,
      isHidden: await read($, hiddenAtom),
      columns,
      maxRows: e.props.maxRows,
      hasDemo: mod.demo !== null,
      barLines: lines.length,
    }
    mod.lastBand = site
    const mode = bandMode(site)
    const { band } = mod
    if (mode === 'none' || progress === null) {
      band.requestId = undefined
      reseat(mod, now)

      return next(e)
    }
    // Other plugins' bands, and the engine's, still draw: below the bar.
    const below = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const bar = (
      <Box key="stage-toons" flexDirection="column">
        {lines.map((spans, i) => (
          <Box key={`line-${i}`} flexDirection="row">
            {spans.map((span, j) => (
              <Text key={`span-${i}-${j}`} wrap="truncate-end" {...TONES[span.tone]}>
                {span.text}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    )
    if (mode === 'text' || e.requestId === undefined || e.surface !== 'terminal') {
      band.requestId = undefined
      reseat(mod, now)

      return (
        <Box flexDirection="column">
          {bar}
          {below}
        </Box>
      )
    }
    const wasShown = band.requestId !== undefined
    band.requestId = e.requestId
    band.kind = 'area'
    band.columns = Math.min(STAGE_W, columns - 1)
    band.rows = TOON_ROWS
    band.isSeen = false
    // Shown again: an agent may have ended, or started, while the area was
    // away (a paint loop still running from before polls on its own time).
    if (!wasShown) void checkAgents($, mod)
    const cells = siteCells($, mod, band, now) ?? ''
    animate($, mod, band)
    const { Raster } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {bar}
        <Raster key="area" columns={band.columns} rows={band.rows} cells={cells} />
        {below}
      </Box>
    )
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const line = await next(e)
    const viewport = e.viewport?.columns ?? 80
    if ((await read($, hiddenAtom)) || viewport < TOON_MIN) {
      mod.toon.requestId = undefined

      return line
    }
    mod.toon.requestId = e.requestId
    mod.toon.columns = Math.min(STAGE_W, viewport - 6)
    mod.toon.isSeen = false
    const cells = siteCells($, mod, mod.toon, await $.clock.now()) ?? ''
    animate($, mod, mod.toon)
    const { Box, Raster } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {line}
        <Raster key="toon" columns={mod.toon.columns} rows={TOON_ROWS} cells={cells} />
      </Box>
    )
  })
}
