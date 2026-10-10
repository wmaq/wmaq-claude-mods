# docs

| File or folder | What is in it |
|---|---|
| [`roadmap.md`](roadmap.md) | What is ahead, and the open leftovers (finished work moves to the mod's `CHANGELOG.md`) |
| [`reviews/`](reviews/) | Full code reviews: correctness, performance, security |
| `media/` | The README's pictures |

Every feature went through the workflow stage-toons draws, in Claude Code
sessions with the [superpowers](https://github.com/obra/superpowers)
skills: a roadmap discussion, a brainstorm, a written spec audited by a
second model (Fable), a step-by-step plan audited the same way,
test-driven development by Claude and its subagents with a review of the
whole branch, testing in a live session by Claude and then by the
person, and a cleanup. Small changes skipped the spec and plan for a
short design agreed in chat. The specs, plans and hand-offs were working
papers, not kept here; `CLAUDE.md` at the
root keeps what was learned about the engine.
