# frames: stage-toons' drawing as PNG contact sheets

A developer tool, not part of the mod. It renders what stage-toons draws
(a scene under the spinner, the idle Clawd, the waiting toon, the whole
band with its bar) to a PNG of frames sampled over time, so a session that
can't see a terminal (a cloud session) can read the picture and check the
pixel art. It imports the mod's own modules, so what it draws is what the
mod draws.

It needs Node and nothing else (`tsx` runs the TypeScript). It finds the
mod from its own folder, so it runs from anywhere; `--out` and the default
file name are relative to the current folder. From the repository root:

```sh
npx -y tsx tools/frames/cli.ts scene bricklaying
npx -y tsx tools/frames/cli.ts scene dice --reaction advance
npx -y tsx tools/frames/cli.ts scene red-pen --auditing
npx -y tsx tools/frames/cli.ts idle classic
npx -y tsx tools/frames/cli.ts idle classic --doze --from 290000 --every 2000
npx -y tsx tools/frames/cli.ts waiting --agents fable,sonnet,opus,haiku --every 500
npx -y tsx tools/frames/cli.ts band --stage plan --feature "frame tool" --agents fable
```

| Command | Draws |
|---|---|
| `scene <id> [--reaction advance\|failure] [--auditing] [--width N]` | the toon under the spinner (48 columns by default); `--auditing` plays Fable's walk-in over it from time 0 |
| `idle <routine> [--doze]` | the area's idle Clawd, the idle period starting at 0; `--doze` from the doze on (still after 5 minutes) |
| `waiting --agents a,b,… [--columns N]` | the desk row: a helper per agent, coloured by model family (`fable`, `sonnet`, `opus`, `haiku`; anything else grey), arriving from time 0; `--columns` is the area's width (48 by default) |
| `band --stage <id> [--feature F] [--message M] [--columns N] [--max-rows N] [--agents …] [--auditing] [--working] [--workflow file.json]` | the band: the bar's lines (100 columns by default), and under them the idle Clawd, or the waiting toon with `--agents`; `--working` draws the bar alone |

Common options: `--from MS` (0), `--every MS` (250), `--count N` (16),
`--columns-per-row N` (4), `--scale N` (1), `--out file.png` (default
`frames-<what>-<id>.png` here). Each frame is captioned with its time. `--width`, `--columns`, `--scale`
and `--columns-per-row` must be at least 1; `--count` too.

**What it gets right, and what not.** The cells, the colours, the layout,
the widths and every pixel of the art are the mod's own. Text is drawn
with an 8×16 bitmap font, not the terminal's (the person's is Fira Code
Nerd Font Mono), so letterforms differ a little; a character the font
lacks (an emoji, CJK) is a box of its width. The theme is dark:
background `#1E1E1E`, text `#D4D4D4`, dim text half way between.

**Tests:** `npx -y tsx --test "tools/frames/*.test.ts"`.

**The font** is a subset of [unscii-16](http://viznut.fi/unscii/) by
viznut, public domain: ASCII and the bar's characters. `⌕` (U+2315) and
`↩` (U+21A9), which unscii lacks, are drawn by hand in `gen_font.py`. To
add a character, put its code point in `gen_font.py`'s `WANTED` and run
`python3 tools/frames/gen_font.py unscii-16.hex tools/frames/font.ts` with
`unscii-16.hex` downloaded from that page.
