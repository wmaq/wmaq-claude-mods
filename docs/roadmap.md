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

### v0.3 (next): a scene library and custom workflows

Architectural, so the full path: spec, Fable's audit, plan, then build.
- **Scene library and workflow model.** Scenes get their own names and are
  no longer keyed by stage; a stage becomes data (`id`, label, message,
  when Claude moves to it, which scene plays). The default workflow stays
  the ten stages and Other, and nothing visible changes.
- **Custom workflows.** A person defines their own stages (a workflow file,
  picked in the config menu), and the tool schema, the system-prompt
  section, the band, `/stage` and saved progress follow the workflow.
- **Scenes stay code, written by us.** A mod can't load code at runtime
  (`import()` doesn't load), so scenes from outside the mod would need a
  data format; that is deferred. New scenes and variations are added to
  the library in the mod's source.

Possibly later: sharing stage-toons with the community, the way
claude-toons was shared.

### Later (ideas, up for discussion)

- **Scene authoring by others.** A data format for scenes (sprites and
  keyframed actors), `/stage preview <scene>`, and a skill that teaches an
  agent to make one. Deferred in favour of v0.3.
- **A debugging stage.** A stage, with its own scene, for hunting a bug
  (superpowers:systematic-debugging). Open: where it sits in the workflow,
  or whether it is a side stage any step can drop into and return from.
  With v0.3's custom workflows, adding it becomes configuration.
- **Idle variants by the last finished step.** The idle Clawd's loops
  depend on the stage just completed, for example celebrating after a
  merge or holding the spec after the spec stage. Builds on v0.2's idle
  Clawd.
