import { expect, test } from 'claude-code/testing'

import { bandLayout, bandMode, IDLE_MIN, type Span, trackSpans } from './band'
import { applyMove, freshProgress } from './stages'

const text = (line: Span[] | undefined) => (line ?? []).map(s => s.text).join('')
const plan = applyMove(freshProgress(0), { stage: 'plan', feature: 'stage-toons', by: 'claude', at: 1 })

test('the track marks done, current and future steps', () => {
  const spans = trackSpans(plan)
  expect(text(spans)).toBe('●━●━●━●━◉─○─○─○─○─○')
  expect(spans[0]).toEqual({ text: '●', tone: 'done' })
  expect(spans[7]).toEqual({ text: '━', tone: 'done' })
  expect(spans[8]).toEqual({ text: '◉', tone: 'current' })
  expect(spans[9]).toEqual({ text: '─', tone: 'future' })
})

test('the wide band has the track, the label and the message', () => {
  const lines = bandLayout(plan, false, 100)
  expect(lines.map(text)).toEqual([' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons', ' Writing the implementation plan'])
  expect(lines[1]?.[0]?.tone).toBe('message')
})

test('Other dims the track where it stood and labels itself', () => {
  const p = applyMove(plan, { stage: 'other', message: 'Fixing a CI flake', by: 'claude', at: 2 })
  expect(trackSpans(p).every(s => s.tone === 'future')).toBe(true)
  expect(text(bandLayout(p, false, 100)[0])).toBe(' ●━●━●━●━◉─○─○─○─○─○  ? Other · stage-toons')
  expect(text(bandLayout(freshProgress(0), false, 100)[0])).toBe(' ○─○─○─○─○─○─○─○─○─○  ? Other')
})

test('the Fable tag shows while auditing, and goes first when room runs out', () => {
  const wide = bandLayout(plan, true, 100)[0]
  expect(text(wide)).toBe(' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons  ⌕ Fable reviewing')
  expect(wide?.at(-1)).toEqual({ text: '  ⌕ Fable reviewing', tone: 'tag' })
  expect(text(bandLayout(plan, true, 50)[0])).toBe(' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons')
})

test('a long feature is dropped before anything is cut, and the message is cut to fit', () => {
  const long = applyMove(plan, { stage: 'plan', feature: 'x'.repeat(40), message: 'm'.repeat(80), by: 'claude', at: 2 })
  const [line1, line2] = bandLayout(long, false, 60)
  expect(text(line1)).toBe(' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan')
  expect(text(line2)).toBe(` ${'m'.repeat(57)}…`)
})

test('a narrow band is one line', () => {
  expect(bandLayout(plan, true, 49).map(text)).toEqual(['5/10 Plan — Writing the implementation plan'])
  expect(bandLayout(plan, false, 20).map(text)).toEqual(['5/10 Plan — Writin…'])
})

test('the demo line can stand in for the message', () => {
  expect(bandLayout(plan, false, 100, 'Demo 3/12: Spec').map(text)).toEqual([' ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons', ' Demo 3/12: Spec'])
  expect(bandLayout(plan, false, 40, 'Demo 3/12: Spec').map(text)).toEqual(['5/10 Plan — Demo 3/12: Spec'])
})

const site = { surface: 'terminal', isWorking: false, hasSurvey: false, isAgentView: false, isHidden: false, columns: 100, isDemo: false }

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
