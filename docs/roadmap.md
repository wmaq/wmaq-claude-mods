# Roadmap

## stage-toons

### v0.1 (2026-10-03, merged)

The progress bar, `set_stage` and `/stage`, saved progress per project, the
12 scenes and 4 reactions, and Fable's arrival while a Fable subagent runs.
Spec: `docs/superpowers/specs/2026-10-02-stage-toons-design.md`. Plan:
`docs/superpowers/plans/2026-10-02-stage-toons.md`.

### v0.2 (next)

It builds on existing code, so a short in-chat design is enough; no full
spec and plan.

From the user's testing of v0.1:
- **Idle Clawd while Claude waits for you.** A small Clawd, 4 rows tall,
  beside the bar while Claude isn't working. The band grows from 2 rows to 4
  while idle and goes back to 2 while the toon plays under the spinner.
  Calm loops: sitting, blinking, glancing at the prompt, tapping a foot,
  dozing off with "z z" after about a minute, awake again when a turn
  starts. Repaint at about 6 fps; not on narrow terminals, while hidden, or
  under a survey. The desktop app keeps the text bar.
- **One more row of canvas.** A `?` or a tick drawn above Clawd sometimes
  gets cut off at the top: go from 6 rows (12 pixels) to 7 (14 pixels).
- **Other scene.** It draws two question marks: the one on the box is well
  right of the box's centre, and the one above the box is half cut off.
  Keep one, centred, fully in view.
- **`/stage demo [seconds]`.** Plays every scene in turn (default 10 s
  each), so new users can see them all. The scenes play under the spinner,
  so the demo needs a way to show them while Claude is idle (the idle Clawd
  site above is the natural place).

From Fable's review of the director (`hooks/director.ts`), untested
transitions a real session can hit:
- A stage change while Fable is still walking in or out: a wipe starts under
  the walk, and the walk-in later switches the base to `auditor` over it.
- Auditing turning on or off while a failure or advance reaction plays:
  the reaction is cut short (by design, Fable's walks win), but untested.
- Two stage changes within 300 ms: the second wipe starts from the first
  one's target, so the original scene vanishes mid-wipe.
- `createDirector(stage, true)` starts on the auditor scene with no walk-in;
  and a lone failure reaction's 2.5 s expiry is never asserted.

Deferred minors from the final review of v0.1:
- `cut()` and `fit()` slice UTF-16 code units, so cutting at an emoji can
  leave half of it.
- The "couldn't save progress" toast repeats after a hot reload
  (`hasWarned` is module state).
- `validate()` accepts `NaN` or `Infinity` timestamps (harmless: such a value
  never counts as newer).
- `TOOL_DESCRIPTION` could say a subagent's `set_stage` call is refused, so
  subagents don't try.
