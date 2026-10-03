import { expect, test } from 'claude-code/testing'

import { bandLayout, bandMode, IDLE_MIN, type Span, trackSpans } from './band'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW } from './workflow'

const text = (line: Span[] | undefined) => (line ?? []).map(s => s.text).join('')
const plan = applyMove(DEFAULT_WORKFLOW, freshProgress(0), { stage: 'plan', feature: 'stage-toons', by: 'claude', at: 1 })

test('the track marks done, current and future steps', () => {
  const spans = trackSpans(DEFAULT_WORKFLOW, plan)
  expect(text(spans)).toBe('●━●━●━●━◉─○─○─○─○─○')
  expect(spans[0]).toEqual({ text: '●', tone: 'done' })
  expect(spans[7]).toEqual({ text: '━', tone: 'done' })
  expect(spans[8]).toEqual({ text: '◉', tone: 'current' })
  expect(spans[9]).toEqual({ text: '─', tone: 'future' })
})

test('the wide band has the track, the label and the message', () => {
  const lines = bandLayout(DEFAULT_WORKFLOW, plan, false, 100)
  expect(lines.map(text)).toEqual([' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons', ' Writing the implementation plan'])
  expect(lines[1]?.[0]?.tone).toBe('message')
})

test('Other dims the track where it stood and labels itself', () => {
  const p = applyMove(DEFAULT_WORKFLOW, plan, { stage: 'other', message: 'Fixing a CI flake', by: 'claude', at: 2 })
  expect(trackSpans(DEFAULT_WORKFLOW, p).every(s => s.tone === 'future')).toBe(true)
  expect(text(bandLayout(DEFAULT_WORKFLOW, p, false, 100)[0])).toBe(' ●━●━●━●━◉─○─○─○─○─○  ? Other · stage-toons')
  expect(text(bandLayout(DEFAULT_WORKFLOW, freshProgress(0), false, 100)[0])).toBe(' ○─○─○─○─○─○─○─○─○─○  ? Other')
})

test('the Fable tag shows while auditing, and goes first when room runs out', () => {
  const wide = bandLayout(DEFAULT_WORKFLOW, plan, true, 100)[0]
  expect(text(wide)).toBe(' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons  ⌕ Fable reviewing')
  expect(wide?.at(-1)).toEqual({ text: '  ⌕ Fable reviewing', tone: 'tag' })
  expect(text(bandLayout(DEFAULT_WORKFLOW, plan, true, 50)[0])).toBe(' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons')
})

test('a long feature is dropped before anything is cut, and the message is cut to fit', () => {
  const long = applyMove(DEFAULT_WORKFLOW, plan, { stage: 'plan', feature: 'x'.repeat(40), message: 'm'.repeat(80), by: 'claude', at: 2 })
  const [line1, line2] = bandLayout(DEFAULT_WORKFLOW, long, false, 60)
  expect(text(line1)).toBe(' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan')
  expect(text(line2)).toBe(` ${'m'.repeat(57)}…`)
})

test('a narrow band is one line', () => {
  expect(bandLayout(DEFAULT_WORKFLOW, plan, true, 49).map(text)).toEqual(['5/10 Plan — Writing the implementation plan'])
  expect(bandLayout(DEFAULT_WORKFLOW, plan, false, 20).map(text)).toEqual(['5/10 Plan — Writin…'])
})

test('the demo line can stand in for the message', () => {
  expect(bandLayout(DEFAULT_WORKFLOW, plan, false, 100, 'Demo 3/12: Spec').map(text)).toEqual([' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons', ' Demo 3/12: Spec'])
  expect(bandLayout(DEFAULT_WORKFLOW, plan, false, 40, 'Demo 3/12: Spec').map(text)).toEqual(['5/10 Plan — Demo 3/12: Spec'])
})

const site = { surface: 'terminal', isWorking: false, hasSurvey: false, isAgentView: false, isHidden: false, columns: 100, maxRows: 10, isDemo: false }

test('the band shows the idle Clawd in a wide terminal while Claude waits', () => {
  expect(bandMode(site)).toBe('idle')
  expect(bandMode({ ...site, columns: IDLE_MIN })).toBe('idle')
  expect(IDLE_MIN).toBe(70)
  expect(bandMode({ ...site, columns: IDLE_MIN - 1 })).toBe('text')
  expect(bandMode({ ...site, isWorking: true })).toBe('text')
  expect(bandMode({ ...site, surface: 'desktop' })).toBe('text')
})

test('the band plays the demo in a terminal of 30 columns or more, working or not', () => {
  const demo = { ...site, isDemo: true }
  expect(bandMode(demo)).toBe('demo')
  expect(bandMode({ ...demo, isWorking: true })).toBe('demo')
  expect(bandMode({ ...demo, columns: 30 })).toBe('demo')
  expect(bandMode({ ...demo, columns: 29 })).toBe('text')
  expect(bandMode({ ...demo, surface: 'desktop' })).toBe('text')
})

test('the band yields to a survey, an agent transcript, and /stage hide', () => {
  for (const off of [{ hasSurvey: true }, { isAgentView: true }, { isHidden: true }]) {
    expect(bandMode({ ...site, ...off })).toBe('none')
    expect(bandMode({ ...site, ...off, isDemo: true })).toBe('none')
  }
})

test('the band cuts its lines between characters, never through an emoji', () => {
  const p = applyMove(DEFAULT_WORKFLOW, freshProgress(0), { stage: 'plan', message: '🚀'.repeat(40), by: 'claude', at: 1 })
  for (const columns of [30, 41, 60, 61]) {
    for (const line of bandLayout(DEFAULT_WORKFLOW, p, false, columns)) {
      const t = text(line)
      expect(Array.from(t).some(ch => ch.length === 1 && ch.charCodeAt(0) >= 0xd800 && ch.charCodeAt(0) <= 0xdfff)).toBe(false)
    }
  }
})

test('the idle Clawd and the demo need the rows to show whole', () => {
  expect(bandMode({ ...site, maxRows: 5 })).toBe('idle')
  expect(bandMode({ ...site, maxRows: 4 })).toBe('text')
  expect(bandMode({ ...site, isDemo: true, maxRows: 9 })).toBe('demo')
  expect(bandMode({ ...site, isDemo: true, maxRows: 8 })).toBe('text')
  // Below 50 columns the bar is one line, so the demo takes a row less.
  expect(bandMode({ ...site, isDemo: true, columns: 40, maxRows: 8 })).toBe('demo')
})

test('the track has as many dots as the workflow has track stages', () => {
  const small = { track: DEFAULT_WORKFLOW.track.slice(0, 3), side: DEFAULT_WORKFLOW.side }
  const p = applyMove(small, freshProgress(0), { stage: 'brainstorm', by: 'claude', at: 1 })
  expect(text(bandLayout(small, p, false, 100)[0])).toBe(' ●━◉─○  2/3 Brainstorm')
})
