import { expect, test } from 'claude-code/testing'

import { base64, base64Loop, clearCell, createBuffer, drawText, EMPTY, encodeCells, fillRect, getPixel, glyphAt, hex, isRasterGlyph, rightOf, setPixel, TERMINAL_DEFAULT, textCells, topOf, toWords } from './pixels'

const decode = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)

test("a buffer's origin: setPixel and fillRect take the core's coordinates, getPixel the buffer's own", () => {
  const b = createBuffer(80, 18, 10, 4)
  setPixel(b, 0, 0, 1)
  fillRect(b, -10, -4, 1, 1, 2)
  setPixel(b, 70, 0, 3)
  expect(getPixel(b, 10, 4)).toBe(1)
  expect(getPixel(b, 0, 0)).toBe(2)
  expect([...b.px].filter(c => c === 3)).toHaveLength(0)
  expect([rightOf(b), topOf(b)]).toEqual([70, -4])
  const plain = createBuffer(48, 14)
  expect([rightOf(plain), topOf(plain), 'ox' in plain, 'oy' in plain]).toEqual([48, 0, false, false])
})

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

test('text outside the buffer is dropped, and a character the Raster may not take is a question mark', () => {
  const b = createBuffer(2, 4)
  drawText(b, -1, 1, 'x日!', 0xffffff)
  drawText(b, 0, 2, 'nope', 0xffffff)
  expect(glyphAt(b, 0, 1)).toEqual({ cp: 0x3f, fg: 0xffffff })
  expect(glyphAt(b, 1, 1)).toEqual({ cp: 0x21, fg: 0xffffff })
  expect(glyphAt(b, 0, 0)).toBe(null)
  expect(b.text?.cp.filter(cp => cp !== 0).length).toBe(2)
})

test('letters beyond ASCII that take one cell are drawn: accented Latin, Polish, Greek, Cyrillic, dashes, the note', () => {
  for (const ch of ['é', 'ł', 'Ł', 'ą', 'ß', 'Ω', 'Ж', 'ё', '–', '’', '…', '♪']) expect(isRasterGlyph(ch.codePointAt(0)!)).toBe(true)
  // A control, the no-break space, the soft hyphen, an unassigned Greek
  // code point, a Cyrillic combining mark, CJK, a fullwidth letter, an emoji.
  for (const cp of [0x7f, 0x85, 0xa0, 0xad, 0x378, 0x483, 0x65e5, 0xff21, 0x1f3b5]) expect(isRasterGlyph(cp)).toBe(false)
})

test('drawText writes one character a cell, composed first: an e and its accent are one é, an emoji one ?', () => {
  const text = `Łą${String.fromCodePoint(0x1f3b5)}日e${String.fromCharCode(0x301)}!`
  const b = createBuffer(8, 2)
  drawText(b, 0, 0, text, 0xffffff)
  expect([...b.text!.cp.slice(0, 7)]).toEqual([0x141, 0x105, 0x3f, 0x3f, 0xe9, 0x21, 0])
  expect(textCells(text)).toBe(6)
  // A no-break space (common in track names: "Pt. 1") is a space.
  const pt = createBuffer(8, 2)
  drawText(pt, 0, 0, `Pt.${String.fromCharCode(0xa0)}1`, 0xffffff)
  expect([...pt.text!.cp.slice(0, 5)]).toEqual([0x50, 0x74, 0x2e, 0x20, 0x31])
})

test("clearing a cell clears its two pixels and its character", () => {
  const b = createBuffer(2, 2)
  fillRect(b, 0, 0, 2, 2, 0xffffff)
  drawText(b, 0, 0, 'a', 0x000000)
  clearCell(b, 0, 0)
  expect([getPixel(b, 0, 0), getPixel(b, 0, 1), getPixel(b, 1, 0)]).toEqual([EMPTY, EMPTY, 0xffffff])
  expect(glyphAt(b, 0, 0)).toBe(null)
})
