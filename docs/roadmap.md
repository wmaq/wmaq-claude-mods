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

### Later (ideas, up for discussion)

- **Scene authoring by others.** A data format for scenes (sprites and
  keyframed actors), `/stage preview <scene>`, and a skill that teaches an
  agent to make one.
- **Idle variants by the last finished step.** The idle Clawd's loops
  depend on the stage just completed, for example celebrating after a
  merge or holding the spec after the spec stage. Builds on v0.2's idle
  Clawd.
- **Moving the stage automatically.** The bar depends on Claude
  remembering `set_stage`. A `tool.call` hook could move it from what
  happens: `superpowers:brainstorming` → brainstorm, `writing-plans` →
  plan, an Agent with `model: fable` on spec or plan → that audit, a merge
  to `main` → cleanup done. Claude would still call `set_stage` for the
  message. The triggers could live in `.claude/stage-toons.json`, so a
  custom workflow has its own.
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
- **Stage history.** Time spent per stage and per feature, and
  `/stage log` for a timeline. Progress is already saved per project, with
  its recent moves.
