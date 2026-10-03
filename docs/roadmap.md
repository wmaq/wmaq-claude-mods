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

Open check: whether the session's workflow survives `/clear` (it lives in
`$.state`); try `/stage workflow` after a `/clear` at the start of a
session.

Left as they are (from Fable's v0.3 review):
- `/stage workflow init` doesn't catch a `$.fs.exists` rejection (the API
  says only a network location rejects).
- If `set_stage` fails to register again on reload, the answer still says
  the workflow switched (stale ids are still refused at call time).
- A v0.2 and a v0.3 session on one project disagree on progress v1/v2
  until both run v0.3.

Possibly later: sharing stage-toons with the community, the way
claude-toons was shared.

### Later (ideas, up for discussion)

- **Scene authoring by others.** A data format for scenes (sprites and
  keyframed actors), `/stage preview <scene>`, and a skill that teaches an
  agent to make one.
- **Idle variants by the last finished step.** The idle Clawd's loops
  depend on the stage just completed, for example celebrating after a
  merge or holding the spec after the spec stage. Builds on v0.2's idle
  Clawd.
