# Roadmap

What is ahead, per mod. What each release shipped is in the mod's
`CHANGELOG.md`; when work is finished, its entry moves there (CLAUDE.md,
the workflow's step 10).

## stage-toons

### Where things stand

0.15.0 is on `main`: automatic moves and history with cost per stage, 41
scenes dealt like a deck and played in the area below the bar with Z
layers and a dissolve at every change of picture, an area that grows with
the terminal (`/stage width`) with scenes that spread their action across
it, calm mode (`/stage calm`), Clawd DJ while Spotify plays on Windows, macOS and Linux (`/stage dj`), Clawd's pop-ups for the work at hand and a
task count on the bar, four waiting scenes seating up to 8 helpers, 5 idle
routines with a prop show-off and a celebration, Done after a merge,
per-project settings, and the frame tool (`tools/frames/`) for checking
the drawing from a cloud session. Phases 1 to 4, 6 and 7 of the plan below
are done, and 8a's first half (Clawd DJ on macOS and Linux); what is left
is the pre-release (8a's leftovers, then 8b) and the release (9). History: `stage-toons/CHANGELOG.md`. Sources for what comes next:
the research report
(`docs/research/2026-10-04-stage-toons-improvement-ideas.md`, ideas
#1-#30) and the code review (`docs/reviews/2026-10-04-code-review.md`).

### Open leftovers, not scheduled

Minor findings accepted as they are; pick them up when work passes by.
Phase 8a fixes the ones still worth fixing. Leftovers the plan
schedules are listed in their phase instead.
- **Waiting toon (0.5):** with the waiting toon broken (it threw), the idle
  routine stands in and can doze while agents still work. `/stage demo
  waiting` started during a real waiting period ends with Clawd at x 0
  beside the seated helpers, with no fresh walk aside; `/stage hide`
  during the walk back restarts the idle clock at the hide. The demo's
  script has no queue (the picture is the same).
- **Two sessions (0.6.1):** between reading the store and saving, a few
  awaits apart, two sessions can still race (one credit or one entry
  lost); closing it would need history merged by time.
- **Agent kinds (0.6.3):** `rememberKind`'s cap follows object key order,
  so an all-digit agent id would be dropped first (only past 32 spawns);
  its "same object for unknown" shortcut is never taken; a failing state
  read skips that roster refresh until the next poll; an id equal to an
  `Object.prototype` name would misread (agent ids are hex).
- **Review (0.6.2):** P7 (a slower poll for idle teammates) was declined,
  since the poll is what brings an idle teammate's helper back.
- **Polish pass (phase 1):** in a toon under 48 columns, a reaction that
  ends while crash-test's camera is on the wall cuts the crop back to the
  wall in one frame (the hold could stay until the camera is home); stamp
  shows its last page unstamped for one frame at exactly loop time 0
  (older than the pass); in an area under about 40 columns the third and
  fourth helpers at the desk row are cut off at the right (since 0.5).
- **Hook wins (phase 2):** `/stage workflow reload` with a file that sets
  nothing re-reads the person's settings from the store, so a `/stage auto
  off` or `/stage hide` whose save failed (silently) is undone. Subagent
  tokens are summed in the mod, not `$.state`: a hot reload mid-turn loses
  them, and those of background agents ending in an untracked turn are
  dropped.
- **Done (phase 3):** the push rule also matches `git push origin main
  --dry-run` and `git push origin :main` (Done comes early; `/stage
  back` undoes it). After a typed skill moves the work out of Done, the
  note to Claude doesn't ask for the new feature's name, so the bar reads
  "no feature" until `set_stage` names one. `/stage demo idle` gives
  each prop 2 s, too short for the turn-over and the glance. The README
  doesn't say that a `master` or `trunk` default branch needs its own
  `done` rule (or `/stage done`). From Done, typing a skill for a track
  stage earlier than the one Done came from starts a new round (clearing
  the feature); it could count as a reopen.
- **Clawd in one place (4a):** a band collapsed while Claude works
  restarts the paint loop about every 2 s, each restart asking for the
  agent list and spending 24 refused blits (a cost only). A fullscreen
  band of exactly the bar plus 7 rows might lose the area at each turn's
  start, if the spinner's line comes out of the band's space (read from
  the code; Windows Terminal never got that short, so never seen; one row
  of hysteresis would fix it; no hysteresis can keep 7 rows in 6, but since
4e a band of the bar plus 8 or more keeps an area through the spinner's
line). `toon.ts`, `TOON_ROWS` and `TOON_MIN` keep
  the toon's name. A hot reload starts the desk's seat log over, so seated
  helpers walk in again.
- **A wider canvas (4e):** no test holds Fable's stride rule on a fast
  walk (her feet by time, not distance, past today's speed; checked on
  sheets). Some group-D wings use literal columns (50, 51, 52) where the
  others use `WINGS_X + n` (`scenes/wings.ts`). Fireworks' decorative
  rocket just past the edge of an 80-column area spills a few spark pixels
  into it. Dominoes' cheer reads a chain end its backdrop notes for the
  frame (`chainEnd`), right only inside a render.
- **Smoother scenes (4b):** a waiting demo whose toon throws (`/stage
  demo waiting`) is not caught; only the real waiting toon falls back to
  the idle routine. A paint loop that gives up on refused blits clears
  the band's `requestId` without waiting, so a render landing in that
  instant has its new `requestId` cleared until the redraw it asked for.
- **Clawd follows the work (4c):** a background agent's spinner could
  count as the main one for a moment (the agent joins the roster only
  after its `tool.call` returns), showing its puffs or dots on Clawd; not
  seen in the local test with three agents twice. The frame tool's
  `--what` takes the label as given, so its sheets don't show the
  git-options trimming (the kit tests do). The `#3` and numeric-id
  fallbacks in `tasks.ts` are dead weight now that the result shapes are
  known. Stamp's and the ladder's high-head rule were checked on sheets
  only (fishing live).
- **Calm mode and scene polish (phase 6):** props raised above Clawd's
  head (proofread's lifted page, bug-net's hoop, crash-test's meter top,
  the trophy) share the pop-ups' rows, so a bubble or badge can draw over
  them; stamp on 8 rows leaves its two headroom rows bare; recycling and
  test-tubes (not reworked) cut up to 5 columns of Clawd at 30 to 36
  columns. In calm mode on 7 rows, fishing, stamp and waiting-bench have
  no still with Clawd's head clear of the pop-ups. On a light terminal
  theme the scenes read but look odd; the person wants no tuning unless
  someone raises it once the mod is public.
- **Clawd DJ (phase 7, the final review's minors):** a read in flight
  when `/stage dj off` is typed lands after it (`mod.music` stale until
  the next `on`'s read); the box's scroll counts uncomposed code points
  (normalise in `parseNowPlaying`); `layer.ts` measures labels by
  `.length` while `drawText` draws code points; the poll's 30 s sleep
  isn't woken when the area shows again; dancers walk in over the far
  speaker on a wide room; `/stage demo dj` with the DJ picture broken
  answers "Playing" and ends at once; `hearSkill`'s local `heard`
  shadows `nowplaying`'s. After a hot reload with music playing, the
  area dissolves to the usual picture and back within the first read.
- **Clawd DJ everywhere (8a, the final review's minors):** after a
  `uname` that timed out, `/stage dj on` tells a person in a macOS
  terminal that DJ mode "needs a terminal on Windows, macOS or Linux"
  (a retry fixes it); a read in flight after `/stage dj off` rewrites
  `djProblem`, `music` and `hasDjRead` (harmless: the answers and the
  picture look at `isDj`); `DJ_NEEDS_PLAYERCTL` and the README don't say
  to type `/stage dj on` again once playerctl is installed; no test of
  `/stage dj off` while a check or read runs, and `register-dj` compares
  the Windows argv's first four elements only; `Outcome` and
  `ReadFailure` could move from `nowplaying.ts` to `readers.ts`.

### The plan after the frame tool (agreed 2026-10-04, reordered 2026-10-06)

Agreed with the person in a roadmap discussion that went through the
release history, the research and the code review, and reordered by them
on 2026-10-06 once phase 4 was merged. Item numbers (#n) are the research
report's; letter codes (C7, P5, ...) are the code review's. stage-toons
stays the only mod for now; the repository is ready for more.

Decided in the discussions:
- **#8 (keep the stage through compaction) is done.** The `session.compact`
  hook rebuilds the stage section of the system prompt after every real
  compaction (since v0.3), so the stage survives one.
- **"Done after a merge" and "idle variants by the last finished step" are
  one feature** (#17), as the research has it.
- **Art is no longer terminal-only.** With the frame tool (0.6.4), a cloud
  session checks scenes and the band from contact sheets; the person's
  terminal gives the final look. The research's "Terminal" labels predate
  it.
- **After phase 4 (2026-10-06): extending first, release last.** Scene
  authoring, presets and a public stage contract come first, so new
  scenes and other mods are easy to add; then calm mode and scene polish,
  then Clawd DJ; a full review, cleanup and community readiness close the
  plan, and then a release. Everything else is parked.
- **To the release (2026-10-08).** Phase 5 (scene authoring, presets and
  the stage contract) moved to parked. Two phases are left: a pre-release
  in two parts (the leftovers and Clawd DJ on macOS and Linux, then a full
  code review and its fixes) and the release.

The phases run in order; each feature takes the full workflow, spec and
plan included. (Phases 1 and 2, the polish pass and the hook wins, shipped
in 0.7.0; phase 3, "done" after a merge, in 0.8.0; 4a, Clawd in one
place, in 0.9.0; 4b, smoother scenes, in 0.10.0; 4c, Clawd follows the
work, and 4d, more waiting scenes, together in 0.11.0; 4e, a wider
canvas (#25), in 0.12.0, which finished phase 4, richer art; phase 6,
calm mode (#10) and scene polish, in 0.13.0, ahead of phase 5 as
reordered; phase 7, Clawd DJ, in 0.14.0; 8a's first half, Clawd DJ on
macOS and Linux, in 0.15.0.)

**Phase 8: pre-release.**
- **8a, the leftovers** (Clawd DJ on macOS and Linux, its first half,
  shipped in 0.15.0): fix the open leftovers above that are still worth
  fixing (Clawd DJ's final-review minors included, both rounds).
- **8b, a full code review** of the mod and the frame tool (correctness,
  performance, security), and fixes for what it finds.
- **8b, `/stage help` as a guide to the mod** (the person, 2026-10-08):
  today it lists the commands only; it should also sum up every feature
  in Claude Code (the bar and its automatic moves, the scenes, Clawd's
  pop-ups, the waiting toon, the idle Clawd, Done, calm mode, the width,
  Clawd DJ, the history and the cost per stage), each with the commands
  that go with it.

**Phase 9: the release.**
- Clawd DJ on Linux, probed: the person runs `docs/ideas/clawd-dj-probe-linux/`
  on a Linux desktop (the cases in its header), and the readers'
  "No player" match and the README's "untested" follow what it shows.
- Documentation cleanup (CLAUDE.md, the CHANGELOG, `docs/`) and a
  README cleanup.
- A "not affiliated with Anthropic" line.
- A GIF for the README: the frame tool writing GIFs, or a screen
  recording.
- The CHANGELOG made ready for readers (`stage-toons/CHANGELOG.md` has
  every release since 0.1) and linked from the README.
- Maybe CI, after a probe: the frame tool's tests need only Node, so they
  can run on GitHub Actions as they are; whether `claude plugin validate`
  and `claude plugin test` run there (Claude Code installed on the runner,
  with or without a sign-in) is unknown.
- Release tags.
- The release.

**Parked** (the person, 2026-10-06 and 2026-10-08: not in the plan for
now):
- **Scene authoring** (#26; phase 5 until 2026-10-08): a data format for
  scenes (sprites and keyframed actors), a sandboxed interpreter, `/stage
  preview <scene>`, a validation harness and a skill that teaches an agent
  to make one. Large: claude-toons needed about 3,000 lines for this.
- **Workflow presets** (#18; parked 2026-10-06, Claude Code first): a
  workflow file that builds on a preset. Agreed before it was parked:
  `"extends": "<preset>"`, and `track` and `side` as lists in which a bare
  id keeps the preset's stage, an object with a preset id changes only the
  fields it gives, a new id adds a whole stage, and a stage left out is
  dropped. The spec-kit and Kiro presets are dropped.
- **A public stage contract** (#30; parked with #18): document the
  `PluginState` keys other mods can read; a `$.stage` noun or a
  `stage-toons:auditor` agent type later, if needed. A probe on 2.1.292
  showed it works today: a mod whose `plugin.json` lists `"dependencies":
  ["stage-toons"]` gets stage-toons' contract laid into its types and
  reads `progress` and `scene` with `$.state.get` (writes stay the
  owner's).
- Achievements for finished stages (#28); a timeline pane for `/stage log`
  and `/stage time` (#19; whether the app places plugin panes for a cloud
  session is unconfirmed); the Svg rendition (#24) for the desktop app
  (the only element known to reach it; needs the person's devices to
  check first), VS Code and mobile; #13 (un-defer `set_stage`: tokens on
  every request for one tool); #14 (a status line; off by default if ever
  built).
- From Clawd DJ's design (2026-10-07, the person): more players than
  Spotify (Windows' current media session, or a setting); Japanese,
  Chinese and Korean titles (wide characters) in the now-playing box; a
  `$.process.spawn` watcher in place of the poll (needs a probe of its
  life across a hot reload and `/clear`); following the song's tempo (the
  media session gives none: it would take audio analysis outside the
  mod's sandbox).

**Dropped:** #29 (pet or drag Clawd with the pointer; the person,
2026-10-05: not worth it in a terminal). **Ruled out** by the research:
sound (`$.audio` plays only on macOS), model-written scenes or summaries
(token cost; breaks the no-model-requests promise), `turn.step`
streaming, the kitty image protocol.
