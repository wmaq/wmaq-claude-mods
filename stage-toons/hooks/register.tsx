// stage-toons: wires the workflow progress bar and the toons to Claude
// Code's events. What it decides lives in the modules it imports.
//
// The engine reads this module's source before it loads it: $ may be
// passed only to functions declared at the top of this file, and every
// call on it is spelled $.noun.method(...) where it is made. So the helpers
// below are top-level functions that take $ and the module's state.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Progress, SessionWorkflow, Workflow } from '../types'
import { isAuditorSpawn, isFailureDue, staleAuditors } from './activity'
import { bandLayout, bandMode, type BandSite, IDLE_GAP, type Tone, TOON_MIN } from './band'
import { moveFor, parseCommand, showText, usage, WORKFLOW_FILE, workflowSummary } from './command'
import { type Demo, DEMO_SCENES, demoAt, demoLine } from './demo'
import { createDirector, type Director, react, shot, tick, withAuditing, withScene } from './director'
import { IDLE_COLS, IDLE_ROWS, idleFrame } from './idle'
import { encodeCells } from './pixels'
import { type KV, loadProgress, saveProgress, storeKey, validate } from './progress'
import { COMMAND, SECTION_ID, TOOL, TOOL_DESCRIPTION, toolNameFor, toolSchema, workflowText } from './prompt'
import { type SceneId, STAGE_W } from './scene'
import { REACTIONS, SCENES, STAGE_SCENES } from './scenes'
import { applyMove, describe, freshProgress, isAdvance, reconcile } from './stages'
import { type Cast, composeFrame, TOON_ROWS } from './toon'
import { DEFAULT_WORKFLOW, parseWorkflow, sameWorkflow, sceneOf, stageIds, stageList, workflowJson } from './workflow'

const PLUGIN = 'stage-toons'
const HIDDEN_KEY = 'hidden'
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
// idle Clawd or demo. Its key is its kind.
type SiteKind = 'toon' | 'idle' | 'demo'
type Site = { requestId: string | undefined; kind: SiteKind; columns: number; rows: number; isAnimating: boolean; isSeen: boolean }

// How often each kind repaints: the idle Clawd is calm.
const FRAME_MS: Record<SiteKind, number> = { toon: 83, demo: 83, idle: 166 }

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
  // Whether the band was last drawn while Claude worked, and what it was
  // last drawn in (null before it is first drawn).
  isBandWorking: boolean
  lastBand: BandSite | null
  demo: Demo | null
  // The demo scene the band's text line names.
  demoLineIndex: number
  broken: Set<SceneId>
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
  band: createSite('idle'),
  idleSince: 0,
  isBandWorking: false,
  lastBand: null,
  demo: null,
  demoLineIndex: 0,
  broken: new Set(),
})

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

async function commit($: EngineInterface, mod: Mod, before: Progress, after: Progress, now: number) {
  await update($, progressAtom, () => after)
  mod.director = withScene(mod.director, sceneOf(mod.workflow, after.stage), now)
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
  const before = await current($, now)
  const after = applyMove(mod.workflow, before, { stage, message, feature: typeof feature === 'string' ? feature : undefined, by: 'claude', at: now })
  await commit($, mod, before, after, now)

  // Core takes a registered tool's result as a string, an array or nothing.
  return { result: `Stage ${describe(mod.workflow, after)}` }
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

// A site's next frame, or null once the demo it plays is over.
function siteCells($: EngineInterface, mod: Mod, site: Site, now: number): string | null {
  if (site.kind === 'idle') return encodeCells(idleFrame(now - mod.idleSince))
  if (site.kind === 'demo') {
    const frame = mod.demo ? demoAt(mod.demo, now) : null

    return frame ? encodeCells(composeFrame(frame.shot, frame.sceneMs, site.columns, castOf($, mod))) : null
  }
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
      while (site.requestId !== undefined && !mod.isHidden && refused < (site.isSeen ? MAX_REFUSED : MAX_REFUSED_UNSEEN)) {
        const { requestId, kind, columns, rows } = site
        const now = await $.clock.now()
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
        const index = kind === 'demo' && mod.demo ? demoAt(mod.demo, now)?.index : undefined
        if (index !== undefined && index !== mod.demoLineIndex) {
          mod.demoLineIndex = index
          $.ui.invalidate('ui.render')
        }
        const answer = await $.ui.blit({ requestId, key: kind, cells, columns, rows }).catch(() => ({ deny: 'failed' }))
        if (answer.deny === undefined) {
          refused = 0
          site.isSeen = true
        } else {
          refused += 1
        }
        await $.clock.sleep(FRAME_MS[kind])
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

async function registerTool($: EngineInterface, mod: Mod) {
  try {
    mod.toolName = (await $.tool.register({ name: TOOL, description: TOOL_DESCRIPTION, inputSchema: toolSchema(mod.workflow) })).tool
  } catch (error) {
    $.ui.log(`stage-toons: could not register set_stage: ${String(error)}`, { to: 'debug' })
  }
}

async function initWorkflow($: EngineInterface): Promise<string> {
  if (await $.fs.exists(WORKFLOW_FILE)) return `stage-toons: ${WORKFLOW_FILE} exists; edit it, then /stage workflow reload`
  try {
    await $.fs.write(WORKFLOW_FILE, workflowJson(DEFAULT_WORKFLOW))
  } catch (error) {
    return `stage-toons: couldn't write ${WORKFLOW_FILE}: ${String(error)}`
  }

  return `stage-toons: Wrote the default workflow to ${WORKFLOW_FILE}: edit it, then /stage workflow reload.`
}

async function reloadWorkflow($: EngineInterface, mod: Mod, now: number): Promise<{ text: string; context?: string[] }> {
  const file = await readWorkflowFile($)
  if (file.kind === 'bad') return { text: [`stage-toons: ${WORKFLOW_FILE} has errors; kept the current workflow:`, ...file.errors.map(e => `  ${e}`)].join('\n') }
  const next = sessionWorkflowOf(file)
  if (sameWorkflow(next.workflow, mod.workflow)) {
    if (next.source === mod.workflowSource) return { text: 'stage-toons: workflow unchanged.' }
    // The same stages from another source: nothing for Claude or the cache.
    mod.workflowSource = next.source
    await update($, workflowAtom, () => next)

    return { text: `stage-toons: workflow unchanged (now ${next.source === 'file' ? `from ${WORKFLOW_FILE}` : 'the default'}).` }
  }
  mod.workflow = next.workflow
  mod.workflowSource = next.source
  await update($, workflowAtom, () => next)
  const { progress, moved } = reconcile(mod.workflow, await current($, now))
  await update($, progressAtom, () => progress)
  mod.director = withScene(mod.director, sceneOf(mod.workflow, progress.stage), now)
  await registerTool($, mod)
  await update($, sectionAtom, () => workflowText(mod.workflow, progress, mod.toolName))
  // The band's lines name stages: draw it again.
  $.ui.invalidate('ui.render')
  const from = next.source === 'file' ? `from ${WORKFLOW_FILE}` : `the default (no ${WORKFLOW_FILE})`
  const lines = [`stage-toons: workflow ${from}: ${mod.workflow.track.length} track stages, ${mod.workflow.side.length} side stages.`]
  if (moved) lines.push(moved)

  return { text: lines.join('\n'), context: [`[stage-toons] The workflow changed: ${stageList(mod.workflow)}. Now: ${describe(mod.workflow, progress)}`] }
}

// Starts the demo, or says why not.
function startDemo(mod: Mod, seconds: number, now: number, isHidden: boolean): string {
  if (isHidden) return 'stage-toons is hidden; /stage hide shows it.'
  if (mod.surface !== 'terminal') return 'The demo plays in the terminal only.'
  const band = mod.lastBand
  if (band && bandMode({ ...band, hasSurvey: false, isAgentView: false, isHidden: false, isDemo: true }) !== 'demo') {
    return 'The band has no room for the demo: it needs 30 columns and 9 rows.'
  }
  const isRestart = mod.demo !== null && demoAt(mod.demo, now) !== null
  mod.demo = { at: now, seconds }
  const total = DEMO_SCENES.length * seconds
  const length = total < 60 ? 'under a minute' : `about ${Math.round(total / 60)} min`

  return `${isRestart ? 'Restarting the demo: p' : 'P'}laying ${DEMO_SCENES.length} scenes, ${seconds} s each (${length}). /stage demo stop ends it.`
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
    mod.workflow = held.workflow
    mod.workflowSource = held.source
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
    mod.surface = e.surface
    mod.idleSince = now
    // A reload forgets which agents were Fable, so the auditor stands down.
    mod.auditors.clear()
    await update($, progressAtom, () => progress)
    await update($, hiddenAtom, () => isHidden)
    await update($, auditingAtom, () => false)
    mod.director = createDirector(sceneOf(mod.workflow, progress.stage), false)
    await registerTool($, mod)
    try {
      mod.commandName = (
        await $.command.register({
          name: COMMAND,
          description: 'Show or move the workflow stage; /stage hide hides the bar and the cartoons; /stage demo plays every scene; /stage workflow shows or reloads the workflow',
          argumentHint: '[n | id | next | back | feature <name> | message <text> | hide | demo [seconds | stop] | workflow [init | reload]]',
          immediate: true,
        })
      ).command
    } catch (error) {
      $.ui.log(`stage-toons: could not register /stage: ${String(error)}`, { to: 'debug' })
    }
    // Computed once per session and kept across reloads: the section sits
    // in the cached part of the prompt.
    if ((await read($, sectionAtom)) === null) await update($, sectionAtom, () => workflowText(mod.workflow, progress, mod.toolName))

    return result
  })

  // Another session on this project may have moved the stage.
  on('prompt.submit', async ($, e, next) => {
    // A turn starts: the toon under the spinner takes over from the demo.
    if (mod.demo) endDemo($, mod)
    try {
      const stored = validate(await $.store.get(mod.key))
      const mine = await read($, progressAtom)
      if (stored && (!mine || stored.updatedAt > mine.updatedAt)) {
        // Fitted to this session's workflow in memory only: never saved back.
        const fitted = reconcile(mod.workflow, stored).progress
        await update($, progressAtom, () => fitted)
        mod.director = withScene(mod.director, sceneOf(mod.workflow, fitted.stage), await $.clock.now())
      }
    } catch {
      // The store is unreadable: keep what this session has.
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === mod.toolName) return setStage($, mod, e as unknown as ToolArgs)
    const result = await next(e)
    if (e.agentId === undefined && result.isError === true) {
      const now = await $.clock.now()
      if (isFailureDue(mod.lastFailureAt, now)) {
        mod.lastFailureAt = now
        mod.director = react(mod.director, 'failure', now)
      }
    }

    return result
  })

  on('command.run', async ($, e, next) => {
    if (e.command !== mod.commandName) return next(e)
    const cmd = parseCommand(mod.workflow, e.args)
    const now = await $.clock.now()
    const before = await current($, now)
    if (cmd.kind === 'show') return { text: showText(mod.workflow, before, now) }
    if (cmd.kind === 'usage') return { text: usage(mod.workflow) }
    if (cmd.kind === 'demo') {
      const text = startDemo(mod, cmd.seconds, now, await read($, hiddenAtom))
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
    if (cmd.kind === 'workflow-init') return { text: await initWorkflow($) }
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
    if (cmd.kind === 'message' && before.stage === null) return { text: 'stage-toons: a message belongs to a stage; set one first (/stage next, or /stage <id>).' }
    const after = moveFor(mod.workflow, before, cmd, now)
    await commit($, mod, before, after, now)

    return { text: `Stage ${describe(mod.workflow, after)}`, context: [`[stage-toons] The user set the stage: ${describe(mod.workflow, after)}`] }
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
    if (result.deny === undefined && result.agentId !== undefined && isAuditorSpawn(e, result.model)) {
      const wasIdle = mod.auditors.size === 0
      mod.auditors.add(result.agentId)
      if (wasIdle) await setAuditing($, mod, true)
    }

    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      // A subagent's turn: the end of an auditor, perhaps, and of the
      // spinner on its row, which carries the agent's id.
      if (mod.toon.requestId === e.agentId) mod.toon.requestId = undefined
      if (mod.auditors.delete(e.agentId) && mod.auditors.size === 0) await setAuditing($, mod, false)

      return next(e)
    }
    mod.toon.requestId = undefined
    mod.idleSince = await $.clock.now()
    if (mod.auditors.size > 0) {
      try {
        for (const id of staleAuditors(mod.auditors, await $.agent.list())) mod.auditors.delete(id)
        if (mod.auditors.size === 0) await setAuditing($, mod, false)
      } catch {
        // Checked again at the next turn's end.
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await $.clock.now()
    if (mod.demo && !demoAt(mod.demo, now)) mod.demo = null
    // Claude has just stopped: the idle clock starts here if the band hears
    // of it before the turn's end does.
    if (e.props.isWorking) mod.isBandWorking = true
    else if (mod.isBandWorking) {
      mod.isBandWorking = false
      mod.idleSince = now
    }
    const site: BandSite = {
      surface: e.surface,
      isWorking: e.props.isWorking,
      hasSurvey: e.props.hasSurvey,
      isAgentView: e.props.view.agentId !== undefined,
      isHidden: await read($, hiddenAtom),
      columns: e.props.bodyColumns,
      maxRows: e.props.maxRows,
      isDemo: mod.demo !== null,
    }
    mod.lastBand = site
    const mode = bandMode(site)
    const progress = await read($, progressAtom)
    const { band } = mod
    if (mode === 'none' || progress === null) {
      band.requestId = undefined

      return next(e)
    }
    const columns = e.props.bodyColumns
    const frame = mode === 'demo' && mod.demo ? demoAt(mod.demo, now) : null
    if (frame) mod.demoLineIndex = frame.index
    const barColumns = mode === 'idle' ? columns - IDLE_COLS - IDLE_GAP : columns
    const lines = bandLayout(mod.workflow, progress, await read($, auditingAtom), barColumns, frame ? demoLine(frame, mod.workflow) : undefined)
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

      return (
        <Box flexDirection="column">
          {bar}
          {below}
        </Box>
      )
    }
    band.requestId = e.requestId
    band.kind = mode
    band.columns = mode === 'idle' ? IDLE_COLS : Math.min(STAGE_W, columns - 1)
    band.rows = mode === 'idle' ? IDLE_ROWS : TOON_ROWS
    band.isSeen = false
    const cells = siteCells($, mod, band, now) ?? ''
    animate($, mod, band)
    const { Raster } = $.ui.resolve(e)
    const raster = <Raster key={mode} columns={band.columns} rows={band.rows} cells={cells} />

    return mode === 'idle' ? (
      <Box flexDirection="column">
        <Box key="idle-row" flexDirection="row" alignItems="center" columnGap={IDLE_GAP} marginTop={1}>
          {raster}
          {bar}
        </Box>
        {below}
      </Box>
    ) : (
      <Box flexDirection="column">
        {bar}
        {raster}
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
