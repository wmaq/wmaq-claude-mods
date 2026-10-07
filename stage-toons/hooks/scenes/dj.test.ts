import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, EYE_DARK } from '../clawd'
import { fnv1a } from '../golden'
import { encodeCells, type PixelBuffer } from '../pixels'
import type { AreaSize } from '../scene'
import { EMPTY_LOG, type SeatLog } from '../waiting/seats'
import { BOX_TEXT_MAX, cutText, DANCER_W, DJ_LOOP, djFrame, djHead, type DjInput, djSpots, FLOOR_X, scrollWindow } from './dj'
import { C } from './kit'

const SMALL: AreaSize = { columns: 48, rows: 7 }
const WIDE: AreaSize = { columns: 120, rows: 9 }
const TRACK = 'Daft Punk - Harder, Better, Faster, Stronger'

// A frame's input at t seconds since the picture came on, the track on
// since then.
const input = (t: number, extra: Partial<DjInput> = {}): DjInput => ({ track: TRACK, time: t, now: t * 1000, trackTime: t, sinceChange: null, dancers: EMPTY_LOG, isCalm: false, isParty: false, ...extra })
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
    wideParty: hashOf(WIDE, { dancers: twoDancers(120), isParty: true }),
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
  expect(textRow(djFrame(input(1, { isCalm: true }), { columns: 80, rows: 9 }), 2)).toBe('Daft Punk - Harder~')
  expect(textRow(djFrame(input(1, { track: null }), WIDE), 2)).toBe('')
})

test("the box sits at the floor's left edge by the mirror ball, its text at most 60 characters, no note beside it", () => {
  const b = djFrame(input(1), WIDE)
  // Its frame from FLOOR_X, the text two columns in, on the area's cell row 2.
  expect(at(b, FLOOR_X, 2)).toBe(C.gold)
  expect(at(b, FLOOR_X - 1, 2)).not.toBe(C.gold)
  expect(b.text!.cp[2 * b.w + FLOOR_X + 2]).toBe('D'.codePointAt(0)!)
  // Inside the frame, nothing gold: no note (the frame's right edge is at
  // FLOOR_X + the text's cells + 3).
  const right = FLOOR_X + TRACK.length + 3
  expect(at(b, right, 2)).toBe(C.gold)
  for (let y = 3; y <= 6; y++) for (let x = FLOOR_X + 1; x < right; x++) expect(at(b, x, y)).not.toBe(C.gold)
  // A long title in a box at most BOX_TEXT_MAX wide, however wide the area.
  const long = 'x'.repeat(142)
  expect(BOX_TEXT_MAX).toBe(60)
  expect(textRow(djFrame(input(1, { track: long }), { columns: 372, rows: 9 }), 2)).toHaveLength(60)
  expect(textRow(djFrame(input(1, { track: long }), WIDE), 2)).toHaveLength(59)
})

// A frame's pixels on a row, from column x0 to x1 (past the last).
const span = (b: PixelBuffer, y: number, x0 = 0, x1 = b.w) => [...b.px.slice(y * b.w + x0, y * b.w + x1)].join()
// What lights with the beat: the box's top edge (row 2), the mirror ball
// (rows 5 to 7), the woofer (rows 12 to 16, columns 30 to 44), the floor
// and the booth's LEDs (row 17), on a 9-row area.
const lights = (b: PixelBuffer) => [span(b, 2), ...[5, 6, 7].map(y => span(b, y, 38, 46)), ...[12, 13, 14, 15, 16].map(y => span(b, y, 30, 45)), span(b, 17)]

test("gentle by default: the box's frame, the mirror ball, the woofer, the floor and the booth's LEDs hold through the beat; party lights them on it", () => {
  // 0.05 s and 0.3 s into the first beat: on it, and off it.
  expect(lights(djFrame(input(0.05), WIDE))).toEqual(lights(djFrame(input(0.3), WIDE)))
  expect(lights(djFrame(input(0.05, { isParty: true }), WIDE))).not.toEqual(lights(djFrame(input(0.3, { isParty: true }), WIDE)))
  // Clawd still bobs and the records still turn, gentle.
  expect(djHead(input(0.05), WIDE).y).not.toBe(djHead(input(0.3), WIDE).y)
})

test("a track change: the right record off for half a beat, the arm up for the beat, the box's frame brightening once over a second", () => {
  // The right deck's record row (y 12) and where its lifted arm's head is.
  expect(at(djFrame(input(1, { sinceChange: 0.1 }), SMALL), 23, 12)).toBe(C.darkGray)
  expect(at(djFrame(input(1), SMALL), 23, 12)).not.toBe(C.darkGray)
  expect(at(djFrame(input(1, { sinceChange: 0.3 }), SMALL), 28, 9)).toBe(C.paperShade)
  expect(at(djFrame(input(1, { sinceChange: 0.6 }), SMALL), 28, 9)).not.toBe(C.paperShade)
  // The box frame's top-left corner, its brightness (the sum of its
  // channels) over the second after the change: one rise and one fall,
  // never more than a flash a second (flashing guidelines allow three), in
  // either mode; calm, none.
  const corner = (extra: Partial<DjInput>) => at(djFrame(input(1, extra), WIDE), FLOOR_X, 2)!
  const light = (c: number) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff)
  for (const isParty of [false, true]) {
    const seen = Array.from({ length: 21 }, (_, i) => light(corner({ sinceChange: i * 0.05, isParty })))
    for (let i = 1; i <= 10; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!)
    for (let i = 11; i <= 20; i++) expect(seen[i]!).toBeLessThanOrEqual(seen[i - 1]!)
    expect(seen[10]!).toBeGreaterThan(seen[0]! + 60)
  }
  expect(corner({ sinceChange: null })).toBe(C.gold)
  expect(corner({ sinceChange: 0.5, isCalm: true })).toBe(C.gold)
})

// Recorded from the drawing as it shipped (phase 7, gentle by default and
// the party lights, after the person's look); a change on purpose records
// them again.
const GOLDEN = {
  small: '9b25dd9c',
  smallDancing: '2b923d12',
  wide: '01842049',
  wideDancing: 'ee97f7cf',
  wideCalm: '347db2e4',
  wideParty: 'a457c4b9',
}
