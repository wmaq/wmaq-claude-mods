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

test('at 30 columns the crop keeps Clawd whole through the loop (crash-test follows its car there)', () => {
  const cast: Cast = { scenes: SCENES, reactions: REACTIONS, broken: new Set(), onBreak: () => undefined }
  const ids = ['writing-desk', 'sticky-notes', 'scroll']
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
