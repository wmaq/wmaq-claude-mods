// stage-toons: wires the workflow progress bar and the toons to Claude
// Code's events. What it decides lives in the modules it imports.
//
// The engine reads this module's source before it loads it: $ may be
// passed only to functions declared at the top of this file, and every
// call on it is spelled $.noun.method(...) where it is made. So the helpers
// below are top-level functions that take $ and the module's state.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Progress } from '../types'
import { isAuditorSpawn, isFailureDue, staleAuditors } from './activity'
import { bandLayout, bandMode, IDLE_GAP, type Tone, TOON_MIN } from './band'
import { moveFor, parseCommand, showText, USAGE } from './command'
import { type Demo, DEMO_SCENES, demoAt, demoLine } from './demo'
import { createDirector, type Director, react, shot, tick, withAuditing, withStage } from './director'
import { IDLE_COLS, IDLE_ROWS, idleFrame } from './idle'
import { encodeCells } from './pixels'
import { type KV, loadProgress, saveProgress, storeKey, validate } from './progress'
import { COMMAND, SECTION_ID, TOOL, TOOL_DESCRIPTION, TOOL_SCHEMA, toolNameFor, workflowText } from './prompt'
import { type SceneId, STAGE_W } from './scene'
import { REACTIONS, SCENES } from './scenes'
import { applyMove, describe, freshProgress, isAdvance, isStageId, STAGE_IDS } from './stages'
import { type Cast, composeFrame, TOON_ROWS } from './toon'

const PLUGIN = 'stage-toons'
const HIDDEN_KEY = 'hidden'
const UNSAVED = "stage-toons: couldn't save progress; it lasts for this session only"
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
const workflowAtom = atom({ plugin: 'stage-toons', key: 'workflowText' } as const, null)

const TONES: Record<Tone, { color?: string; bold?: boolean; dimColor?: boolean }> = {
  done: { color: '#D97757' },
  current: { color: '#D97757', bold: true },
  future: { dimColor: true },
  label: {},
  tag: { color: '#8B7AE8' },
  message: { dimColor: true },
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
  toolName: string
  commandName: string
  hasWarned: boolean
  director: Director
  auditors: Set<string>
  lastFailureAt: number | null
  isHidden: boolean
  surface: string | null
  toon: Site
  band: Site
  // When Claude last went idle: the session's start or the main turn's end.
  idleSince: number
  demo: Demo | null
  broken: Set<SceneId>
}

const createMod = (): Mod => ({
  key: storeKey(''),
  toolName: toolNameFor(PLUGIN),
  commandName: COMMAND,
  hasWarned: false,
  director: createDirector('other', false),
  auditors: new Set(),
  lastFailureAt: null,
  isHidden: false,
  surface: 'terminal',
  toon: createSite('toon'),
  band: createSite('idle'),
  idleSince: 0,
  demo: null,
  broken: new Set(),
})

type ToolArgs = { agentId?: string } & Record<string, unknown>

// The store as progress.ts takes it.
const storeOf = ($: EngineInterface): KV => ({
  get: key => $.store.get(key),
  set: (key, value) => $.store.set(key, value),
})

function warnUnsaved($: EngineInterface, mod: Mod) {
  if (mod.hasWarned) return
  mod.hasWarned = true
  $.ui.toast(UNSAVED)
}

async function current($: EngineInterface, now: number): Promise<Progress> {
  return (await read($, progressAtom)) ?? freshProgress(now)
}

async function commit($: EngineInterface, mod: Mod, before: Progress, after: Progress, now: number) {
  await update($, progressAtom, () => after)
  mod.director = withStage(mod.director, after.stage, now)
  if (isAdvance(before, after)) mod.director = react(mod.director, 'advance', now)
  if (!(await saveProgress(storeOf($), mod.key, after))) warnUnsaved($, mod)
}

async function setStage($: EngineInterface, mod: Mod, args: ToolArgs) {
  if (args.agentId !== undefined) return { deny: 'stage-toons: only the main conversation moves the workflow stage.' }
  const { stage, message, feature } = args
  if (!isStageId(stage) || typeof message !== 'string' || message.trim() === '') {
    return { deny: `stage-toons: set_stage needs "stage" (one of ${STAGE_IDS.join(', ')}) and a non-empty "message".` }
  }
  const now = await $.clock.now()
  const before = await current($, now)
  const after = applyMove(before, { stage, message, feature: typeof feature === 'string' ? feature : undefined, by: 'claude', at: now })
  await commit($, mod, before, after, now)

  // Core takes a registered tool's result as a string, an array or nothing.
  return { result: `Stage ${describe(after)}` }
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
    onBreak: (id, error) => $.ui.log(`stage-toons: scene ${id} failed and was replaced by idle: ${String(error)}`, { to: 'debug' }),
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
        const cells = siteCells($, mod, site, await $.clock.now())
        if (cells === null) {
          // The demo is over. Nothing is awaited from here to the loop's
          // end, so the redraw that brings the band back finds it finished.
          site.requestId = undefined
          endDemo($, mod)
          break
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
    } finally {
      site.isAnimating = false
    }
  })().catch(() => {
    // The environment unloaded mid-frame (a reload, the session's end).
  })
}

// Starts the demo, or says why not.
function startDemo(mod: Mod, seconds: number, now: number, isHidden: boolean): string {
  if (isHidden) return 'stage-toons is hidden; /stage hide shows it.'
  if (mod.surface !== 'terminal') return 'The demo plays in the terminal only.'
  mod.demo = { at: now, seconds }
  const total = DEMO_SCENES.length * seconds
  const length = total < 60 ? 'under a minute' : `about ${Math.round(total / 60)} min`

  return `Playing ${DEMO_SCENES.length} scenes, ${seconds} s each (${length}). /stage demo stop ends it.`
}

export const register: Register = on => {
  const mod = createMod()

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const now = await $.clock.now()
    mod.key = storeKey(e.cwd)
    const loaded = await loadProgress(storeOf($), mod.key, now)
    if (!loaded.isAvailable) warnUnsaved($, mod)
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
    await update($, progressAtom, () => loaded.progress)
    await update($, hiddenAtom, () => isHidden)
    await update($, auditingAtom, () => false)
    mod.director = createDirector(loaded.progress.stage, false)
    try {
      mod.toolName = (await $.tool.register({ name: TOOL, description: TOOL_DESCRIPTION, inputSchema: TOOL_SCHEMA })).tool
      mod.commandName = (
        await $.command.register({
          name: COMMAND,
          description: 'Show or move the workflow stage; /stage hide hides the bar and the cartoons',
          argumentHint: '[n | id | next | back | feature <name> | message <text> | hide]',
          immediate: true,
        })
      ).command
    } catch (error) {
      $.ui.log(`stage-toons: could not register set_stage or /stage: ${String(error)}`, { to: 'debug' })
    }
    // Computed once per session and kept across reloads: the section sits
    // in the cached part of the prompt.
    if ((await read($, workflowAtom)) === null) await update($, workflowAtom, () => workflowText(loaded.progress, mod.toolName))

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
        await update($, progressAtom, () => stored)
        mod.director = withStage(mod.director, stored.stage, await $.clock.now())
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
    const cmd = parseCommand(e.args)
    const now = await $.clock.now()
    const before = await current($, now)
    if (cmd.kind === 'show') return { text: showText(before, now) }
    if (cmd.kind === 'usage') return { text: USAGE }
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
    const after = moveFor(before, cmd, now)
    await commit($, mod, before, after, now)

    return { text: `Stage ${describe(after)}`, context: [`[stage-toons] The user set the stage: ${describe(after)}`] }
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    let text = await read($, workflowAtom)
    if (text === null) {
      const fresh = workflowText(await current($, await $.clock.now()), mod.toolName)
      await update($, workflowAtom, () => fresh)
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
      await update($, workflowAtom, () => workflowText(p, mod.toolName))
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
    const mode = bandMode({
      surface: e.surface,
      isWorking: e.props.isWorking,
      hasSurvey: e.props.hasSurvey,
      isAgentView: e.props.view.agentId !== undefined,
      isHidden: await read($, hiddenAtom),
      columns: e.props.bodyColumns,
      isDemo: mod.demo !== null,
    })
    const progress = await read($, progressAtom)
    const { band } = mod
    if (mode === 'none' || progress === null) {
      band.requestId = undefined

      return next(e)
    }
    const columns = e.props.bodyColumns
    const frame = mode === 'demo' && mod.demo ? demoAt(mod.demo, now) : null
    const barColumns = mode === 'idle' ? columns - IDLE_COLS - IDLE_GAP : columns
    const lines = bandLayout(progress, await read($, auditingAtom), barColumns, frame ? demoLine(frame) : undefined)
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
        <Box flexDirection="row" alignItems="center" columnGap={IDLE_GAP}>
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
