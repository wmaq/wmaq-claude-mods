import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { getPixel, type PixelBuffer } from './pixels'
import { areaBuffer, CLAWD_TOP, STAGE_W } from './scene'
import { REACTIONS } from './scenes'
import { C, drawStarfield, plankOn, STAR_LAYERS } from './scenes/kit'

// Where a colour shows on a buffer, in its own columns and rows.
const where = (b: PixelBuffer, color: number) => [...b.px].flatMap((c, i) => (c === color ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))

test('the starfield fills a wide, tall area: the scatter tiled across and up into the headroom, about as dense', () => {
  const b = areaBuffer({ columns: 120, rows: 9 })
  drawStarfield(b, 0, ['far'])
  const stars = where(b, STAR_LAYERS.far.color)
  // 12 far stars to a 48 x 14 tile: about 30 on 120 x 14, and a few more in the 4 rows above.
  expect(stars.filter(s => s.y >= 4).length).toBeGreaterThanOrEqual(28)
  expect(stars.filter(s => s.y < 4).length).toBeGreaterThan(3)
  expect(stars.some(s => s.x >= 96)).toBe(true)
  // Wrapping round the area's own width: one second on, the same count.
  const later = areaBuffer({ columns: 120, rows: 9 })
  drawStarfield(later, 1, ['far'])
  expect(where(later, STAR_LAYERS.far.color)).toHaveLength(stars.length)
})

test('plankOn runs the wood top to the edge, legs every step after the first', () => {
  const b = areaBuffer({ columns: 100, rows: 7 })
  plankOn(b, 48, 12, 1, 71, 25)
  expect(getPixel(b, 48, 12)).toBe(C.wood)
  expect(getPixel(b, 99, 12)).toBe(C.wood)
  expect(where(b, C.woodDark).map(p => p.x)).toEqual([71, 96])
  // Nothing at 48 columns: the plank starts past the core.
  const core = areaBuffer({ columns: 48, rows: 7 })
  plankOn(core, 48, 12, 1, 71, 25)
  expect([...core.px].every(c => c === -1)).toBe(true)
})

test("the failure's bang rises over a high head into the headroom, as far as it goes", () => {
  const bangTop = (rows: number, headY: number) => {
    const b = areaBuffer({ columns: 48, rows })
    REACTIONS.failure!.draw(b, 1, { x: 20, y: headY })
    return Math.min(...where(b, C.red).map(p => p.y)) - (b.oy ?? 0)
  }
  // A head at row 6 keeps today's rows; a higher one takes them up, at 7 rows not past the top.
  expect(bangTop(9, CLAWD_TOP)).toBe(2)
  expect(bangTop(9, 4)).toBe(0)
  expect(bangTop(9, 1)).toBe(-2)
  expect(bangTop(9, 0)).toBe(-2)
  expect(bangTop(8, 0)).toBe(0)
  expect(bangTop(7, 0)).toBe(2)
})

test('the confetti falls over the whole width of the area, from its top', () => {
  const b = areaBuffer({ columns: 120, rows: 9 })
  REACTIONS.advance!.draw(b, 0.5, { x: 20, y: CLAWD_TOP })
  const colours = [C.gold, C.blue, C.green, C.red]
  const pieces = colours.flatMap(c => where(b, c))
  expect(pieces.some(p => p.x >= 96)).toBe(true)
  expect(pieces.some(p => p.y < 4)).toBe(true)
})

test('Fable walks in from the real edge, and out to it, in the same 2 s', () => {
  const firstX = (columns: number, t: number) => {
    const b = areaBuffer({ columns, rows: 9 })
    REACTIONS['fable-arrives']!.draw(b, t, { x: 20, y: CLAWD_TOP })
    const xs = where(b, FABLE_VIOLET).map(p => p.x)
    return xs.length === 0 ? null : Math.min(...xs)
  }
  expect(firstX(120, 0)).toBe(null)
  expect(firstX(120, 0.3)).toBeGreaterThan(STAGE_W)
  expect(firstX(120, 2)).toBe(30)
  const out = areaBuffer({ columns: 120, rows: 9 })
  REACTIONS['fable-leaves']!.draw(out, 1.9, { x: 20, y: CLAWD_TOP })
  expect(Math.min(...where(out, FABLE_VIOLET).map(p => p.x))).toBeGreaterThan(100)
  expect(where(out, CLAWD_ORANGE)).toHaveLength(0)
})
