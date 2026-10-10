// A contact sheet: frames sampled over time, laid out left to right and top
// to bottom, each captioned (with its time, and its width when the sheet
// has several), a one-cell gap of lighter grey between them so each
// frame's edge shows.

import { blitCanvas, type Canvas, createCanvas, drawText } from './grid'

export const GAP = 0x3a3a3a

export function contactSheet(frames: readonly Canvas[], captions: readonly string[], perRow: number): Canvas {
  if (frames.length === 0) throw new Error('a contact sheet needs at least one frame')
  const tileCols = Math.max(...frames.map(f => f.cols))
  // A frame, then its caption's row.
  const tileRows = Math.max(...frames.map(f => f.rows)) + 1
  const across = Math.max(1, Math.min(perRow, frames.length))
  const down = Math.ceil(frames.length / across)
  const sheet = createCanvas(across * (tileCols + 1) + 1, down * (tileRows + 1) + 1, GAP)
  frames.forEach((frame, i) => {
    const col = 1 + (i % across) * (tileCols + 1)
    const row = 1 + Math.floor(i / across) * (tileRows + 1)
    const tile = createCanvas(tileCols, tileRows, GAP)
    blitCanvas(tile, frame, 0, 0)
    drawText(tile, 0, tileRows - 1, captions[i] ?? '', { dim: true })
    blitCanvas(sheet, tile, col, row)
  })

  return sheet
}
