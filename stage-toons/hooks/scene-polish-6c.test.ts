import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE } from './clawd'
import { type PixelBuffer } from './pixels'
import { type AreaSize, heroAt, renderFull, renderScene, type Scene, STAGE_SIZE } from './scene'
import { REACTIONS, SCENES } from './scenes'
import { C } from './scenes/kit'
import { type Cast, heroOnScreen } from './toon'

// Phase 6c's scenes, each showing what it is about across the width (the
// rules every polished scene keeps are in scene-polish.test.ts).
const scene = (id: string): Scene => SCENES[id]!
const MID: AreaSize = { columns: 120, rows: 9 }
const draw = (id: string, t: number, size: AreaSize = MID) => renderFull(scene(id), t, null, t, size)
// A colour's pixels, in the core's coordinates.
const where = (b: PixelBuffer, ...colors: number[]) =>
  [...b.px].flatMap((c, i) => (colors.includes(c) ? [{ x: (i % b.w) - (b.ox ?? 0), y: Math.floor(i / b.w) - (b.oy ?? 0) }] : []))
const xs = (b: PixelBuffer, ...colors: number[]) => where(b, ...colors).map(p => p.x)

test('writing-desk: stacks every 14 columns from 28 along the desk to the edge, growing as the sheets land', () => {
  const stacks = (columns: number) => {
    const b = draw('writing-desk', 0.05, { columns, rows: 9 })
    const tops = new Set(where(b, C.paper, C.paperShade).filter(p => p.y === 9).map(p => p.x))
    return Array.from({ length: 20 }, (_, k) => 28 + 14 * k).filter(x => tops.has(x)).length
  }
  expect([48, 120, 200].map(stacks)).toEqual([2, 7, 11])
  const sheets = (t: number) => where(draw('writing-desk', t), C.paper, C.paperShade).filter(p => p.x >= 28 && p.y <= 9).length
  expect(sheets(0.05)).toBeLessThan(sheets(6))
  expect(sheets(6)).toBeLessThan(sheets(12.5))
})

test('sticky-notes: Clawd walks the board to its far end, the notes going up behind him', () => {
  const s = scene('sticky-notes')
  expect(heroAt(s, 0, MID).x).toBe(13)
  expect(heroAt(s, 12, MID).x).toBe(111)
  expect(heroAt(s, 12, { columns: 48, rows: 7 }).x).toBe(39)
  const notes = (t: number) => where(draw('sticky-notes', t), C.gold, C.green, C.blue, C.paper, C.red).length
  expect(notes(1)).toBeLessThan(notes(5))
  expect(notes(5)).toBeLessThan(notes(11))
  expect(Math.max(...xs(draw('sticky-notes', 11), C.green, C.blue, C.paper, C.red))).toBeGreaterThan(90)
})

test('scroll: it unrolls to near the edge, then rolls back up to Clawd', () => {
  const end = (t: number, columns = 120) => Math.max(...xs(draw('scroll', t, { columns, rows: 9 }), C.paper, C.paperShade))
  expect(end(0.05)).toBeLessThan(26)
  expect(end(7.5)).toBe(117)
  expect(end(7.5, 48)).toBe(45)
  expect(end(5)).toBeLessThan(end(7.5))
  expect(end(9.99)).toBeLessThan(26)
})

test('proofread: a tray at the far end, pages slid in to Clawd, a pile growing at the left; the page ticked, the checklist ticked box by box', () => {
  for (const id of ['proofread-page', 'proofread-checklist']) {
    const tray = xs(draw(id, 0.05), C.paper, C.paperShade).filter(x => x >= 100)
    expect({ id, tray: tray.length > 0 }).toEqual({ id, tray: true })
    const pile = (t: number) => where(draw(id, t), C.paper, C.paperShade).filter(p => p.x < 12).length
    expect({ id, grows: pile(0.05) < pile(11.3) }).toEqual({ id, grows: true })
  }
  const green = (id: string, t: number) => where(draw(id, t), C.green).length
  // The first page: lifted at 1.8 s, checked to 3.1 s.
  expect(green('proofread-page', 1.85)).toBe(0)
  expect(green('proofread-page', 3.05)).toBeGreaterThan(0)
  expect(green('proofread-checklist', 1.85)).toBeLessThan(green('proofread-checklist', 2.6))
  expect(green('proofread-checklist', 2.6)).toBeLessThan(green('proofread-checklist', 3.05))
})

test('stamp: the pages past Clawd carry the red seal down the belt to the edge; the ones coming in are blank', () => {
  for (let t = 0; t < scene('stamp').loop; t += 0.25) {
    const red = where(draw('stamp', t), C.red)
    // Seals on the belt's pages (rows 8 to 10) well past Clawd, short of the
    // out-bin, whose rim has its own red marks: at least two pages' worth.
    expect(`${t}: ${red.filter(p => p.y >= 8 && p.y <= 10 && p.x > 40 && p.x < 100).length >= 12}`).toBe(`${t}: true`)
    // Coming in from the left, behind and before Clawd (from column 19): no seal.
    expect(red.every(p => p.x >= 19)).toBe(true)
  }
})

test('at 30 columns the crop keeps Clawd whole through the loop (crash-test follows its car there)', () => {
  const cast: Cast = { scenes: SCENES, reactions: REACTIONS, broken: new Set(), onBreak: () => undefined }
  const ids = ['writing-desk', 'sticky-notes', 'scroll', 'proofread-page', 'proofread-checklist', 'stamp']
  for (const id of ids) {
    for (let t = 0; t < scene(id).loop; t += 0.1) {
      const head = heroOnScreen({ base: id, time: t, reaction: null }, { columns: 30, rows: 7 }, cast)
      expect(`${id} at ${t}: ${head.x - 7 >= 0 && head.x + 7 <= 30}`).toBe(`${id} at ${t}: true`)
    }
  }
})

test("a reaction's camera keeps a walking Clawd in view: bricklaying mid-build in a 30-column toon", () => {
  const cast: Cast = { scenes: SCENES, reactions: REACTIONS, broken: new Set(), onBreak: () => undefined }
  for (const t of [4, 8, 12]) {
    const head = heroOnScreen({ base: 'bricklaying', time: t, reaction: { id: 'failure', t: 0.5 } }, { columns: 30, rows: 7 }, cast)
    expect(`${t}: ${head.x - 7 >= 0 && head.x + 7 <= 30}`).toBe(`${t}: true`)
  }
  // A camera that pans away from a Clawd standing still holds on the scene's focus.
  const crash = heroOnScreen({ base: 'crash-test', time: 2, reaction: { id: 'failure', t: 0.5 } }, { columns: 30, rows: 7 }, cast)
  expect(crash.x - 7 >= 0 && crash.x + 7 <= 30).toBe(true)
  expect(STAGE_SIZE.columns).toBe(48)
})
