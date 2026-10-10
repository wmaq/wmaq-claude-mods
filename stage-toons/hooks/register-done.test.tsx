import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { CLAWD_ORANGE } from './clawd'
import { answerText, bandProps, type Blit, blitsOf, callTool, colorInRows, decode, endTurn, engine, KEY, mountBand, NOW, runStage, setStage, START, startTurn, submit } from './harness'
import { DEEP_SLEEP_MS, DOZE_MS, IDLE_IDS } from './idle'
import { stored } from './progress'
import { C } from './scenes/kit'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW } from './workflow'

const text = (answer: unknown) => (answer as { text?: string }).text ?? ''
const ALL_ROWS = [0, 1, 2, 3, 4, 5, 6]

// Whether the area's frame is blank left of Clawd: classic alone draws
// nothing there (idle.test.ts), a show-off draws its prop there.
function isLeftBlank(blit: Blit | undefined): boolean {
  if (!blit) return false
  const words = decode(blit.cells)
  for (let row = 0; row < blit.rows; row++) for (let x = 0; x <= 10; x++) if (words[(row * blit.columns + x) * 3] !== 0x20) return false

  return true
}

// Every idle routine the mod writes to $.state, in order.
function idlePicks(on: On): string[] {
  const picks: string[] = []
  on('state.set', ($, e, next) => {
    const write = e as unknown as { key: string; value: unknown }
    if (write.key === 'idle') picks.push(String(write.value))

    return next(e)
  })

  return picks
}

// Session start reads classic as the idle routine; later reads see what the mod writes.
function classicFirst(on: On) {
  let isFirstRead = true
  on('state.get', ($, e, next) => {
    if (e.key !== 'idle' || !isFirstRead) return next(e)
    isFirstRead = false

    return { value: { value: 'classic', version: 0 } }
  })
}

test('/stage done from Cleanup: the bar shows Done, the history has it, Clawd jumps, and he celebrates while idle', async ($, on) => {
  const picks = idlePicks(on)
  const { world, clock } = engine(on)
  await $.session.start(START)
  // Claude works: the area plays the stage's scene.
  await mountBand($, 'terminal', bandProps(100, { isWorking: true }))
  await runStage($, 'cleanup')
  await runStage($, 'feature login')
  await clock.advance(3500)
  expect(text(await runStage($, 'done'))).toContain('✓ Done · login · "Merged and done"')
  await clock.advance(500)
  expect(colorInRows(blitsOf(world, 'area').at(-1), [0, 1, 2], CLAWD_ORANGE)).toBe(true)
  expect(text(await runStage($, 'log'))).toContain('✓ Done')
  expect(picks.at(-1)).toBe('celebrate')
})

test('/stage next from Cleanup goes to Done, and set_stage done does too', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await runStage($, 'cleanup')
  expect(text(await runStage($, 'next'))).toContain('✓ Done')
  await runStage($, 'cleanup')
  expect(answerText(await setStage($, { stage: 'done', message: 'Merged to main' }))).toBe('Stage ✓ Done · no feature · "Merged to main"')
})

test('a merge from Cleanup moves to Done by itself, and Claude hears of it; the same from Develop does not', async ($, on) => {
  const { world } = engine(on)
  world.isBashFailing = false
  await $.session.start(START)
  await runStage($, 'develop')
  await callTool($, 'Bash', { command: 'git push origin main' })
  expect(text(await runStage($, ''))).toContain('7/10 Develop')
  await runStage($, 'cleanup')
  const merged = await callTool($, 'Bash', { command: 'gh pr merge 12 --squash' })
  expect(merged.context?.[0]).toContain('[stage-toons] The stage moved by itself to ✓ Done (bash rule ')
  expect(text(await runStage($, ''))).toContain('✓ Done by auto')
})

test('a push from Cleanup moves to Done only when core saw it go through', async ($, on) => {
  const { world } = engine(on)
  let gitOperation: unknown
  world.answerTool = e => (e.tool === 'Bash' ? { result: { stdout: '', stderr: '', interrupted: false, ...(gitOperation ? { gitOperation } : {}) }, text: 'x' } : undefined)
  await $.session.start(START)
  await runStage($, 'cleanup')
  // Everything up to date, or a dry run: core names no push.
  await callTool($, 'Bash', { command: 'git push origin main' })
  expect(text(await runStage($, ''))).toContain('10/10 Cleanup')
  gitOperation = { push: { branch: 'main' } }
  const pushed = await callTool($, 'Bash', { command: 'git push origin main' })
  expect(pushed.context?.[0]).toContain('[stage-toons] The stage moved by itself to ✓ Done (pushed to main)')
})

test('after Done, Claude’s own chores move nothing; /stage back reopens the feature without confetti', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', bandProps(100, { isWorking: true }))
  await runStage($, 'cleanup')
  await runStage($, 'feature login')
  await runStage($, 'done')
  await callTool($, 'Write', { file_path: 'C:/Dev/proj/docs/superpowers/specs/x.md', content: 'x' })
  await callTool($, 'Skill', { skill: 'superpowers:finishing-a-development-branch' })
  expect(text(await runStage($, ''))).toContain('✓ Done · login')
  await clock.advance(3500)
  expect(text(await runStage($, 'back'))).toContain('10/10 Cleanup · login')
  await clock.advance(500)
  expect(colorInRows(blitsOf(world, 'area').at(-1), [0, 1, 2], CLAWD_ORANGE)).toBe(false)
})

test('the idle period after a turn that finished the spec shows off the spec, from the turn’s end; the one after picks at random', async ($, on) => {
  const picks = idlePicks(on)
  classicFirst(on)
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($)
  await runStage($, 'spec')
  await clock.advance(500)
  expect(isLeftBlank(blitsOf(world, 'area').at(-1))).toBe(true)
  await submit($)
  await startTurn($)
  await setStage($, { stage: 'spec-audit', message: 'Auditing' })
  expect(picks.at(-1)).toBe('show-off:spec')
  // During the turn the routine on show stays.
  await clock.advance(2000)
  expect(isLeftBlank(blitsOf(world, 'area').at(-1))).toBe(true)
  await endTurn($)
  await clock.advance(2500)
  expect(isLeftBlank(blitsOf(world, 'area').at(-1))).toBe(false)
  await submit($)
  expect(IDLE_IDS).toContain(picks.at(-1))
})

test('in Done every idle period celebrates; leaving Done during a turn ends with a random pick', async ($, on) => {
  const picks = idlePicks(on)
  engine(on)
  await $.session.start(START)
  await runStage($, 'cleanup')
  await runStage($, 'done')
  await submit($)
  await startTurn($)
  expect(picks.at(-1)).toBe('celebrate')
  await endTurn($)
  await submit($)
  await startTurn($)
  expect(picks.at(-1)).toBe('celebrate')
  await setStage($, { stage: 'brainstorm', feature: 'signup', message: 'Next feature' })
  await endTurn($)
  expect(IDLE_IDS).toContain(picks.at(-1))
})

// The work in Done, as the store keeps it.
const inDone = stored(
  applyMove(DEFAULT_WORKFLOW, applyMove(DEFAULT_WORKFLOW, freshProgress(NOW - 10), { stage: 'cleanup', feature: 'login', by: 'claude', at: NOW - 9 }), { stage: 'done', by: 'claude', at: NOW - 5 }),
)

test('a session that starts in Done celebrates', async ($, on) => {
  const picks = idlePicks(on)
  engine(on, { store: { [KEY]: inDone } })
  await $.session.start(START)
  expect(picks).toEqual(['celebrate'])
})

test('the pick at a prompt follows another session’s move into Done, and out of it', async ($, on) => {
  const picks = idlePicks(on)
  const { world } = engine(on)
  await $.session.start(START)
  await runStage($, 'cleanup')
  world.store[KEY] = { ...inDone, updatedAt: NOW + 60_000 }
  await submit($)
  expect(picks.at(-1)).toBe('celebrate')
  await endTurn($)
  world.store[KEY] = { ...inDone, stage: 'brainstorm', lastTrackStage: 'brainstorm', updatedAt: NOW + 120_000 }
  await submit($)
  expect(IDLE_IDS).toContain(picks.at(-1))
})

test('/stage next typed while Claude waits shows the prop at once, waking an area asleep', async ($, on) => {
  classicFirst(on)
  const { world, clock } = engine(on)
  await $.session.start(START)
  const ui = await mountBand($)
  await runStage($, 'develop')
  await clock.advance(DOZE_MS + DEEP_SLEEP_MS + 10_000)
  const asleep = blitsOf(world, 'area').length
  await clock.advance(60_000)
  expect(blitsOf(world, 'area').length).toBe(asleep)
  // The move asks for the band to be drawn again, so the area wakes.
  const invalidated = world.invalidations
  await runStage($, 'next')
  expect(world.invalidations).toBe(invalidated + 1)
  await ui.redraw()
  // The Raster mounts with the first frame; the prop is lifted at 1.5 s.
  await clock.advance(2000)
  expect(blitsOf(world, 'area').length).toBeGreaterThan(asleep)
  // The hammer's head: Develop's prop.
  expect(colorInRows(blitsOf(world, 'area').at(-1), ALL_ROWS, C.gray)).toBe(true)
})
