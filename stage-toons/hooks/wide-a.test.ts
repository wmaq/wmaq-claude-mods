import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE } from './clawd'
import { EMPTY, getPixel, type PixelBuffer } from './pixels'
import { type AreaSize, heroAt, renderFull, renderSeamed, type Scene } from './scene'
import { SCENES } from './scenes'
import { C, STAR_LAYERS } from './scenes/kit'
import { LAYERS as ROAD_LAYERS } from './scenes/road-trip'

// The wide sets of bricklaying, crash-test, fireworks, fishing, flashlight,
// recycling, road-trip and stamp (phase 4e). Pixels are read in core
// coordinates: x as drawn, y plus the headroom.

const WIDE: AreaSize = { columns: 200, rows: 9 }
const MID: AreaSize = { columns: 120, rows: 9 }
const scene = (id: string): Scene => SCENES[id]!
const at = (b: PixelBuffer, x: number, y: number) => getPixel(b, x + (b.ox ?? 0), y + (b.oy ?? 0))
const draw = (id: string, t: number, size: AreaSize = WIDE) => renderFull(scene(id), t, null, t, size)
// The columns from..to-1 of a core row that hold no pixel.
const gaps = (b: PixelBuffer, y: number, from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i).filter(x => at(b, x, y) === EMPTY)
// The columns where a colour shows, on any row.
const columnsOf = (b: PixelBuffer, color: number) => [...new Set([...b.px].flatMap((c, i) => (c === color ? [i % b.w] : [])))].sort((p, q) => p - q)
// A region of the area's own columns, as a string to compare.
const region = (b: PixelBuffer, from: number, to = b.w) => Array.from({ length: b.h }, (_, y) => Array.from({ length: to - from }, (_, x) => getPixel(b, from + x, y)).join(',')).join('|')

test('every scene of the group draws at any size without throwing, at exactly that size', () => {
  for (const id of ['bricklaying', 'crash-test', 'fireworks', 'fishing', 'flashlight', 'recycling', 'road-trip', 'stamp']) {
    for (const columns of [30, 47, 48, 49, 51, 120, 512]) {
      for (const rows of [7, 8, 9]) {
        for (let t = 0; t < 2 * scene(id).loop; t += 1.37) {
          const b = renderSeamed(scene(id), t, null, { columns, rows })
          expect(b.w).toBe(Math.max(48, columns))
          expect(b.h).toBe(rows * 2)
        }
      }
    }
  }
})

test("bricklaying: the wall runs from 6 to Clawd's width and two short of the edge, at most 150 columns, and Clawd walks along it", () => {
  // The wall's last column (its mortar), in core columns, once it is whole.
  const end = (size: AreaSize) => {
    const b = draw('bricklaying', 13.6, size)

    return Math.max(...columnsOf(b, C.mortar)) - (b.ox ?? 0)
  }
  expect(end({ columns: 48, rows: 7 })).toBe(6 + 6 * 4 + 1)
  expect(end(MID)).toBe(6 + 24 * 4 + 1)
  expect(end({ columns: 512, rows: 9 })).toBe(6 + 37 * 4 + 1)
  // Clawd stands just past the wall's growing end: he walks right with it.
  const scene = SCENES.bricklaying!
  expect(heroAt(scene, 1, MID).x).toBe(23)
  expect(heroAt(scene, 13.4, MID).x).toBe(111)
  expect(heroAt(scene, 13.4, { columns: 48, rows: 7 }).x).toBe(40)
})

test('crash-test: the wall carries on as bricks to the edge, column 47 only past 48 columns', () => {
  const b = draw('crash-test', 0)
  for (const y of [3, 4, 5, 8, 13]) expect(gaps(b, y, 43, 200)).toEqual([])
  expect(at(b, 47, 4)).toBe(C.mortar)
  // Joints every 4 columns, carried on from the core's (44 and 46 by course).
  expect(at(b, 48, 3)).toBe(C.mortar)
  expect(at(b, 196, 3)).toBe(C.mortar)
  expect(at(b, 50, 5)).toBe(C.mortar)
  expect(at(b, 49, 5)).toBe(C.brick)
  const bare = draw('crash-test', 0, { columns: 48, rows: 7 })
  for (let y = 0; y < 14; y++) expect(at(bare, 47, y)).toBe(EMPTY)
})

test('fireworks: the starfield fills the area, rockets go up in the wings, and Clawd cheers his own alone', () => {
  const b = draw('fireworks', 3)
  expect([...b.px].some((c, i) => c === STAR_LAYERS.far.color && i % b.w >= 192)).toBe(true)
  // At 120 columns, the wings' first rockets burst past the core.
  const burstColumns = (t: number) => [C.red, C.blue, C.gold, C.green].flatMap(c => columnsOf(draw('fireworks', t, MID), c))
  expect(burstColumns(2.5).some(x => x > 48)).toBe(true)
  expect(burstColumns(3).some(x => x > 96)).toBe(true)
  // All are over by the loop's end: nothing but stars past the core at its end and start.
  for (const t of [0, 7.99]) expect(burstColumns(t).filter(x => x >= 48)).toEqual([])
  // Clawd moves exactly as on the bare stage at every moment.
  const clawd = (size: AreaSize, t: number) => {
    const b = draw('fireworks', t, size)
    return [...b.px].flatMap((c, i) => (c === CLAWD_ORANGE ? [`${i % b.w},${Math.floor(i / b.w) - (b.oy ?? 0)}`] : [])).join(' ')
  }
  for (let t = 0; t < 8; t += 0.1) expect(clawd(WIDE, t)).toBe(clawd({ columns: 48, rows: 7 }, t))
})

test('fishing: the water runs to the edge, its ripples tiled every 25 columns', () => {
  const b = draw('fishing', 0)
  for (const y of [11, 12, 13]) expect(gaps(b, y, 21, 200)).toEqual([])
  for (let t = 0; t < 8; t += 0.32) {
    const mid = draw('fishing', t, MID)
    // On the water's top row: a splash's drops fly above it.
    const glass = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i).filter(x => at(mid, x, 11) === C.glass)
    // Each tile has the core's three ripples, 25 columns on, stepping and
    // wrapping with them (the core's own may hide behind the line or a catch).
    expect(glass(47, 72)).toHaveLength(3)
    expect(glass(72, 97)).toEqual(glass(47, 72).map(x => x + 25))
    const tile = glass(47, 72).map(x => x - 25)
    expect(glass(22, 47).every(x => tile.includes(x))).toBe(true)
  }
  // A ripple at column 47 shows only past 48 columns.
  const t47 = Array.from({ length: 25 }, (_, i) => (i * 8) / 25 + 0.01).find(t => at(draw('fishing', t, MID), 47, 11) === C.glass)
  expect(t47).not.toBe(undefined)
  expect(at(draw('fishing', t47!, { columns: 48, rows: 7 }), 47, 11)).toBe(C.blue)
})

test('fishing: now and then a fish jumps out of the water in the wings, in an arc, with a splash out and in', () => {
  // Every 0.05 s through the loop, at 200 columns: jumpers start at 52, 81, 110, ...
  const frames = Array.from({ length: 160 }, (_, i) => draw('fishing', 0.025 + i * 0.05))
  const fishIn = (b: PixelBuffer, from: number) => {
    const out: { x: number; y: number }[] = []
    for (let y = -4; y < 14; y++) for (let x = from; x < from + 11; x++) if (at(b, x, y) === C.green) out.push({ x, y })
    return out
  }
  const starts: number[] = []
  for (const from of [52, 81, 110]) {
    const seen = frames.map(b => fishIn(b, from))
    // Out for about a second a loop, once.
    const out = seen.flatMap((px, i) => (px.length > 0 ? [i] : []))
    expect(out.length).toBeGreaterThanOrEqual(18)
    expect(out.length).toBeLessThanOrEqual(21)
    starts.push(out[0]!)
    // Always above the water, rising to row 3 at the top of its arc, and moving right as it goes.
    const all = seen.flat()
    expect(all.every(p => p.y <= 10)).toBe(true)
    expect(Math.min(...all.map(p => p.y))).toBe(3)
    expect(Math.max(...all.map(p => p.x)) - Math.min(...all.map(p => p.x))).toBe(10)
  }
  // Each at its own moment.
  expect(new Set(starts).size).toBe(3)
  // The splashes throw white drops above the water now and then, never all the time.
  const splashing = frames.filter(b => Array.from({ length: 152 }, (_, i) => 48 + i).some(x => at(b, x, 9) === C.white)).length
  expect(splashing).toBeGreaterThan(5)
  expect(splashing).toBeLessThan(120)
  // The water stays water under them.
  const water: number[] = [C.blue, C.glass]
  const dry = frames.filter(b => Array.from({ length: 152 }, (_, i) => 48 + i).some(x => [11, 12, 13].some(y => !water.includes(at(b, x, y)))))
  expect(dry).toHaveLength(0)
})

test('flashlight: the pool sweeps out to 9 short of the edge, up to 150 columns on, and the dark wall stays empty', () => {
  // At its farthest (3.4 s) the pool's lit wall reaches near the far point.
  const lit = (size: AreaSize) => Math.max(...columnsOf(draw('flashlight', 3.4, size), C.beam))
  expect(lit(MID)).toBeGreaterThanOrEqual(111 - 7)
  expect(lit(MID)).toBeLessThan(120)
  expect(lit(WIDE)).toBeGreaterThanOrEqual(180 - 7)
  expect(lit(WIDE)).toBeLessThan(190)
  // Between the shelves (row 2) the unlit back wall is the terminal's own
  // background: nothing is drawn there away from the light.
  const b = draw('flashlight', 0.5, MID)
  expect(gaps(b, 2, 60, 120)).toHaveLength(60)
  expect(gaps(draw('flashlight', 3.4, MID), 2, 60, 120).length).toBeLessThan(60)
})

test('recycling: past 50 columns the third throw goes into a second bin; at 50 and under it misses and rolls off', () => {
  const ball = (t: number, size: AreaSize) => {
    const xs = columnsOf(draw('recycling', t, size), C.white).filter(x => x > 40)
    return xs.length === 0 ? null : Math.min(...xs)
  }
  // The second bin stands at x 50, rim from 49.
  const b = draw('recycling', 0, MID)
  expect(gaps(b, 7, 49, 57)).toEqual([])
  expect(at(b, 50, 13)).toBe(C.gray)
  // The third ball flies on over the first bin and drops into the second:
  // nothing lies on the floor after.
  expect(ball(4.2, MID)).toBeGreaterThan(40)
  for (const t of [4.6, 5.2, 5.8, 6, 6.39]) expect(ball(t, MID)).toBe(null)
  // At 50 columns and under it misses, bounces and rolls off as before, gone at 6.0 s.
  expect(ball(5.2, { columns: 48, rows: 7 })).not.toBe(null)
  expect(ball(5.95, { columns: 50, rows: 7 })).toBe(49)
  expect(ball(6.05, { columns: 50, rows: 7 })).toBe(null)
  // Clawd's eyes go wide at a miss only.
  // Wide eyes draw 8 dark pixels, open ones 4: at 48 columns the third ball
  // misses, past 50 it goes into the second bin.
  const eyeInk = (size: AreaSize) => [...draw('recycling', 4.5, size).px].filter(c => c === 0x2a1610).length
  expect([eyeInk({ columns: 48, rows: 9 }), eyeInk(MID)]).toEqual([8, 4])
})

test('recycling: past the second bin, sorting bins to the edge, 14 columns apart: paper, glass, plastic in turn', () => {
  const b = draw('recycling', 1)
  const blue = 0x4a6aa8
  const green = 0x4a8a55
  const yellow = 0xa89040
  // Bins at 64, 78, ... 190, each a body of its colour, a lid, and a sign in a lighter shade.
  const xs = Array.from({ length: 10 }, (_, k) => 64 + 14 * k)
  expect(xs.map(x => at(b, x, 13))).toEqual([blue, green, yellow, blue, green, yellow, blue, green, yellow, blue])
  for (const x of xs) {
    expect(gaps(b, 7, x - 1, x + 7)).toEqual([])
    expect(at(b, x - 1, 7)).not.toBe(at(b, x, 13))
    const body = at(b, x, 13)
    const sign = Array.from({ length: 16 }, (_, i) => at(b, x + 1 + (i % 4), 9 + Math.floor(i / 4))).filter(c => c !== body)
    expect(sign.length).toBeGreaterThanOrEqual(8)
    expect(new Set(sign).size).toBe(1)
    expect(sign[0]).not.toBe(CLAWD_ORANGE)
    // Nothing between this bin's lid and the next one's.
    expect(gaps(b, 7, x + 7, x + 13)).toHaveLength(6)
  }
  // The core's bin and the second stay grey, the second 14 columns on.
  expect([36, 50].map(x => at(b, x, 13))).toEqual([C.gray, C.gray])
  // Still bins all through the loop, the same at 120 columns as at 200, whole ones only:
  // the bin at 120 would show only its lid's end, so it is left out.
  const mid = draw('recycling', 5.9, MID)
  for (let x = 57; x < 113; x++) for (let y = 7; y < 14; y++) expect(at(mid, x, y)).toBe(at(b, x, y))
  for (let x = 113; x < 120; x++) for (let y = 0; y < 14; y++) expect(at(mid, x, y)).toBe(EMPTY)
})

test('road-trip: the road and the fence run to the edge, the near layer scrolling 6 columns a second, the far ones slower', () => {
  const b = draw('road-trip', 0)
  expect(gaps(b, 13, 0, 200)).toEqual([])
  expect(gaps(b, 10, 0, 200)).toEqual([])
  // One second on, the road's dashes are 6 columns further left (from
  // column 30, clear of Clawd's feet).
  const road = (t: number, shift: number) => Array.from({ length: 150 }, (_, x) => at(draw('road-trip', t), 30 + x + shift, 13)).join(',')
  expect(road(0, 0)).toBe(road(1, -6))
  // Each layer is slower the further off it is.
  const speeds = [ROAD_LAYERS.clouds, ROAD_LAYERS.mountains, ROAD_LAYERS.hills, ROAD_LAYERS.near].map(l => l.speed)
  expect([...speeds].sort((p, q) => p - q)).toEqual(speeds)
  // Every layer is behind Clawd: nothing of it covers him, at any moment.
  const bare: Scene = { ...scene('road-trip'), background: undefined }
  for (let t = 0; t < 4; t += 0.25) {
    const orange = (s: Scene) => [...renderFull(s, t, null, t, MID).px].filter(c => c === CLAWD_ORANGE).length
    expect(orange(scene('road-trip'))).toBe(orange(bare))
  }
})

test('stamp: the desk runs to the edge, legs every 25 columns; a page every 24 columns from the stamp to the edge', () => {
  const b = draw('stamp', 0)
  expect(gaps(b, 12, 20, 200)).toEqual([])
  const legs = columnsOf(b, C.woodDark).filter(x => x >= 46)
  expect(legs.filter(x => at(b, x, 13) === C.woodDark)).toEqual([46, 71, 96, 121, 146, 171, 196])
  for (let t = 0; t < 4.5; t += 0.05) {
    const frame = draw('stamp', t)
    const paper = columnsOf(frame, C.paper).filter(x => at(frame, x, 9) === C.paper || at(frame, x, 11) === C.paper)
    // Pages come in from the edge: always one within the last 24 columns, and none more than 24 apart.
    expect(paper.at(-1)!).toBeGreaterThanOrEqual(200 - 24)
    for (let i = 1; i < paper.length; i++) expect(paper[i]! - paper[i - 1]!).toBeLessThanOrEqual(19)
  }
  // Seamless: the wings at the loop's end are the wings at its start.
  expect(region(draw('stamp', 4.4999, MID), 48)).toBe(region(draw('stamp', 0, MID), 48))
})
