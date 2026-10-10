// stage-toons: wires the workflow progress bar and the toons to Claude
// Code's events. What it decides lives in the modules it imports.
//
// The engine reads this module's source before it loads it: $ may be
// passed only to functions declared at the top of this file, and every
// call on it is spelled $.noun.method(...) where it is made. So the helpers
// below are top-level functions that take $ and the module's state.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { Progress, ScenePick, SessionWorkflow, StageId, TaskList, WidthSetting, Workflow, WorkflowSettings } from '../types'
import { isAuditorSpawn, isFailureDue, staleAuditors } from './activity'
import { ended, reconcileRoster, rememberKind, spawned } from './agents'
import { autoMatch, hasRules, type Heard, isWindowsPath, relativePath, type Signal, typedSkill, viaOf } from './auto'
import { areaSize, BAR_TONES, bandLayout, bandMode, type BandSite } from './band'
import { autoText, bubblesText, CALM_DEMO_LINE, calmText, djBlockedText, djPartyText, djText, hideText, moveFor, parseCommand, settingsText, settingsWords, showText, unknownText, WORKFLOW_FILE, workflowSummary } from './command'
import { demoAt, demoFor, demoLine, demoStep, djDemoLine, idleDemoAt, idleDemoLine, startDemo, waitingDemoLine, workDemoAt, workDemoLine } from './demo'
import { createDirector, react, restarted, withAuditing, withScene } from './director'
import { areaCells, type Log } from './frames'
import { helpText } from './help'
import { CELEBRATE, pickIdle } from './idle'
import { idleForMove } from './keepsake'
import { createMod, djPollState, endDemo, type Mod, queued, reseat, takeWaiting } from './mod'
import { animate, type Ports } from './paint'
import { dealCard } from './deck'
import { addCost, type Cost, costText, creditAt, currentEntry, logText, NO_COST, timeText, tokensOf } from './history'
import { COMMAND_READ_MS, heard, isNewTrack, nextDelay, NO_MUSIC, type NowPlaying, READ_TIMEOUT_MS, type ReadFailure, SLOW_POLL_MS, trackText } from './nowplaying'
import { CHECK_TIMEOUT_MS, type Platform, platformOfUname, PLAYERCTL_VERSION_ARGV, problemOf, type Reader, readerFor, UNAME_ARGV } from './readers'
import { momentOf, phaseOf, whatOf } from './phase'
import { composed } from './pixels'
import { type KV, loadProgress, PRUNE_EVERY_MS, saveProgress, staleKeys, storeKey, validate } from './progress'
import { COMMAND, SECTION_ID, TOOL, TOOL_DESCRIPTION, toolSchema, workflowText } from './prompt'
import type { SceneId } from './scene'
import { STAGE_SCENES } from './scenes'
import { applyMove, describe, freshProgress, isAdvance, isReopen, reconcile, stageLabel } from './stages'
import { afterTaskCall, atTurnStart, countOf, isAllDone, sameCount, TASK_TOOLS } from './tasks'
import { isDone } from './track'
import { DEFAULT_WIDTH, isWidth, WIDTH_MAX, WIDTH_USAGE, widthText } from './width'
import { createActivity, lineOf, said, toolEnded, toolStarted, withMode } from './work'
import { DEFAULT_WORKFLOW, parseWorkflow, sameWorkflow, stageIds, stageList, stageOf, UNTRACKED_SCENE, withScenes, workflowJson } from './workflow'

const HIDDEN_KEY = 'hidden'
const AUTO_KEY = 'auto'
const BUBBLES_KEY = 'bubbles'
const CALM_KEY = 'calm'
const DJ_KEY = 'dj'
const DJ_PARTY_KEY = 'dj-party'
const WIDTH_KEY = 'width'
const PRUNED_KEY = 'pruned-at'
// Set once the first session's welcome toast was given.
const WELCOMED_KEY = 'welcomed'
const WELCOME = "stage-toons: the bar above the prompt follows the work's stage; /stage shows it and its commands, /stage demo plays the cartoons."
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
// The load of this module that runs now. A hot reload cancels only the
// waits pending as it lands, so a paint loop of the old load can live on,
// painting its own state into the band's Raster: it stops once this names
// another load.
const loadAtom = atom({ plugin: 'stage-toons', key: 'loadId' } as const, null)
const LOAD_ID = Math.random().toString(36).slice(2, 10)
// The idle routine for the next idle period: picked when a turn starts, so
// the band's render (which may not write $.state) only reads it; kept across
// a hot reload.
const idleAtom = atom({ plugin: 'stage-toons', key: 'idle' } as const, null)
// The scene the stage shows: kept across a hot reload, so the scene does
// not change under the person when the module reloads.
const sceneAtom = atom({ plugin: 'stage-toons', key: 'scene' } as const, null)
// Whether rules move the stage by itself, for this session: the project's
// file's setting or the store's at the start, then /stage auto's; kept
// across a hot reload.
const autoAtom = atom({ plugin: 'stage-toons', key: 'auto' } as const, true)
// Each agent's kind, as its spawn told it: kept across reloads, which
// start the roster empty, so the list's agents keep their colours.
const kindsAtom = atom({ plugin: 'stage-toons', key: 'agentKinds' } as const, {})
// The session's cost already credited to the history (null: not known yet):
// kept across reloads, so dollars are neither lost nor counted twice.
const usdAtom = atom({ plugin: 'stage-toons', key: 'usdCredited' } as const, null)
// The subagent tokens waiting for the main turn's end: kept across reloads.
const turnTokensAtom = atom({ plugin: 'stage-toons', key: 'turnTokens' } as const, NO_COST)
// Claude's task list, as the bar counts it: kept across reloads.
const tasksAtom = atom({ plugin: 'stage-toons', key: 'tasks' } as const, {})
// Whether Clawd's pop-ups show, for this session, as autoAtom is.
const bubblesAtom = atom({ plugin: 'stage-toons', key: 'bubbles' } as const, true)
// Whether the cartoons hold still, for this session, as autoAtom is: off
// unless turned on.
const calmAtom = atom({ plugin: 'stage-toons', key: 'calm' } as const, false)
// Whether DJ mode is on (/stage dj): kept across a reload, as calm is.
const djAtom = atom({ plugin: 'stage-toons', key: 'dj' } as const, false)
// Whether the DJ picture has its full light show (/stage dj party).
const djPartyAtom = atom({ plugin: 'stage-toons', key: 'djParty' } as const, false)
// How wide the cartoons grow, for this session, as autoAtom is.
const widthAtom = atom({ plugin: 'stage-toons', key: 'width' } as const, DEFAULT_WIDTH as WidthSetting)

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

// A tool call's arguments, read off the tool.call event itself: the engine
// spreads them onto it, beside tool, tool_use_id and agentId. The event's
// type is a union of the known tools' inputs, which names no MCP tool's
// fields, so it is read as a plain record here, once.
const argsOf = (e: ToolCallInput): ToolArgs => e as unknown as ToolArgs

// The store as progress.ts takes it.
const storeOf = ($: EngineInterface): KV => ({
  get: key => $.store.get(key),
  set: (key, value) => $.store.set(key, value),
})

// The first session's toast: once the store has saved that it was given,
// so a store that can't be read or written shows nothing.
async function welcome($: EngineInterface) {
  try {
    if ((await $.store.get(WELCOMED_KEY)) !== undefined) return
    await $.store.set(WELCOMED_KEY, true)
  } catch {
    return
  }
  $.ui.toast(WELCOME)
}

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
  if (typeof head.v === 'number' && head.v > 3) {
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
// stage stays and still lists it, else the next card of the stage's deck
// (hooks/deck.ts: every scene plays once before any repeats, never the one
// shown last). Untracked shows the Other scene and clears the held pick's
// stage, so coming back to the same stage deals the next card; the deck
// stays. Never called while a ui.render hook draws: it writes $.state.
async function sceneFor($: EngineInterface, mod: Mod, stage: StageId | null): Promise<SceneId> {
  const held = await read($, sceneAtom)
  if (stage === null) {
    if (held && held.stage !== null) await update($, sceneAtom, () => ({ ...held, stage: null }))

    return UNTRACKED_SCENE
  }
  const scenes = stageOf(mod.workflow, stage)?.scenes ?? [UNTRACKED_SCENE]
  if (held && held.stage === stage && scenes.includes(held.scene)) return held.scene
  const { scene, deck } = dealCard(scenes, held?.decks?.[stage], held?.lastByStage[stage], Math.random)
  const next: ScenePick = { stage, scene, lastByStage: { ...held?.lastByStage, [stage]: scene }, decks: { ...held?.decks, [stage]: deck } }
  await update($, sceneAtom, () => next)

  return scene
}

// The idle routine a move calls for (keepsake.ts), as the next idle
// period's; while Claude is idle (no turn under way: /stage typed while he
// waits), shown at once, the idle clock restarted, and a deep-asleep area
// woken to show it.
async function idleAfterMove($: EngineInterface, mod: Mod, before: Progress, after: Progress, now: number) {
  const routine = idleForMove(mod.workflow, before, after, mod.idle, Math.random())
  if (routine === null) return
  mod.nextIdle = routine
  await update($, idleAtom, () => routine)
  if (mod.workSince !== null || mod.isBandWorking) return
  mod.idle = routine
  mod.idleSince = now
  if (mod.band.isAsleep) {
    mod.band.isAsleep = false
    $.ui.invalidate('ui.render')
  }
}

async function commit($: EngineInterface, mod: Mod, before: Progress, after: Progress, now: number) {
  await update($, progressAtom, () => after)
  // Claude's working time goes to the entry the move left the work in.
  mod.workEntry = currentEntry(after)
  mod.director = withScene(mod.director, await sceneFor($, mod, after.stage), now)
  // Confetti for a step forward, and for the feature finished.
  if (isAdvance(mod.workflow, before, after) || (isDone(after.stage) && !isDone(before.stage))) mod.director = react(mod.director, 'advance', now)
  await idleAfterMove($, mod, before, after, now)
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
// at the call), a command run (with the branch a push in it updated, as
// core's gitOperation has it); or nothing a rule reads.
async function signalOf($: EngineInterface, mod: Mod, args: ToolArgs, result: unknown): Promise<Signal | null> {
  if (args.tool === 'Skill' && typeof args.skill === 'string') return { kind: 'skill', name: args.skill }
  if (args.tool === 'Bash' && typeof args.command === 'string') {
    const pushed = (result as { gitOperation?: { push?: { branch?: unknown } } } | null)?.gitOperation?.push?.branch

    return { kind: 'bash', command: args.command, ...(typeof pushed === 'string' ? { pushed } : {}) }
  }
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
  let isNewRound = false
  const after = await move($, mod, now, from => {
    const match = autoMatch(mod.workflow, from, signal, mod.isWindows)
    if (match === null) return null
    target = match.stage
    via = viaOf(signal, match.rule)
    isNewRound = isDone(from.stage) && !isReopen(from, match.stage)

    return applyMove(mod.workflow, from, { stage: target, by: 'auto', via, at: now })
  })
  if (after === null) return
  // Out of Done, a new round: the bar has no feature until Claude names one.
  const newRound = isNewRound ? ' A new feature starts: pass its name as feature.' : ''
  mod.notes.push(
    `[stage-toons] The stage moved by itself to ${stageLabel(mod.workflow, target)} (${via}). Now: ${describe(mod.workflow, after)}. Call ${mod.toolName} if a more specific message or another stage fits.${newRound}`,
  )
}

// Where a command the person typed comes from: a terminal, a phone (the
// bridge) or their own SDK host. A plugin's command is not the person's.
const PERSON_ORIGINS: readonly string[] = ['composer', 'bridge', 'sdk']

// A skill the person typed: command.run hears the command, skill.prompt the
// skill expanded, in either order. Whichever comes second makes the match,
// and the move goes on the queue as the Skill tool's call does.
async function hearSkill($: EngineInterface, mod: Mod, side: 'command' | 'skill', name: string) {
  const heard: Heard = { name, at: await $.clock.now() }
  const skill = side === 'command' ? typedSkill(heard, mod.expandedSkill) : typedSkill(mod.typedCommand, heard)
  if (skill === null) {
    if (side === 'command') mod.typedCommand = heard
    else mod.expandedSkill = heard

    return
  }
  mod.typedCommand = null
  mod.expandedSkill = null
  if (!mod.isAuto || !hasRules(mod.workflow, 'skill')) return
  const signal: Signal = { kind: 'skill', name: skill, isTyped: true }
  await settle($, 'an automatic move', queued(mod, () => autoMove($, mod, signal)))
}

// The session's cost so far, as /cost totals it; null when the engine
// answers none (no ledger) or the call fails.
async function sessionUsd($: EngineInterface): Promise<number | null> {
  try {
    const usd = (await $.session.usage()).cost?.usd

    return typeof usd === 'number' && Number.isFinite(usd) && usd >= 0 ? usd : null
  } catch {
    return null
  }
}

// The dollars spent since the last main turn's end, the baseline moved to
// the session's cost whatever becomes of them. A cost below the baseline
// (the ledger restarted) or a first figure only starts it: nothing spent.
// A session with no figure leaves it as it was, and spent nothing.
async function dollarsSpent($: EngineInterface): Promise<number> {
  const usd = await sessionUsd($)
  if (usd === null) return 0
  const baseline = await read($, usdAtom)
  await update($, usdAtom, () => usd)

  return baseline !== null && usd >= baseline ? usd - baseline : 0
}

// The main turn's end: the rest of its working time, and what its turns
// cost (tokens: the main turn's and its subagents'; dollars since the last
// main turn's end), credited and saved, so another session on the project
// picks it up. A turn whose start was missed credits its duration, at most
// the time since the entry began.
async function creditTurn($: EngineInterface, mod: Mod, durationMs: number, tokens: Cost) {
  const now = await $.clock.now()
  const since = mod.workSince
  const counted = mod.workEntry
  mod.workSince = null
  mod.workEntry = null
  // Moved at every main turn's end, credited or not (untracked, no entry),
  // so dollars never pile onto a later entry.
  const cost: Cost = { ...tokens, usd: await dollarsSpent($) }
  if ((await read($, progressAtom)) === null) return
  const { progress, raw } = await latestProgress($, mod, now)
  const entry = since !== null ? counted : currentEntry(progress)
  if (entry === null) return
  const ms = since !== null ? now - since : Math.min(Math.max(0, durationMs), now - entry.at)
  const after = creditAt(raw, entry, ms, cost)
  if (after === raw) {
    // The entry is gone from the copy (an older version's session cut the history).
    const lost = [ms > 0 ? `${Math.round(ms / 1000)} s of working time` : '', costText(cost)].filter(part => part !== '').join(' and ')
    if (lost !== '') $.ui.log(`stage-toons: ${lost} had no history entry to go to`, { to: 'debug' })

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

// /stage bubbles on or off, kept for every project. The paint loop reads
// it at its next frame.
async function setBubbles($: EngineInterface, mod: Mod, isOn: boolean) {
  mod.isBubbles = isOn
  await update($, bubblesAtom, () => isOn)
  try {
    await $.store.set(BUBBLES_KEY, isOn)
  } catch {
    // Lasts for this session.
  }
}

// /stage calm on or off, kept for every project. The paint loop reads it
// at its next frame; the band is drawn again, which wakes a loop the deep
// sleep stopped.
async function setCalm($: EngineInterface, mod: Mod, isOn: boolean) {
  mod.isCalm = isOn
  await update($, calmAtom, () => isOn)
  $.ui.invalidate('ui.render')
  try {
    await $.store.set(CALM_KEY, isOn)
  } catch {
    // Lasts for this session.
  }
}

// The platform check, run where the cwd isn't Windows: uname -sr, and on
// Linux playerctl --version. isKept: false for an answer the next check
// may change (uname couldn't run in time; playerctl isn't installed yet).
async function checkPlatform($: EngineInterface): Promise<{ platform: Platform; isKept: boolean }> {
  let platform: Platform
  try {
    platform = platformOfUname(await $.process.run([...UNAME_ARGV], { timeoutMs: CHECK_TIMEOUT_MS }))
  } catch {
    return { platform: 'unknown', isKept: false }
  }
  if (platform !== 'linux') return { platform, isKept: true }
  try {
    const { exitCode } = await $.process.run([...PLAYERCTL_VERSION_ARGV], { timeoutMs: CHECK_TIMEOUT_MS })
    if (exitCode === 0) return { platform: 'linux', isKept: true }
  } catch {
    // Not installed.
  }

  return { platform: 'linux-missing', isKept: false }
}

// The platform DJ mode reads on (Clawd DJ everywhere): none off the
// terminal ($.process is CLI only), Windows from the cwd, elsewhere the
// check's answer, kept for the load; a check in flight is shared, so a
// poll and a /stage dj typed together run one.
async function platformOf($: EngineInterface, mod: Mod): Promise<Platform> {
  if (mod.surface !== 'terminal') return 'none'
  if (mod.isWindows) return 'windows'
  if (mod.platform === null) {
    mod.platform = checkPlatform($).then(check => {
      mod.platform = check.isKept ? check.platform : null

      return check.platform
    })
  }

  return await mod.platform
}

// One read of what Spotify plays, with the platform's reader: the track,
// or null for nothing playing. A failed read counts as nothing playing;
// each kind is logged once per load, with its exit code but never its
// output or stderr (they may name what other apps play). It leaves what
// macOS's permission says (mod.djProblem). timeoutMs: how long it may take
// (the poll's 10 s; a command's own read less, inside its hook's budget).
async function readMusic($: EngineInterface, mod: Mod, reader: Reader, timeoutMs = READ_TIMEOUT_MS): Promise<NowPlaying | null> {
  let track: NowPlaying | null = null
  let failure: ReadFailure | null = null
  let detail = ''
  try {
    const result = await $.process.run([...reader.argv], { timeoutMs })
    // DJ mode turned off while it read: what it heard is nobody's.
    if (!mod.isDj) return null
    const outcome = reader.outcomeOf(result)
    // Composed (NFC), as drawText draws it and the box measures it.
    track = outcome.track && { ...outcome.track, artist: composed(outcome.track.artist), title: composed(outcome.track.title) }
    failure = outcome.failure
    if (failure === 'exit') detail = ` ${result.exitCode}`
  } catch {
    if (!mod.isDj) return null
    failure = 'rejected'
  }
  mod.djProblem = problemOf(reader, failure, mod.hasDjRead)
  // Only a read that reached Spotify shows macOS's prompt was answered:
  // {} comes from running() alone, before any Apple Event.
  if (track !== null) mod.hasDjRead = true
  if (failure !== null && !mod.djFailures.has(failure)) {
    mod.djFailures.add(failure)
    $.ui.log(`stage-toons: reading Spotify failed (${failure}${detail}); DJ mode takes it as nothing playing`, { to: 'debug' })
  }

  return track
}

// A read taken in: what the mod has heard, the moment a new track came on,
// and the band drawn again when the picture or the track changes.
async function hearMusic($: EngineInterface, mod: Mod, track: NowPlaying | null) {
  const before = mod.music
  const after = heard(before, track)
  mod.music = after
  if (isNewTrack(before, after)) mod.djChangedAt = await $.clock.now()
  const trackOf = (m: typeof after) => (m.track === null ? null : trackText(m.track))
  if (before.isPlaying !== after.isPlaying || trackOf(before) !== trackOf(after)) $.ui.invalidate('ui.render')
}

// The poll (Clawd DJ), detached: reads Spotify at nextDelay's pace while
// DJ mode stays on and this load is the current one; at once first unless
// the caller has just read. One loop at a time: turning DJ mode off ends
// it at its next look, and a loop started after that has its own token.
// It asks the platform first, and ends at once where DJ mode can't read
// (a check that isn't kept is asked again every SLOW_POLL_MS).
function startPoll($: EngineInterface, mod: Mod, hasRead: boolean) {
  if (mod.djLoop !== null) return
  const token = Math.random().toString(36).slice(2, 10)
  mod.djLoop = token
  void (async () => {
    let reader = readerFor(await platformOf($, mod))
    // A check that isn't kept (uname too slow, playerctl not yet
    // installed) is asked again at the slow pace while DJ mode stays on.
    while (reader === null && mod.platform === null && mod.isDj && mod.djLoop === token) {
      await $.clock.sleep(SLOW_POLL_MS)
      const id = await read($, loadAtom)
      if (id !== null && id !== LOAD_ID) return
      reader = readerFor(await platformOf($, mod))
    }
    let isFirst = !hasRead
    while (reader !== null && mod.isDj && mod.djLoop === token) {
      if (!isFirst) {
        // The area shown again wakes it (the band's hook); the sleep runs
        // out unheeded.
        mod.djSleepMs = nextDelay(djPollState(mod))
        let wake: (() => void) | null = null
        await Promise.race([$.clock.sleep(mod.djSleepMs), new Promise<void>(resolve => (mod.djWake = wake = resolve))])
        // A newer loop's (dj off, then on) is its own.
        if (mod.djWake === wake) mod.djWake = null
      }
      isFirst = false
      if (!mod.isDj || mod.djLoop !== token) break
      const id = await read($, loadAtom)
      if (id !== null && id !== LOAD_ID) break
      const track = await readMusic($, mod, reader)
      // DJ mode turned off (or on again, with a new loop) while it read.
      if (!mod.isDj || mod.djLoop !== token) break
      await hearMusic($, mod, track)
    }
  })()
    .catch(() => {
      // The environment unloaded mid-read (a reload, the session's end).
    })
    .finally(() => {
      if (mod.djLoop === token) mod.djLoop = null
    })
}

// /stage dj on or off, kept for every project; its answer. Turning it on
// gives a DJ picture that failed another try, and reads Spotify at once
// (within COMMAND_READ_MS, so the answer comes inside the hook's budget),
// so the answer names the track, then polls. Where DJ mode can't read (the
// platform), it answers why and stays off.
async function setDj($: EngineInterface, mod: Mod, isOn: boolean): Promise<string> {
  let reader: Reader | null = null
  if (isOn) {
    const platform = await platformOf($, mod)
    reader = readerFor(platform)
    if (reader === null) return djBlockedText(platform)
  }
  mod.isDj = isOn
  if (isOn && mod.isDjBroken) {
    mod.isDjBroken = false
    $.ui.invalidate('ui.render')
  }
  await update($, djAtom, () => isOn)
  try {
    await $.store.set(DJ_KEY, isOn)
  } catch {
    // Lasts for this session.
  }
  if (!isOn) {
    mod.djLoop = null
    // The poll's sleep ends now: it sees DJ mode off and ends.
    mod.djWake?.()
    mod.music = NO_MUSIC
    mod.djChangedAt = null
    mod.djProblem = null
    $.ui.invalidate('ui.render')
  } else if (mod.djLoop === null && reader !== null) {
    await hearMusic($, mod, await readMusic($, mod, reader, COMMAND_READ_MS))
    startPoll($, mod, true)
  }

  return djText(mod.isDj, mod.music, mod.isDjBroken, mod.djProblem)
}

// /stage dj's answer with no on or off: off; where DJ mode can't read (a
// setting kept from another machine), why; else what it last heard.
async function djStatus($: EngineInterface, mod: Mod): Promise<string> {
  if (mod.isDj) {
    const platform = await platformOf($, mod)
    if (readerFor(platform) === null) return djBlockedText(platform)
  }

  return djText(mod.isDj, mod.music, mod.isDjBroken, mod.djProblem)
}

// The columns the band has for the area, null before a band was drawn.
const roomOf = (mod: Mod): number | null => (mod.lastBand === null ? null : Math.min(mod.lastBand.columns - 1, WIDTH_MAX))

// What a help topic's page ends with: the answer its feature's own
// command gives now, for a feature with a setting.
async function helpNow($: EngineInterface, mod: Mod, topic: string | null, p: Progress, now: number): Promise<string | undefined> {
  const settings = (await read($, workflowAtom))?.settings
  if (topic === 'bar') return `${showText(mod.workflow, p, now)}\n${hideText((await read($, hiddenAtom)) === true, settings?.hide)}`
  if (topic === 'auto') return autoText(mod.workflow, mod.isAuto, settings?.auto)
  if (topic === 'popups') return bubblesText(mod.isBubbles, settings?.bubbles)
  if (topic === 'calm') return calmText(mod.isCalm, settings?.calm)
  if (topic === 'width') return widthText(mod.width, roomOf(mod), settings?.width)
  if (topic === 'dj') return `${await djStatus($, mod)}\n${djPartyText(mod.isDjParty)}`

  return undefined
}

// /stage dj party on or off, kept for every project, as calm is; the band
// is drawn again, so the next frame has it.
async function setDjParty($: EngineInterface, mod: Mod, isOn: boolean) {
  mod.isDjParty = isOn
  await update($, djPartyAtom, () => isOn)
  $.ui.invalidate('ui.render')
  try {
    await $.store.set(DJ_PARTY_KEY, isOn)
  } catch {
    // Lasts for this session.
  }
}

async function setAuditing($: EngineInterface, mod: Mod, isAuditing: boolean) {
  await update($, auditingAtom, () => isAuditing)
  mod.director = withAuditing(mod.director, isAuditing, await $.clock.now())
}

// Where the frames' failures go (a scene or a routine that threw): the
// debug log. The band's hook hands it to areaCells, as the paint loop's
// cells do.
function debugLog($: EngineInterface): Log {
  return text => $.ui.log(text, { to: 'debug' })
}

// The engine as the paint loop reaches it: closures over $, built here,
// since no other file may take $.
function portsOf($: EngineInterface, mod: Mod): Ports {
  const log = debugLog($)

  return {
    now: () => $.clock.now(),
    sleep: ms => $.clock.sleep(ms),
    blit: frame => $.ui.blit(frame).catch(() => ({ deny: 'failed' })),
    invalidate: () => $.ui.invalidate('ui.render'),
    pollAgents: () => checkAgents($, mod),
    isCurrent: async () => {
      const id = await read($, loadAtom)

      return id === null || id === LOAD_ID
    },
    cells: (site, now) => areaCells(mod, { columns: site.columns, rows: site.rows }, now, log),
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

type FileWorkflow = { kind: 'none' } | { kind: 'ok'; workflow: Workflow; settings?: WorkflowSettings } | { kind: 'bad'; errors: string[] }

// The project's workflow file: absent, a workflow, or what is wrong with it.
async function readWorkflowFile($: EngineInterface): Promise<FileWorkflow> {
  try {
    if (!(await $.fs.exists(WORKFLOW_FILE))) return { kind: 'none' }
    const text = await $.fs.read(WORKFLOW_FILE)
    if (typeof text === 'string' && text.length > WORKFLOW_FILE_MAX) return { kind: 'bad', errors: [`${text.length} characters; a workflow file holds at most ${WORKFLOW_FILE_MAX}`] }
    const parsed = parseWorkflow(typeof text === 'string' ? text : '', STAGE_SCENES)

    return 'workflow' in parsed ? { kind: 'ok', workflow: parsed.workflow, ...(parsed.settings ? { settings: parsed.settings } : {}) } : { kind: 'bad', errors: parsed.errors }
  } catch (error) {
    return { kind: 'bad', errors: [`could not read it: ${String(error)}`] }
  }
}

// /stage width <n> or full, kept for every project. The band redraws at
// its new size.
async function setWidth($: EngineInterface, mod: Mod, width: WidthSetting) {
  mod.width = width
  await update($, widthAtom, () => width)
  try {
    await $.store.set(WIDTH_KEY, width)
  } catch {
    // Lasts for this session.
  }
  $.ui.invalidate('ui.render')
}

const sessionWorkflowOf = (file: FileWorkflow): SessionWorkflow =>
  file.kind === 'ok' ? { workflow: file.workflow, source: 'file', ...(file.settings ? { settings: file.settings } : {}) } : { workflow: DEFAULT_WORKFLOW, source: 'default' }

// The project's starting state, at a fresh session start and at /stage
// workflow reload: the file's auto, hide, bubbles, calm and width where it sets them, else the
// person's own (the store's), else as the session has it. Nothing is
// saved: the store keeps the person's own settings.
async function applySettings($: EngineInterface, mod: Mod, settings: WorkflowSettings | undefined) {
  let isAuto = await read($, autoAtom)
  if (settings?.auto !== undefined) isAuto = settings.auto
  else {
    try {
      isAuto = (await $.store.get(AUTO_KEY)) !== false
    } catch {
      // As this session had it.
    }
  }
  const wasHidden = await read($, hiddenAtom)
  let isHidden = wasHidden
  if (settings?.hide !== undefined) isHidden = settings.hide
  else {
    try {
      isHidden = (await $.store.get(HIDDEN_KEY)) === true
    } catch {
      // As this session had it.
    }
  }
  let isBubbles = await read($, bubblesAtom)
  if (settings?.bubbles !== undefined) isBubbles = settings.bubbles
  else {
    try {
      isBubbles = (await $.store.get(BUBBLES_KEY)) !== false
    } catch {
      // As this session had it.
    }
  }
  // Off unless the store says on (bubbles is the other way round).
  const wasCalm = await read($, calmAtom)
  let isCalm = wasCalm
  if (settings?.calm !== undefined) isCalm = settings.calm
  else {
    try {
      isCalm = (await $.store.get(CALM_KEY)) === true
    } catch {
      // As this session had it.
    }
  }
  const wasWidth = await read($, widthAtom)
  let width = wasWidth
  if (settings?.width !== undefined) width = settings.width
  else {
    try {
      const kept = await $.store.get(WIDTH_KEY)
      width = isWidth(kept) ? kept : DEFAULT_WIDTH
    } catch {
      // As this session had it.
    }
  }
  mod.isAuto = isAuto
  mod.isHidden = isHidden
  mod.isBubbles = isBubbles
  mod.isCalm = isCalm
  mod.width = width
  await update($, autoAtom, () => isAuto)
  await update($, hiddenAtom, () => isHidden)
  await update($, bubblesAtom, () => isBubbles)
  await update($, calmAtom, () => isCalm)
  await update($, widthAtom, () => width)
  if (isHidden !== wasHidden || width !== wasWidth || isCalm !== wasCalm) $.ui.invalidate('ui.render')
}

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
  // The file's settings apply whether or not its stages changed.
  await applySettings($, mod, next.settings)
  const starts = settingsText(next.settings)
  const withStarts = (text: string) => (starts ? `${text}\n${starts}` : text)
  if (sameWorkflow(next.workflow, mod.workflow)) {
    const wasSource = mod.workflowSource
    // The settings ride in the session's workflow: kept for a hot reload.
    mod.workflowSource = next.source
    await update($, workflowAtom, () => next)
    const words = settingsWords(next.settings)
    const applied = words === null ? '.' : `; applied its settings: ${words}.`
    if (next.source === wasSource) return { text: `workflow unchanged${applied}` }

    // The same stages from another source: nothing for Claude or the cache.
    return { text: `workflow unchanged (now ${next.source === 'file' ? `from ${WORKFLOW_FILE}` : 'the default'})${applied}` }
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
  if (starts) lines.push(starts)
  if (!isRegistered) lines.push("set_stage could not be registered again (the debug log says why): Claude's tool may still list the old stages.")

  return { text: lines.join('\n'), context: [`[stage-toons] The workflow changed: ${stageList(mod.workflow)}. Now: ${describe(mod.workflow, progress)}`] }
}

// A call of the main conversation's that ended: the line it says (a test
// run, a commit, a push), and the task list it moved, the bar redrawn when
// the count changed and "All done!" said when the last task is done. The
// list is read and written in one update: a batch's task calls end
// together, and each must build on the one before.
async function heardCall($: EngineInterface, mod: Mod, args: ToolArgs, output: unknown, isError: boolean, now: number) {
  const tool = String(args.tool)
  const moment = momentOf(tool, args, isError)
  if (moment !== null) mod.activity = said(mod.activity, lineOf(moment, now), now)
  if (isError || !TASK_TOOLS.has(tool)) return
  let before: TaskList = {}
  let after: TaskList = {}
  await update($, tasksAtom, list => {
    before = list
    after = afterTaskCall(list, tool, args, output)

    return after
  })
  if (sameCount(countOf(before), countOf(after))) return
  $.ui.invalidate('ui.render')
  if (isAllDone(after) && !isAllDone(before)) mod.activity = said(mod.activity, lineOf('all-done', now), now)
}

export const register: Register = on => {
  const mod = createMod()

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await update($, loadAtom, () => LOAD_ID)
    const now = await $.clock.now()
    mod.key = storeKey(e.cwd)
    let held = await read($, workflowAtom)
    // No session workflow yet: a fresh session, not a hot reload.
    const isFresh = held === null
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
    // A fresh session starts as the project's file and the person's own
    // settings say; a hot reload keeps the session's own (a /stage auto off
    // typed earlier stands).
    if (isFresh) await applySettings($, mod, held.settings)
    else {
      mod.isAuto = await read($, autoAtom)
      mod.isHidden = await read($, hiddenAtom)
      mod.isBubbles = await read($, bubblesAtom)
      mod.isCalm = await read($, calmAtom)
      mod.width = await read($, widthAtom)
    }
    mod.surface = e.surface
    // DJ mode is the person's own, never the workflow file's: from the
    // store on a fresh session, from the session on a reload. On, it reads
    // Spotify at once (the poll ends at once where it can't read).
    if (isFresh) {
      let isDj = false
      let isParty = false
      try {
        isDj = (await $.store.get(DJ_KEY)) === true
        isParty = (await $.store.get(DJ_PARTY_KEY)) === true
      } catch {
        // Off for this session.
      }
      await update($, djAtom, () => isDj)
      await update($, djPartyAtom, () => isParty)
    }
    mod.isDj = await read($, djAtom)
    mod.isDjParty = await read($, djPartyAtom)
    if (mod.isDj && mod.surface === 'terminal') startPoll($, mod, false)
    mod.idleSince = now
    let routine = await read($, idleAtom)
    if (routine === null) {
      // A session that starts in Done celebrates; a show-off is not replayed.
      const first = isDone(progress.stage) ? CELEBRATE : pickIdle(undefined, Math.random())
      await update($, idleAtom, () => first)
      routine = first
    }
    mod.idle = routine
    mod.nextIdle = routine
    // A reload forgets which agents were Fable, so the auditor stands down.
    mod.auditors.clear()
    await update($, progressAtom, () => progress)
    await update($, auditingAtom, () => false)
    mod.director = createDirector(await sceneFor($, mod, progress.stage), false)
    await registerTool($, mod)
    try {
      mod.commandName = (
        await $.command.register({
          name: COMMAND,
          description:
            "Show or move the workflow stage; /stage hide hides the bar and the cartoons; /stage demo plays every scene, a stage's scenes, the idle routines, the waiting toon, what Clawd shows while Claude works or Clawd DJ; /stage workflow shows or reloads the workflow; /stage auto, bubbles, calm, dj, width, log and time: the automatic moves, Clawd's pop-ups, whether the cartoons hold still, Clawd DJ while Spotify plays, how wide they grow, the history, the time spent",
          argumentHint: '[n | id | next | back | feature <name> | message <text> | hide | demo [<stage> | idle | work | dj] [seconds] | demo waiting [scene] | demo stop | workflow [init | reload] | auto [on | off] | bubbles [on | off] | calm [on | off] | dj [on | off | party [on | off]] | width [<n> | full] | log [n] | time]',
          immediate: true,
        })
      ).command
    } catch (error) {
      $.ui.log(`stage-toons: could not register /stage: ${String(error)}`, { to: 'debug' })
    }
    // Computed once per session and kept across reloads: the section sits
    // in the cached part of the prompt.
    if ((await read($, sectionAtom)) === null) await update($, sectionAtom, () => workflowText(mod.workflow, progress, mod.toolName))
    // Dollars count from the session's cost now: what it cost before (a
    // resumed session's) is not this history's to claim. A reload keeps the
    // baseline it finds, unless the session's cost is below it (the ledger
    // restarted).
    const usdNow = await sessionUsd($)
    const usdBaseline = await read($, usdAtom)
    if (usdNow !== null && (usdBaseline === null || usdNow < usdBaseline)) await update($, usdAtom, () => usdNow)
    // Agents at work before a reload: the roster starts empty, and the list
    // finds them, in the colours their spawns left (grey for one unseen).
    await checkAgents($, mod)
    // Last, so the tool and the command are there first.
    if (loaded.isAvailable) await pruneStore($, mod, now)
    await welcome($)

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    // A turn starts: the stage's scene takes the area over from the demo.
    if (mod.demo) endDemo(mod, () => $.ui.invalidate('ui.render'))
    // Another session on this project may have moved the stage. On the move
    // queue, so a move still running is not overwritten.
    // Fitted to this session's workflow in memory; saved back only with this
    // session's next move or turn's credit.
    const now = await $.clock.now()
    await settle($, "adopting another session's progress", queued(mod, () => latestProgress($, mod, now)))
    // The routine for the idle period after this turn, leaving out the one
    // just shown; in Done (another session's move adopted first), the
    // celebration. A prompt typed while a turn runs (turnId set) starts no
    // idle period of its own, so it picks nothing. The box keeps the routine
    // on show until the idle clock restarts: switched here, it could paint
    // the new one for a frame before the turn hides it.
    if (e.turnId === undefined) {
      const routine = isDone((await read($, progressAtom))?.stage ?? null) ? CELEBRATE : pickIdle(mod.idle, Math.random())
      mod.nextIdle = routine
      await update($, idleAtom, () => routine)
    }
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
    // A new turn: no tools running, no line said; the spinner's mode stays.
    mod.activity = { ...createActivity(), mode: mod.activity.mode }
    // A task list all done showed through the turn it finished in.
    const tasks = await read($, tasksAtom)
    if (atTurnStart(tasks) !== tasks) {
      await update($, tasksAtom, atTurnStart)
      $.ui.invalidate('ui.render')
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === mod.toolName) return queued(mod, () => setStage($, mod, argsOf(e)))
    // The model's own calls in the main conversation show their phase's
    // badge while they run.
    const isModelCall = e.agentId === undefined && next.origin.plugin === 'engine'
    const phase = isModelCall ? phaseOf(e.tool, argsOf(e), mod.toolName) : null
    if (phase !== null) mod.activity = toolStarted(mod.activity, e.tool_use_id, phase, whatOf(e.tool, argsOf(e)))
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next(e)
    } finally {
      // The clock fails only as the plugin unloads: the call's own outcome stands.
      let end: number | null = null
      if (phase !== null) {
        try {
          end = await $.clock.now()
        } catch {
          end = null
        }
      }
      if (end !== null) mod.activity = toolEnded(mod.activity, e.tool_use_id, end)
    }
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
    // Never at the cost of the call's result: a failure goes to the debug log.
    await settle($, 'hearing a tool call', heardCall($, mod, argsOf(e), result.result, result.isError === true, await $.clock.now()))
    const kind = SIGNAL_KINDS[e.tool]
    if (result.isError !== true && kind !== undefined && mod.isAuto && hasRules(mod.workflow, kind)) {
      const signal = await signalOf($, mod, argsOf(e), result.result)
      if (signal) await settle($, 'an automatic move', queued(mod, () => autoMove($, mod, signal)))
    }
    if (mod.notes.length === 0) return result
    // Claude hears of the moves it has not heard of with this result.
    const notes = mod.notes
    mod.notes = []

    return { ...result, context: [...(result.context ?? []), ...notes] }
  })

  on('command.run', async ($, e, next) => {
    if (e.command !== mod.commandName) {
      // Heard before it runs: the skill it expands may be heard while it does.
      if (PERSON_ORIGINS.includes(e.origin.kind)) await hearSkill($, mod, 'command', e.command)

      return next(e)
    }
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

      return { text: autoText(mod.workflow, mod.isAuto, (await read($, workflowAtom))?.settings?.auto) }
    }
    if (cmd.kind === 'bubbles') {
      if (cmd.isOn !== null) await setBubbles($, mod, cmd.isOn)

      return { text: bubblesText(mod.isBubbles, (await read($, workflowAtom))?.settings?.bubbles) }
    }
    if (cmd.kind === 'calm') {
      if (cmd.isOn !== null) await setCalm($, mod, cmd.isOn)

      return { text: calmText(mod.isCalm, (await read($, workflowAtom))?.settings?.calm) }
    }
    if (cmd.kind === 'dj-party') {
      if (cmd.isOn !== null) await setDjParty($, mod, cmd.isOn)

      return { text: djPartyText(mod.isDjParty) }
    }
    if (cmd.kind === 'dj') return { text: cmd.isOn !== null ? await setDj($, mod, cmd.isOn) : await djStatus($, mod) }
    if (cmd.kind === 'width') {
      if (cmd.width !== null) await setWidth($, mod, cmd.width)

      return { text: widthText(mod.width, roomOf(mod), (await read($, workflowAtom))?.settings?.width) }
    }
    if (cmd.kind === 'width-usage') return { text: WIDTH_USAGE }
    if (cmd.kind === 'help') return { text: helpText(mod.workflow, cmd.topic, await helpNow($, mod, cmd.topic, before, now)) }
    if (cmd.kind === 'usage') return { text: unknownText(mod.workflow, e.args) }
    if (cmd.kind === 'demo' || cmd.kind === 'demo-idle' || cmd.kind === 'demo-waiting' || cmd.kind === 'demo-work' || cmd.kind === 'demo-dj') {
      // The work demo plays over the stage's own scene; the waiting demo the
      // scene asked for, or the next one dealt.
      const deal = mod.waiting.deal
      const waiting = cmd.kind === 'demo-waiting' ? (cmd.scene ?? takeWaiting(mod, now)) : undefined
      // The waiting demo's walks are worked out at the width the area will
      // have: the band's last size under the width setting now (a /stage
      // width just before it has not been drawn yet).
      const columns = mod.lastBand === null ? mod.band.columns : areaSize(mod.lastBand, mod.width, null).columns
      const { demo, label } = demoFor(cmd, mod.workflow, now, mod.director.scene, waiting, columns)
      // The bar's lines with the demo's line under it, at the band's width.
      const barLines = bandLayout(mod.workflow, before, false, mod.lastBand?.columns ?? 100, 'demo', countOf(await read($, tasksAtom))).length
      const text = startDemo(mod, demo, label, now, await read($, hiddenAtom), barLines)
      // A demo refused takes no scene from the deck.
      if (mod.demo !== demo) mod.waiting = { ...mod.waiting, deal }
      // The band grows to hold it.
      if (mod.demo) $.ui.invalidate('ui.render')
      // Asked for, the work demo shows the pop-ups even while they are off,
      // and every demo moves while calm mode is on.
      const notes = mod.demo !== demo ? [] : [...(demo.kind === 'work' && !mod.isBubbles ? ["Clawd's pop-ups are off: the demo shows them; /stage bubbles on turns them on."] : []), ...(mod.isCalm ? [CALM_DEMO_LINE] : [])]

      return { text: [text, ...notes].join('\n') }
    }
    if (cmd.kind === 'demo-stop') {
      if (!mod.demo) return { text: 'No demo is playing.' }
      endDemo(mod, () => $.ui.invalidate('ui.render'))

      return { text: 'Demo stopped.' }
    }
    if (cmd.kind === 'workflow') return { text: workflowSummary(mod.workflow, mod.workflowSource, (await read($, workflowAtom))?.settings) }
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

      return { text: hideText(isHidden, (await read($, workflowAtom))?.settings?.hide) }
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

  // Typed, through the Skill tool or preloaded into a subagent: only one
  // the person just typed moves the stage here (the Skill tool's calls go
  // through tool.call). The text passes untouched.
  on('skill.prompt', async ($, e, next) => {
    await hearSkill($, mod, 'skill', e.skill)

    return next(e)
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

  // A /clear starts a conversation with a new system prompt (no
  // session.start fires): the section is built again at the next prompt,
  // with the stage then, and the old conversation's notes are dropped.
  on('session.end', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'clear') {
      mod.notes = []
      await update($, sectionAtom, () => null)
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
      // Its tokens wait for the main turn's end, to go to the entry with it.
      const counted = tokensOf(e.usage)
      await update($, turnTokensAtom, waiting => addCost(waiting, counted))
      // A subagent's turn: the end of an auditor, perhaps. Its helper gets
      // up at once, whatever the list says yet.
      if (mod.auditors.delete(e.agentId) && mod.auditors.size === 0) await setAuditing($, mod, false)
      const now = await $.clock.now()
      mod.roster = ended(mod.roster, e.agentId, now)
      reseat(mod, now)
      await checkAgents($, mod)

      return next(e)
    }
    // A typed command or an expanded skill still waiting for the other is forgotten.
    mod.typedCommand = null
    mod.expandedSkill = null
    // The tokens so far, this turn's own with its subagents': a background
    // agent's turn that ends after this goes to the next main turn's.
    let waiting = NO_COST
    await update($, turnTokensAtom, before => {
      waiting = before

      return NO_COST
    })
    const tokens = addCost(waiting, tokensOf(e.usage))
    // The idle clock starts at the turn's end, not after the queue's wait:
    // a later start would restart the idle routine, a second dissolve.
    mod.idleSince = await $.clock.now()
    await settle($, "crediting the turn's working time", queued(mod, () => creditTurn($, mod, e.durationMs, tokens)))
    const now = await $.clock.now()
    // After the queue: a move it held may have picked the next routine.
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

  // The main conversation's spinner: its mode (thinking, responding, ...)
  // is what Clawd's layer shows. The engine's spinner draws as it does. A
  // background agent's row has its own, whose requestId is the agent's id.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.requestId === undefined || !mod.roster.has(e.requestId)) mod.activity = withMode(mod.activity, e.props.mode)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await $.clock.now()
    if (mod.demo && !demoStep(mod.demo, now)) mod.demo = null
    // Claude has just started: his scene starts from its beginning, even if
    // the area was away (hidden, or the bar alone) since it last showed it.
    // Claude has just stopped: the idle clock starts here if the band hears
    // of it before the turn's end does.
    if (e.props.isWorking) {
      if (!mod.isBandWorking) mod.director = restarted(mod.director, now)
      mod.isBandWorking = true
    } else if (mod.isBandWorking) {
      mod.isBandWorking = false
      mod.idleSince = now
      mod.idle = mod.nextIdle
      // The scene's picture keeps the layer it had through its dissolve.
      mod.activity = createActivity()
    }
    const progress = await read($, progressAtom)
    const columns = e.props.bodyColumns
    const sceneFrame = mod.demo?.kind === 'scenes' ? demoAt(mod.demo, now) : null
    const idleFrameOfDemo = mod.demo?.kind === 'idle' ? idleDemoAt(mod.demo, now) : null
    const workFrame = mod.demo?.kind === 'work' ? workDemoAt(mod.demo, now) : null
    if (sceneFrame) mod.demoLineIndex = sceneFrame.index
    if (idleFrameOfDemo) mod.demoLineIndex = idleFrameOfDemo.index
    if (workFrame) mod.demoLineIndex = workFrame.index
    const demoText =
      sceneFrame && mod.demo
        ? demoLine(sceneFrame, mod.demo, mod.workflow)
        : idleFrameOfDemo
          ? idleDemoLine(idleFrameOfDemo)
          : workFrame
            ? workDemoLine(workFrame, mod.isBubbles)
            : mod.demo?.kind === 'waiting'
              ? waitingDemoLine(mod.demo.scene)
              : mod.demo?.kind === 'dj'
                ? djDemoLine()
                : undefined
    const tasks = countOf(await read($, tasksAtom))
    const lines = progress === null ? [] : bandLayout(mod.workflow, progress, await read($, auditingAtom), columns, demoText, tasks)
    const site: BandSite = {
      surface: e.surface,
      hasSurvey: e.props.hasSurvey,
      isAgentView: e.props.view.agentId !== undefined,
      isHidden: await read($, hiddenAtom),
      columns,
      maxRows: e.props.maxRows,
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
              <Text key={`span-${i}-${j}`} wrap="truncate-end" {...BAR_TONES[span.tone]}>
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
    // As wide as the band and the width setting allow, as tall as it has
    // the rows for (band.ts).
    const size = areaSize(site, mod.width, wasShown ? band.rows : null)
    band.columns = size.columns
    band.rows = size.rows
    band.isSeen = false
    // Shown again: an agent may have ended, or started, while the area was
    // away (a paint loop still running from before polls on its own time).
    if (!wasShown) void checkAgents($, mod)
    const cells = areaCells(mod, { columns: band.columns, rows: band.rows }, now, debugLog($)) ?? ''
    // The Raster mounts showing these.
    band.lastCells = cells
    band.blittedAt = now
    animate(portsOf($, mod), mod, band)
    // The DJ poll sleeping its slow pace reads at once, now the area shows
    // (animate has woken it: a deep-asleep Clawd is awake until it says).
    if (mod.djWake !== null && nextDelay(djPollState(mod)) < mod.djSleepMs) mod.djWake()
    const { Raster } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {bar}
        <Raster key="area" columns={band.columns} rows={band.rows} cells={cells} />
        {below}
      </Box>
    )
  })
}
