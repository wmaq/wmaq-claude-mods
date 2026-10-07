import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, EYE_DARK } from '../clawd'
import { fnv1a } from '../golden'
import { encodeCells, type PixelBuffer } from '../pixels'
import type { AreaSize } from '../scene'
import { EMPTY_LOG, type SeatLog } from '../waiting/seats'
import { cutText, DANCER_W, DJ_LOOP, djFrame, djHead, type DjInput, djSpots, scrollWindow } from './dj'
import { C } from './kit'

const SMALL: AreaSize = { columns: 48, rows: 7 }
const WIDE: AreaSize = { columns: 120, rows: 9 }
const TRACK = 'Daft Punk - Harder, Better, Faster, Stronger'

// A frame's input at t seconds since the picture came on, the track on
// since then.
const input = (t: number, extra: Partial<DjInput> = {}): DjInput => ({ track: TRACK, time: t, now: t * 1000, trackTime: t, sinceChange: null, dancers: EMPTY_LOG, isCalm: false, ...extra })
const count = (b: PixelBuffer, color: number) => [...b.px].filter(c => c === color).length
const at = (b: PixelBuffer, x: number, y: number) => b.px[y * b.w + x]
// The characters on a cell row.
const textRow = (b: PixelBuffer, row: number) =>
  [...(b.text?.cp.slice(row * b.w, (row + 1) * b.w) ?? [])]
    .filter(cp => cp !== 0)
    .map(cp => String.fromCodePoint(cp))
    .join('')

// Two helpers on the floor, walking in at 0 and 0.5 s, as many as it has
// spots for.
function twoDancers(columns: number): SeatLog {
  const spots = djSpots(columns)
  const entries = [0, 1].slice(0, spots.count).map(seat => ({ agentId: `agent-${seat}`, seat, kind: seat === 0 ? ('opus' as const) : ('fable' as const), arrivedAt: seat * 500, leftAt: null, edge: Math.max(48, columns), x: spots.x(seat) }))

  return { entries, queue: [], since: 0, until: null, walk: null, seats: spots.count }
}

const hashOf = (size: AreaSize, extra: Partial<DjInput> = {}) => fnv1a(Array.from({ length: 16 }, (_, i) => encodeCells(djFrame(input(i * 0.577, extra), size))).join('|'))

test('the DJ picture draws exactly its recorded frames', () => {
  expect({
    small: hashOf(SMALL),
    smallDancing: hashOf(SMALL, { dancers: twoDancers(48) }),
    wide: hashOf(WIDE),
    wideDancing: hashOf(WIDE, { dancers: twoDancers(120) }),
    wideCalm: hashOf(WIDE, { dancers: twoDancers(120), isCalm: true }),
  }).toEqual(GOLDEN)
})

test('Clawd is on stage throughout the DJ picture, at the narrowest area', () => {
  for (let t = 0.013; t < DJ_LOOP; t += 0.1) expect(count(djFrame(input(t), SMALL), CLAWD_ORANGE)).toBeGreaterThan(40)
  expect(count(djFrame(input(0, { isCalm: true }), SMALL), CLAWD_ORANGE)).toBeGreaterThan(40)
})

test("nothing crosses Clawd's face: notes, specks and the equaliser stay off it", () => {
  for (let t = 0.013; t < DJ_LOOP; t += 0.05) {
    const b = djFrame(input(t, { dancers: twoDancers(48) }), SMALL)
    const { y } = djHead(input(t), SMALL)
    // His top four rows, inside the headphones (the band's ends sit on the
    // top row's ends).
    for (let row = y; row < y + 4; row++) {
      for (let x = row === y ? 11 : 10; x <= (row === y ? 18 : 19); x++) expect([CLAWD_ORANGE, EYE_DARK]).toContain(at(b, x, row))
    }
  }
})

test("Clawd's head for the pop-ups: column 15, his top row with the beat's dip; cropped on a narrow area", () => {
  expect(djHead(input(0), SMALL)).toEqual({ x: 15, y: 7 })
  expect(djHead(input(0.2), SMALL)).toEqual({ x: 15, y: 6 })
  expect(djHead(input(0.2), WIDE)).toEqual({ x: 15, y: 10 })
  expect(djHead(input(0.2), { columns: 30, rows: 7 }).x).toBe(12)
})

test("the dance floor's spots: from 72 columns between the speakers, narrower right of the near one", () => {
  const xs = (columns: number) => {
    const spots = djSpots(columns)

    return Array.from({ length: spots.count }, (_, i) => spots.x(i))
  }
  expect(xs(48)).toEqual([41])
  expect(xs(64)).toEqual([41, 51])
  expect(xs(72)).toEqual([45, 55])
  expect(xs(120)).toEqual([45, 55, 65, 75, 85, 95])
  expect(xs(200)).toHaveLength(8)
  // Each spot clear of the far speaker (its last 10 columns) from 72 on.
  for (const columns of [72, 80, 100, 120, 160]) expect(xs(columns).at(-1)! + DANCER_W).toBeLessThanOrEqual(columns - 10)
})

test('a long title scrolls: its start held 2 s, 4 columns a second, its end held 2 s, round again; calm cuts it with ~', () => {
  const chars = [...'abcdefghij']
  expect(scrollWindow(chars, 4, 0)).toBe('abcd')
  expect(scrollWindow(chars, 4, 1.99)).toBe('abcd')
  expect(scrollWindow(chars, 4, 2.5)).toBe('cdef')
  expect(scrollWindow(chars, 4, 3.5)).toBe('ghij')
  expect(scrollWindow(chars, 4, 5.4)).toBe('ghij')
  expect(scrollWindow(chars, 4, 5.6)).toBe('abcd')
  expect(scrollWindow(chars, 12, 3)).toBe('abcdefghij')
  expect(cutText(chars, 4)).toBe('abc~')
  expect(cutText(chars, 10)).toBe('abcdefghij')
})

test('the box names the track from 72 columns, beyond ASCII too; narrower, no box', () => {
  expect(textRow(djFrame(input(1), WIDE), 2)).toBe(TRACK)
  expect(textRow(djFrame(input(1, { track: 'Clawd & the Toons - Łąka, Кино' }), WIDE), 2)).toBe('Clawd & the Toons - Łąka, Кино')
  expect(textRow(djFrame(input(1), { columns: 71, rows: 9 }), 2)).toBe('')
  expect(textRow(djFrame(input(1, { isCalm: true }), { columns: 80, rows: 9 }), 2)).toBe('Daft Punk - Har~')
  expect(textRow(djFrame(input(1, { track: null }), WIDE), 2)).toBe('')
})

test("a track change: the right record off for half a beat, the arm up for the beat, the box's frame flashing", () => {
  // The right deck's record row (y 12) and where its lifted arm's head is.
  expect(at(djFrame(input(1, { sinceChange: 0.1 }), SMALL), 23, 12)).toBe(C.darkGray)
  expect(at(djFrame(input(1), SMALL), 23, 12)).not.toBe(C.darkGray)
  expect(at(djFrame(input(1, { sinceChange: 0.3 }), SMALL), 28, 9)).toBe(C.paperShade)
  expect(at(djFrame(input(1, { sinceChange: 0.6 }), SMALL), 28, 9)).not.toBe(C.paperShade)
  // The box's top edge, on the area's pixel row 2.
  const whites = (b: PixelBuffer) => [...b.px.slice(2 * b.w, 3 * b.w)].filter(c => c === C.white).length
  expect(whites(djFrame(input(1, { sinceChange: 0.05 }), WIDE))).toBeGreaterThan(20)
  expect(whites(djFrame(input(1), WIDE))).toBe(0)
  expect(whites(djFrame(input(1, { sinceChange: 0.05, isCalm: true }), WIDE))).toBe(0)
})

// Recorded from the drawing as it shipped (phase 7); a change on purpose
// records them again.
const GOLDEN = {
  small: 'c6b7c8d4',
  smallDancing: '874c0d5b',
  wide: '64eacb76',
  wideDancing: '1dbc7874',
  wideCalm: 'd71ca4d4',
}
