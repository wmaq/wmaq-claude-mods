// A grid of pixels, two to a terminal cell (the upper and lower half
// blocks), packed the way a Raster's cells are: little-endian u32 triplets
// [codePoint, foreground, background], base64.

export const EMPTY = -1
export const TERMINAL_DEFAULT = 0x01000000

export type Point = { x: number; y: number }
export type PixelBuffer = { w: number; h: number; px: Int32Array }

export const hex = (s: string): number => parseInt(s.replace('#', ''), 16)

export const createBuffer = (w: number, h: number): PixelBuffer => ({ w, h, px: new Int32Array(w * h).fill(EMPTY) })

export function setPixel(b: PixelBuffer, x: number, y: number, color: number): void {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (color === EMPTY || xi < 0 || yi < 0 || xi >= b.w || yi >= b.h) return
  b.px[yi * b.w + xi] = color
}

export function getPixel(b: PixelBuffer, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return EMPTY

  return b.px[y * b.w + x] ?? EMPTY
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
      const i = (row * b.w + col) * 3
      if (top === EMPTY && bottom === EMPTY) words.set([SPACE, TERMINAL_DEFAULT, TERMINAL_DEFAULT], i)
      else if (bottom === EMPTY) words.set([UPPER, top, TERMINAL_DEFAULT], i)
      else if (top === EMPTY) words.set([LOWER, bottom, TERMINAL_DEFAULT], i)
      else words.set([UPPER, top, bottom], i)
    }
  }

  return words
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64(bytes: Uint8Array): string {
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
