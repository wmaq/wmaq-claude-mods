import { expect, test } from 'claude-code/testing'

import { base64, base64Loop, clearCell, createBuffer, drawText, EMPTY, encodeCells, fillRect, getPixel, glyphAt, hex, setPixel, TERMINAL_DEFAULT, toWords } from './pixels'

const decode = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)

test('two pixels share a cell as half blocks', () => {
  const b = createBuffer(2, 2)
  setPixel(b, 0, 0, 0xff0000)
  setPixel(b, 0, 1, 0x0000ff)
  setPixel(b, 1, 1, 0x00ff00)
  expect([...toWords(b)]).toEqual([0x2580, 0xff0000, 0x0000ff, 0x2584, 0x00ff00, TERMINAL_DEFAULT])
  const top = createBuffer(1, 2)
  setPixel(top, 0, 0, 0x123456)
  expect([...toWords(top)]).toEqual([0x2580, 0x123456, TERMINAL_DEFAULT])
  expect([...toWords(createBuffer(1, 2))]).toEqual([0x20, TERMINAL_DEFAULT, TERMINAL_DEFAULT])
})

test("an odd height leaves the last cell's lower half empty", () => {
  const b = createBuffer(1, 3)
  setPixel(b, 0, 2, 0xabcdef)
  expect([...toWords(b)]).toEqual([0x20, TERMINAL_DEFAULT, TERMINAL_DEFAULT, 0x2580, 0xabcdef, TERMINAL_DEFAULT])
})

test('pixels outside the buffer are dropped, and positions round', () => {
  const b = createBuffer(2, 2)
  setPixel(b, -1, 0, 1)
  setPixel(b, 2, 0, 1)
  setPixel(b, 0, 5, 1)
  setPixel(b, 0.6, 0.4, 0x111111)
  expect(getPixel(b, 1, 0)).toBe(0x111111)
  expect([...b.px].filter(c => c !== EMPTY)).toHaveLength(1)
  expect(getPixel(b, 9, 9)).toBe(EMPTY)
})

test('cells encode as base64 and decode back', () => {
  const b = createBuffer(3, 4)
  fillRect(b, 0, 0, 3, 4, 0xd97757)
  setPixel(b, 1, 3, 0x2a1610)
  expect([...decode(encodeCells(b))]).toEqual([...toWords(b)])
  for (const n of [0, 1, 2, 3, 4, 5]) {
    const bytes = new Uint8Array(n).map((_, i) => (i * 37) % 256)
    expect(base64(bytes)).toBe(btoa(String.fromCharCode(...bytes)))
  }
})

test('hex colors parse', () => {
  expect(hex('#D97757')).toBe(0xd97757)
})

test('the native encoder and the loop give the same text, for every length', () => {
  for (let n = 0; n < 40; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) % 256)
    expect(base64(bytes)).toBe(base64Loop(bytes))
    expect(base64Loop(bytes)).toBe(btoa(String.fromCharCode(...bytes)))
  }
})

test("a cell's character is drawn in its colour over the cell's upper pixel; its lower pixel is not drawn", () => {
  const b = createBuffer(3, 2)
  setPixel(b, 0, 0, 0xf2ead8)
  setPixel(b, 0, 1, 0x123456)
  drawText(b, 0, 0, 'Hi', 0x2a1610)
  expect([...toWords(b)]).toEqual([0x48, 0x2a1610, 0xf2ead8, 0x69, 0x2a1610, TERMINAL_DEFAULT, 0x20, TERMINAL_DEFAULT, TERMINAL_DEFAULT])
})

test('text outside the buffer is dropped, and anything but printable ASCII is a question mark', () => {
  const b = createBuffer(2, 4)
  drawText(b, -1, 1, 'xé!', 0xffffff)
  drawText(b, 0, 2, 'nope', 0xffffff)
  expect(glyphAt(b, 0, 1)).toEqual({ cp: 0x3f, fg: 0xffffff })
  expect(glyphAt(b, 1, 1)).toEqual({ cp: 0x21, fg: 0xffffff })
  expect(glyphAt(b, 0, 0)).toBe(null)
  expect(b.text?.cp.filter(cp => cp !== 0).length).toBe(2)
})

test("clearing a cell clears its two pixels and its character", () => {
  const b = createBuffer(2, 2)
  fillRect(b, 0, 0, 2, 2, 0xffffff)
  drawText(b, 0, 0, 'a', 0x000000)
  clearCell(b, 0, 0)
  expect([getPixel(b, 0, 0), getPixel(b, 0, 1), getPixel(b, 1, 0)]).toEqual([EMPTY, EMPTY, 0xffffff])
  expect(glyphAt(b, 0, 0)).toBe(null)
})
