import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { EMPTY, getPixel, type PixelBuffer } from './pixels'
import { type AreaSize, renderFull, type Scene, STAGE_W } from './scene'
import { SCENES } from './scenes'
import { C } from './scenes/kit'

// The scenes whose wings this file covers: each a themed set piece past the core.
const WINGED = ['blueprint', 'bug-hunt', 'bug-net', 'cake', 'clipboard', 'control-panel', 'dice', 'dishes', 'fable-audit', 'gift', 'ladder']
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
      // The next bug's flight in from above is the one change inside bug-net's core.
      if (id === 'bug-net' && t >= 5.4) continue
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
    // [scene, core row, first column, colour]: cake's table, dishes' counter, the shelves' bottom planks, dice's track.
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
  for (const id of ['blueprint', 'bug-hunt', 'bug-net', 'cake', 'clipboard', 'control-panel', 'dice', 'dishes', 'fable-audit', 'ladder']) {
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

// The free bug's red pixels between the hoop and the wings (the caught one stays in the net at x 18 to 20).
const freeBug = (t: number, columns: number) => where(at('bug-net', t, columns), C.red).filter(p => p.x >= 30 && p.x < STAGE_W)

test("bug-net's next bug flies in from above the area on a wide one, over the same 0.6 s, to the catch", () => {
  const b = at('bug-net', 5.7, 120)
  const oy = b.oy ?? 0
  // Not yet there as the entry starts; on its way down from the top half way through; at the catch (34, 4) as the loop ends.
  expect(freeBug(5.41, 120)).toEqual([])
  const half = freeBug(5.7, 120)
  expect(half.length).toBeGreaterThan(0)
  expect(Math.max(...half.map(p => p.y)) - oy).toBeLessThan(4)
  expect(Math.max(...half.map(p => p.x))).toBeLessThan(42)
  const last = freeBug(5.999, 120)
  expect(last.map(p => ({ x: p.x, y: p.y - oy }))).toEqual([
    { x: 34, y: 4 },
    { x: 35, y: 4 },
  ])
  expect(last).toEqual(freeBug(0, 120))
  // From any height: at 7 and 8 rows it comes from above the area's top too.
  for (const rows of [7, 8]) expect(where(at('bug-net', 5.41, 120, rows), C.red).filter(p => p.x >= 30 && p.x < STAGE_W)).toEqual([])
})

test("bug-net keeps today's entry from x 50 where it doesn't show mid-air: up to 50 columns", () => {
  for (const width of [48, 49, 50]) expect(freeBug(5.7, width)).toEqual(freeBug(5.7, 48))
  // Today's flight: level with the catch, half way along from x 50.
  expect(Math.min(...freeBug(5.7, 48).map(p => p.x))).toBeGreaterThanOrEqual(41)
})
