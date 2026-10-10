# docs

The working papers behind the mods, kept as they were written. Every
feature went through the workflow stage-toons draws, and each step left
a document here:

1. **Roadmap discussion:** [`roadmap.md`](roadmap.md), what is ahead
   (finished work moves to the mod's `CHANGELOG.md`).
2. **Brainstorm**, in a Claude Code session with the
   [superpowers](https://github.com/obra/superpowers) skills.
3. **Spec:** [`superpowers/specs/`](superpowers/specs/).
4. **Spec audit:** a second model (Fable) reviews the spec; what holds up
   is applied, and the person approves it.
5. **Plan:** [`superpowers/plans/`](superpowers/plans/), step by step,
   with the tests first.
6. **Plan audit**, the same way.
7. **Develop**, test-driven, by Claude and its subagents, then a review
   of the whole branch.
8. **Claude testing** in a live session, then **the person's testing**,
   then cleanup and the release.

Small changes skipped the spec and plan for a short design agreed in
chat. The documents use the language of the time: a spec may describe
what a later release changed.

| Folder | What is in it |
|---|---|
| [`superpowers/specs/`](superpowers/specs/) | Designs, one per feature |
| [`superpowers/plans/`](superpowers/plans/) | Implementation plans |
| [`reviews/`](reviews/) | Full code reviews (correctness, performance, security) |
| [`research/`](research/) | Research reports: ranked improvement ideas, and the notes behind them |
| [`ideas/`](ideas/) | Ideas researched or probed but not yet planned, with their throwaway probe mods |
| [`handoffs/`](handoffs/) | What a cloud session did, and what to check in a terminal |
| `media/` | The README's pictures |

"Cloudie" in the hand-offs is a Claude Code cloud session, which can't
see the terminal; "Termie" is the local one at the person's terminal.
