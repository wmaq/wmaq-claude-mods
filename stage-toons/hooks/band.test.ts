import { expect, test } from 'claude-code/testing'

import { bandLayout, type Span, trackSpans } from './band'
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
