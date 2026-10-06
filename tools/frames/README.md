# frames: stage-toons' drawing as PNG contact sheets

A developer tool, not part of the mod. It renders what stage-toons draws
(a scene as the area plays it while Claude works, with what Claude is doing
over Clawd's head, the idle Clawd, the waiting toon, a turn's start and
end, the work demo, the whole band with its bar) to a PNG of frames sampled over
time, so a session that can't see a terminal (a cloud session) can read
the picture and check the pixel art. It imports the mod's own modules, so
what it draws is what the mod draws.

It needs Node and nothing else (`tsx` runs the TypeScript). It finds the
mod from its own folder, so it runs from anywhere; `--out` and the default
file name are relative to the current folder. From the repository root:

```sh
npx -y tsx tools/frames/cli.ts scene bricklaying
npx -y tsx tools/frames/cli.ts scene fishing --columns 48,80,120,200
npx -y tsx tools/frames/cli.ts scene fishing --columns 48 --rows 7
npx -y tsx tools/frames/cli.ts scene dice --reaction advance
npx -y tsx tools/frames/cli.ts scene red-pen --auditing
npx -y tsx tools/frames/cli.ts scene bricklaying --phase test --what "npm test"
npx -y tsx tools/frames/cli.ts scene dice --mode thinking
npx -y tsx tools/frames/cli.ts scene dice --reaction failure --say "Red tests."
npx -y tsx tools/frames/cli.ts demo-work --stage develop
npx -y tsx tools/frames/cli.ts band --stage plan --tasks 3/8
npx -y tsx tools/frames/cli.ts band --stage plan --columns 200 --width full
npx -y tsx tools/frames/cli.ts idle classic
npx -y tsx tools/frames/cli.ts idle classic --doze --from 290000 --every 2000
npx -y tsx tools/frames/cli.ts waiting --agents fable,sonnet,opus,haiku --every 500
npx -y tsx tools/frames/cli.ts waiting --agents fable,sonnet --scene rowing
npx -y tsx tools/frames/cli.ts waiting --demo --scene conveyor --every 1000 --count 24
npx -y tsx tools/frames/cli.ts band --stage plan --feature "frame tool" --agents fable
npx -y tsx tools/frames/cli.ts idle show-off:spec
npx -y tsx tools/frames/cli.ts band --stage done --feature login --idle celebrate
npx -y tsx tools/frames/cli.ts band --stage develop --working --scene dice
npx -y tsx tools/frames/cli.ts turn --stage develop --idle nyan
npx -y tsx tools/frames/cli.ts turn --scene sweeping --from 4900 --every 83
npx -y tsx tools/frames/cli.ts turn --stage develop --calm
npx -y tsx tools/frames/cli.ts stills scenes --columns 30,48,120
```

| Command | Draws |
|---|---|
| `scene <id> [--reaction advance\|failure] [--auditing] [--mode thinking\|responding] [--phase <phase>] [--what text] [--say line]` | the area while Claude works with that scene (`--width` is another name for `--columns`); `--auditing` plays Fable's walk-in over it from time 0. The rest draw the layer over Clawd's head from time 0, held for the sheet: `--mode` the thought puffs or the typing dots, `--phase` a tool's icon (`search`, `read`, `edit`, `test`, `build`, `git`, `run`, `web`, `agents`) with `--what` its label, `--say` a line in a bubble |
| `idle <routine> [--doze]` | the area's idle Clawd, the idle period starting at 0; `--doze` from the doze on (still after 5 minutes). Besides the five routines: `celebrate` (Done's), and `show-off:<stage id>`, the prop of that stage (any id: one of your own gets the page with a tick) |
| `waiting --agents a,b,… [--scene id]` | the waiting toon: a helper per agent, coloured by model family (`fable`, `sonnet`, `opus`, `haiku`; anything else grey), arriving from time 0, at the waiting scene `--scene` names (`laptops`, the default, `building`, `rowing` or `conveyor`) |
| `waiting --demo [--scene id]` | the script `/stage demo waiting` plays (helpers arriving, one waiting for a seat, all leaving, Clawd back), from time 0, at the scene `--scene` names |
| `band --stage <id> [--feature F] [--message M] [--columns N] [--max-rows N] [--width N\|full] [--agents …] [--auditing] [--working] [--scene id] [--workflow file.json] [--idle routine] [--tasks done/total]` | the band: the bar's lines (`--columns`, the band's width, 100 by default; `--tasks 3/8` adds Claude's task count), and under them, sized as the band's hook sizes the area (`--width` is `/stage width`'s setting, 120 by default; `--max-rows` the band's rows, the bar's lines and 9 by default), the idle Clawd (`--idle`'s routine, classic by default), or the waiting toon with `--agents` (always the laptops; `waiting --scene` draws the others); `--working` draws the stage's scene instead (its first, or `--scene`'s; `--auditing` walks Fable in from time 0), and ignores `--agents` and `--idle` |
| `turn [--stage id] [--scene id] [--idle routine] [--start MS] [--end MS]` | the area through one turn: the idle Clawd (classic, or `--idle`'s) until `--start` (1000), the stage's scene (the stage's first, or `--scene`) until `--end` (5000), then the idle Clawd again, both edges dissolving (`--start 0` skips the idle Clawd before). Its own defaults are `--every 500 --count 16`; a closer look at an edge takes `--from` and `--every 83` |
| `demo-work [--stage id] [--scene id] [--seconds N] [--workflow file.json]` | `/stage demo work`: the layer's 14 steps over the stage's scene (its first, or `--scene`'s), `--seconds` each (3); its own defaults sample the middle of each step |
| `stills scenes\|idle\|waiting` | calm mode's still of every picture of that kind, one frame each, captioned with its id: every scene; the routines, Done's celebration, each default stage's show-off and the doze; the four waiting scenes with four helpers seated. It takes `--columns` (a list too), `--rows`, `--columns-per-row`, `--scale` and `--out` |

`--calm` draws `scene`, `idle`, `waiting`, `band` and `turn` with calm
mode on: a sheet then shows the same frame over time but for a change
(`turn --calm` dissolves from the idle still to the scene's and back).
`waiting --demo` refuses it, as the demos move by design.

**The area's size.** Every command but `band` draws the area at
`--columns N` (its width, 120 by default, up to 512) and `--rows N` (7,
8 or 9; 9 by default): the size the band gives it on a terminal with
room. `--columns` takes a list (`--columns 48,80,120,200`): the sheet
then has a row of frames per width, each width's frames at the same
moments (4 of them unless `--count` says), to check a picture's wide set
in one look. At `--columns 48 --rows 7` every picture draws as 0.11.0
drew it.

Common options: `--from MS` (0), `--every MS` (250), `--count N` (16),
`--columns-per-row N` (4, or 2 when the frames are wider than 64
columns; with a `--columns` list, the count), `--scale N` (1), `--out
file.png` (default `frames-<what>-<id>.png` here, a `:` or `*` in the id
made `-`). Each frame is captioned with its time (and its width, with a
list). A sheet's frames are drawn
in time order on one mod, as the paint loop draws them, so a dissolve
starts at the first sample after a change: sheets of fades want `--every
100` or less, and `scene` with `--from` near a loop point shows the
seam's fade. `--columns`, `--scale` and `--columns-per-row` must be at
least 1; `--count` too.

**What it gets right, and what not.** The cells, the colours, the layout,
the widths and every pixel of the art are the mod's own. Text is drawn
with an 8×16 bitmap font, not the terminal's (the person's is Fira Code
Nerd Font Mono), so letterforms differ a little; a character the font
lacks (an emoji, CJK) is a box of its width. The theme is dark:
background `#1E1E1E`, text `#D4D4D4`, dim text half way between.

**Tests:** `npx -y tsx --test "tools/frames/*.test.ts"`.

**The font** is a subset of [unscii-16](http://viznut.fi/unscii/) by
viznut, public domain: ASCII and the bar's characters. `⌕` (U+2315),
`↩` (U+21A9) and `✓` (U+2713), which unscii lacks, are drawn by hand in
`gen_font.py`. To
add a character, put its code point in `gen_font.py`'s `WANTED` and run
`python3 tools/frames/gen_font.py unscii-16.hex tools/frames/font.ts` with
`unscii-16.hex` downloaded from that page.
