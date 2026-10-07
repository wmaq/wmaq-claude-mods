import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { EMPTY, getPixel, type PixelBuffer } from './pixels'
import { renderFull, type Scene, STAGE_W } from './scene'
import { SCENES } from './scenes'
import { C } from './scenes/kit'
import { CHALK } from './scenes/light-bulbs'

// proofread-page, proofread-checklist, scroll and sticky-notes, reworked
// across the whole width in phase 6c, are held by scene-polish.test.ts and
// scene-polish-6c.test.ts.
const WINGED = ['light-bulbs', 'mystery-box', 'red-pen', 'scales', 'stepping-stones', 'thought-clouds', 'treasure-map']
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

test('the sets that run on reach the edge at 200 columns with no gap: the stream, the sea', () => {
  const runs: [string, number, number[]][] = [
    ['stepping-stones', STAGE_W, [12, 13]],
    ['treasure-map', STAGE_W, [12, 13]],
  ]
  for (const [id, from, rows] of runs) {
    const b = draw(id, 1, 200)
    for (const y of rows) for (let x = from; x < 200; x++) expect(at(b, x, y)).not.toBe(EMPTY)
  }
  // And the wings that repeat reach the area's last 8 columns.
  for (const id of ['light-bulbs', 'red-pen', 'scales', 'stepping-stones', 'treasure-map']) {
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

// The wings' pixels as [x, y, colour], y in the core's coordinates.
const wingPixels = (b: PixelBuffer) => wings(b).map(p => p.split(',').map(Number) as [number, number, number])

test('stepping-stones: ground to the edge under a snowy mountain range, the tallest peak near the edge flying a red flag', () => {
  for (const columns of [120, 200]) {
    const b = draw('stepping-stones', 1, columns)
    for (let x = STAGE_W; x < columns; x++) {
      expect(at(b, x, 12)).toBe(C.green)
      expect(at(b, x, 13)).toBe(C.woodDark)
    }
    const px = wingPixels(b)
    const rock = px.filter(([, , c]) => c === C.gray || c === C.darkGray || c === C.white)
    // Snow on the peaks; with the headroom the range stands taller than on 7 rows.
    expect(px.filter(([, , c]) => c === C.white).length).toBeGreaterThan(10)
    const lowRock = wingPixels(draw('stepping-stones', 1, columns, 7)).filter(([, , c]) => c === C.gray || c === C.darkGray)
    expect(rock.filter(([, , c]) => c !== C.white).length).toBeGreaterThan(lowRock.length + 100)
    // The goal: the highest peak, 14 columns in from the edge, its flag
    // reaching the area's top row.
    const peak = Math.min(...rock.map(([, y]) => y))
    expect(rock.filter(([, y]) => y === peak).map(([x]) => x)).toEqual([columns - 14])
    const flag = px.filter(([, , c]) => c === C.red)
    expect(flag.length).toBeGreaterThan(0)
    expect(flag.every(([x]) => x > columns - 14 && x <= columns - 12)).toBe(true)
    expect(Math.min(...px.filter(([x]) => x === columns - 14).map(([, y]) => y))).toBe(-4)
  }
  // At 7 rows the range is lower, and the flag still reaches the top row.
  const low = wingPixels(draw('stepping-stones', 1, 120, 7))
  expect(Math.min(...low.filter(([x]) => x === 106).map(([, y]) => y))).toBe(0)
  // Too narrow to show the goal whole past the core: no goal, no flag.
  expect(wingPixels(draw('stepping-stones', 1, 60)).some(([, , c]) => c === C.red)).toBe(false)
})

test('stepping-stones: the range stands where it is at any width, still; only the flag flutters', () => {
  const left = (b: PixelBuffer) => wings(b).filter(p => Number(p.split(',')[0]) < 90)
  expect(left(draw('stepping-stones', 1, 200))).toEqual(left(draw('stepping-stones', 1, 120)))
  const rock = (t: number) => wings(draw('stepping-stones', t, 120)).filter(p => !([C.red, C.woodDark] as number[]).includes(Number(p.split(',')[2])) || Number(p.split(',')[1]) >= 12)
  for (const t of moments(scene('stepping-stones'))) expect(rock(t)).toEqual(rock(0))
  const flag = (t: number) => wings(draw('stepping-stones', t, 120)).filter(p => Number(p.split(',')[2]) === C.red)
  expect(flag(0.1)).not.toEqual(flag(0.6))
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

test('mystery-box: the piles of taped boxes stand 5 columns apart, from 52 to the edge', () => {
  const b = draw('mystery-box', 1, 200)
  // A pile is 19 columns wide; one every 24: at 52, 76, 100, ...
  for (const x of [52, 76, 100, 124, 148, 172]) {
    expect(at(b, x, 13)).toBe(C.woodDark)
    expect(at(b, x + 18, 13)).toBe(C.woodDark)
    expect(at(b, x + 6, 2)).toBe(C.woodDark)
    for (let gap = x + 19; gap < x + 24; gap++) for (let y = 0; y < 14; y++) expect(at(b, gap, y)).toBe(EMPTY)
  }
  // The last pile at 196 is cut by the edge.
  expect(at(b, 196, 13)).toBe(C.woodDark)
})

test("thought-clouds' wing clouds are blue-grey sky clouds, never the white of his thought bubbles", () => {
  for (const t of moments(scene('thought-clouds'))) {
    const colors = new Set(wingPixels(draw('thought-clouds', t, 200)).map(([, , c]) => c))
    expect([...colors].sort()).toEqual([C.sky, C.skyShade].sort())
  }
})

test('light-bulbs: dim chalk symbols float in the wings, bobbing; now and then one lights up gold', () => {
  const s = scene('light-bulbs')
  const times = Array.from({ length: 60 }, (_, i) => 0.013 + (i * s.loop) / 60)
  let litMoments = 0
  for (const t of times) {
    const px = wingPixels(draw('light-bulbs', t, 200))
    expect(px.every(([, , c]) => c === CHALK || c === C.gold)).toBe(true)
    // At most two symbols lit at once: a few pixels of gold, against many of chalk.
    const gold = px.filter(([, , c]) => c === C.gold).length
    expect(gold).toBeLessThan(25)
    expect(px.length - gold).toBeGreaterThan(100)
    if (gold > 0) litMoments++
  }
  // Lit now and then: some moments, never most.
  expect(litMoments).toBeGreaterThan(3)
  expect(litMoments).toBeLessThan(times.length / 2)
  // Placed by column: the wider area shows the same symbols, and more.
  const shape = (b: PixelBuffer) => wingPixels(b).filter(([x]) => x < 110).map(([x, y]) => `${x},${y}`)
  expect(shape(draw('light-bulbs', 1, 200))).toEqual(shape(draw('light-bulbs', 1, 120)))
  // Each bobs a pixel up and down every 3 s: moving, and back where it was.
  expect(shape(draw('light-bulbs', 1, 120))).not.toEqual(shape(draw('light-bulbs', 2, 120)))
  expect(shape(draw('light-bulbs', 4, 120))).toEqual(shape(draw('light-bulbs', 1, 120)))
  // Symbols up in the headroom show only on an area tall enough for them.
  expect(wingPixels(draw('light-bulbs', 1, 120)).some(([, y]) => y < 0)).toBe(true)
  for (const t of times) expect(wingPixels(draw('light-bulbs', t, 120, 7)).every(([, y]) => y >= 0)).toBe(true)
})

test('scales: a shelf in the wings holds sets of brass weights, smallest to largest, in every bay to the edge', () => {
  const b = draw('scales', 1, 200)
  // The plank on row 11 from 49 to the edge, an upright every 35 columns.
  for (let x = 49; x < 200; x++) expect(at(b, x, 11)).not.toBe(EMPTY)
  expect([49, 84, 119, 154, 189].map(x => at(b, x, 6))).toEqual(Array(5).fill(C.woodDark))
  // In each bay, four weights stand on the plank, each taller than the one before.
  for (const bay of [49, 84, 119, 154]) {
    const tops: number[] = []
    let top: number | null = null
    for (let x = bay + 1; x < bay + 35; x++) {
      let y = 0
      while (y < 11 && at(b, x, y) === EMPTY) y++
      if (y < 11) top = Math.min(top ?? y, y)
      else if (top !== null) {
        tops.push(top)
        top = null
      }
    }
    expect(tops).toHaveLength(4)
    for (let i = 1; i < tops.length; i++) expect(tops[i]!).toBeLessThan(tops[i - 1]!)
  }
  // Brass: gold in the light, brassDark in shade, standing right on the plank.
  expect(at(b, 52, 10)).toBe(C.gold)
  expect(at(b, 53, 10)).toBe(C.brassDark)
  // Nothing on the shelf moves.
  for (const t of [0, 2.6, 5.9]) expect(wings(draw('scales', t, 200))).toEqual(wings(b))
})

test('treasure-map: the map unrolls as far as ever on a wide area', () => {
  // Fully open: the map's roller ends at column 45; the wings start past a gap.
  const map = draw('treasure-map', 4, 200)
  expect(at(map, 45, 5)).toBe(C.woodDark)
  expect(at(map, 46, 5)).toBe(EMPTY)
})
