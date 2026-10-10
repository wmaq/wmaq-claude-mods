// A grid of pixels, two to a terminal cell (the upper and lower half
// blocks), packed the way a Raster's cells are: little-endian u32 triplets
// [codePoint, foreground, background], base64. A buffer may also carry
// text: a character in a cell, drawn over the cell's upper pixel.
//
// A buffer may have an origin (ox, oy): where a picture's 48 x 14 core has
// its (0, 0) on a wider or taller area. setPixel and fillRect (and so every
// sprite and Clawd) take the core's coordinates and add it; getPixel, the
// text helpers and everything that works on the whole grid use the
// buffer's own.

export const EMPTY = -1
export const TERMINAL_DEFAULT = 0x01000000

export type Point = { x: number; y: number }
// Per terminal cell (a column, two pixel rows), a character's code point
// (0: none) and its colour.
export type TextLayer = { cp: Int32Array; fg: Int32Array }
export type PixelBuffer = { w: number; h: number; px: Int32Array; text?: TextLayer; ox?: number; oy?: number }

export const hex = (s: string): number => parseInt(s.replace('#', ''), 16)

export const createBuffer = (w: number, h: number, ox = 0, oy = 0): PixelBuffer =>
  ox === 0 && oy === 0 ? { w, h, px: new Int32Array(w * h).fill(EMPTY) } : { w, h, px: new Int32Array(w * h).fill(EMPTY), ox, oy }

// The area's edges in the core's coordinates: the first column past its
// right edge (48 on a bare stage), and its top row (0 on a bare stage,
// above the core's top on a taller area).
export const rightOf = (b: PixelBuffer): number => b.w - (b.ox ?? 0)
export const topOf = (b: PixelBuffer): number => 0 - (b.oy ?? 0)

export function setPixel(b: PixelBuffer, x: number, y: number, color: number): void {
  const xi = Math.round(x) + (b.ox ?? 0)
  const yi = Math.round(y) + (b.oy ?? 0)
  if (color === EMPTY || xi < 0 || yi < 0 || xi >= b.w || yi >= b.h) return
  b.px[yi * b.w + xi] = color
}

export function getPixel(b: PixelBuffer, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return EMPTY

  return b.px[y * b.w + x] ?? EMPTY
}

// How many terminal rows a buffer takes.
export const cellRows = (b: PixelBuffer): number => Math.ceil(b.h / 2)

const textOf = (b: PixelBuffer): TextLayer => {
  const n = b.w * cellRows(b)
  b.text ??= { cp: new Int32Array(n), fg: new Int32Array(n) }

  return b.text
}

// The characters a Raster's cell takes for sure. It refuses the whole
// picture for one that isn't a printable width-1 character of the Basic
// Multilingual Plane, so text sticks to a list known to be: printable
// ASCII; Latin-1's signs and letters (not the no-break space or the soft
// hyphen) and Latin Extended-A and -B (Polish ł and ą among them); the
// Greek and Cyrillic letters (no unassigned code points, no combining
// marks); the dashes and quotes, the ellipsis, and the note.
const GLYPH_RANGES: readonly (readonly [number, number])[] = [
  [0x20, 0x7e],
  [0xa1, 0xac],
  [0xae, 0x24f],
  [0x386, 0x386],
  [0x388, 0x38a],
  [0x38c, 0x38c],
  [0x38e, 0x3a1],
  [0x3a3, 0x3ce],
  [0x400, 0x482],
  [0x48a, 0x4ff],
  [0x2010, 0x201f],
  [0x2026, 0x2026],
  [0x266a, 0x266a],
]
export const isRasterGlyph = (cp: number): boolean => GLYPH_RANGES.some(([from, to]) => cp >= from && cp <= to)
const NO_BREAK_SPACE = 0xa0

// Writes text from a cell on, one character a cell, in a colour: each
// character over the cell's upper pixel, which is its background (the
// lower pixel is not drawn). Composed first (NFC: an e and its accent
// become one é); a no-break space is a space; a character the Raster may
// not take (isRasterGlyph) is a ?, one per character (an emoji's two
// halves are one). Cells outside the buffer are dropped.
export function drawText(b: PixelBuffer, col: number, row: number, text: string, color: number): void {
  if (row < 0 || row >= cellRows(b)) return
  const layer = textOf(b)
  let x = col
  for (const ch of composed(text)) {
    const cp = ch.codePointAt(0)!
    const code = cp === NO_BREAK_SPACE ? 0x20 : cp
    if (x >= 0 && x < b.w) {
      layer.cp[row * b.w + x] = isRasterGlyph(code) ? code : 0x3f
      layer.fg[row * b.w + x] = color
    }
    x++
  }
}

// The text composed (NFC), or as it is where the environment can't.
export function composed(text: string): string {
  try {
    return text.normalize('NFC')
  } catch {
    return text
  }
}

// How many cells drawText takes for a text.
export const textCells = (text: string): number => [...composed(text)].length

// The character in a cell, or null.
export function glyphAt(b: PixelBuffer, col: number, row: number): { cp: number; fg: number } | null {
  const i = row * b.w + col
  const cp = b.text?.cp[i] ?? 0

  return cp === 0 || col < 0 || col >= b.w ? null : { cp, fg: b.text!.fg[i]! }
}

// Clears a cell's two pixels and its character.
export function clearCell(b: PixelBuffer, col: number, row: number): void {
  if (col < 0 || col >= b.w || row < 0 || row >= cellRows(b)) return
  b.px[row * 2 * b.w + col] = EMPTY
  if (row * 2 + 1 < b.h) b.px[(row * 2 + 1) * b.w + col] = EMPTY
  if (b.text) b.text.cp[row * b.w + col] = 0
}

export function fillRect(b: PixelBuffer, x: number, y: number, w: number, h: number, color: number): void {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) setPixel(b, x + dx, y + dy, color)
}

const UPPER = 0x2580
const LOWER = 0x2584
const SPACE = 0x20

export function toWords(b: PixelBuffer): Uint32Array {
  const rows = Math.ceil(b.h / 2)
  const words = new Uint32Array(b.w * rows * 3)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < b.w; col++) {
      const top = getPixel(b, col, row * 2)
      const bottom = getPixel(b, col, row * 2 + 1)
      // Written by index: a frame allocates no arrays per cell.
      const i = (row * b.w + col) * 3
      const cp = b.text?.cp[row * b.w + col] ?? 0
      if (cp !== 0) {
        words[i] = cp
        words[i + 1] = b.text!.fg[row * b.w + col]!
        words[i + 2] = top === EMPTY ? TERMINAL_DEFAULT : top
      } else if (top === EMPTY && bottom === EMPTY) {
        words[i] = SPACE
        words[i + 1] = TERMINAL_DEFAULT
        words[i + 2] = TERMINAL_DEFAULT
      } else if (bottom === EMPTY) {
        words[i] = UPPER
        words[i + 1] = top
        words[i + 2] = TERMINAL_DEFAULT
      } else if (top === EMPTY) {
        words[i] = LOWER
        words[i + 1] = bottom
        words[i + 2] = TERMINAL_DEFAULT
      } else {
        words[i] = UPPER
        words[i + 1] = top
        words[i + 2] = bottom
      }
    }
  }

  return words
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// The engine's own Uint8Array.prototype.toBase64 when it has one (the
// plugin environment does: about 40 times faster, little garbage), else
// the loop below; both give the same text.
export function base64(bytes: Uint8Array): string {
  const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64

  return typeof native === 'function' ? native.call(bytes) : base64Loop(bytes)
}

export function base64Loop(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!
    out += b === undefined ? '=' : ALPHABET[(n >> 6) & 63]!
    out += c === undefined ? '=' : ALPHABET[n & 63]!
  }

  return out
}

export const encodeCells = (b: PixelBuffer): string => base64(new Uint8Array(toWords(b).buffer))
