import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE } from './clawd'
import { EMPTY, getPixel, type PixelBuffer } from './pixels'
import { type AreaSize, renderFull, renderSeamed, type Scene } from './scene'
import { SCENES } from './scenes'
import { C, STAR_LAYERS } from './scenes/kit'

// The wide sets of bricklaying, crash-test, fireworks, fishing, flashlight,
// recycling, road-trip and stamp (phase 4e). Pixels are read in core
// coordinates: x as drawn, y plus the headroom.

const WIDE: AreaSize = { columns: 200, rows: 9 }
const MID: AreaSize = { columns: 120, rows: 9 }
const scene = (id: string): Scene => SCENES[id]!
const at = (b: PixelBuffer, x: number, y: number) => getPixel(b, x + (b.ox ?? 0), y + (b.oy ?? 0))
const draw = (id: string, t: number, size: AreaSize = WIDE) => renderFull(scene(id), t, null, t, size)
// The columns from..to-1 of a core row that hold no pixel.
const gaps = (b: PixelBuffer, y: number, from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i).filter(x => at(b, x, y) === EMPTY)
// The columns where a colour shows, on any row.
const columnsOf = (b: PixelBuffer, color: number) => [...new Set([...b.px].flatMap((c, i) => (c === color ? [i % b.w] : [])))].sort((p, q) => p - q)
// A region of the area's own columns, as a string to compare.
const region = (b: PixelBuffer, from: number, to = b.w) => Array.from({ length: b.h }, (_, y) => Array.from({ length: to - from }, (_, x) => getPixel(b, from + x, y)).join(',')).join('|')

test('every scene of the group draws at any size without throwing, at exactly that size', () => {
  for (const id of ['bricklaying', 'crash-test', 'fireworks', 'fishing', 'flashlight', 'recycling', 'road-trip', 'stamp']) {
    for (const columns of [30, 47, 48, 49, 51, 120, 512]) {
      for (const rows of [7, 8, 9]) {
        for (let t = 0; t < 2 * scene(id).loop; t += 1.37) {
          const b = renderSeamed(scene(id), t, null, { columns, rows })
          expect(b.w).toBe(Math.max(48, columns))
          expect(b.h).toBe(rows * 2)
        }
      }
    }
  }
})

test("bricklaying: the finished wall slides out at the real edge in the same 1.5 s", () => {
  const left = (b: PixelBuffer) => Math.min(...columnsOf(b, C.brick))
  expect(left(draw('bricklaying', 10.5))).toBe(26)
  // Halfway through the slide, halfway to the edge: 174 / 2 on 200 columns, 22 / 2 on 48.
  expect(left(draw('bricklaying', 11.25))).toBe(26 + 87)
  expect(left(draw('bricklaying', 11.25, { columns: 48, rows: 7 }))).toBe(26 + 11)
  // Near the end it reaches the last 8 columns, and is out by the loop's end.
  expect(columnsOf(draw('bricklaying', 11.9), C.brick).some(x => x >= 192)).toBe(true)
  expect(left(draw('bricklaying', 11.99))).toBeGreaterThanOrEqual(198)
})

test('crash-test: the wall carries on as bricks to the edge, column 47 only past 48 columns', () => {
  const b = draw('crash-test', 0)
  for (const y of [3, 4, 5, 8, 13]) expect(gaps(b, y, 43, 200)).toEqual([])
  expect(at(b, 47, 4)).toBe(C.mortar)
  // Joints every 4 columns, carried on from the core's (44 and 46 by course).
  expect(at(b, 48, 3)).toBe(C.mortar)
  expect(at(b, 196, 3)).toBe(C.mortar)
  expect(at(b, 50, 5)).toBe(C.mortar)
  expect(at(b, 49, 5)).toBe(C.brick)
  const bare = draw('crash-test', 0, { columns: 48, rows: 7 })
  for (let y = 0; y < 14; y++) expect(at(bare, 47, y)).toBe(EMPTY)
})

test('fireworks: the starfield fills the area, rockets go up in the wings, and Clawd cheers his own alone', () => {
  const b = draw('fireworks', 3)
  expect([...b.px].some((c, i) => c === STAR_LAYERS.far.color && i % b.w >= 192)).toBe(true)
  // At 120 columns, the wings' first rockets burst past the core.
  const burstColumns = (t: number) => [C.red, C.blue, C.gold, C.green].flatMap(c => columnsOf(draw('fireworks', t, MID), c))
  expect(burstColumns(2.5).some(x => x > 48)).toBe(true)
  expect(burstColumns(3).some(x => x > 96)).toBe(true)
  // All are over by the loop's end: nothing but stars past the core at its end and start.
  for (const t of [0, 7.99]) expect(burstColumns(t).filter(x => x >= 48)).toEqual([])
  // Clawd moves exactly as on the bare stage at every moment.
  const clawd = (size: AreaSize, t: number) => {
    const b = draw('fireworks', t, size)
    return [...b.px].flatMap((c, i) => (c === CLAWD_ORANGE ? [`${i % b.w},${Math.floor(i / b.w) - (b.oy ?? 0)}`] : [])).join(' ')
  }
  for (let t = 0; t < 8; t += 0.1) expect(clawd(WIDE, t)).toBe(clawd({ columns: 48, rows: 7 }, t))
})

test('fishing: the water runs to the edge, its ripples tiled every 25 columns', () => {
  const b = draw('fishing', 0)
  for (const y of [11, 12, 13]) expect(gaps(b, y, 21, 200)).toEqual([])
  for (let t = 0; t < 8; t += 0.32) {
    const mid = draw('fishing', t, MID)
    const glass = (from: number, to: number) => columnsOf(mid, C.glass).filter(x => x >= from && x < to)
    // Each tile has the core's three ripples, 25 columns on, stepping and
    // wrapping with them (the core's own may hide behind the line or a catch).
    expect(glass(47, 72)).toHaveLength(3)
    expect(glass(72, 97)).toEqual(glass(47, 72).map(x => x + 25))
    const tile = glass(47, 72).map(x => x - 25)
    expect(glass(22, 47).every(x => tile.includes(x))).toBe(true)
  }
  // A ripple at column 47 shows only past 48 columns.
  const t47 = Array.from({ length: 25 }, (_, i) => (i * 8) / 25 + 0.01).find(t => at(draw('fishing', t, MID), 47, 11) === C.glass)
  expect(t47).not.toBe(undefined)
  expect(at(draw('fishing', t47!, { columns: 48, rows: 7 }), 47, 11)).toBe(C.blue)
})

test('flashlight: past column 47 the beam narrows to nothing over 12 columns', () => {
  for (const t of [0, 1.5, 3, 5.25]) {
    const b = draw('flashlight', t)
    const height = (x: number) => Array.from({ length: b.h }, (_, y) => getPixel(b, x + (b.ox ?? 0), y)).filter(c => c === C.beam).length
    expect(height(48)).toBeGreaterThan(0)
    for (let x = 48; x < 59; x++) expect(height(x)).toBeLessThanOrEqual(height(x - 1))
    for (let x = 59; x < 200; x++) expect(height(x)).toBe(0)
  }
  // Pointing up, the beam's tip is still in the air at 120 columns: it reaches column 57.
  expect(columnsOf(draw('flashlight', 0, MID), C.beam).at(-1)).toBeGreaterThanOrEqual(57)
})

test('recycling: past 50 columns the missed ball rolls against a second bin and lies there', () => {
  const ball = (t: number, size: AreaSize) => {
    const xs = columnsOf(draw('recycling', t, size), C.white).filter(x => x > 40)
    return xs.length === 0 ? null : Math.min(...xs)
  }
  // The second bin stands at x 50, rim from 49.
  const b = draw('recycling', 0, MID)
  expect(gaps(b, 7, 49, 57)).toEqual([])
  expect(at(b, 50, 13)).toBe(C.gray)
  // The ball stops at 48, against the bin's side, at the same speed, and lies there to the loop's end.
  expect(ball(5.2, MID)).toBe(ball(5.2, { columns: 48, rows: 7 }))
  for (const t of [5.8, 6, 6.39]) expect(ball(t, MID)).toBe(48)
  expect(ball(0.01, MID)).toBe(null)
  // At 50 columns and under it rolls off as before, gone at 6.0 s.
  expect(ball(5.95, { columns: 50, rows: 7 })).toBe(49)
  expect(ball(6.05, { columns: 50, rows: 7 })).toBe(null)
  expect(ball(6.05, { columns: 51, rows: 7 })).toBe(48)
})

test('road-trip: the road winds to the edge, flags standing past the core from the start; still through the fade', () => {
  const b = draw('road-trip', 0)
  const roadY = (x: number) => 11 + Math.round(Math.sin((x - 18) / 5) * 1.5)
  for (let x = 18; x < 200; x += 2) expect(at(b, x, roadY(x))).toBe(C.road)
  for (let x = 48; x < 200; x += 7) expect(at(b, x + 1, roadY(x) - 4)).toBe(C.red)
  // The wings are the same at the held last moment and the new start.
  const held = renderFull(scene('road-trip'), 7.95, null, 7.95, MID)
  const start = renderFull(scene('road-trip'), 8, null, 8, MID)
  expect(region(held, 48)).toBe(region(start, 48))
})

test('stamp: the desk runs to the edge, legs every 25 columns; a page every 24 columns from the stamp to the edge', () => {
  const b = draw('stamp', 0)
  expect(gaps(b, 12, 20, 200)).toEqual([])
  const legs = columnsOf(b, C.woodDark).filter(x => x >= 46)
  expect(legs.filter(x => at(b, x, 13) === C.woodDark)).toEqual([46, 71, 96, 121, 146, 171, 196])
  for (let t = 0; t < 4.5; t += 0.05) {
    const frame = draw('stamp', t)
    const paper = columnsOf(frame, C.paper).filter(x => at(frame, x, 9) === C.paper || at(frame, x, 11) === C.paper)
    // Pages come in from the edge: always one within the last 24 columns, and none more than 24 apart.
    expect(paper.at(-1)!).toBeGreaterThanOrEqual(200 - 24)
    for (let i = 1; i < paper.length; i++) expect(paper[i]! - paper[i - 1]!).toBeLessThanOrEqual(19)
  }
  // Seamless: the wings at the loop's end are the wings at its start.
  expect(region(draw('stamp', 4.4999, MID), 48)).toBe(region(draw('stamp', 0, MID), 48))
})
