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

// heroAt gives the centre of Clawd's head: his left column plus 7.
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

test('crash-test: the car runs the width into the padded barrier, sparks fly, and the meter reads red', () => {
  const car = (t: number, size: AreaSize = MID) => Math.min(...xs(draw('crash-test', t, size), C.blue))
  expect(car(0.3)).toBe(24)
  expect(car(2)).toBeGreaterThan(car(1))
  expect(car(3.2)).toBe(105)
  // The bump: it rocks back a column off the barrier.
  expect(car(3.3)).toBe(104)
  // At 48 columns the run is short: the bump at 33, the barrier ending at 45.
  expect(car(3.2, { columns: 48, rows: 7 })).toBe(33)
  // The barrier: red and white, its last column 2 short of the edge.
  expect(Math.max(...xs(draw('crash-test', 0.3), C.red).filter(x => x > 40))).toBe(117)
  expect(where(draw('crash-test', 3), C.gold).filter(p => p.x > 100)).toHaveLength(0)
  expect(where(draw('crash-test', 3.3), C.gold).filter(p => p.x > 100).length).toBeGreaterThan(0)
  // The meter in his claw (columns 16 to 20): low, then into the red.
  const meterRed = (t: number) => where(draw('crash-test', t), C.red).filter(p => p.x >= 16 && p.x <= 20).length
  expect(meterRed(0.3)).toBe(0)
  expect(meterRed(4.6)).toBeGreaterThan(0)
})

test('crash-test in a narrow toon: the camera follows the car to the bump, and is back on Clawd before and after', () => {
  const s = scene('crash-test')
  for (const width of [24, 30]) {
    expect(where(renderScene(s, 3.3, width), C.gold).length).toBeGreaterThan(0)
    for (const t of [0.3, 4.6]) expect([...renderScene(s, t, width).px].filter(c => c === CLAWD_ORANGE).length).toBeGreaterThan(40)
  }
})

test('dice: the pawn hops along a board to the edge and ends on the gold goal, at every width', () => {
  for (const columns of [48, 120, 200]) {
    const size = { columns, rows: 9 }
    // The pawn: blue over the board's row (7).
    const pawn = (t: number) => Math.min(...where(draw('dice', t, size), C.blue).filter(p => p.y < 7).map(p => p.x))
    const goal = Math.min(...where(draw('dice', 0.05, size), C.gold).filter(p => p.y === 7).map(p => p.x))
    // On the first square, which widens with the board's pitch.
    expect({ columns, start: pawn(0.05) >= 25 && pawn(0.05) <= 26 }).toEqual({ columns, start: true })
    expect({ columns, mid: pawn(4) > 26 && pawn(4) < goal }).toEqual({ columns, mid: true })
    expect({ columns, end: pawn(8.2) - goal }).toEqual({ columns, end: pawn(0.05) - 25 })
  }
  // The goal near the edge at every width up to 175 columns, where the board's 150 columns end.
  for (let columns = 48; columns <= 175; columns++) {
    const gold = xs(draw('dice', 0.05, { columns, rows: 9 }), C.gold)
    expect(`${columns}: ${columns - Math.max(...gold) <= 8}`).toBe(`${columns}: true`)
  }
})

test('bug-net: the bug flits ahead of Clawd, never over him, and is netted on the far flowers', () => {
  const s = scene('bug-net')
  for (const columns of [48, 120, 200]) {
    const size = { columns, rows: 9 }
    for (let t = 0; t < 7.3; t += 0.05) {
      const hero = heroAt(s, t, size)
      const over = where(draw('bug-net', t, size), C.red).filter(p => p.x >= hero.x - 7 && p.x < hero.x + 7 && p.y >= hero.y)
      expect(`${columns} ${t}: ${over.length}`).toBe(`${columns} ${t}: 0`)
    }
  }
  const bug = (t: number) => xs(draw('bug-net', t), C.red)
  expect(Math.min(...bug(0.25))).toBeLessThan(40)
  expect(Math.min(...bug(7.6))).toBeGreaterThan(100)
  expect(Math.min(...bug(8.5))).toBeGreaterThan(90)
})

test('victory-lap: Clawd runs the lap with the trophy to the far end and back, cheering at each end', () => {
  const s = scene('victory-lap')
  expect(heroAt(s, 0, MID).x).toBe(11)
  expect(heroAt(s, 6.6, MID).x).toBe(107)
  expect(heroAt(s, 6.6, { columns: 48, rows: 7 }).x).toBe(35)
  expect(heroAt(s, 13.9, MID).x).toBe(11)
  // The trophy (the only gold) stays in his claws: within 11 columns of his head's centre.
  for (const t of [0, 3, 6.6, 10, 13.5]) {
    const gold = xs(draw('victory-lap', t), C.gold)
    const head = heroAt(s, t, MID).x
    expect(`${t}: ${gold.length > 0 && gold.every(x => Math.abs(x - head) <= 11)}`).toBe(`${t}: true`)
  }
})

test('bowling: the ball rolls the lane to the pins at the far end, which fall, and a green tick lights', () => {
  const ball = (t: number) => Math.min(...where(draw('bowling', t), C.blue).filter(p => p.y >= 10).map(p => p.x))
  expect(ball(1.5)).toBeLessThan(ball(2.5))
  expect(ball(3.5)).toBeGreaterThan(90)
  // The pins at the far end: standing, their heads on row 9; knocked down, lying on rows 11 to 13.
  const pinTop = (t: number) => Math.min(...where(draw('bowling', t), C.white).filter(p => p.x > 90).map(p => p.y))
  expect(pinTop(1)).toBe(9)
  expect(pinTop(6)).toBeGreaterThanOrEqual(11)
  expect(where(draw('bowling', 1), C.green)).toHaveLength(0)
  expect(where(draw('bowling', 6), C.green).length).toBeGreaterThan(0)
})

test('at 30 columns the crop keeps Clawd whole through the loop (crash-test follows its car there)', () => {
  const cast: Cast = { scenes: SCENES, reactions: REACTIONS, broken: new Set(), onBreak: () => undefined }
  const ids = ['writing-desk', 'sticky-notes', 'scroll', 'proofread-page', 'proofread-checklist', 'stamp', 'dice', 'bug-net', 'victory-lap', 'bowling']
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
