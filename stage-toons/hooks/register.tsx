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
import { bandLayout, type Tone } from './band'
import { moveFor, parseCommand, showText, USAGE } from './command'
import { createDirector, type Director, react, withStage } from './director'
import { type KV, loadProgress, saveProgress, storeKey, validate } from './progress'
import { COMMAND, SECTION_ID, TOOL, TOOL_DESCRIPTION, TOOL_SCHEMA, toolNameFor, workflowText } from './prompt'
import { applyMove, describe, freshProgress, isAdvance, isStageId, STAGE_IDS } from './stages'

const PLUGIN = 'stage-toons'
const HIDDEN_KEY = 'hidden'
const UNSAVED = "stage-toons: couldn't save progress; it lasts for this session only"

// The engine reads each atom's plugin and key from the source, so they are
// written out as literals.
const progressAtom = atom({ plugin: 'stage-toons', key: 'progress' } as const, null)
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

// The module's own state: made fresh by every load, so it starts over on a
// reload. What must outlive a reload is in $.state.
type Mod = {
  key: string
  toolName: string
  commandName: string
  hasWarned: boolean
  director: Director
}

const createMod = (): Mod => ({
  key: storeKey(''),
  toolName: toolNameFor(PLUGIN),
  commandName: COMMAND,
  hasWarned: false,
  director: createDirector('other', false),
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

  return { result: { content: [{ type: 'text' as const, text: `Stage ${describe(after)}` }] } }
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
    await update($, progressAtom, () => loaded.progress)
    await update($, hiddenAtom, () => isHidden)
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

  on('tool.call', async ($, e, next) => (e.tool === mod.toolName ? setStage($, mod, e as unknown as ToolArgs) : next(e)))

  on('command.run', async ($, e, next) => {
    if (e.command !== mod.commandName) return next(e)
    const cmd = parseCommand(e.args)
    const now = await $.clock.now()
    const before = await current($, now)
    if (cmd.kind === 'show') return { text: showText(before, now) }
    if (cmd.kind === 'usage') return { text: USAGE }
    if (cmd.kind === 'hide') {
      const isHidden = !(await read($, hiddenAtom))
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

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId !== undefined || (await read($, hiddenAtom))) return next(e)
    const progress = await read($, progressAtom)
    if (progress === null) return next(e)
    const lines = bandLayout(progress, false, e.props.bodyColumns)
    const { Box, Text } = $.ui.resolve(e)

    return (
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
  })
}
