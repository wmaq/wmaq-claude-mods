# Roadmap

## stage-toons

### v0.1 (2026-10-03, merged)

The progress bar, `set_stage` and `/stage`, saved progress per project, the
12 scenes and 4 reactions, and Fable's arrival while a Fable subagent runs.
Spec: `docs/superpowers/specs/2026-10-02-stage-toons-design.md`. Plan:
`docs/superpowers/plans/2026-10-02-stage-toons.md`.

### v0.2 (2026-10-03, merged)

Designed in chat (no spec or plan), from the user's testing of v0.1 and the
reviews' leftovers:
- **Idle Clawd** left of the bar while Claude waits: blinks, glances at the
  prompt and the bar, taps a foot, dozes after a minute with a rising z.
  The band takes 5 rows (a blank one above him); terminal only, 70 columns
  and 5 rows at least.
- **`/stage demo [seconds]`** plays the 12 scenes below the bar (9 rows);
  `/stage demo stop` or a new prompt ends it.
- **The toon is 7 rows (14 pixels)**, every scene moved down 2 pixels; the
  Other scene has one `?`, centred and whole, and the auditor's is whole.
- **Director:** a wipe ends with Fable's walk-in; a second stage change
  mid-wipe keeps wiping the first scene out; the edge transitions Fable
  listed are tested.
- **v0.1's minors:** text cut by code points; the store warning kept in
  `$.state` across a reload; non-finite timestamps refused; `set_stage`'s
  description says a subagent's call is refused.

Left as they are (from Fable's v0.2 review):
- During the demo's 300 ms wipe the outgoing scene is drawn at its own
  start, a small jump back: `composeFrame` takes one clock for both scenes.
- Text is measured in code points, not terminal cells: a wide emoji takes
  two columns, and `truncate-end` cuts what overflows.

### v0.3 (2026-10-03, merged)

A scene library and custom workflows. Spec:
`docs/superpowers/specs/2026-10-03-stage-toons-workflows-design.md`. Plan:
`docs/superpowers/plans/2026-10-03-stage-toons-workflows.md`.
- **Scene library.** Scenes have their own names (`bricklaying`,
  `road-trip`, ...) and stages pick one; a new `bug-hunt` scene.
  `/stage demo` plays all 13.
- **Workflows as data.** A project's `.claude/stage-toons.json` defines its
  track and side stages; `/stage workflow`, `init` and `reload`. The tool
  schema, the system-prompt section, the bar, `/stage` and saved progress
  follow the workflow. Mistakes are listed with their path; the session
  always keeps a working workflow.
- **Side stages.** Debugging joins Other beside the track; on a side stage
  the bar hides the dots and shows the stage the work returns to.
- **Untracked.** A fresh project reads "Not tracked yet"; saved progress
  is v2, fitted in memory to a changed workflow and never rewritten by it.
- **Scenes stay code, written by us.** A mod can't load code at runtime
  (`import()` doesn't load); scenes from outside the mod would need a data
  format (deferred, below).

Checked live: the session's workflow (in `$.state`) survives `/clear`; the
file is read again only by `/stage workflow reload` or a new session.
`/stage workflow init` makes the file it writes the session's source when
the session was on the default.

Left as they are (from Fable's v0.3 review):
- `/stage workflow init` doesn't catch a `$.fs.exists` rejection (the API
  says only a network location rejects).
- If `set_stage` fails to register again on reload, the answer still says
  the workflow switched (stale ids are still refused at call time).
- A v0.2 and a v0.3 session on one project disagree on progress v1/v2
  until both run v0.3.

**Installable (2026-10-03).** The repository is a plugin marketplace
(`.claude-plugin/marketplace.json`): `claude plugin marketplace add
wmaq/claude-mods`, then `claude plugin install stage-toons@claude-mods`.
A probe showed hooks modules load from an installed plugin like from a
`--plugin-dir`. The mod's version (`plugin.json`, 0.3.0) goes up with every
release.

**0.3.1 (2026-10-03)**, from Claude's first run on macOS: a side stage reads
"Debugging (side stage)" to the model and `/stage`, and plain "Debugging"
on the bar ("?" read as unknown); the prompt section says to load
`set_stage` with ToolSearch when it is a deferred tool.

### v0.4 step 1 (2026-10-03, merged)

Scene variety. Spec:
`docs/superpowers/specs/2026-10-03-stage-toons-scene-variety-design.md`.
Plan: `docs/superpowers/plans/2026-10-03-stage-toons-scene-variety-step1.md`.
- **Stages list scenes.** `"scenes": [...]`, 1 to 5 per stage (the old
  `"scene"` still reads); one is picked at random when the work enters the
  stage, never the one it showed last when it has another.
- **12 new scenes**, each the second scene of a default stage: stargazing,
  sticky-notes, blueprint, red-pen, dominoes, clipboard, terminal,
  control-panel, waiting-bench, dishes, flashlight, fishing.
- **The idle box is 26 columns** (shown from 78) with two routines, classic
  and Nyan Clawd, one picked each time a turn starts; all doze after a
  minute.
- **`/stage demo <stage>` and `/stage demo idle`** play one stage's scenes
  or the idle routines; the library demo plays 25 scenes.

- **Nyan's stars** are single twinkling pixels on the rows the rainbow
  leaves free, not the spec's plus shapes: the 26 x 8 box has no room.

Left as they are (from the reviews):
- Going untracked and back to the same stage shows the same scene again
  (the pick keeps the last tracked stage; spec-literal).
- Some scenes reset visibly at the loop point (the dishes stacks), as
  bricklaying's wall does.

Possibly later: sharing stage-toons with the community, the way
claude-toons was shared.

### v0.4 step 2 (2026-10-04, merged)

Plan: `docs/superpowers/plans/2026-10-03-stage-toons-scene-variety-step2.md`.
- **12 more scenes**, each the third scene of a default stage:
  treasure-map, thought-clouds, scroll, stamp, ladder, scales, workbench,
  crash-test, cake, recycling, bug-net, dice. The library demo plays 37.
- **Three more idle routines**: coffee, reading and yo-yo, picked with
  classic and Nyan.
- A `line` helper in the scenes' kit.
- **Approved changes to the spec's concepts**: the cake is picked back up
  and carried off, so the loop needs no jump; the bug-net bug stays caught
  in the net as the next bug flies in; the dice always land on a double six.

Left as they are (from Fable's final review, minor; the user's live test
passed):
- Below 54 terminal columns crash-test's wall and bang are cropped out
  (its focus keeps Clawd in view), so the cart seems to bounce off the edge.
- In stamp, the desk top sits on Clawd's foot row (his feet draw through
  it) and the raised stamp floats a row above his claw.
- Thought-clouds' big cloud pops to a small puff in one frame instead of
  thinning away.
- Scroll's quill tip sits a column or two right of the claw.

### 0.4.2 (2026-10-04)

From reviewing Claude Code 2.1.289's changelog: `$.agent.list()` now
reports `pending`, `waiting` and `idle` beside `running`, and the auditor
check took anything but `running` as finished, so Fable could leave the
stage while still auditing. An auditor is now gone only when the list shows
it ended (`completed`, `failed`, `killed`) or no longer shows it.

### v0.5 (2026-10-04, merged)

The waiting toon. Spec:
`docs/superpowers/specs/2026-10-04-stage-toons-waiting-toon-design.md`.
Plan: `docs/superpowers/plans/2026-10-04-stage-toons-waiting-toon.md`.
- **The area below the bar.** The idle Clawd moves from beside the bar to
  an area below it, 48 x 7 like the demo; the bar keeps its full width and
  the idle Clawd shows from 30 columns (it needed 78). It needs 8 or 9 rows
  of band (5 before).
- **The waiting toon.** While Claude waits on agents, Clawd stands aside
  with a cup beside a desk row of helpers, one per agent at work (pending,
  running or waiting), coloured by model; four seats and a queue. Agents
  are tracked by `agent.spawn`, their own `turn.complete`, and a 2 s poll
  of `$.agent.list()` while the area shows.
- **`/stage demo waiting`** plays it with pretend agents.

Built by drafting all of it in a scratch copy of the mod first (254 tests
green there), then a plan that embeds that code, audited by Fable by
applying every task to fresh copies. Checked live with three background
agents (Sonnet, Haiku, Fable) and the demos; the user's test passed.

Departures from the spec, approved: the list may lag the events by 3 s
both ways (`LIST_LAG_MS`); idle teammates stay in the roster, ended agents
leave it; a 2 x 2 cup instead of the coffee mug; Clawd glances along the
row instead of swaying; the area checks the agent list before its first
frame whatever the roster holds.

Left as they are (from Fable's final review, minor):
- The idle clock can move backwards when a waiting period that ended
  unseen reports an end before the main turn's end (masked by the band's
  own reset when Claude stops); only moving it forward would fix it.
- With the waiting toon broken (it threw), the idle routine stands in and
  can doze while agents still work.
- An idle teammate found by the list after a reload is not adopted, so it
  is not polled until a turn ends or the area shows again.
- The test "an agent spawned while Claude works walks in when the turn
  ends" raises no `turn.complete`; it exercises the band's `isWorking` flip.
- The demo's script has no queue: the grey helper simply arrives when the
  first seat frees (the picture is the same).
- `/stage demo waiting` started during a real waiting period ends with
  Clawd at x 0 beside the seated helpers, no fresh walk aside; `/stage
  hide` during the walk back restarts the idle clock at the hide.

### v0.6 (2026-10-04, on `claude/relaxed-ramanujan-2qv6ui`)

Automatic stage moves and stage history, the first two "Later" ideas,
built together in one cloud session. Spec:
`docs/superpowers/specs/2026-10-04-stage-toons-auto-moves-history-design.md`.
Plan: `docs/superpowers/plans/2026-10-04-stage-toons-auto-moves-history.md`.
- **Rules move the bar.** A stage's `auto` list: `skill`, `write` (a
  glob), `agent` (a model family) or `bash` (a regular expression), with
  `from`. Only the main conversation's successful calls and spawns, only
  forward on the track or into a side stage. The default workflow's
  rules follow the superpowers skills and the Fable audits. Claude gets a
  `[stage-toons]` note with the next tool result or prompt;
  `/stage auto [on | off]`.
- **History.** Entries record the feature, `by: auto` and why, and
  Claude's working time (turn time, split at moves); 200 kept.
  `/stage log [n]` and `/stage time`.
- Every move runs on one queue in the module.

Built like v0.5: drafted whole in a scratch copy, a plan embedding the
code, Fable audits of the spec (17 of 18 findings applied) and of the
plan (applied to a fresh copy; 11 of 11). Checked live in the cloud
session: the module loads, a spec Write and a Fable spawn move the bar,
a write behind the stage moves nothing, the notes reach Claude. The
person's local test: the bar moving by itself, `/stage log`, `/stage time`.

Departures from the spec: a spawn's note comes with the next result, not
the Agent call's own (live finding); Spec audit also fires from
Brainstorm, for specs written through Bash.

### 0.6.1 (2026-10-04)

The research's Tier 0, designed in chat:
- **Two sessions on one project no longer lose moves.** v0.6's turn-end
  credit (and every move) saved this session's whole progress over the
  store's; every change now starts from the store's copy when another
  session saved since (`latestProgress`, on the move queue), and working
  time goes to the entry it was spent in, found by stage and start.
- Leftovers fixed: `/stage workflow init` catches a failing `fs.exists`;
  the idle clock only moves forward; `/stage workflow reload` says when
  `set_stage` could not be registered again; an idle teammate the list
  finds after a reload is adopted.
- The band measures its lines in terminal cells: wide characters (CJK,
  emoji) count two, so they no longer run past the edge.
- The progress of projects untouched for 180 days is pruned, at most
  weekly (never the session's own, never one this version can't read).
- The walk-in test raises the main turn's end; the README's costs name
  v0.6's notes.

From Fable's review of 0.6.1: a turn's credit builds on the store's
copy as saved (never one fitted to this session's workflow), working time
follows the entry it was counted for (`workEntry`) through an adoption,
`/stage`, `log` and `time` show another session's move at once, and
`/stage log` lines its columns up in cells. Left as it is: between reading
the store and saving, a few awaits apart, two sessions can still race
(one credit or one entry lost); closing it would need history merged by
time.

### 0.6.2 (2026-10-04)

From the code review (`docs/reviews/2026-10-04-code-review.md`), one
commit each:
- **Workflow-file rules can't hang the plugin** (S1): a `bash` rule that
  repeats a group holding a repeat or a choice is refused; rules compile
  once; a rule reads at most 500 characters of a command; a glob holds at
  most 8 `*`. The history names a command by its rule, not its text (S2).
- **Fewer store reads** (P4): a call reads the store only when a rule of
  its kind matches; an older stored copy isn't checked whole.
- **A newer version's progress is never saved over** (C3), and unknown
  entry fields are kept; a mid-turn `/stage workflow reload` keeps the
  turn's time (C2).
- **Frames encode with the native base64**, no per-cell arrays (P2).
- **Pruning** runs after registration and keeps at most 50 projects (C5,
  P5a).
- Nits: C6, S3, S4 (64 KB file cap), D3, D4, T5; a CLAUDE.md lesson.

Needing the person's terminal:
- **The idle area sleeps** (P1, P3): dozing it paints at 333 ms; after
  five minutes of doze it shows one still picture and stops until a
  render, prompt or agent wakes it. No frame is sent twice (a resend
  every 2 s, and every frame after a refusal, keep a gone Raster noticed).
- **Each spinner animates its own toon** (C1).

Declined: P7 (a slower poll while only idle teammates are known): an
idle teammate that works again raises no event, so the poll is what
brings its helper back. Left for later: C4 (a collapsed band's loop
cycling; check live first), C7, D1-D2, D5, P5b-d, P6, P8, P9, A1.

**The person's check:** with the branch loaded in a terminal,
1. leave Claude idle: Clawd dozes after a minute and, about five minutes
   later, holds still (the z stops halfway up); a new prompt wakes it;
2. start a background agent and watch both the main spinner's toon and
   the agent row's: both animate; when the main turn ends only the
   agent's goes on;
3. scenes and the idle routines look as before (no stutter from skipped
   frames), and collapsing and expanding the band brings it back moving.

### Found in the person's local test (2026-10-04)

Testing 0.6.2 on Windows with a throwaway feature (a violet bar, reverted
after the test) run through the superpowers skills. Seen working: every
rule from Roadmap to Develop and into Debugging moved the bar, with its
note to Claude; a background Fable spawn's note came with the next
prompt; writing a spec or ticking the plan's checkboxes behind the stage
moved nothing; a Fable review during Develop moved nothing; the desk row
showed a Fable helper for the audits. The rest of the hand-off's
checklist passed too: `/stage auto`, `log` and `time` read well; an emoji
and CJK feature name fits the bar; Clawd dozes and then holds still; the
main spinner's toon and a background agent's animate together, the
agent's alone after the main turn; the scenes, idle routines and waiting
toon play as before, and come back moving after the band is collapsed
and expanded. Not watched: C4 (whether a collapsed band's loop keeps
restarting), which needs `claude --debug`.

To fix after the test (approved, 0.6.3):
- **A helper turns grey after a reload.** An agent already at work when
  the mod reloads (a hot-reload refresh, a plugin update) shows as a grey
  helper without the monocle until it ends: the roster lives in module
  variables, which a reload starts over, and `$.agent.list()` gives an
  agent's id and status but no model, so `reconcileRoster` joins it as
  `unknown` (`agents.ts`). Fix: keep each agent's model kind in a session
  `$.state` value keyed by agent id (a new key in `types/index.d.ts`),
  written at `agent.spawn` and read when the list brings an agent the
  roster lacks; a test drops the module's roster and checks the kind
  comes back.

Up for discussion:
- **A workflow file without rules turns automatic moves off silently.**
  This project's `.claude/stage-toons.json`, written by `/stage workflow
  init` before 0.6, has no `auto` lists, so no rule fired until it was set
  aside (`.claude/stage-toons.json.pre-0.6`, untracked). The README says so
  and `/stage auto` would have told, but nothing points there. Options: a
  one-time notice at load when automatic moves are on and the workflow has
  no rules, or the default's rules for a file that lists none.

### Research (2026-10-04)

`docs/research/2026-10-04-stage-toons-improvement-ideas.md` ranks 30
improvement ideas from claude-toons, comparable tools and the unused
parts of the plugin API, with the notes behind it in
`docs/research/2026-10-04-notes/`. Its Tier 0 (fixes) is 0.6.1.

### Later (ideas, up for discussion)

- **Scene authoring by others.** A data format for scenes (sprites and
  keyframed actors), `/stage preview <scene>`, and a skill that teaches an
  agent to make one.
- **Idle variants by the last finished step.** The idle Clawd's loops
  depend on the stage just completed, for example celebrating after a
  merge or holding the spec after the spec stage. Builds on v0.2's idle
  Clawd.
- **A "done" state after a merge.** Past the last stage: the track all
  lit and the feature finished, set by a rule (a merge to `main`) or by
  hand, so the history closes the feature. v0.6 left it out: it changes
  the band's drawing.
- **Configurable or dynamic canvas sizes.** The toon (under the spinner),
  the idle Clawd's box and the demo have fixed sizes; they could grow with
  the terminal, or be set in `.claude/stage-toons.json`, so scenes on a
  wide screen get more room.
- **Several waiting scenes.** The desk row is one; more scenes for the
  waiting toon (the helpers building, rowing, ...) picked at random like a
  stage's scenes, sharing the seat log's rules.
- **Layers (a Z axis) for scenes.** Today a scene paints in a fixed order
  (backdrop, actors, front) and a later pixel simply covers an earlier
  one, so placing a prop behind or in front of Clawd means arranging the
  code around that order. A depth per actor and prop would make layering
  easy: Nyan's rainbow could start right behind Clawd's body instead of
  where his sprite box ends, and props could pass in front of or behind
  him.
