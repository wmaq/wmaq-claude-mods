import { expect, test } from 'claude-code/testing'

import { BADGE_H, BADGE_W, BADGES, drawLayer } from './layer'
import { createBuffer, EMPTY, fillRect, getPixel, glyphAt, type PixelBuffer } from './pixels'
import { PHASES } from './phase'
import { C } from './scenes/kit'
import type { Layer } from './work'

const AREA_H = 14
const layer = (over: Partial<Layer>): Layer => ({ badge: null, what: '', bubble: null, t: 0, ...over })
const textIn = (b: PixelBuffer, row: number): string => {
  let s = ''
  for (let x = 0; x < b.w; x++) s += String.fromCharCode(glyphAt(b, x, row)?.cp ?? 0x20)

  return s
}
// The columns where anything of the layer is, and the lowest pixel row.
function extent(b: PixelBuffer): { from: number; to: number; bottom: number } {
  let from = Infinity
  let to = -Infinity
  let bottom = -1
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (getPixel(b, x, y) === EMPTY && glyphAt(b, x, Math.floor(y / 2)) === null) continue
      from = Math.min(from, x)
      to = Math.max(to, x)
      bottom = Math.max(bottom, y)
    }
  }

  return { from, to, bottom }
}

test('a label or bubble is measured as drawText draws it: a letter and its combining accent are one cell', () => {
  const b = createBuffer(40, AREA_H)
  // 'Café!' with the accent apart: 6 code units, 5 cells, and the bubble's 2.
  drawLayer(b, layer({ bubble: 'Cafe' + String.fromCharCode(0x301) + '!' }), 10)
  const { from, to } = extent(b)
  expect(to - from + 1).toBe(7)
})

test('every phase has a 5 x 4 icon, drawn in no colour of Clawd or Fable', () => {
  for (const phase of PHASES) {
    const rows = BADGES[phase].frames[0]!
    expect(rows.length).toBe(BADGE_H)
    for (const row of rows) expect(row.length).toBe(BADGE_W)
    for (const color of Object.values(BADGES[phase].palette)) expect([0xd97757, 0x8b7ae8]).not.toContain(color)
  }
})

test("a badge sits over the hero's head with its label one cell to its right, in the top four rows", () => {
  const b = createBuffer(48, AREA_H)
  drawLayer(b, layer({ badge: 'test', what: 'npm test' }), 12)
  expect(getPixel(b, 11, 1)).toBe(C.glass)
  expect(textIn(b, 1).trimEnd()).toBe(`${' '.repeat(16)}npm test`)
  expect(glyphAt(b, 16, 1)?.fg).toBe(C.paperShade)
  // The test tube's icon leaves its first column empty.
  expect(extent(b)).toEqual({ from: 11, to: 23, bottom: 3 })
})

test("the label's cells are cleared, so the scene's art never shows around its letters", () => {
  const b = createBuffer(48, AREA_H)
  fillRect(b, 0, 0, 48, 4, C.gold)
  drawLayer(b, layer({ badge: 'read', what: 'a.ts' }), 12)
  for (let x = 16; x < 20; x++) {
    expect(getPixel(b, x, 2)).toBe(EMPTY)
    expect(getPixel(b, x, 3)).toBe(EMPTY)
  }
  expect(getPixel(b, 20, 2)).toBe(C.gold)
})

test('a bubble takes the label\'s place: its line on paper in the top row, padded, with a tail', () => {
  const b = createBuffer(48, AREA_H)
  drawLayer(b, layer({ badge: 'test', what: 'npm test', bubble: 'All green!' }), 12)
  expect(textIn(b, 0).trimEnd()).toBe(`${' '.repeat(17)}All green!`)
  expect(textIn(b, 1).trim()).toBe('')
  expect(getPixel(b, 16, 0)).toBe(C.paper)
  expect(getPixel(b, 27, 1)).toBe(C.paper)
  expect(glyphAt(b, 17, 0)?.fg).toBe(C.ink)
  expect(getPixel(b, 16, 2)).toBe(C.paper)
  expect(getPixel(b, 17, 2)).toBe(EMPTY)
})

test('with hasTail false the bubble has no tail, for a head at its row', () => {
  const b = createBuffer(48, AREA_H)
  drawLayer(b, layer({ bubble: 'Saved it.' }), 12, false)
  expect(textIn(b, 0).trimEnd()).toBe(`${' '.repeat(13)}Saved it.`)
  expect(getPixel(b, 12, 2)).toBe(EMPTY)
})

test('with no badge, the bubble starts at the head', () => {
  const b = createBuffer(48, AREA_H)
  drawLayer(b, layer({ bubble: '...' }), 20)
  expect(extent(b).from).toBe(20)
  expect(textIn(b, 0).trimEnd()).toBe(`${' '.repeat(21)}...`)
})

test('the layer stays inside the area at 29, 40 and 48 columns, with the hero at either edge', () => {
  for (const width of [29, 40, 48]) {
    for (const headX of [-5, 0, 7, width - 3, width + 6]) {
      for (const l of [layer({ badge: 'git', what: 'git push' }), layer({ badge: 'edit', what: 'x', bubble: 'Committed!' }), layer({ bubble: 'Hi, Fable!' }), layer({ badge: 'thinking', t: 1 })]) {
        const b = createBuffer(width, AREA_H)
        drawLayer(b, l, headX)
        const e = extent(b)
        expect(e.from >= 0 && e.to < width && e.bottom <= 3).toBe(true)
      }
    }
  }
})

test('text too long for the area is cut with a ~', () => {
  const b = createBuffer(29, AREA_H)
  drawLayer(b, layer({ badge: 'agents', what: 'a'.repeat(30) }), 3)
  expect(textIn(b, 1).trimEnd()).toBe(`${' '.repeat(6)}${'a'.repeat(22)}~`)
  const c = createBuffer(12, AREA_H)
  drawLayer(c, layer({ badge: 'test', bubble: 'All green!' }), 2)
  expect(textIn(c, 0).trimEnd()).toBe(`${' '.repeat(7)}All~`)
})

test('the thought puffs come one, two, three, then hold, then again', () => {
  const count = (t: number) => {
    const b = createBuffer(48, AREA_H)
    drawLayer(b, layer({ badge: 'thinking', t }), 12)
    let n = 0
    for (let y = 0; y < 4; y++) for (let x = 0; x < 48; x++) if (getPixel(b, x, y) !== EMPTY) n++

    return n
  }
  expect([count(0), count(0.3), count(0.6), count(0.9), count(1.2)]).toEqual([1, 5, 9, 9, 1])
})
