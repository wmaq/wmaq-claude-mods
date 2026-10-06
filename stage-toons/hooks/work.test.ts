import { expect, test } from 'claude-code/testing'

import { createDirector, react } from './director'
import { type Activity, createActivity, DOTS_S, layerAt, LINE_MS, lineAt, lineOf, LINES, MIN_SHOW_MS, said, settleActivity, TOOL_HOLD_MS, toolEnded, toolStarted, wanted, withMode } from './work'

const calm = createDirector('workbench', false)

// The activity settled at each moment in turn, as the paint loop does.
function run(a: Activity, times: number[]): Activity {
  return times.reduce((acc, t) => settleActivity(acc, t), a)
}

test("a running tool's badge and label show; after it ends they hold for TOOL_HOLD_MS", () => {
  let a = toolStarted(createActivity(), 'tu-1', 'test', 'npm test')
  a = settleActivity(a, 0)
  expect(a.shown.display).toEqual({ badge: 'test', what: 'npm test', isTyping: false })
  a = toolEnded(a, 'tu-1', 1000)
  expect(wanted(a, 1000 + TOOL_HOLD_MS - 1).badge).toBe('test')
  expect(wanted(a, 1000 + TOOL_HOLD_MS).badge).toBe(null)
})

test('two tools running together: the newest shows, the hold starts when the last ends', () => {
  let a = toolStarted(createActivity(), 'a', 'search', 'foo')
  a = toolStarted(a, 'b', 'read', 'bar.ts')
  expect(wanted(a, 0)).toEqual({ badge: 'read', what: 'bar.ts', isTyping: false })
  a = toolEnded(a, 'b', 100)
  expect(wanted(a, 100)).toEqual({ badge: 'search', what: 'foo', isTyping: false })
  expect(a.endedAt).toBe(null)
  a = toolEnded(a, 'a', 200)
  expect(a.endedAt).toBe(200)
  expect(wanted(a, 200 + TOOL_HOLD_MS - 1).badge).toBe('read')
  expect(toolEnded(a, 'unknown', 300)).toBe(a)
})

test('thinking and responding show only once no tool runs or is held', () => {
  let a = withMode(createActivity(), 'thinking')
  expect(wanted(a, 0).badge).toBe('thinking')
  a = toolStarted(a, 't', 'edit', 'x.ts')
  expect(wanted(a, 0).badge).toBe('edit')
  a = toolEnded(a, 't', 1000)
  a = withMode(a, 'responding')
  expect(wanted(a, 1500).badge).toBe('edit')
  expect(wanted(a, 1000 + TOOL_HOLD_MS)).toEqual({ badge: null, what: '', isTyping: true })
  a = withMode(a, 'thinking')
  expect(wanted(a, 1000 + TOOL_HOLD_MS).badge).toBe('thinking')
})

test('requesting and tool-input keep what shows; no mode shows nothing', () => {
  let a = settleActivity(withMode(createActivity(), 'thinking'), 0)
  a = withMode(a, 'requesting')
  expect(wanted(a, 5000).badge).toBe('thinking')
  a = withMode(a, 'tool-input')
  expect(wanted(a, 5000).badge).toBe('thinking')
  expect(wanted(withMode(a, null), 5000).badge).toBe(null)
})

test('a tool with no badge running past the hold shows nothing, not the last badge', () => {
  let a = toolEnded(toolStarted(createActivity(), 't', 'edit', 'auth.ts'), 't', 1000)
  a = settleActivity(withMode(a, 'tool-use'), 1000)
  expect(wanted(a, 1000 + TOOL_HOLD_MS - 1).badge).toBe('edit')
  expect(wanted(a, 1000 + TOOL_HOLD_MS)).toEqual({ badge: null, what: '', isTyping: false })
})

test('a display lasts at least MIN_SHOW_MS: in a burst, the ones between are skipped', () => {
  let a = toolStarted(createActivity(), '1', 'read', 'a.ts')
  a = settleActivity(a, 0)
  a = toolStarted(toolEnded(a, '1', 100), '2', 'read', 'b.ts')
  a = run(a, [150])
  a = toolStarted(toolEnded(a, '2', 300), '3', 'edit', 'c.ts')
  a = run(a, [400, 900])
  expect(a.shown.display.what).toBe('a.ts')
  a = run(a, [MIN_SHOW_MS])
  expect(a.shown).toEqual({ display: { badge: 'edit', what: 'c.ts', isTyping: false }, since: MIN_SHOW_MS })
})

test("a hook's line shows for LINE_MS; a newer one replaces it", () => {
  let a = said(createActivity(), 'All green!', 1000)
  expect(lineAt(a, calm, 1000)).toBe('All green!')
  expect(lineAt(a, calm, 1000 + LINE_MS)).toBe(null)
  a = said(a, 'Committed!', 2000)
  expect(lineAt(a, calm, 2100)).toBe('Committed!')
})

test("a reaction says its line from the director, the same in every frame; a hook's later line wins over it", () => {
  const failing = react(calm, 'failure', 5000)
  const line = lineAt(createActivity(), failing, 5000)
  expect(LINES.failure).toContain(line)
  expect(lineAt(createActivity(), failing, 7000)).toBe(line)
  expect(lineAt(createActivity(), failing, 5000 + LINE_MS)).toBe(null)
  expect(lineOf('failure', 5000)).toBe(line)
  expect(lineAt(said(createActivity(), 'Red tests.', 5100), failing, 5200)).toBe('Red tests.')
  expect(lineAt(said(createActivity(), 'Committed!', 4000), failing, 5200)).toBe(line)
  expect(LINES.advance).toContain(lineAt(createActivity(), react(calm, 'advance', 0), 10))
})

test('every line is ASCII and at most 12 characters', () => {
  for (const lines of Object.values(LINES)) for (const line of lines) expect(/^[\x20-\x7e]{1,12}$/.test(line)).toBe(true)
})

test('the layer: a badge with its label, or a bubble; a reaction hides the badge and the dots but not the line', () => {
  let a = settleActivity(toolStarted(createActivity(), '1', 'git', 'git push'), 0)
  expect(layerAt(a, calm, 0)).toEqual({ badge: 'git', what: 'git push', bubble: null, t: 0 })
  const failing = react(calm, 'failure', 400)
  a = said(a, 'Pushed!', 500)
  expect(layerAt(a, calm, 600)).toEqual({ badge: 'git', what: 'git push', bubble: 'Pushed!', t: 0.6 })
  expect(layerAt(a, failing, 800)).toEqual({ badge: null, what: '', bubble: 'Pushed!', t: 0.8 })
  expect(layerAt(createActivity(), calm, 0)).toBe(null)
})

test('the typing dots grow one, two, three, every DOTS_S', () => {
  const a = settleActivity(withMode(createActivity(), 'responding'), 1000)
  const at = (s: number) => layerAt(a, calm, 1000 + s * 1000)?.bubble
  expect([at(0), at(DOTS_S), at(2 * DOTS_S), at(3 * DOTS_S)]).toEqual(['.', '..', '...', '.'])
  expect(layerAt(a, react(calm, 'advance', 1000), 1100)?.bubble).not.toBe('.')
  const thinking = settleActivity(withMode(createActivity(), 'thinking'), 0)
  expect(layerAt(thinking, calm, 0)).toEqual({ badge: 'thinking', what: '', bubble: null, t: 0 })
})
