"""Writes tools/frames/font.ts: the subset of unscii-16 (public domain,
http://viznut.fi/unscii/) the drawing needs, plus two glyphs drawn here.
Usage: python gen_font.py unscii-16.hex font.ts"""
import sys

# ASCII, and the bar's other characters that unscii has.
WANTED = list(range(0x20, 0x7F)) + [0x00B7, 0x2014, 0x2026, 0x2501, 0x2500, 0x25CF, 0x25C9, 0x25CB]

# Drawn here in the same 8x16 grid (unscii lacks them): one byte a row,
# the high bit the leftmost pixel.
DRAWN = {
    # ⌕ (U+2315), the auditing tag: a loop with a tail to the lower right.
    0x2315: [0x00, 0x00, 0x00, 0x00, 0x38, 0x44, 0x44, 0x44, 0x38, 0x04, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00],
    # ↩ (U+21A9): a hook on the right, an arrow pointing left below it.
    0x21A9: [0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x02, 0x22, 0x7E, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    # ✓ (U+2713), Done's label: a short stroke down, a long one up to the right.
    0x2713: [0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x04, 0x88, 0x50, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00],
}

glyphs = {}
with open(sys.argv[1], encoding='ascii') as f:
    for line in f:
        key, _, bits = line.strip().partition(':')
        cp = int(key, 16)
        if cp in WANTED and len(bits) == 32:
            glyphs[cp] = bits.upper()
missing = [hex(cp) for cp in WANTED if cp not in glyphs]
if missing:
    sys.exit(f'unscii-16 lacks {missing}')
for cp, rows in DRAWN.items():
    glyphs[cp] = ''.join(f'{r:02X}' for r in rows)

lines = [
    '// An 8x16 bitmap font for the frame tool: the subset of unscii-16 (public',
    '// domain, http://viznut.fi/unscii/) the drawing needs, written by',
    "// gen_font.py (see README.md). Each glyph is 16 rows of one byte, the high",
    '// bit the leftmost pixel, as 32 hex digits. U+2315, U+21A9 and U+2713 are',
    '// drawn by hand: unscii lacks them.',
    '',
    'const GLYPHS: Record<number, string> = {',
]
for cp in sorted(glyphs):
    lines.append(f"  0x{cp:04X}: '{glyphs[cp]}',")
lines += [
    '}',
    '',
    'export const GLYPH_W = 8',
    'export const GLYPH_H = 16',
    '',
    "// A glyph's rows, or null when the font lacks it.",
    'export function glyph(codePoint: number): Uint8Array | null {',
    '  const bits = GLYPHS[codePoint]',
    '  if (bits === undefined) return null',
    '  const rows = new Uint8Array(GLYPH_H)',
    '  for (let i = 0; i < GLYPH_H; i++) rows[i] = parseInt(bits.slice(i * 2, i * 2 + 2), 16)',
    '',
    '  return rows',
    '}',
    '',
]
with open(sys.argv[2], 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(lines))
print('font.ts:', len(glyphs), 'glyphs')
