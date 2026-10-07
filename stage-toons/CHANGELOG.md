# Changelog

What each stage-toons release shipped, newest first. What is still ahead,
and the open leftovers, are in `docs/roadmap.md`. The details of each
release (departures from the spec, review findings, live checks) are in its
spec and plan under `docs/superpowers/`, the hand-offs in `docs/handoffs/`
and the git history.

## 0.13.0 (2026-10-07)

Roadmap phase 6, calm mode (6a) and scene polish (6b, 6c), built by a
cloud session and tested locally, every check passing with no code
changes. Specs and plans:
`docs/superpowers/specs/2026-10-06-stage-toons-calm-mode-design.md`,
`docs/superpowers/plans/2026-10-06-stage-toons-calm-mode.md`,
`docs/superpowers/specs/2026-10-07-stage-toons-scene-polish-design.md`,
`docs/superpowers/plans/2026-10-07-stage-toons-scene-polish-6b.md`,
`docs/superpowers/plans/2026-10-07-stage-toons-scene-polish-6c.md`.
Hand-offs: `docs/handoffs/2026-10-06-stage-toons-calm-mode.md`,
`docs/handoffs/2026-10-07-stage-toons-scene-polish-6b.md`,
`docs/handoffs/2026-10-07-stage-toons-scene-polish-6c.md`; the local
tests: `docs/handoffs/2026-10-07-stage-toons-6a-6b-local-test.md`,
`docs/handoffs/2026-10-07-stage-toons-6c-local-test.md`.
- **Calm mode (6a):** `/stage calm [on | off]` (off by default, also a
  workflow-file setting). Every scene, idle routine and waiting scene
  holds one still, Clawd's eyes open and its idea showing; the area
  changes only when something happens (a turn, a stage move, Fable, a
  helper, the doze), with the dissolve. The pop-ups stay, drawn still.
  The loop sends a frame only on a change; demos move anyway. The frame
  tool's `--calm` and `stills`.
- **Scene polish (6b):** scenes are given their area and spread across
  it; a depth kit of faded, scrolling layers. road-trip in parallax,
  bricklaying's wall across the width with a crane, flashlight's beam
  over a dark storeroom, and a new **rocket** in Done.
- **Scene polish (6c):** writing-desk, sticky-notes, scroll, both
  proofreads, stamp, crash-test, dice and bug-net reworked to use the
  width; two new scenes, the **victory lap** in Done and **bowling** in
  Claude testing (41 in `/stage demo`). A reaction in a narrow toon keeps
  following a walking Clawd.

## 0.12.0 (2026-10-06)

Roadmap phase 4e, a wider canvas, built by a cloud session and tested
locally, all six checks passing. Spec and plan:
`docs/superpowers/specs/2026-10-06-stage-toons-wider-canvas-design.md`,
`docs/superpowers/plans/2026-10-06-stage-toons-wider-canvas.md`.
Hand-off: `docs/handoffs/2026-10-06-stage-toons-wider-canvas.md`.
- **The area grows with the terminal:** as wide as the band, up to 120
  columns by default, and 9 rows high (8 or 7 in a shorter band, with a
  row of hysteresis). `/stage width [<n> | full]` (48 to 512 columns, also
  a workflow-file setting).
- **Every scene keeps its 48-column picture at the left;** its set runs on
  to the edge, or quiet wings of its own stand from column 48. The rows
  above are headroom for the pop-ups and the reactions; Nyan's starfield
  fills the area.
- **The waiting toon seats up to 8 helpers** (one more each 8 columns past
  48), each walking in from the edge it arrived at, so a resize moves
  nobody.
- **From the local test:** the waiting demo's helpers sit at least 3 s
  before they leave (on a full-width area the last one turned round
  mid-walk). Thirteen pictures redrawn at the person's request:
  light-bulbs' chalk maths, thought-clouds' blue-grey sky, stepping-stones'
  mountains with a flag, fishing's jumping fish, scales' brass weights,
  terminal's desk props, workbench's pegboard and robots, waiting-bench's
  clock and "now serving" display, writing-desk's stack on the desk,
  sweeping's full shelf, recycling's sorting bins, mystery-box's closer
  piles, and Nyan on a navy sky, bobbing with the rainbow in a wave.
- The frame tool draws any size (`--columns 48,120,200`, `--rows 7` to 9,
  `band --width`).

## 0.11.0 (2026-10-06)

Roadmap phases 4c and 4d, built by a cloud session overnight and tested
locally together, all nine checks passing. Specs and plans:
`docs/superpowers/specs/2026-10-05-stage-toons-clawd-follows-the-work-design.md`,
`docs/superpowers/plans/2026-10-05-stage-toons-clawd-follows-the-work.md`,
`docs/superpowers/specs/2026-10-06-stage-toons-more-waiting-scenes-design.md`,
`docs/superpowers/plans/2026-10-06-stage-toons-more-waiting-scenes.md`.
Hand-offs: `docs/handoffs/2026-10-06-stage-toons-clawd-follows-the-work.md`,
`docs/handoffs/2026-10-06-stage-toons-more-waiting-scenes.md`, and the
combined checklist `docs/handoffs/2026-10-06-stage-toons-4c-4d-test-checklist.md`.
- **Clawd follows the work (4c):** over the stage's scene, thought puffs
  while Claude thinks, a badge and label for the tool at work, typing
  dots while it answers, and fixed lines at moments (`All green!`,
  `Red tests.`, `Committed!`, `All done!`, `Hi, Fable!`). `/stage
  bubbles [on|off]` (on by default, also a workflow-file setting) and
  `/stage demo work`.
- **The task count on the bar** (`3 of 8 tasks`, with a `✓` when all are
  done). It needs Claude Code's task tools, which newer models get only
  with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` (found in the local test; the
  README says so); checked live in a session started that way.
- **More waiting scenes (4d):** the waiting toon is one of laptops,
  building, rowing and conveyor, dealt from a deck for each wait and kept
  through it. `/stage demo waiting [scene]`.
- The frame tool draws the layer (`scene --mode/--phase/--what/--say`,
  `demo-work`) and the waiting scenes (`waiting --scene/--demo`).

## 0.10.0 (2026-10-06)

Roadmap phase 4b, smoother scenes, built by a cloud session from the
approved spec and plan (`docs/superpowers/specs/2026-10-05-stage-toons-smoother-scenes-design.md`,
`docs/superpowers/plans/2026-10-05-stage-toons-smoother-scenes.md`) and
tested locally, all ten of the hand-off's checks passing. Hand-off:
`docs/handoffs/2026-10-05-stage-toons-smoother-scenes.md`.
- **Z layers:** each actor has a depth, and props can pass behind Clawd
  or in front of him (bug-net's bug, light-bulbs' ideas).
- **A background layer** on its own clock, with a three-layer parallax
  starfield: Nyan flies through it; stargazing and fireworks have its
  far, dim layer.
- **The dissolve:** every change of what the area shows (a turn's start
  and end, a stage move, Fable coming and going, the helpers, the doze,
  a demo's steps) breaks up cell by cell into the new picture over half
  a second. It replaces the wipe between scenes.
- **Scene clocks:** a scene starts from its beginning each time it comes
  on, and the eight scenes that build something up dissolve back to
  their start at the loop point.
- The frame tool draws each sheet on one mod, so it shows the dissolves,
  and has a `turn` command.

## 0.9.0 (2026-10-05)

Roadmap phase 4a, Clawd in one place, built by a cloud session from the
approved spec and plan (`docs/superpowers/specs/2026-10-05-stage-toons-scenes-below-bar-design.md`,
`docs/superpowers/plans/2026-10-05-stage-toons-scenes-below-bar.md`) and
tested locally. Hand-off: `docs/handoffs/2026-10-05-stage-toons-scenes-below-bar.md`.
- **The stage's scene plays in the area below the bar** while Claude
  works, with its wipe, Fable's walk-in and the reactions; the area stays
  mounted through a turn, so the idle Clawd and the scene cut on the same
  Raster. A demo started mid-turn plays over the scene.
- **The spinner is Claude Code's own again:** the toon under it and the
  toons on background agents' rows are gone.
- The frame tool draws the working area (`scene <id>`, `band --working`).
- **Fixed in the local test:** a hot reload could leave the old load's
  paint loop running (a reload cancels only the sleeps pending as it
  lands), and since the area now stays mounted such loops lived on,
  fighting over the picture. Each load writes a `loadId` to `$.state`,
  and a loop stops once it names another load.

## 0.8.0 (2026-10-05)

Roadmap phase 3, "done" after a merge (#17), built by a cloud session from
the approved spec and plan (`docs/superpowers/specs/2026-10-05-stage-toons-done-design.md`,
`docs/superpowers/plans/2026-10-05-stage-toons-done.md`) and tested
locally, the hot reload over a 0.7.0 session included. Hand-off:
`docs/handoffs/2026-10-05-stage-toons-done.md`.
- **Done**, a stage past the track (`/stage done`, `/stage next` from
  the last stage, or a merge rule on `git push … main` or `gh pr merge`
  during Your testing or Cleanup): the whole track lit with a tick,
  confetti, a fireworks scene while Claude works and a celebration while
  idle. It takes no time in `/stage time`; a move back is a reopen that
  keeps the feature, any other move starts a new round. From Done only a
  skill the person types moves the work by itself.
- The workflow file takes a `done` section (`message`, `scenes`,
  `auto`); a file with no rules anywhere gets the default's merge rules.
- **Idle props:** after a forward move, the next idle period shows the
  finished stage's prop once (a page with a tick for a stage of your own);
  a move typed while Claude waits shows it at once.
- The frame tool draws `idle celebrate`, `idle show-off:<id>` and
  `band --idle <routine>`.

## 0.7.0 (2026-10-05)

Roadmap phases 1 and 2, built by a cloud session while the person was
away (designs audited by Fable and approved by Cloudie, double-checked by
Termie) and tested locally. Hand-offs:
`docs/handoffs/2026-10-05-cloud-session-polish-pass.md` and
`docs/handoffs/2026-10-05-cloud-session-hook-wins.md`.
- **The polish pass** (spec `2026-10-04-stage-toons-polish-pass-design`):
  stamp (Clawd on a crate, squatting to stamp), scroll's quill,
  thought-clouds' swell, crash-test's camera in a narrow toon
  (`Scene.focus`), dishes and bricklaying cleared away before their loop;
  the review's nits C7, D2, D5, A1, P8, P9 and the eleven findings
  deferred from 0.6.4.
- **The hook wins** (spec `2026-10-05-stage-toons-hook-wins-design`):
  skills the person types move the stage (#7); a stage's scenes dealt like
  a shuffled deck (#11); `auto` and `hide` in the workflow file and a
  first-run toast (#12); progress saved as a compact v3 record, about half
  the size (P5 b, c; P5 d dropped, the store stays well under its limit);
  dollars and tokens per stage in the history, `/stage log` and `/stage
  time` (#9). Older copies (0.6.2 to 0.6.4) leave a project saved as v3
  alone, read-only.
- From the local test: `/stage help`, a one-line answer to a `/stage` it
  doesn't understand (with the stage you may have meant), `/stage
  workflow reload` naming the settings it applied, and a note that costs
  count from the mod's load.

## 0.6.4 (2026-10-04)

The register split and the frame tool, built by a cloud session from the
person's approved plans and tested locally. Hand-off:
`docs/handoffs/2026-10-04-cloud-session-split-frames.md` (its eleven
deferred minor findings are scheduled in the roadmap's phase 1).
- **`register.tsx` split** (research #23, review D1), a pure refactor:
  `mod.ts`, `frames.ts` and `paint.ts` out of it, the demo set-up into
  `demo.ts`, one `move()`; 1,175 lines to 858. The bar's tones moved to
  `band.ts` as `BAR_TONES`. Spec and plan
  `2026-10-04-stage-toons-register-split`.
- **The frame tool** (research #16, `tools/frames/`, outside the mod):
  renders scenes, the idle Clawd, the waiting toon and the whole band to
  PNG contact sheets, so a cloud session can see what the mod draws. Spec
  and plan `2026-10-04-stage-toons-frame-tool`.

## 0.6.3 (2026-10-04)

From the person's local test of 0.6.2, designed in chat.
- A helper keeps its model's colour through a reload: each spawn leaves
  its agent's kind in the session's state (`agentKinds`, the newest 32).
- A workflow file that lists no rules takes the default's, for the stages
  it shares with the default by id; an `auto` field on any stage keeps the
  file's own rules alone.

## 0.6.2 (2026-10-04)

The code review's fixes (`docs/reviews/2026-10-04-code-review.md`), one
commit each.
- Workflow-file rules can't hang the plugin (S1): risky `bash` regexes are
  refused, rules compile once, input is capped; the history names a
  command by its rule, not its text (S2).
- Fewer store reads (P4); a newer version's progress is never saved over
  (C3); a mid-turn `/stage workflow reload` keeps the turn's time (C2).
- Frames encode with the native base64 (P2); pruning runs after
  registration and keeps at most 50 projects (C5, P5a).
- The idle area sleeps (P1, P3): it paints slower while Clawd dozes and
  holds one still picture five minutes into the doze.
- Each spinner animates its own toon (C1).
- Checked live afterwards, C4: a collapsed band redraws every 4 to 8 s
  until the deep sleep; bounded, left as it is.

## 0.6.1 (2026-10-04)

The research's Tier 0, designed in chat.
- Two sessions on one project no longer lose moves: every change starts
  from the store's copy when another session saved since; working time
  goes to the entry it was spent in.
- Old leftovers fixed: `/stage workflow init` catches a failing
  `fs.exists`; the idle clock only moves forward; `/stage workflow reload`
  says when `set_stage` could not be registered again; an idle teammate
  the list finds after a reload is adopted.
- The band measures text in terminal cells (CJK, emoji).
- Progress of projects untouched for 180 days is pruned, at most weekly.

## 0.6.0 (2026-10-04)

Automatic stage moves and stage history. Spec and plan
`2026-10-04-stage-toons-auto-moves-history`.
- **Rules move the bar:** a stage's `auto` list (`skill`, `write` glob,
  `agent` model family, `bash` regex, with `from`); only the main
  conversation's successful calls and spawns, only forward or into a side
  stage. The default workflow follows the superpowers skills and the Fable
  audits. Claude gets a `[stage-toons]` note; `/stage auto [on | off]`.
- **History:** entries record the feature, `by: auto` and why, and
  Claude's working time; 200 kept. `/stage log [n]` and `/stage time`.

## 0.5.0 (2026-10-04)

The waiting toon. Spec and plan `2026-10-04-stage-toons-waiting-toon`.
- The idle Clawd moves to an area below the bar (48 x 7), shown from 30
  columns.
- While Claude waits on agents, Clawd stands aside with a cup beside a
  desk row of helpers, one per agent at work, coloured by model; four
  seats and a queue.
- `/stage demo waiting`.

## 0.4.2 (2026-10-04)

Claude Code 2.1.289's new agent statuses: an auditor is gone only when the
list shows it ended or no longer shows it.

## 0.4 step 2 (2026-10-04)

Plan `2026-10-03-stage-toons-scene-variety-step2`.
- 12 more scenes, the third of each default stage (treasure-map,
  thought-clouds, scroll, stamp, ladder, scales, workbench, crash-test,
  cake, recycling, bug-net, dice); the library demo plays 37.
- Three more idle routines: coffee, reading, yo-yo.

## 0.4 step 1 (2026-10-03)

Scene variety. Spec `2026-10-03-stage-toons-scene-variety-design`, plan
`...-step1`.
- Stages list 1 to 5 scenes, one picked at random on entry, never the last
  one shown when there is another.
- 12 new scenes, the second of each default stage.
- Idle routines: classic and Nyan Clawd.
- `/stage demo <stage>` and `/stage demo idle`.

## 0.3.1 (2026-10-03)

From the first run on macOS: a side stage reads "Debugging (side stage)"
to the model and `/stage`; the prompt section says to load `set_stage`
with ToolSearch when it is deferred.

## 0.3.0 (2026-10-03)

A scene library and custom workflows. Spec and plan
`2026-10-03-stage-toons-workflows`.
- Named scenes and a new `bug-hunt` scene.
- Workflows as data in `.claude/stage-toons.json`; `/stage workflow`,
  `init` and `reload`.
- Side stages (Debugging, Other); untracked projects read "Not tracked
  yet".
- Scenes stay code: a mod can't load code at runtime (`import()` doesn't
  load), so scenes from outside the mod need a data format.
- Installable from this repository's marketplace.

## 0.2 (2026-10-03)

Designed in chat from the first test.
- The idle Clawd while Claude waits: blinks, glances, taps, dozes.
- `/stage demo [seconds]` and `/stage demo stop`.
- The toon is 7 rows (14 pixels).

## 0.1 (2026-10-03)

The progress bar, `set_stage` and `/stage`, saved progress per project, 12
scenes and 4 reactions, and Fable's arrival while a Fable subagent runs.
Spec and plan `2026-10-02-stage-toons`.
