import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createBuffer, encodeCells, setPixel } from '../../stage-toons/hooks/pixels'
import { BACKGROUND, CELL_H, CELL_W, createCanvas, dimmed, drawCells, drawText, toRgba } from './grid'

const at = (c: ReturnType<typeof createCanvas>, x: number, y: number) => c.px[y * c.width + x]

test('a half-block cell paints its top half and its bottom half', () => {
  const b = createBuffer(1, 2)
  setPixel(b, 0, 0, 0xff0000)
  setPixel(b, 0, 1, 0x00ff00)
  const c = createCanvas(1, 1)
  drawCells(c, 0, 0, encodeCells(b), 1, 1)
  assert.equal(at(c, 3, 2), 0xff0000)
  assert.equal(at(c, 3, CELL_H - 2), 0x00ff00)
})

test("an empty half, and an empty cell, show the theme's background", () => {
  const b = createBuffer(2, 2)
  setPixel(b, 0, 0, 0xff0000)
  const c = createCanvas(2, 1, 0x123456)
  drawCells(c, 0, 0, encodeCells(b), 2, 1)
  assert.equal(at(c, 3, 2), 0xff0000)
  assert.equal(at(c, 3, CELL_H - 2), BACKGROUND)
  assert.equal(at(c, CELL_W + 3, 2), BACKGROUND)
})

test('dim text is drawn half way to the background', () => {
  const c = createCanvas(1, 1)
  drawText(c, 0, 0, '#', { color: 0xffffff, dim: true })
  const colours = new Set(c.px)
  assert.ok(colours.has(dimmed(0xffffff)))
  assert.ok(!colours.has(0xffffff))
  assert.equal(dimmed(0xffffff, 0x000000), 0x808080)
})

test('a wide character takes two cells, drawn as a box; a zero-width mark takes none', () => {
  const c = createCanvas(4, 1)
  assert.equal(drawText(c, 0, 0, '漢'), 2)
  assert.equal(drawText(c, 0, 0, '́'), 0)
  assert.equal(drawText(c, 0, 0, 'ab'), 2)
})

test('toRgba scales every pixel', () => {
  const c = createCanvas(1, 1, 0x010203)
  const { width, height, rgba } = toRgba(c, 2)
  assert.equal(width, CELL_W * 2)
  assert.equal(height, CELL_H * 2)
  assert.deepEqual([...rgba.subarray(0, 4)], [1, 2, 3, 255])
})
