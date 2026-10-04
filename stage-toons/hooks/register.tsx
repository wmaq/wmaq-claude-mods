// stage-toons: wires the workflow progress bar and the toons to Claude
// Code's events. What it decides lives in the modules it imports.
//
// The engine reads this module's source before it loads it: $ may be
// passed only to functions declared at the top of this file, and every
// call on it is spelled $.noun.method(...) where it is made. So the helpers
// below are top-level functions that take $ and the module's state.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Progress, ScenePick, SessionWorkflow, StageId, Workflow } from '../types'
import { isAuditorSpawn, isFailureDue, staleAuditors } from './activity'
import { ended, reconcileRoster, rememberKind, spawned } from './agents'
import { autoMatch, hasRules, isWindowsPath, relativePath, type Signal, viaOf } from './auto'
import { bandLayout, bandMode, type BandSite, type Tone, TOON_MIN } from './band'
import { autoText, moveFor, parseCommand, showText, usage, WORKFLOW_FILE, workflowSummary } from './command'
import { demoAt, demoFor, demoLine, demoStep, idleDemoAt, idleDemoLine, startDemo, WAITING_DEMO_LINE } from './demo'
import { createDirector, react, withAuditing, withScene } from './director'
import { siteCells } from './frames'
import { pickIdle } from './idle'
import { createMod, createSite, endDemo, type Mod, queued, reseat, stopToon } from './mod'
import { animate, type Ports } from './paint'
import { pickOne } from './pick'
import { creditAt, currentEntry, logText, timeText } from './history'
import { type KV, loadProgress, PRUNE_EVERY_MS, saveProgress, staleKeys, storeKey, validate } from './progress'
import { COMMAND, SECTION_ID, TOOL, TOOL_DESCRIPTION, toolSchema, workflowText } from './prompt'
import { type SceneId, STAGE_W } from './scene'
import { STAGE_SCENES } from './scenes'
import { applyMove, describe, freshProgress, isAdvance, reconcile, stageLabel } from './stages'
import { TOON_ROWS } from './toon'
import { DEFAULT_WORKFLOW, parseWorkflow, sameWorkflow, stageIds, stageList, stageOf, UNTRACKED_SCENE, withScenes, workflowJson } from './workflow'

const HIDDEN_KEY = 'hidden'
const AUTO_KEY = 'auto'
const PRUNED_KEY = 'pruned-at'
const UNSAVED = "stage-toons: couldn't save progress; it lasts for this session only"
const NEWER = "stage-toons: a newer version saved this project's progress; this session won't save over it"
const BAD_FILE = 'stage-toons: .claude/stage-toons.json has errors; using the default workflow. /stage workflow reload lists them.'
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
// Each agent's kind, as its spawn told it: kept across reloads, which
// start the roster empty, so the list's agents keep their colours.
const kindsAtom = atom({ plugin: 'stage-toons', key: 'agentKinds' } as const, {})

const TONES: Record<Tone, { color?: string; bold?: boolean; dimColor?: boolean }> = {
  done: { color: '#D97757' },
  current: { color: '#D97757', bold: true },
  future: { dimColor: true },
  label: {},
  tag: { color: '#8B7AE8' },
  message: { dimColor: true },
  note: { dimColor: true },
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
// was spent in: what every move starts from. The count restarts only when
// the move goes ahead (move).
function credited(mod: Mod, p: Progress, now: number): Progress {
  if (mod.workSince === null) return p

  return creditAt(p, mod.workEntry, now - mod.workSince)
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
  let value: unknown
  try {
    value = await $.store.get(mod.key)
  } catch {
    // The store is unreadable: keep what this session has.
    return { progress: mine, raw: mine }
  }
  const head = typeof value === 'object' && value !== null ? (value as { v?: unknown; updatedAt?: unknown }) : {}
  // A newer version's progress: this session reads none of it and saves
  // nothing over it.
  if (typeof head.v === 'number' && head.v > 2) {
    if (!mod.isReadOnly) $.ui.toast(NEWER)
    mod.isReadOnly = true

    return { progress: mine, raw: mine }
  }
  // Older than this session's: no need to check it whole.
  if (typeof head.updatedAt === 'number' && head.updatedAt < mine.updatedAt) return { progress: mine, raw: mine }
  const stored = validate(value)
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
  if (!mod.isReadOnly && !(await saveProgress(storeOf($), mod.key, after))) await warnUnsaved($)
}

// Reads the store's latest copy, credits the time so far, applies what
// build makes of it, and commits; null from build moves nothing, and
// leaves the working time counting as it was.
async function move<P extends Progress | null>($: EngineInterface, mod: Mod, at: number, build: (from: Progress) => P): Promise<P> {
  const { progress } = await latestProgress($, mod, at)
  const before = credited(mod, progress, at)
  const after = build(before)
  if (after === null) return after
  if (mod.workSince !== null) mod.workSince = at
  await commit($, mod, before, after, at)

  return after
}

async function setStage($: EngineInterface, mod: Mod, args: ToolArgs) {
  if (args.agentId !== undefined) return { deny: 'stage-toons: only the main conversation moves the workflow stage.' }
  const { stage, message, feature } = args
  if (typeof stage !== 'string' || !stageIds(mod.workflow).includes(stage) || typeof message !== 'string' || message.trim() === '') {
    return { deny: `stage-toons: set_stage needs "stage" (one of ${stageIds(mod.workflow).join(', ')}) and a non-empty "message".` }
  }
  const now = await $.clock.now()
  const after = await move($, mod, now, from => applyMove(mod.workflow, from, { stage, message, feature: typeof feature === 'string' ? feature : undefined, by: 'claude', at: now }))
  // Claude's own move supersedes what it has not heard of yet.
  mod.notes = []

  // Core takes a registered tool's result as a string, an array or nothing.
  return { result: `Stage ${describe(mod.workflow, after)}` }
}

// The kind of rule each tool's calls can match.
const SIGNAL_KINDS: Record<string, Signal['kind']> = { Skill: 'skill', Bash: 'bash', Write: 'write', Edit: 'write' }

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
  // Most calls move nothing: only a match on this session's copy reads the store.
  if (autoMatch(mod.workflow, await current($, now), signal, mod.isWindows) === null) return
  // Matched again on the store's copy, which another session may have moved.
  let target: StageId = ''
  let via = ''
  const after = await move($, mod, now, from => {
    const match = autoMatch(mod.workflow, from, signal, mod.isWindows)
    if (match === null) return null
    target = match.stage
    via = viaOf(signal, match.rule)

    return applyMove(mod.workflow, from, { stage: target, by: 'auto', via, at: now })
  })
  if (after === null) return
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
  if (!mod.isReadOnly && !(await saveProgress(storeOf($), mod.key, saved))) await warnUnsaved($)
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

// The engine as the paint loop and the frames reach it: closures over $,
// built here, since no other file may take $.
function portsOf($: EngineInterface, mod: Mod): Ports {
  const log = (text: string) => $.ui.log(text, { to: 'debug' })

  return {
    now: () => $.clock.now(),
    sleep: ms => $.clock.sleep(ms),
    blit: frame => $.ui.blit(frame).catch(() => ({ deny: 'failed' })),
    invalidate: () => $.ui.invalidate('ui.render'),
    log,
    pollAgents: () => checkAgents($, mod),
    cells: (site, now) => siteCells(mod, site, now, log),
  }
}

// The roster as the agent list has it now. A list that fails leaves the
// roster as it was: the next check tries again.
async function checkAgents($: EngineInterface, mod: Mod) {
  try {
    const list = await $.agent.list()
    const now = await $.clock.now()
    mod.roster = reconcileRoster(mod.roster, list, now, await read($, kindsAtom))
    reseat(mod, now)
  } catch {
    // Checked again at the next poll or turn's end.
  }
}

// A workflow file is a few KB; anything far bigger is not one.
const WORKFLOW_FILE_MAX = 64 * 1024

type FileWorkflow = { kind: 'none' } | { kind: 'ok'; workflow: Workflow } | { kind: 'bad'; errors: string[] }

// The project's workflow file: absent, a workflow, or what is wrong with it.
async function readWorkflowFile($: EngineInterface): Promise<FileWorkflow> {
  try {
    if (!(await $.fs.exists(WORKFLOW_FILE))) return { kind: 'none' }
    const text = await $.fs.read(WORKFLOW_FILE)
    if (typeof text === 'string' && text.length > WORKFLOW_FILE_MAX) return { kind: 'bad', errors: [`${text.length} characters; a workflow file holds at most ${WORKFLOW_FILE_MAX}`] }
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
    // No credit here: the turn's time stays counting for its entry (found
    // again by its key), and the turn's end saves it.
    const fitted = reconcile(mod.workflow, base)
    await update($, progressAtom, () => fitted.progress)

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
    // finds them, in the colours their spawns left (grey for one unseen).
    await checkAgents($, mod)
    // Last, so the tool and the command are there first.
    if (loaded.isAvailable) await pruneStore($, mod, now)

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
    if (mod.demo) endDemo(mod, portsOf($, mod).invalidate)
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
    const kind = SIGNAL_KINDS[e.tool]
    if (result.isError !== true && kind !== undefined && mod.isAuto && hasRules(mod.workflow, kind)) {
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
      const { demo, label } = demoFor(cmd, mod.workflow, now)
      // The bar's lines with the demo's line under it, at the band's width.
      const barLines = bandLayout(mod.workflow, before, false, mod.lastBand?.columns ?? 100, 'demo').length
      const text = startDemo(mod, demo, label, now, await read($, hiddenAtom), barLines)
      // The band grows to hold it.
      if (mod.demo) $.ui.invalidate('ui.render')

      return { text }
    }
    if (cmd.kind === 'demo-stop') {
      if (!mod.demo) return { text: 'No demo is playing.' }
      endDemo(mod, portsOf($, mod).invalidate)

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
      const after = await move($, mod, at, from => moveFor(mod.workflow, from, cmd, at))

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
    const agentId = result.agentId
    mod.roster = spawned(mod.roster, agentId, result.model, now)
    reseat(mod, now)
    const kind = mod.roster.get(agentId)?.kind ?? 'unknown'
    if (kind !== 'unknown') await update($, kindsAtom, kinds => rememberKind(kinds, agentId, kind))
    // Clawd deep asleep: the area wakes to seat the helper.
    if (mod.band.isAsleep) {
      mod.band.isAsleep = false
      $.ui.invalidate('ui.render')
    }
    // A spawn of the main conversation's own, not a teammate's, may move the stage.
    if (e.parentAgentId === undefined && e.isTeammate !== true && mod.isAuto && hasRules(mod.workflow, 'agent')) {
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
      stopToon(mod, e.agentId)
      if (mod.auditors.delete(e.agentId) && mod.auditors.size === 0) await setAuditing($, mod, false)
      const now = await $.clock.now()
      mod.roster = ended(mod.roster, e.agentId, now)
      reseat(mod, now)
      await checkAgents($, mod)

      return next(e)
    }
    // The main spinner's toon stops; an agent at work keeps its row's.
    for (const id of [...mod.toons.keys()]) if (mod.roster.get(id)?.isAtWork !== true) stopToon(mod, id)
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
      mod.roster = reconcileRoster(mod.roster, list, now, await read($, kindsAtom))
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
    const cells = siteCells(mod, band, now, portsOf($, mod).log) ?? ''
    // The Raster mounts showing these.
    band.lastCells = cells
    band.blittedAt = now
    animate(portsOf($, mod), mod, band)
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
    const id = e.requestId
    if ((await read($, hiddenAtom)) || viewport < TOON_MIN) {
      if (id !== undefined) stopToon(mod, id)

      return line
    }
    // A spinner with no requestId is drawn once, with no loop.
    let toon = id === undefined ? createSite('toon') : mod.toons.get(id)
    if (!toon) {
      toon = createSite('toon')
      mod.toons.set(id!, toon)
    }
    toon.requestId = id
    toon.columns = Math.min(STAGE_W, viewport - 6)
    toon.isSeen = false
    const shownAt = await $.clock.now()
    const cells = siteCells(mod, toon, shownAt, portsOf($, mod).log) ?? ''
    toon.lastCells = cells
    toon.blittedAt = shownAt
    if (id !== undefined) animate(portsOf($, mod), mod, toon)
    const { Box, Raster } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {line}
        <Raster key="toon" columns={toon.columns} rows={TOON_ROWS} cells={cells} />
      </Box>
    )
  })
}
