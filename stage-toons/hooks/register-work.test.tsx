import { expect, test } from 'claude-code/testing'

import { type Blit, bandProps, bandText, blitsOf, callTool, colorInRows, decode, endTurn, engine, mountBand, START, startTurn, type World } from './harness'
import { C } from './scenes/kit'
import { LINES } from './work'

// The activity layer over the stage's scene while Claude works.
const WORKING = bandProps(100, { isWorking: true })
const lastArea = (world: World) => blitsOf(world, 'area').at(-1)
const SPINNER = { word: 'Sauteing', message: null, suffix: '…' } as const

// The printable text of a cell row of a blitted frame: the layer's glyphs,
// the half blocks of the art as spaces.
function rowText(blit: Blit | undefined, row: number): string {
  if (!blit) return ''
  const words = decode(blit.cells)
  let s = ''
  for (let x = 0; x < blit.columns; x++) {
    const cp = words[(row * blit.columns + x) * 3]!
    s += cp >= 0x20 && cp < 0x7f ? String.fromCharCode(cp) : ' '
  }

  return s
}

test("the main spinner's mode reaches the layer: responding shows the typing dots, a background agent's spinner changes nothing", async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', WORKING)
  await $.agent.spawn({ tool_use_id: 'tu-a', prompt: 'p', description: 'Busy', subagentType: 'general-purpose', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
  const agents = await $.ui.mount({ plugin: 'stage-toons', surface: 'terminal', component: 'Spinner', props: { ...SPINNER, mode: 'responding' }, requestId: 'agent-1' })
  await clock.advance(1500)
  expect(rowText(lastArea(world), 0).trim()).toBe('')
  const main = await $.ui.mount({ plugin: 'stage-toons', surface: 'terminal', component: 'Spinner', props: { ...SPINNER, mode: 'responding' } })
  // The engine's spinner draws as it does.
  expect(await main.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await clock.advance(1500)
  expect(rowText(lastArea(world), 0)).toMatch(/\.{1,3}/)
  await main.unmount()
  await agents.unmount()
})

test('a test command shows its badge and label while it runs, then says its line', async ($, on) => {
  let release = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const { world, clock } = engine(on)
  world.answerTool = async call => {
    if (call.tool !== 'Bash') return undefined
    await gate

    return { result: 'ok', text: 'ok' }
  }
  await $.session.start(START)
  await mountBand($, 'terminal', WORKING)
  const running = callTool($, 'Bash', { command: 'cd x && npm test' })
  await clock.advance(500)
  expect(rowText(lastArea(world), 1)).toContain('npm test')
  release()
  await running
  await clock.advance(300)
  expect(LINES['test-pass'].some(line => rowText(lastArea(world), 0).includes(line))).toBe(true)
  // The line goes after LINE_MS; the badge after its hold.
  await clock.advance(3000)
  expect(rowText(lastArea(world), 0).trim()).toBe('')
  expect(rowText(lastArea(world), 1)).not.toContain('npm test')
})

test('a failing test plays the failure reaction and says a red line over it', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', WORKING)
  await callTool($, 'Bash', { command: 'npm test' })
  await clock.advance(400)
  expect(colorInRows(lastArea(world), [0, 1], C.red)).toBe(true)
  expect(LINES['test-fail'].some(line => rowText(lastArea(world), 0).includes(line))).toBe(true)
})

test("a subagent's calls show nothing; the layer goes when Claude stops working", async ($, on) => {
  const { world, clock } = engine(on)
  world.isBashFailing = false
  await $.session.start(START)
  const ui = await mountBand($, 'terminal', WORKING)
  await callTool($, 'Read', { file_path: 'src/auth.ts' }, 'agent-9')
  await clock.advance(300)
  expect(rowText(lastArea(world), 1)).not.toContain('auth.ts')
  await callTool($, 'Read', { file_path: 'src/auth.ts' })
  await clock.advance(300)
  expect(rowText(lastArea(world), 1)).toContain('auth.ts')
  await endTurn($)
  await ui.redraw(bandProps(100))
  await clock.advance(1000)
  expect(rowText(lastArea(world), 1)).not.toContain('auth.ts')
})

// The task tools answer as the engine does.
function taskTools(world: World) {
  let ids = 0
  world.answerTool = call => {
    if (call.tool === 'TaskCreate') {
      ids += 1

      return { result: { task: { id: String(ids), subject: String(call.subject) } }, text: 'ok' }
    }
    if (call.tool === 'TaskUpdate') return { result: { success: true, taskId: call.taskId, updatedFields: ['status'], statusChange: { from: 'pending', to: call.status } }, text: 'ok' }

    return undefined
  }
}

test('the task tools count on the bar, redrawing it; the last task done says All done!, and the next turn starts clean', async ($, on) => {
  const { world, clock } = engine(on)
  taskTools(world)
  await $.session.start(START)
  await mountBand($, 'terminal', WORKING)
  await callTool($, 'TaskCreate', { subject: 'a', description: 'a' })
  await callTool($, 'TaskCreate', { subject: 'b', description: 'b' })
  // A subagent's tasks are not Claude's list.
  await callTool($, 'TaskCreate', { subject: 'c', description: 'c' }, 'agent-9')
  expect(await bandText($, 'terminal', WORKING)).toContain('Not tracked yet · 0 of 2 tasks')
  const before = world.invalidations
  await callTool($, 'TaskUpdate', { taskId: '1', status: 'completed' })
  expect(world.invalidations).toBeGreaterThan(before)
  expect(await bandText($, 'terminal', WORKING)).toContain('1 of 2 tasks')
  await callTool($, 'TaskUpdate', { taskId: '2', status: 'completed' })
  expect(await bandText($, 'terminal', WORKING)).toContain('2 of 2 tasks ✓')
  await clock.advance(300)
  expect(rowText(lastArea(world), 0)).toContain('All done!')
  await endTurn($)
  await startTurn($)
  expect(await bandText($, 'terminal', WORKING)).not.toContain('tasks')
})

test('a list with work left stays at the next turn', async ($, on) => {
  taskTools(engine(on).world)
  await $.session.start(START)
  await callTool($, 'TaskCreate', { subject: 'a', description: 'a' })
  await endTurn($)
  await startTurn($)
  expect(await bandText($)).toContain('0 of 1 task')
})

test('with /stage bubbles off the layer shows nothing, while the failure still plays', async ($, on) => {
  const { world, clock } = engine(on)
  await $.session.start(START)
  await mountBand($, 'terminal', WORKING)
  await $.command.run({ command: 'stage', args: 'bubbles off' } as never)
  await callTool($, 'Bash', { command: 'npm test' })
  await clock.advance(400)
  expect(colorInRows(lastArea(world), [0, 1], C.red)).toBe(true)
  expect(rowText(lastArea(world), 0).trim()).toBe('')
  expect(rowText(lastArea(world), 1).trim()).toBe('')
})
