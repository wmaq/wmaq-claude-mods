import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { EMPTY, getPixel, type PixelBuffer } from './pixels'
import { LOOP_LAST_S, renderFull, type Scene, STAGE_W } from './scene'
import { SCENES } from './scenes'
import { C } from './scenes/kit'

const WINGED = [
  'light-bulbs', 'mystery-box', 'proofread-page', 'proofread-checklist', 'red-pen', 'scroll', 'scales', 'stepping-stones', 'sticky-notes', 'thought-clouds', 'treasure-map',
]
const scene = (id: string): Scene => SCENES[id]!
// A scene on an area of that size, its background on the same unwrapped time.
const draw = (id: string, time: number, columns: number, rows = 9) => renderFull(scene(id), time, null, time, { columns, rows })
// A pixel in the core's coordinates.
const at = (b: PixelBuffer, x: number, y: number) => getPixel(b, x + (b.ox ?? 0), y + (b.oy ?? 0))
// The wings' pixels, from column 48 on, as "x,y" in the core's coordinates.
const wings = (b: PixelBuffer): string[] => {
  const out: string[] = []
  for (let y = 0; y < b.h; y++) for (let x = STAGE_W; x < b.w; x++) if (getPixel(b, x, y) !== EMPTY) out.push(`${x},${y - (b.oy ?? 0)},${getPixel(b, x, y)}`)
  return out
}
// How many of the wings' pixels differ between two pictures of a size.
const wingsDiffer = (a: PixelBuffer, b: PixelBuffer) => {
  let n = 0
  for (let y = 0; y < a.h; y++) for (let x = STAGE_W; x < a.w; x++) if (getPixel(a, x, y) !== getPixel(b, x, y)) n++
  return n
}
const moments = (s: Scene) => Array.from({ length: 12 }, (_, i) => 0.013 + (i * s.loop) / 12)

test('every themed wing draws right of the core at 120 columns, in the kit colours, never orange or violet', () => {
  const kit = new Set<number>(Object.values(C))
  for (const id of WINGED) {
    for (const t of moments(scene(id))) {
      const px = wings(draw(id, t, 120)).map(p => Number(p.split(',')[2]))
      expect(px.length).toBeGreaterThan(0)
      expect(px.every(c => kit.has(c) && c !== CLAWD_ORANGE && c !== FABLE_VIOLET)).toBe(true)
    }
  }
})

test('the wings leave the core as it is: its columns draw the same at 200 columns as at 48', () => {
  for (const id of [...WINGED, 'standing']) {
    for (const rows of [7, 9]) {
      for (const t of moments(scene(id))) {
        const narrow = draw(id, t, STAGE_W, rows)
        const wide = draw(id, t, 200, rows)
        const differ: string[] = []
        for (let y = 0; y < narrow.h; y++) for (let x = 0; x < STAGE_W; x++) if (getPixel(narrow, x, y) !== getPixel(wide, x, y)) differ.push(`${id} ${t} ${x},${y}`)
        expect(differ).toEqual([])
      }
    }
  }
})

test('standing stays bare: nothing right of the core at any width', () => {
  for (const columns of [120, 200]) for (const t of moments(scene('standing'))) expect(wings(draw('standing', t, columns))).toEqual([])
})

test('the sets that run on reach the edge at 200 columns with no gap: the stream, the sea, the desk, the rack', () => {
  const runs: [string, number, number[]][] = [
    ['stepping-stones', STAGE_W, [12, 13]],
    ['treasure-map', STAGE_W, [12, 13]],
    ['proofread-page', 50, [9]],
    ['proofread-checklist', 50, [9]],
    ['scroll', 50, [8, 13]],
  ]
  for (const [id, from, rows] of runs) {
    const b = draw(id, 1, 200)
    for (const y of rows) for (let x = from; x < 200; x++) expect(at(b, x, y)).not.toBe(EMPTY)
  }
  // And the wings that repeat reach the area's last 8 columns.
  for (const id of ['light-bulbs', 'red-pen', 'scales', 'scroll', 'stepping-stones', 'treasure-map', 'proofread-page']) {
    expect(wings(draw(id, 1, 200)).some(p => Number(p.split(',')[0]) >= 192)).toBe(true)
  }
})

// thought-clouds' wings drift on unwrapped time, at no fixed step: its own
// test below checks they go on through the loop point.
test('every loop is seamless across the wings at 120 columns: the step over the loop point is no bigger than any other', () => {
  for (const id of WINGED.filter(id => id !== 'thought-clouds')) {
    const s = scene(id)
    // Every 0.05 s through the loop, so every step a wing takes is among them.
    const frames = Array.from({ length: Math.round(s.loop / 0.05) }, (_, i) => draw(id, 0.025 + i * 0.05, 120))
    const inside = frames.slice(1).map((b, i) => wingsDiffer(frames[i]!, b))
    const step = (time: number) => wingsDiffer(draw(id, time - 0.025, 120), draw(id, time + 0.025, 120))
    expect(step(s.loop)).toBeLessThanOrEqual(Math.max(...inside))
    expect(step(2 * s.loop)).toBeLessThanOrEqual(Math.max(...inside))
  }
})

test("sticky-notes fades at its loop point: the second board is the same at its held last moment and at the new start", () => {
  const s = scene('sticky-notes')
  expect(wings(draw('sticky-notes', s.loop - LOOP_LAST_S, 120))).toEqual(wings(draw('sticky-notes', 0, 120)))
  expect(wings(draw('sticky-notes', 0, 120)).length).toBeGreaterThan(0)
})

test("stepping-stones' stream ripples downstream, a column a step, and is back where it was at the loop point", () => {
  const ripples = (t: number) => {
    const b = draw('stepping-stones', t, 120)
    const xs: number[] = []
    for (let x = STAGE_W; x < 120; x++) if (at(b, x, 12) === C.glass) xs.push(x)
    return xs
  }
  expect(ripples(0)).not.toEqual(ripples(3))
  // The last step of the loop moves each ripple one column on, as every step does.
  expect(ripples(5.9).map(x => x + 1).filter(x => x < 120)).toEqual(ripples(0).filter(x => x > STAGE_W))
  expect(ripples(1.6).map(x => x + 1).filter(x => x < 120)).toEqual(ripples(2.3).filter(x => x > STAGE_W))
})

test("thought-clouds' wing clouds drift right to left on unwrapped time, never jumping back at the loop point", () => {
  const s = scene('thought-clouds')
  const sky = (time: number) => wings(renderFull(s, time, null, time, { columns: 120, rows: 9 }))
  // 1.5 pixels a second: from 2 s to 4 s every cloud away from the core and the edge moves 3 columns left.
  const away = (ps: string[], shift: number) =>
    ps.map(p => p.split(',').map(Number)).flatMap(([x, y, c]) => (x! + shift >= 62 && x! + shift < 110 ? [`${x! + shift},${y},${c}`] : []))
  expect(away(sky(4), 3)).toEqual(away(sky(2), 0))
  expect(away(sky(2), 0).length).toBeGreaterThan(0)
  // At the loop point (6 s) the clouds go on from where they were, not from where they started.
  expect(away(sky(s.loop + 2), 9)).toEqual(away(sky(2), 0))
})

test('light-bulbs: the wings\' bulbs are unlit, each on a wire from the area\'s top', () => {
  for (const t of moments(scene('light-bulbs'))) {
    const b = draw('light-bulbs', t, 120)
    expect(wings(b).some(p => Number(p.split(',')[2]) === C.gold)).toBe(false)
    expect(getPixel(b, 52, 0)).toBe(C.darkGray)
    expect(at(b, 52, 2)).toBe(C.darkGray)
  }
  // At 7 rows the wire starts on the core's top row.
  expect(at(draw('light-bulbs', 1, 120, 7), 52, 0)).toBe(C.darkGray)
})

test('scales: the weights in the wings stand on the floor, smallest to largest', () => {
  const b = draw('scales', 1, 120)
  // Each weight's top row, left to right along the first row of five.
  const tops: number[] = []
  let top: number | null = null
  for (let x = 50; x < 92; x++) {
    let y = 0
    while (y < 14 && at(b, x, y) === EMPTY) y++
    if (y < 14) top = Math.min(top ?? y, y)
    else if (top !== null) {
      tops.push(top)
      top = null
    }
  }
  expect(tops).toHaveLength(5)
  for (let i = 1; i < tops.length; i++) expect(tops[i]!).toBeLessThan(tops[i - 1]!)
  expect(at(b, 50, 13)).toBe(C.darkGray)
})

test('scroll and treasure-map: the scroll and the map unroll as far as ever on a wide area', () => {
  // Fully open: the scroll's roll ends at column 46, the map's roller at 45; the wings start past a gap.
  const scrollAt = draw('scroll', 5.6, 200)
  expect(at(scrollAt, 46, 12)).toBe(C.paperShade)
  expect(at(scrollAt, 47, 12)).toBe(EMPTY)
  const map = draw('treasure-map', 4, 200)
  expect(at(map, 45, 5)).toBe(C.woodDark)
  expect(at(map, 46, 5)).toBe(EMPTY)
})
