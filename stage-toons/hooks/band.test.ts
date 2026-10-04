import { expect, test } from 'claude-code/testing'

import { BAR_TONES, bandLayout, bandMode, type Span, trackSpans } from './band'
import { applyMove, cellWidth, freshProgress } from './stages'
import { DEFAULT_WORKFLOW } from './workflow'

const W = DEFAULT_WORKFLOW

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

test('a side stage hides the track and shows where the work returns', () => {
  const p = applyMove(W, plan, { stage: 'debugging', message: 'Reproducing the login bug', by: 'claude', at: 2 })
  const lines = bandLayout(W, p, false, 100)
  expect(lines.map(text)).toEqual([' Debugging · stage-toons   ↩ 5/10 Plan', ' Reproducing the login bug'])
  expect(lines[0]?.at(-1)).toEqual({ text: '   ↩ 5/10 Plan', tone: 'note' })
})

test('on a side stage the return note goes first, then the feature, then the label is cut', () => {
  const p = applyMove(W, plan, { stage: 'debugging', by: 'claude', at: 2 })
  // " Debugging · " and 30 x's is 43 cells; the note adds 14.
  const long = { ...p, feature: 'x'.repeat(30) }
  expect(text(bandLayout(W, long, false, 100)[0])).toBe(` Debugging · ${'x'.repeat(30)}   ↩ 5/10 Plan`)
  expect(text(bandLayout(W, long, false, 52)[0])).toBe(` Debugging · ${'x'.repeat(30)}`)
  expect(text(bandLayout(W, { ...p, feature: 'x'.repeat(40) }, false, 52)[0])).toBe(' Debugging')
  expect(bandLayout(W, p, false, 49).map(text)).toEqual(['Debugging — Hunting a bug'])
  const fresh = applyMove(W, freshProgress(0), { stage: 'other', by: 'user', at: 1 })
  expect(text(bandLayout(W, fresh, false, 100)[0])).toBe(' Other')
})

test('untracked is one line: the dim track, Not tracked yet and the feature', () => {
  expect(bandLayout(W, freshProgress(0), false, 100).map(text)).toEqual([' ○─○─○─○─○─○─○─○─○─○  Not tracked yet'])
  expect(bandLayout(W, { ...freshProgress(0), feature: 'login' }, false, 100).map(text)).toEqual([' ○─○─○─○─○─○─○─○─○─○  Not tracked yet · login'])
  expect(bandLayout(W, freshProgress(0), false, 40).map(text)).toEqual(['Not tracked yet'])
  expect(bandLayout(W, freshProgress(0), false, 100, 'Demo 1/25: road-trip').map(text)).toEqual([' ○─○─○─○─○─○─○─○─○─○  Not tracked yet', ' Demo 1/25: road-trip'])
  // A Fable audit can start before the first stage is set.
  expect(text(bandLayout(W, freshProgress(0), true, 100)[0])).toBe(' ○─○─○─○─○─○─○─○─○─○  Not tracked yet  ⌕ Fable reviewing')
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

const site = { surface: 'terminal', isWorking: false, hasSurvey: false, isAgentView: false, isHidden: false, columns: 100, maxRows: 10, hasDemo: false, barLines: 2 }

test('while Claude waits, the band shows the area below the bar from 30 columns', () => {
  expect(bandMode(site)).toBe('area')
  expect(bandMode({ ...site, columns: 30 })).toBe('area')
  expect(bandMode({ ...site, columns: 29 })).toBe('text')
  expect(bandMode({ ...site, isWorking: true })).toBe('text')
  expect(bandMode({ ...site, surface: 'desktop' })).toBe('text')
})

test('a demo shows the area whether or not Claude works, but not off the terminal', () => {
  const demo = { ...site, hasDemo: true }
  expect(bandMode(demo)).toBe('area')
  expect(bandMode({ ...demo, isWorking: true })).toBe('area')
  expect(bandMode({ ...demo, columns: 29 })).toBe('text')
  expect(bandMode({ ...demo, surface: 'desktop' })).toBe('text')
})

test('the band yields to a survey, an agent transcript, and /stage hide', () => {
  for (const off of [{ hasSurvey: true }, { isAgentView: true }, { isHidden: true }]) {
    expect(bandMode({ ...site, ...off })).toBe('none')
    expect(bandMode({ ...site, ...off, hasDemo: true })).toBe('none')
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

test('wide characters fit the band by terminal cells: no line runs past its last column', () => {
  const p = applyMove(DEFAULT_WORKFLOW, freshProgress(0), { stage: 'plan', message: '🚀 '.repeat(30), feature: '日本語の機能をテストする', by: 'claude', at: 1 })
  const side = applyMove(DEFAULT_WORKFLOW, p, { stage: 'debugging', by: 'claude', at: 2 })
  for (const progress of [p, side]) {
    for (const columns of [30, 49, 50, 61, 80]) {
      for (const line of bandLayout(DEFAULT_WORKFLOW, progress, true, columns)) expect(cellWidth(text(line))).toBeLessThanOrEqual(columns - 1)
    }
  }
})

test("the area needs the bar's lines and 7 rows", () => {
  expect(bandMode({ ...site, maxRows: 9 })).toBe('area')
  expect(bandMode({ ...site, maxRows: 8 })).toBe('text')
  expect(bandMode({ ...site, barLines: 1, maxRows: 8 })).toBe('area')
  expect(bandMode({ ...site, barLines: 1, maxRows: 7 })).toBe('text')
})

test('the bar takes as many lines as it lays out: untracked below 50 columns is two with a demo line', () => {
  expect(bandLayout(W, plan, false, 100)).toHaveLength(2)
  expect(bandLayout(W, plan, false, 40)).toHaveLength(1)
  expect(bandLayout(W, freshProgress(0), false, 40)).toHaveLength(1)
  expect(bandLayout(W, freshProgress(0), false, 40, 'Demo 1/37')).toHaveLength(2)
  expect(bandLayout(W, freshProgress(0), false, 100, 'Demo 1/37')).toHaveLength(2)
})

test('the track has as many dots as the workflow has track stages', () => {
  const small = { track: DEFAULT_WORKFLOW.track.slice(0, 3), side: DEFAULT_WORKFLOW.side }
  const p = applyMove(small, freshProgress(0), { stage: 'brainstorm', by: 'claude', at: 1 })
  expect(text(bandLayout(small, p, false, 100)[0])).toBe(' ●━◉─○  2/3 Brainstorm')
})

test('the bar draws its tones as before: Clawd orange lit, the current stage bold, the Fable tag violet, the rest dim', () => {
  expect(BAR_TONES).toEqual({
    done: { color: '#D97757' },
    current: { color: '#D97757', bold: true },
    future: { dimColor: true },
    label: {},
    tag: { color: '#8B7AE8' },
    message: { dimColor: true },
    note: { dimColor: true },
  })
})
