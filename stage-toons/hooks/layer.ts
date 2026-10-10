// The activity layer, drawn over the stage's scene once it is cut to the
// area's width: above Clawd's head, in the area's top four pixel rows (the
// top two terminal rows), a badge for what Claude is doing, its label, and
// a speech bubble. The whole layer is kept inside the area.

import { clearCell, composed, drawText, type PixelBuffer, setPixel, textCells } from './pixels'
import { drawSprite, type Sprite } from './scene'
import { C } from './scenes/kit'
import type { Phase } from './phase'
import { type Layer, PUFFS_S } from './work'

export const BADGE_W = 5
export const BADGE_H = 4
// The terminal rows of the bubble and the label.
const BUBBLE_ROW = 0
const LABEL_ROW = 1

const icon = (palette: Record<string, number>, rows: string[]): Sprite => ({ palette, frames: [rows] })

// Each phase's icon, 5 x 4 pixels, in the scene kit's colours.
export const BADGES: Record<Phase, Sprite> = {
  search: icon({ g: C.gray, b: C.glass, w: C.wood }, ['.gg..', 'gbbg.', '.ggw.', '...ww']),
  read: icon({ w: C.paper, l: C.paperShade, d: C.woodDark }, ['ww.ww', 'wldlw', 'wwdww', '.ddd.']),
  edit: icon({ y: C.gold, r: C.red, g: C.gray }, ['...yr', '..yy.', '.yy..', 'g....']),
  test: icon({ g: C.glass, l: C.liquid }, ['.g.g.', '.glg.', '.glg.', '..g..']),
  build: icon({ d: C.gray, w: C.wood }, ['dddd.', 'dddd.', '.w...', '.w...']),
  git: icon({ G: C.green, l: C.gray }, ['G...G', 'l...l', '.l.l.', '..G..']),
  run: icon({ g: C.green }, ['g....', '.g...', 'g....', '..ggg']),
  web: icon({ b: C.blue, g: C.green }, ['.bgb.', 'bggbb', 'bbbgb', '.bbb.']),
  agents: icon({ b: C.blue, d: C.ink }, ['.bbb.', 'bdbdb', 'bbbbb', 'b.b.b']),
}

// The thought puffs: a dot, a small puff, a cloud, one more each PUFFS_S,
// held a beat with all three, then again.
const PUFFS: [number, number][][] = [
  [[0, 3]],
  [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
  ],
  [
    [3, 0],
    [4, 0],
    [3, 1],
    [4, 1],
  ],
]

function drawPuffs(b: PixelBuffer, x: number, t: number) {
  const shown = Math.min(3, 1 + (Math.floor((t * 1000) / (PUFFS_S * 1000)) % 4))
  PUFFS.slice(0, shown).forEach((puff, i) => {
    for (const [dx, dy] of puff) setPixel(b, x + dx, dy, i === 2 ? C.white : C.paperShade)
  })
}

// Text cut to fit cells, with a ~ for what was cut, counted as drawText
// draws it: composed, a cell a code point.
function fitText(text: string, cells: number): string {
  const chars = [...composed(text)]
  if (cells <= 0) return ''

  return chars.length <= cells ? chars.join('') : `${chars.slice(0, Math.max(0, cells - 1)).join('')}~`
}

// Draws the layer over an area of b.w columns, the hero's head centred at
// column headX (in the area's own columns). The badge's left edge is at
// headX - 2; the label (or the bubble, which takes its place) one cell to
// its right, or the bubble at headX with no badge; all moved left as far as
// it takes to fit. hasTail false leaves out the bubble's tail (pixel row 2),
// for a head that reaches that row.
export function drawLayer(b: PixelBuffer, layer: Layer, headX: number, hasTail = true): void {
  const hasBadge = layer.badge !== null
  const text = layer.bubble ?? layer.what
  const isBubble = layer.bubble !== null
  const badgeCells = hasBadge ? BADGE_W + 1 : 0
  const room = b.w - badgeCells - (isBubble ? 2 : 0)
  const shown = fitText(text, room)
  const shownCells = shown === '' ? 0 : textCells(shown) + (isBubble ? 2 : 0)
  const total = (hasBadge ? BADGE_W : 0) + (shownCells > 0 ? (hasBadge ? 1 : 0) + shownCells : 0)
  let left = Math.round(hasBadge ? headX - 2 : headX)
  left = Math.max(0, Math.min(left, b.w - total))
  if (layer.badge === 'thinking') drawPuffs(b, left, layer.t)
  else if (layer.badge !== null) drawSprite(b, BADGES[layer.badge], 0, left, 0)
  if (shown === '') return
  const at = left + badgeCells
  if (!isBubble) {
    for (let i = 0; i < shownCells; i++) clearCell(b, at + i, LABEL_ROW)
    drawText(b, at, LABEL_ROW, shown, C.paperShade)

    return
  }
  for (let i = 0; i < shownCells; i++) {
    clearCell(b, at + i, BUBBLE_ROW)
    setPixel(b, at + i, BUBBLE_ROW * 2, C.paper)
    setPixel(b, at + i, BUBBLE_ROW * 2 + 1, C.paper)
  }
  drawText(b, at + 1, BUBBLE_ROW, shown, C.ink)
  // The tail, under the bubble's first cell.
  if (hasTail) setPixel(b, at, BUBBLE_ROW * 2 + 2, C.paper)
}
