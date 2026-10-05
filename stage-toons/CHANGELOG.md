# Changelog

What each stage-toons release shipped, newest first. What is still ahead,
and the open leftovers, are in `docs/roadmap.md`. The details of each
release (departures from the spec, review findings, live checks) are in its
spec and plan under `docs/superpowers/`, the hand-offs in `docs/handoffs/`
and the git history.

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
