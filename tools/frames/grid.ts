// A terminal as pixels: a grid of cells 8 wide and 16 tall, painted with
// text in the bitmap font and with a Raster's own cells (half blocks), on a
// dark theme. Colours are 0xRRGGBB.

import { TERMINAL_DEFAULT } from '../../stage-toons/hooks/pixels'
import { cellsOf } from '../../stage-toons/hooks/stages'
import { glyph, GLYPH_H, GLYPH_W } from './font'

export const CELL_W = GLYPH_W
export const CELL_H = GLYPH_H
export const BACKGROUND = 0x1e1e1e
export const FOREGROUND = 0xd4d4d4

export type Canvas = { cols: number; rows: number; width: number; height: number; px: Uint32Array }
export type TextStyle = { color?: number; bold?: boolean; dim?: boolean }

export function createCanvas(cols: number, rows: number, background = BACKGROUND): Canvas {
  const width = cols * CELL_W
  const height = rows * CELL_H

  return { cols, rows, width, height, px: new Uint32Array(width * height).fill(background) }
}

export function fillRect(c: Canvas, x: number, y: number, w: number, h: number, color: number) {
  for (let yy = Math.max(0, y); yy < Math.min(c.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(c.width, x + w); xx++) c.px[yy * c.width + xx] = color
  }
}

// Half way between a colour and the background: how dim text shows.
export function dimmed(color: number, background = BACKGROUND): number {
  const mix = (shift: number) => Math.round((((color >> shift) & 0xff) + ((background >> shift) & 0xff)) / 2) << shift

  return mix(16) | mix(8) | mix(0)
}

// Draws text from a cell on, a character per cell (two for a wide one, none
// for a zero-width mark); returns the cells it took. A character the font
// lacks is a hollow box as wide as its cells.
export function drawText(c: Canvas, col: number, row: number, text: string, style: TextStyle = {}): number {
  const base = style.color ?? FOREGROUND
  const color = style.dim ? dimmed(base) : base
  let at = col
  for (const ch of text) {
    const cells = cellsOf(ch)
    if (cells === 0) continue
    const x = at * CELL_W
    const y = row * CELL_H
    const rows = cells === 1 ? glyph(ch.codePointAt(0)!) : null
    if (rows) {
      for (let gy = 0; gy < CELL_H; gy++) {
        for (let gx = 0; gx < CELL_W; gx++) {
          if (!(rows[gy]! & (0x80 >> gx))) continue
          fillRect(c, x + gx, y + gy, 1, 1, color)
          // Bold: the glyph again, a pixel to the right, within the cell.
          if (style.bold && gx + 1 < CELL_W) fillRect(c, x + gx + 1, y + gy, 1, 1, color)
        }
      }
    } else {
      const w = cells * CELL_W
      fillRect(c, x + 1, y + 2, w - 2, 1, color)
      fillRect(c, x + 1, y + CELL_H - 3, w - 2, 1, color)
      fillRect(c, x + 1, y + 2, 1, CELL_H - 4, color)
      fillRect(c, x + w - 2, y + 2, 1, CELL_H - 4, color)
    }
    at += cells
  }

  return at - col
}

const UPPER = 0x2580
const LOWER = 0x2584

// Decodes a Raster's cells (base64 of little-endian u32 triplets
// [codePoint, foreground, background]) as the mod encodes them.
export function decodeCells(cells: string): Uint32Array {
  const bytes = Uint8Array.from(Buffer.from(cells, 'base64'))

  return new Uint32Array(bytes.buffer)
}

// Paints a Raster's cells from a cell on: a half block shows its two
// colours, a space only its background; TERMINAL_DEFAULT is the theme's.
export function drawCells(c: Canvas, col: number, row: number, cells: string, columns: number, rows: number) {
  const words = decodeCells(cells)
  const colour = (v: number) => (v === TERMINAL_DEFAULT ? BACKGROUND : v)
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < columns; k++) {
      const i = (r * columns + k) * 3
      if (i + 2 >= words.length) return
      const cp = words[i]!
      const fg = colour(words[i + 1]!)
      const bg = colour(words[i + 2]!)
      const top = cp === UPPER ? fg : bg
      const bottom = cp === LOWER ? fg : bg
      const x = (col + k) * CELL_W
      const y = (row + r) * CELL_H
      fillRect(c, x, y, CELL_W, CELL_H / 2, top)
      fillRect(c, x, y + CELL_H / 2, CELL_W, CELL_H / 2, bottom)
    }
  }
}

// Copies a canvas onto another at a cell.
export function blitCanvas(to: Canvas, from: Canvas, col: number, row: number) {
  const x0 = col * CELL_W
  const y0 = row * CELL_H
  for (let y = 0; y < from.height; y++) {
    if (y0 + y >= to.height) break
    for (let x = 0; x < from.width; x++) {
      if (x0 + x >= to.width) break
      to.px[(y0 + y) * to.width + x0 + x] = from.px[y * from.width + x]!
    }
  }
}

// The canvas as RGBA bytes, each pixel scale times over.
export function toRgba(c: Canvas, scale = 1): { width: number; height: number; rgba: Uint8Array } {
  const width = c.width * scale
  const height = c.height * scale
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = c.px[Math.floor(y / scale) * c.width + Math.floor(x / scale)]!
      const i = (y * width + x) * 4
      rgba[i] = (v >> 16) & 0xff
      rgba[i + 1] = (v >> 8) & 0xff
      rgba[i + 2] = v & 0xff
      rgba[i + 3] = 0xff
    }
  }

  return { width, height, rgba }
}
