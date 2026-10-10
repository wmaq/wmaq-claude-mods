# stage-toons 0.16.0: full code review (phase 8b)

2026-10-10, branch `stage-toons-8b` at `f8d90aa` (0.16.0 plus the new
`/stage help` guide). Five Fable reviewers, each read-only on the
repository, one area each: the core state and events with the engine's
rules; the drawing and its performance; security and robustness; the
frame tool, the tests and maintainability; and a ponytail audit for
duplication and leanness. The baseline is green: `claude plugin test
stage-toons` 829 pass, 0 fail; `npx tsx --test "tools/frames/*.test.ts"`
54 pass; `validate` and `tsc` clean.

The 0.6.1 review (`2026-10-04-code-review.md`) was checked again: its
P1-P3 (idle loop, encoding garbage, identical blits), C1-C3, S2, S4 and
T1-T6 are fixed. Still open from it: C5 (pruning awaited at session
start, C3 below), P7 (polling for idle teammates, P2 below), S1 (fixed
only in part, S1 below). Parked leftovers in `docs/roadmap.md` were not
re-reported.

## Summary: what to act on

1. **A workflow file's `bash` rule can still hang the session** (S1,
   high). The guard refuses nested repeats (`(a+)*`) but not chains:
   `.*.*.*.*.*.*.*.*.*.*X` passes it and takes 84 s on a 122-character
   `git commit && git push`; 26 `.?` and an `X` take 13.6 s on 30
   characters. A cloned repository can ship one.
2. **Control characters reach the bar, the answers and the system
   prompt** (S2, medium). Labels, messages and `when` lines from the
   file, and `set_stage`'s or `/stage message`'s text, keep ESC, BEL and
   newlines: an OSC 52 clipboard write or a screen clear passes through,
   and a newline throws off the area's row count.
3. **A scene whose hero `at()` or `focus()` throws freezes the area with
   no log** (D1, medium). The broken-scene fallback covers only throws
   inside the scene's drawing. None of the 42 library scenes throws
   (616,056 frames swept), so this guards future scenes.
4. **After `/clear`, Claude may be told the stage from the session's
   first start** (C1, medium-low, plausible). The cached system-prompt
   section is rebuilt after a compaction, not after `/clear`.
5. **The setting commands repeat one shape six times, and their answers
   twice** (L3-L5, M1-M2). `setAuto`, `setBubbles`, `setCalm`,
   `setDjParty`, `setWidth` and the inline hide; `applySettings`' five
   blocks; and the new help's `Now:` lines rebuild what each command
   answers.

---

## 1. Correctness and engine rules

**C1. Medium-low. After `/clear`, the system prompt keeps the stage of
the session's first start.** PLAUSIBLE.
`register.tsx:1033` computes the section once, `prompt.compose`
(`:1253`) returns the cached `sectionAtom`, and only `session.compact`
(`:1267`) refreshes it. The 2.1.296 types say no `session.start` fires
for `/clear`; `session.end` with reason `clear` is how a hook sees it.
So after moves and a `/clear`, the new conversation's section still says
`At session start: <the stage when the process loaded>`. If `$.state`
were wiped at `/clear` instead (not probed), a later move could save a
fresh progress over the project's history. Fix: on `session.end` with
`reason === 'clear'`, rebuild the section as `session.compact` does and
drop `mod.notes`. Probe live first: move, `/clear`, read the section.

**C2. Low. A mid-turn hot reload after a same-stage move counts the time
before the move twice.** PLAUSIBLE (dev-only).
`register.tsx:402-405`: after a reload `workSince` is null and the turn's
credit falls back to `min(durationMs, now - entry.at)`; a message-only
move adds no entry, so the time it already credited is credited again.
Fix: bound the fallback by `Math.max(entry.at, raw.updatedAt)`.

**C3. Low. Pruning is awaited in `session.start`** (0.6.1's C5, still
open). CONFIRMED. `register.tsx:1045`; at most about 50 store reads once
a week, inside the budget. Fix: `void settle($, 'pruning', ...)`.

**E1. Low. Five gating hooks have no `.catch`**, as `validate` notes
(`prompt.submit`, `tool.call`, `command.run`, `session.compact`,
`agent.spawn`). What can still throw there is a `$.state` read or
`$.clock.now()` outside a try, which fails only as the plugin unloads.
Not worth code without a probe showing a prompt or command lost.

Checked and fine: the move queue and credit accounting, Done and reopen,
store versions (v1-v3 read, v3 written, newer read-only), cost and
tokens, subagent and teammate filtering, the closed agent statuses,
every engine rule in CLAUDE.md, the commands' answers.

## 2. Drawing and performance

**D1. Medium. A scene's hero `at()` or `focus()` that throws kills the
paint loop silently.** CONFIRMED by probe.
`frames.ts:46-54` calls `heroOnScreen` before `composeFrame`'s
try/catch; `areaCells` rethrows a `scene:` picture's error
(`frames.ts:309`); the loop's `.catch` (`paint.ts:118`) takes it as an
unload, logs nothing, and each render restarts a loop that dies again.
Fix: in `areaCells`' catch, treat `scene:` and `:work` pictures as the
waiting ones are (mark the base scene broken once, re-pick, rethrow if
the fallback breaks too), and log a thrown frame in the paint loop.

**P1. Low. The DJ box normalises its title once per character, every
frame.** CONFIRMED. `scenes/dj.ts:384-385` calls `textCells` in a loop
condition: about 40 KB and 10 µs a frame at 12 fps. Fix: compute it once.

**P2. Low. The agent list is polled every 2 s while only idle teammates
remain** (0.6.1's P7). CONFIRMED. `paint.ts:55` polls on
`mod.roster.size`, which keeps idle teammates; about 1,800 calls an
hour. Fix: poll on `atWork(mod.roster).length > 0`.

**D2. Low. A resize during the frame's `clock.now()` sends one blit the
engine refuses.** CONFIRMED by reading. `paint.ts:50-59` reads the
site's size before the await. Fix: read it after.

**P3. Info. Four engine calls per frame** (`state.get` for `loadId`,
`clock.now`, `blit`, `clock.sleep`): checking `loadId` once a second
would cut a quarter of them.

### What one frame costs now

Node 22 with a native-like `toBase64`. "Identical" frames are not
blitted.

| Picture (size, rate) | µs/frame | KB/frame | identical | blits |
|---|---|---|---|---|
| Scene, mean of 42 (48×7, 83 ms) | 23.5 | 50 | 40% | ~7/s |
| Scene, mean of 42 (120×9) | 35.5 | 75 | 33% | ~8/s, 17 KB each |
| Scene, mean of 42 (512×9) | 109 | 227 | 30% | ~8/s, 74 KB each |
| Scene, calm (120×9, 500 ms) | 18 | 72 | 99% | 1 per 2 s |
| Idle classic / nyan / yo-yo (120×9) | 18 / 36 / 16 | 62 | 72% / 0% / 17% | 1.7 / 6 / 5 per s |
| Doze (120×9, 333 ms) | 15 | 62 | 0% | 3/s for 4 min, then stops |
| Waiting, 4 helpers (120×9 / 512×9) | 21 / 40 | 53 / 100 | 58% / 6% | 5 / 11 per s |
| DJ, 3 dancers (120×9) | 85-94 | 170 | 0% | 12/s |
| DJ party, working (512×9) | 227 | 557 | 0% | 12/s, 74 KB each |

CPU is negligible: the worst case is 0.3% of a core. The cost that
matters is the host's decode and the terminal's redraw, that is the
blit count.

Checked and fine: 616,056 frames over every scene, routine, waiting
scene and DJ state at 19 widths (29 to 512) and 7 to 9 rows, with no
throw, no fallback and no cell the Raster refuses; a resize
mid-dissolve; uncomposable text; the paint loop's every exit; calm mode.

## 3. Security and robustness

**S1. High. A `bash` rule can hang the session: the guard stops nested
repeats, not chains of them.** CONFIRMED (0.6.1's S1, fixed in part).
`auto.ts:122-144` (`isRiskyPattern`), `auto.ts:28` (`COMMAND_MAX` 500),
run from `register.tsx:1132`. A JS regex can't be interrupted: past the
10 s budget the plugin thread keeps spinning, and every later hook,
render and blit stalls, in every session in that project.

| Rule (passes the guard) | Command | Time |
|---|---|---|
| `.*.*.*.*.*.*.*.*.*.*X` | a 122-character one-liner | 84 s |
| `.*.*.*.*.*.*X` | 72 characters | 10.8 s |
| `.*.*.*X` | 500 characters | 8.6 s |
| `.?` × 26 + `X` | 30 characters | 13.6 s |
| `a*a*a*a*a*a*a*a*a*a*b` | 40 `a`s | 44 s |

Fix: count every quantifier (`*`, `+`, `?`, `{`) outside escapes and
classes, not the `?` of `(?:`, and refuse a rule with more than 4 (the
default `gh pr merge` rule has exactly 4); cut the command to about 100
characters. `write` globs are polynomial on short paths: not a practical
hang.

**S2. Medium. Control characters from the workflow file and from
`set_stage`'s message reach the bar, the answers and the system
prompt.** CONFIRMED at the mod's boundary; the terminal's handling not
watched. `workflow.ts:163-170` (trim and length only), `:217-222`,
`auto.ts:61-64`, `stages.ts:15-19` (`cut` collapses `\s+` only). Fix:
replace `[\u0000-\u001f\u007f-\u009f]` with a space in `cut`, and refuse
them in the file's text fields with the field's path.

**S3. Low. The parser's error list is unbounded.** CONFIRMED.
`workflow.ts:183-198` validates every item past "at most N": a 60 KB
file gives 100,001 errors (2.7 MB) in `/stage workflow reload`'s answer;
a scene name of any length is quoted whole. Fix: return early as
`rulesAt` does, and cut quoted names to about 40 characters.

**S4. Low. More of the file reaches Claude than the README says.**
CONFIRMED. Labels, stage messages and rule sources ride in the
`[stage-toons]` notes (`register.tsx:333-335`, `:915`), up to 160
characters a note; the README names only the `when` lines. Same trust
as CLAUDE.md. Fix: a README clause.

**S5. Low. The first `/stage dj on` of a load can use the whole hook
budget on Linux or macOS.** PLAUSIBLE. `register.tsx:612-644`: `uname`
(2 s), `playerctl --version` (2 s) and the read (4 s) in one 10 s
budget, with store writes. Fix, if wanted: shorten the read by the time
the check took.

Checked and fine: the readers' argv is constant; their output is capped
and parsed defensively; the track stays in memory (no atom, store key or
log line holds it); `__proto__` and unknown keys are errors; the 64 KB
file cap; the store's validation, cuts, history cap and pruning (about
1.5 MB worst case under the 4 MiB cap).

## 4. The frame tool

**F1. Low. In a sheet of mixed widths a narrower frame's edge doesn't
show.** CONFIRMED. `tools/frames/sheet.ts:18` fills each tile with the
area's own background. Fix: fill the tile with `GAP`.

**F2. Low. `stills --columns 48,80` doesn't lay out a row per width** as
the usage says (`cli.ts:304-307` vs `:328`).

**F3. Low. The usage omits `demo-work --workflow`** (`cli.ts:36`).

**F4. Low. Nothing tests the README's "every picture draws as its
golden hash records".** PLAUSIBLE: true by construction today. A
six-line test in `sources.test.ts` would pin it.

Checked and fine: the PNG encoder (CRC, IHDR, IDAT, validated chunk by
chunk), argument parsing and its errors, the README's commands.

## 5. Tests

**T1. Medium. The move queue's failure isolation has no direct test.**
CONFIRMED. `mod.ts:294-299` (`queued`) and `register.tsx:109-114`
(`settle`) run only on happy paths. Fix: one test with a `state.update`
hook that throws once, then two `set_stage` calls.

**T2. Low. `reseat` and `redance` have no unit test.** PLAUSIBLE.
`mod.ts:283-332`; reached only through drawing assertions.

**T3. Low. One wall-clock assertion** (`auto.test.ts:165-167`, 200
regex runs under 2 s): fine today, a risk on a slow CI runner.

Checked and fine: the readers, the store migration, the paint loop
(19 tests), redraw counting, the hot-reload pinning pattern; 829 tests
in 11 s under load, no flaky timing beyond T3.

## 6. Leanness and maintainability (with the ponytail audit, L)

**L1. The same hash function is pasted into 8 scenes**
(`scenes/bricklaying.ts:52`, `flashlight.ts:73`, `proofread.ts:74`,
`scroll.ts:36`, `stamp.ts:47`, `sticky-notes.ts:51`, `victory-lap.ts:58`,
`writing-desk.ts:83`), differing only in the seed. Fix: one `hash(n,
seed)` in `scenes/kit.ts`; the goldens stay the same.

**L2. Test helpers are copied across the register tests**: `text` in 12
files, `lastArea` 4, `FILE` 4 (the mod exports `WORKFLOW_FILE`), and six
more. Fix: move them into `harness.tsx`.

**L3 (M2). Six near-identical setting writers** (`register.tsx:437-471`,
`676-685`, `753-762`, the inline hide at `1220-1231`). Fix: one
top-level `keepSetting($, atom, key, value, redraw)`; check live that
the engine loads an atom passed as a value.

**L4. `applySettings` repeats one block five times**
(`register.tsx:771-833`). Fix: one top-level helper with a parse
function per setting.

**L5 (M1). The help's `Now:` lines and the setting commands build the
same answers** (`helpNow` at `register.tsx:662-672`, and
`1159-1183`, `1220-1230`). Fix: the commands answer through the one
builder.

**L6. The frame tool rebuilds the mod builders `golden.ts` has**
(`tools/frames/sources.ts:67-139` vs `golden.ts:36-69`), with small
differences nobody chose. Fix: import them.

**L7. `short` in `auto.ts:272` is `cut` from `stages.ts`**, copied to
avoid an import cycle. Fix: move `cut` to the cycle-free leaf.

**L8 (M3). Four dead exports**: `scenes/kit.ts` `PAGE` and `BRICK`,
`scenes/wings.ts` `waterOn` (with `RIPPLE_EVERY`), `waiting/conveyor.ts`
`BOX_W`. Delete.

**L9 (T4). Test-only wrappers in the mod**: `autoTarget`, `credit`,
`renderScene`, `idleFrame` (and `getPixel`, `glyphAt`). Delete the first
two; move or mark the rest.

**L10. The band hook works out the demo's line in 18 lines of nested
ternaries** (`register.tsx:1383-1400`). Fix: one `demoLineOf` in
`demo.ts`.

**L11. About 80 exports used only in their own file.** Drop the
`export` keyword where nothing imports them.

**L12. 214 register tests start with the same two lines.** A `boot`
helper in `harness.tsx`, adopted as files are touched.

**L13 (M4). Test files named by plan phase** (`wide-a` to `wide-d`,
`wide-kit`, `wide-sizes`, `scene-polish-6c`; `layers.test.ts` beside
`layer.test.ts` for two unrelated modules). Rename by subject before
the names are public.

**M5. A stale review id in a comment** (`mod.ts:43`, "(P1)").

**M6. `register.tsx` is 1,477 lines**, but its parts are named; the DJ
block (about 230 lines) can't move out while every function takes `$`.
L3-L5 shrink it; nothing more before the release.

The audit's verdict: lean enough to ship; about 210 lines could go
(40 in `register.tsx`, 40 in scenes, 35 in tests, 30 in the frame tool,
25 dead or test-only). Not duplication, by the engine's rules: the
top-level `$` functions and `$.store.set` spelled in each writer.

## How this was verified

Each reviewer traced its findings end to end or reproduced them with
scripts run by `npx tsx` against the mod's own modules (kept in the
session's scratchpad: `review-sec/redos*.ts`, `ctrl.ts`;
`review-draw/bench.ts`, `alloc.ts`, `sweep.ts`, `probe-throw.ts`,
`probe-resize.ts`; `review-lean/exports.txt`), type-checked with a
`noEmit` tsconfig outside the repository, and left the repository
unchanged. Not checked: the terminal's handling of the escapes in S2,
`$.state` across `/clear` (C1), Bun's timings (Node measured; the same
class of regex engine), and 37 of the 45 scene files line by line for
leanness.

## What was done with it

Fixed on `stage-toons-8b`: S1 (at most 4 repeats; each command of a
line read on its own, its first 60 characters: about 0.1 s at worst),
S2, S3, S4, D1, D2, C1, C2, P1, T1, F1-F3, L1, L3-L5 (the atoms stay
where each setter names them: `validate` refuses an atom passed into a
helper), L8, L9, L13, M5. Two fixes were tried and undone, as the tests
showed them wrong: **P2** (an idle teammate that works again raises no
event, so the list must be polled while one is known) and **C3**
(pruning is awaited so its work is done when `session.start` returns;
at most about 50 store reads a week). L7 went to the roadmap: `cut`
can't move into `auto.ts` without an import cycle. The rest of the
smaller items are on the roadmap's open leftovers.
