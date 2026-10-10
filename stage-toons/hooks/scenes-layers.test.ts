import { expect, test } from 'claude-code/testing'

import { EMPTY, getPixel, setPixel } from './pixels'
import { areaBuffer } from './scene'
import { C } from './scenes/kit'
import { drawLit, eachColumn, eachItem, fade, FAR, mix, scrolled, wrap } from './scenes/layers'

test('wrap gives a place in the pattern, negatives included; scrolled gives whole columns', () => {
  expect([wrap(0, 8), wrap(7, 8), wrap(8, 8), wrap(-1, 8), wrap(-17, 8)]).toEqual([0, 7, 0, 7, 7])
  expect([scrolled(0, 2.5), scrolled(0.39, 2.5), scrolled(0.4, 2.5), scrolled(10, 0.4)]).toEqual([0, 0, 1, 4])
  for (let t = 0; t < 5; t += 0.07) expect(Number.isInteger(scrolled(t, 6))).toBe(true)
})

test('eachColumn visits every column of the area once, with its place in the pattern', () => {
  for (const columns of [48, 120, 512]) {
    const b = areaBuffer({ columns, rows: 9 }, 10)
    const seen: number[] = []
    eachColumn(b, 5, 7, (x, u) => {
      seen.push(x)
      expect(u).toBe(wrap(x + 5, 7))
    })
    expect(seen).toEqual(Array.from({ length: b.w }, (_, i) => i - (b.ox ?? 0)))
  }
})

test("eachItem's copies come every period, from a margin left of the area to one past its right", () => {
  const b = areaBuffer({ columns: 120, rows: 7 })
  const xs: number[] = []
  eachItem(b, 3, 40, 10, x => xs.push(x))
  // The item at 10 in the pattern, scrolled 3: at 7, then every 40, from -12 to 132.
  expect(xs).toEqual([7, 47, 87, 127])
  const wide: number[] = []
  eachItem(b, 0, 40, 30, x => wide.push(x), 20)
  expect(wide).toEqual([-10, 30, 70, 110])
})

test('fade: 0 is the colour, 1 is FAR; mix is its general form', () => {
  expect(fade(C.brick, 0)).toBe(C.brick)
  expect(fade(C.brick, 1)).toBe(FAR)
  expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080)
  expect(mix(C.gold, C.blue, 0)).toBe(C.gold)
})

test('drawLit: true colour at light 1, bare where the paint drew nothing, empty below 0.1 with dark 1', () => {
  const b = areaBuffer({ columns: 48, rows: 7 })
  const paint = (layer: typeof b) => {
    setPixel(layer, 2, 2, C.red)
    setPixel(layer, 30, 2, C.red)
    setPixel(layer, 40, 2, C.red)
  }
  // Lit on the left, half lit in the middle, dark from column 35.
  const light = (x: number) => (x < 20 ? 1 : x < 35 ? 0.5 : 0)
  drawLit(b, paint, light, { dark: 1, bare: C.beam })
  expect(getPixel(b, 2, 2)).toBe(C.red)
  expect(getPixel(b, 3, 2)).toBe(C.beam)
  expect(getPixel(b, 30, 2)).toBe(fade(C.red, 0.5))
  expect(getPixel(b, 31, 2)).toBe(fade(C.beam, 0.5))
  expect(getPixel(b, 40, 2)).toBe(EMPTY)
  expect(getPixel(b, 41, 2)).toBe(EMPTY)
  // With no bare, what the paint left empty stays as it was; a dark below 1
  // keeps unlit shapes as faint silhouettes.
  const c = areaBuffer({ columns: 48, rows: 7 })
  setPixel(c, 3, 2, C.green)
  drawLit(c, paint, light, { dark: 0.8 })
  expect(getPixel(c, 3, 2)).toBe(C.green)
  expect(getPixel(c, 40, 2)).toBe(fade(C.red, 0.8))
  expect(getPixel(c, 41, 2)).toBe(EMPTY)
})

test("drawLit reads the light in the core's coordinates, across the headroom and an inset core", () => {
  const b = areaBuffer({ columns: 120, rows: 9 }, 10)
  const lit: { x: number; y: number }[] = []
  drawLit(b, () => undefined, (x, y) => {
    lit.push({ x, y })

    return 0
  }, { dark: 1, bare: C.beam })
  expect(lit[0]).toEqual({ x: -10, y: -4 })
  expect(lit.at(-1)).toEqual({ x: 109, y: 13 })
  expect([...b.px].every(c => c === EMPTY)).toBe(true)
})
