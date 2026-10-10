import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { EMPTY, getPixel, type PixelBuffer } from './pixels'
import { type AreaSize, renderFull, type Scene, STAGE_W } from './scene'
import { SCENES } from './scenes'
import { C } from './scenes/kit'

// The scenes whose wings this file covers: each a themed set piece past the
// core. bug-net and dice, reworked across the whole width in phase 6c, are
// held by scenes-polish.test.ts and scenes-polish-2.test.ts.
const WINGED = ['blueprint', 'bug-hunt', 'cake', 'clipboard', 'control-panel', 'dishes', 'fable-audit', 'gift', 'ladder']
const scene = (id: string): Scene => SCENES[id]!
const at = (id: string, t: number, columns: number, rows = 9): PixelBuffer => renderFull(scene(id), t, null, t, { columns, rows } satisfies AreaSize)

// A buffer's pixels in its columns from..to-1, every row, as one list.
const columns = (b: PixelBuffer, from: number, to = b.w) => Array.from({ length: b.h }, (_, y) => Array.from({ length: to - from }, (_, i) => getPixel(b, from + i, y))).flat()
const where = (b: PixelBuffer, color: number) => [...b.px].flatMap((c, i) => (c === color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))
// A row of the core, read on the area's own rows.
const rowOf = (b: PixelBuffer, coreY: number, from: number, to = b.w) => Array.from({ length: to - from }, (_, i) => getPixel(b, from + i, coreY + (b.oy ?? 0)))

test('every themed wing draws past the core at 120 columns, in the kit colours, never a Clawd', () => {
  for (const id of WINGED) {
    for (const t of [0, scene(id).loop / 2]) {
      const wings = columns(at(id, t, 120), STAGE_W)
      expect({ id, drawn: wings.some(c => c !== EMPTY) }).toEqual({ id, drawn: true })
      expect({ id, clawd: wings.filter(c => c === CLAWD_ORANGE || c === FABLE_VIOLET).length }).toEqual({ id, clawd: 0 })
    }
  }
})

test('the wings leave the core as it was: its columns at 120 are those at 48, at every size', () => {
  for (const id of WINGED) {
    for (let t = 0; t < scene(id).loop; t += 0.5) {
      for (const rows of [7, 8, 9]) expect({ id, t, rows, core: columns(at(id, t, 120, rows), 0, STAGE_W) }).toEqual({ id, t, rows, core: columns(at(id, t, 48, rows), 0, STAGE_W) })
    }
  }
})

test('the wings are the same at the loop point as at the start, at any width', () => {
  // control-panel's lights step on at the loop point as at any whole second: its own test below.
  for (const id of WINGED.filter(id => id !== 'control-panel')) {
    for (const width of [80, 120, 200]) {
      const end = columns(at(id, scene(id).loop - 0.001, width), STAGE_W)
      const start = columns(at(id, 0, width), STAGE_W)
      expect({ id, width, same: end.every((c, i) => c === start[i]) }).toEqual({ id, width, same: true })
    }
  }
})

test('every picture draws at any size without throwing, at exactly that size', () => {
  for (const id of WINGED) {
    for (const width of [30, 47, 48, 49, 50, 51, 80, 120, 200, 512]) {
      for (const rows of [7, 8, 9]) {
        for (let t = 0; t < scene(id).loop; t += 1.5) {
          const b = at(id, t, width, rows)
          expect(b.w).toBe(Math.max(STAGE_W, width))
          expect(b.h).toBe(rows * 2)
        }
      }
    }
  }
})

test('the wings that run on reach the edge at 200 columns with no gap in their row', () => {
  const runs: [string, number, number, number][] = [
    // [scene, core row, first column, colour]: cake's table, dishes' counter, the shelves' bottom planks.
    ['cake', 10, 49, C.wood],
    ['dishes', 7, 63, C.gray],
    ['clipboard', 13, 60, C.wood],
    ['fable-audit', 13, 50, C.wood],
    ['ladder', 13, 50, C.wood],
  ]
  for (const [id, y, from, color] of runs) {
    const b = at(id, 1, 200)
    // An upright crosses the plank here and there: the row is the plank's wood or the upright's.
    expect({ id, gaps: rowOf(b, y, from).filter(c => c !== color && c !== C.woodDark).length }).toEqual({ id, gaps: 0 })
  }
  // Something in the last 8 columns of each tiled wing (gift's whole piles stop short of it).
  for (const id of ['blueprint', 'bug-hunt', 'cake', 'clipboard', 'control-panel', 'dishes', 'fable-audit', 'ladder']) {
    expect({ id, edge: columns(at(id, 1, 200), 192).some(c => c !== EMPTY) }).toEqual({ id, edge: true })
  }
})

test("gift's wings are whole piles of presents: none cut at the edge", () => {
  // Piles every 34 columns from 50, 18 wide: at 100 columns the second (84 to 101) is left out, and nothing past 68.
  const b = at('gift', 1, 100)
  expect(columns(b, 50, 68).some(c => c !== EMPTY)).toBe(true)
  expect(columns(b, 68).every(c => c === EMPTY)).toBe(true)
})

test("bug-hunt's first hidden bug twitches now and then, every 3 s, and is still between", () => {
  const firstBug = (t: number) => columns(at('bug-hunt', t, 120), 62, 72)
  expect(firstBug(0.15)).not.toEqual(firstBug(0.05))
  expect(firstBug(3.15)).toEqual(firstBug(0.15))
  expect(firstBug(1)).toEqual(firstBug(2))
  expect(where(at('bug-hunt', 1, 120), C.red).filter(p => p.x >= STAGE_W).length).toBeGreaterThan(0)
})

test("control-panel's banks of lights blink slowly, a step a second, and match at the loop point", () => {
  const lights = (t: number) => columns(at('control-panel', t, 120), STAGE_W)
  expect(lights(0.5)).not.toEqual(lights(1.5))
  expect(lights(0.5)).toEqual(lights(0.9))
  expect(lights(0.5)).toEqual(lights(3.5))
  // The pattern's 3 s divide the loop: the step taken at the loop point is the one taken at 3 s.
  const loop = SCENES['control-panel']!.loop
  expect(loop % 3).toBe(0)
  expect(lights(loop - 0.001)).toEqual(lights(2.999))
  expect(lights(0)).toEqual(lights(3))
})
