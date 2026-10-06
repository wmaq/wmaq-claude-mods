import { expect, test } from 'claude-code/testing'

import { EMPTY, getPixel, type PixelBuffer } from './pixels'
import { type AreaSize, renderFull, renderSeamed, type Scene } from './scene'
import { SCENES } from './scenes'
import { C } from './scenes/kit'

// The wide sets of stargazing, sweeping, the terminal, the test tubes, the
// workbench, the dominoes, the waiting bench and the writing desk.

const WIDE: AreaSize = { columns: 200, rows: 9 }
const AREA: AreaSize = { columns: 120, rows: 9 }
const draw = (id: string, t: number, size: AreaSize = AREA) => renderFull(SCENES[id]!, t, null, t, size)
// A pixel in the core's coordinates (y 0 is the core's top row).
const at = (b: PixelBuffer, x: number, y: number) => getPixel(b, x + (b.ox ?? 0), y + (b.oy ?? 0))
// The columns from..to-1 of a core row that are empty.
const gaps = (b: PixelBuffer, y: number, from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i).filter(x => at(b, x, y) === EMPTY)
const isSetIn = (b: PixelBuffer, from: number, to: number) => {
  for (let y = -(b.oy ?? 0); y < 14; y++) for (let x = from; x < to; x++) if (at(b, x, y) !== EMPTY) return true

  return false
}
// The pixels right of the core, as a string to compare frames by.
const wings = (b: PixelBuffer, keep: (c: number) => boolean = () => true, from = 48) => {
  const out: string[] = []
  for (let y = -(b.oy ?? 0); y < 14; y++) for (let x = from; x < b.w - (b.ox ?? 0); x++) if (keep(at(b, x, y))) out.push(`${x},${y},${at(b, x, y)}`)

  return out.join(' ')
}

test("each scene's set reaches the edge with no gap in its row", () => {
  // [scene, the set's row, where the core's set starts, a moment]
  const rows: [string, number, number, number][] = [
    ['sweeping', 7, 36, 1],
    ['terminal', 12, 18, 1],
    ['workbench', 10, 19, 1],
    ['waiting-bench', 11, 6, 1],
    ['writing-desk', 12, 10, 4],
    // Every domino lies flat once the chain has ended.
    ['dominoes', 12, 21, 6.8],
  ]
  for (const [id, y, from, t] of rows) {
    const b = draw(id, t, WIDE)
    expect(gaps(b, y, from, 200)).toEqual([])
    expect(isSetIn(b, 192, 200)).toBe(true)
  }
  for (const id of ['stargazing', 'test-tubes']) expect(isSetIn(draw(id, 1, WIDE), 192, 200)).toBe(true)
})

test('stargazing: one more star per 8 columns past the core, on from the start', () => {
  const bright = (c: number) => c === C.white || c === C.gold
  const stars = (columns: number) => wings(draw('stargazing', 0, { columns, rows: 9 }), bright).split(' ').filter(Boolean).length
  expect(stars(200)).toBe(19)
  expect(stars(120)).toBe(9)
  // They twinkle in a 2 s beat, which divides the 6 s loop: seamless.
  expect(wings(draw('stargazing', 6 - 0.01), bright)).toBe(wings(draw('stargazing', 2 - 0.01), bright))
})

test('stargazing: the shooting star starts further right, on the same slope and time', () => {
  for (const [columns, start] of [[48, 46], [60, 58], [120, 70], [200, 70]] as const) {
    const size = { columns, rows: 9 }
    expect(at(draw('stargazing', 4.21, size), start, 0)).toBe(C.white)
    expect(at(draw('stargazing', 4.79, size), start - 16, 4)).toBe(C.white)
  }
})

test('sweeping: past the core the shelf is full of books already shelved, to the edge, the same at the fade', () => {
  const b = draw('sweeping', 0, WIDE)
  // A book on every column from 45 (after the core's eighth) to the edge, standing on the plank.
  expect(gaps(b, 6, 45, 200)).toEqual([])
  // 3 or 4 tall: never above the core's books' top row (3), and none a twin of its left neighbour.
  expect(gaps(b, 2, 45, 200)).toHaveLength(155)
  const tall = Array.from({ length: 155 }, (_, i) => at(b, 45 + i, 3)).filter(c => c !== EMPTY).length
  expect(tall).toBeGreaterThan(100)
  expect(tall).toBeLessThan(155)
  for (let x = 46; x < 200; x++) expect(at(b, x, 6) === at(b, x - 1, 6)).toBe(false)
  // The four colours, mostly dimmed: a few books as bright as the core's, not most.
  const bright = Array.from({ length: 155 }, (_, i) => at(b, 45 + i, 6)).filter(c => ([C.blue, C.red, C.green, C.gold] as number[]).includes(c)).length
  expect(bright).toBeGreaterThan(15)
  expect(bright).toBeLessThan(80)
  // The same books at every width, and through the fade.
  const mid = draw('sweeping', 3, AREA)
  for (let x = 45; x < 120; x++) for (let y = 2; y < 8; y++) expect(at(mid, x, y)).toBe(at(b, x, y))
  expect(wings(draw('sweeping', 7.99, WIDE))).toBe(wings(b))
  // At 48 columns the shelf is as it was: bare from 45, ending at 46.
  const core = draw('sweeping', 7.99, { columns: 48, rows: 9 })
  expect([45, 46].map(x => at(core, x, 5))).toEqual([EMPTY, EMPTY])
  expect(at(core, 46, 7)).toBe(C.woodDark)
})

test('the terminal: the desk joins at 44, a leg every 23 columns after its right leg', () => {
  const b = draw('terminal', 1)
  expect([65, 88, 111].map(x => at(b, x, 13))).toEqual([C.woodDark, C.woodDark, C.woodDark])
  expect(gaps(b, 13, 43, 120).length).toBe(77 - 3)
})

test('the terminal: props stand on the desk in a fixed order, every 46 columns to the edge', () => {
  const b = draw('terminal', 0, WIDE)
  for (const x of [48, 94, 140]) {
    // The mug, the duck, the second monitor, the plant's pot, the lamp's base.
    expect(at(b, x + 2, 11)).toBe(C.paperShade)
    expect(at(b, x + 12, 8)).toBe(C.gold)
    expect(at(b, x + 18, 5)).toBe(C.darkGray)
    expect(at(b, x + 19, 6)).toBe(C.ink)
    expect(at(b, x + 30, 9)).toBe(C.brick)
    expect(at(b, x + 38, 11)).toBe(C.darkGray)
  }
  // Each prop stands on the desk: nothing of the set on rows 12 and 13 but the desk.
  for (let x = 48; x < 200; x++) expect({ x, floor: [C.wood, C.woodDark, EMPTY].includes(at(b, x, 13)) }).toEqual({ x, floor: true })
  expect({ edge: isSetIn(b, 192, 200) }).toEqual({ edge: true })
  // Never Clawd's orange nor Fable's violet, and nothing above row 5.
  const kit = new Set<number>(Object.values(C))
  for (const t of [0, 1.3, 2.5, 3.7]) {
    const px = wings(draw('terminal', t, WIDE), c => c !== EMPTY).split(' ').map(p => p.split(',').map(Number))
    expect({ t, bad: px.filter(p => !kit.has(p[2]!) || p[1]! < 5).map(p => p.join(',')) }).toEqual({ t, bad: [] })
  }
})

test("the terminal: the mug's steam rises and the second monitor's graph changes, both meeting themselves at the loop point", () => {
  const steam = (t: number) => wings(draw('terminal', t), c => c === C.smoke)
  const graph = (t: number) => wings(draw('terminal', t), c => c === C.green)
  expect(steam(0.1)).not.toBe(steam(0.5))
  expect(steam(0.5)).not.toBe(steam(0.9))
  expect(graph(0.1)).not.toBe(graph(1.3))
  // A puff takes 1.2 s, four to the 4.8 s loop; the graph's four take it all.
  expect(steam(4.8 - 0.01)).toBe(steam(1.2 - 0.01))
  expect(new Set([0.1, 1.3, 2.5, 3.7].map(graph)).size).toBe(4)
  expect(graph(4.8 + 0.1)).toBe(graph(0.1))
})

test('the test tubes: a tube every 7 columns from 45, bubbling in turn; only the core three get ticks', () => {
  const b = draw('test-tubes', 5.9)
  for (let x = 45; x < 120; x += 7) expect(at(b, x + 1, 13)).toBe(C.glass)
  const ticks = (columns: number) => [...draw('test-tubes', 5.9, { columns, rows: 9 }).px].filter(c => c === C.green).length
  expect(ticks(120)).toBe(ticks(48))
  // A bubble's cycle is 0.75 s, 8 to the 6 s loop: seamless.
  expect(wings(draw('test-tubes', 6 - 0.01))).toBe(wings(draw('test-tubes', 0.75 - 0.01)))
})

test('the workbench: legs every 26 columns, and the robot walks into the crate at 48', () => {
  const b = draw('workbench', 0)
  expect([72, 98].map(x => at(b, x, 11))).toEqual([C.woodDark, C.woodDark])
  // The crate stands on the bench from the start, over the walking robot.
  expect(at(b, 48, 7)).toBe(C.woodDark)
  expect(at(b, 56, 9)).toBe(C.wood)
  // Walking to 48 as today, the robot goes in behind the crate's front: its
  // head may show over the rim, never past the crate's middle.
  for (let t = 4.6; t < 7; t += 0.1) expect(wings(draw('workbench', t), undefined, 53)).toBe(wings(b, undefined, 53))
  expect(wings(draw('workbench', 6.5))).toBe(wings(b))
})

test('the dominoes: the row stands from the start and the chain ends by 6.7 s, at any width', () => {
  const start = draw('dominoes', 0, WIDE)
  for (let x = 45; x < 200; x += 3) expect(at(start, x, 9)).toBe(C.paper)
  for (const columns of [49, 120, 200, 512]) {
    const b = draw('dominoes', 6.7 + 0.12, { columns, rows: 9 })
    expect(gaps(b, 9, 21, columns).length).toBe(columns - 21)
  }
  // Clawd cheers at the true end: at 48 columns from 5.64 s, at 120 not
  // until 6.7.
  const clawd = (columns: number, t: number) => {
    const b = draw('dominoes', t, { columns, rows: 9 })
    return Array.from({ length: 18 * 14 }, (_, i) => at(b, i % 18, Math.floor(i / 18))).join(',')
  }
  expect(clawd(120, 6.6)).not.toBe(clawd(48, 6.6))
  expect(clawd(120, 6.701)).toBe(clawd(48, 6.701))
})

test('the dominoes: the extra row dissolves with the core at the loop point', () => {
  const scene: Scene = SCENES.dominoes!
  // A dissolved picture keeps no origin: the core's row 9 is the area's 13.
  const standing = (b: PixelBuffer) => Array.from({ length: 72 }, (_, i) => 48 + i).filter(x => getPixel(b, x, 13) === C.paper).length
  // Midway through the fade some of the wings' dominoes stand again, not all.
  const mid = standing(renderSeamed(scene, 7.15, null, AREA))
  expect(mid).toBeGreaterThan(0)
  expect(mid).toBeLessThan(24)
  expect(standing(renderSeamed(scene, 7.5, null, AREA))).toBe(24)
})

test('the waiting bench runs on from 28, legs as far apart as its own', () => {
  const b = draw('waiting-bench', 1)
  expect([42, 59, 76].map(x => at(b, x, 12))).toEqual([C.woodDark, C.woodDark, C.woodDark])
})

test('the writing desk: a second stack, written already, on the desk past the core', () => {
  for (const t of [0, 5.99]) {
    const b = draw('writing-desk', t)
    expect(at(b, 52, 11)).toBe(C.paper)
    expect(at(b, 57, 6)).toBe(C.paperShade)
    expect(at(b, 52, 5)).toBe(EMPTY)
  }
  expect(at(draw('writing-desk', 0), 68, 13)).toBe(C.woodDark)
})

test('the writing desk: the growing stack stands on the desk, never over its top, at every width', () => {
  const wrong: string[] = []
  for (const columns of [48, 120]) {
    // A moment in each of the stack's six heights, and its last before the loop.
    for (const t of [0.013, 0.95, 1.85, 2.75, 3.65, 4.55, 5.99]) {
      const b = draw('writing-desk', t, { columns, rows: 9 })
      // The desk's top is wood from 10 to the edge; the stack's bottom page on the row above.
      for (let x = 10; x < columns; x++) if (at(b, x, 12) !== C.wood) wrong.push(`${columns} ${t} top ${x}`)
      if (at(b, 36, 11) !== C.paper || at(b, 41, 11) !== C.paper) wrong.push(`${columns} ${t} bottom page`)
      // Under the desk past Clawd, nothing but its legs.
      for (let x = 32; x < columns; x++) if (at(b, x, 13) !== EMPTY && at(b, x, 13) !== C.woodDark) wrong.push(`${columns} ${t} under ${x}`)
      // At most 6 pages, the top one on row 6: the rows above the stack stay clear.
      for (let y = -4; y < 6; y++) for (let x = 36; x < 42; x++) if (at(b, x, y) !== EMPTY) wrong.push(`${columns} ${t} above ${x},${y}`)
    }
  }
  expect(wrong).toEqual([])
  // It grows a page every 0.9 s, from one to six.
  const pages = (t: number) => Array.from({ length: 6 }, (_, i) => at(draw('writing-desk', t), 36, 11 - i)).filter(c => c !== EMPTY).length
  expect([0.1, 1, 1.9, 2.8, 3.7, 4.6, 5.9].map(pages)).toEqual([1, 2, 3, 4, 5, 6, 6])
})
