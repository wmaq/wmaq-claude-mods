# claude-mods

Claude Code mods (plugins of function hooks, an early-access feature) built
by wmaq with Claude. Each mod is a folder at the repository root.

| Mod | What it is | Status |
|---|---|---|
| `stage-toons/` | A progress bar of the workflow below (or a project's own, from `.claude/stage-toons.json`), above the prompt, with pixel-art Clawd scenes under the spinner and an idle Clawd beside the bar | v0.3 merged; later ideas in `docs/roadmap.md` |

## The workflow

Work moves through these stages, and the user expects each step's artifact
before the next one starts:

1. Roadmap discussion / new features brainstorming
2. Brainstorm one feature (superpowers:brainstorming)
3. Spec, in `docs/superpowers/specs/`
4. Spec audit: a Fable subagent (Agent tool, `model: fable`) reviews the
   spec; apply what holds up, then the user approves
5. Plan, in `docs/superpowers/plans/` (superpowers:writing-plans)
6. Plan audit by a Fable subagent, then the user approves and picks how it
   is executed
7. Develop (superpowers:executing-plans or subagent-driven-development,
   TDD), then a final whole-branch review by a Fable subagent
8. Claude testing, live in the session
9. The user's testing
10. Cleanup: leftovers, chores, docs; then merge to `main`

A change that builds on existing code can skip the full spec and plan: a
short design in chat, approved by the user, is enough.

**Keep the stage-toons bar current.** When stage-toons is loaded, call
`mcp__stage-toons__set_stage` whenever the work moves to another stage, with
a short present-tense message (the mod's system-prompt section says the
same).

Commits go on a feature branch, never straight to `main`. Ask before
pushing.

## Developing a mod

Load the `plugin-authoring` skill before writing or debugging a hooks module.
It names this session's hot-reload folder,
`~/.claude/dev-mods/<session id>/`, and starts the engine's watch on it.

- **Hot reload uses a copy, not a link.** On Windows a directory junction
  into the hot-reload folder loads the mod once, but saves through it never
  trigger a reload. Copy the mod in and refresh the copy after every change:
  `cp -r <mod>/.claude-plugin <mod>/hooks <mod>/types ~/.claude/dev-mods/<session id>/<mod>/`.
  The mod reloads when the turn that changed it ends.
- **Checks**, from the repository root:
  ```sh
  claude plugin validate <mod>
  claude plugin test <mod>
  npx -y -p typescript@5 tsc -p <mod>
  ```
  `tsc -p <mod>` needs `<mod>/.claude-plugin/types/`, which the engine
  writes when it first loads the mod (git-ignored). Before that, type-check
  with a tsconfig kept outside the mod whose `include` names the skill's
  `types/claude-code.d.ts` and the mod's `hooks` and `types`.
- **The API reference** is the skill's `types/claude-code.d.ts` (about 20,000
  lines: grep it) and `reference.md`. After a Claude Code upgrade, re-check
  the APIs a mod depends on against the new file.

### Engine rules the docs don't spell out

Learned building stage-toons on 2.1.287 and 2.1.288:

- The engine prefixes a command's answer with the plugin's name
  (`stage-toons: …`); an answer that starts with it shows it twice.
  Toasts and tool refusals are not prefixed.

- The engine reads a hooks module's source before loading it, and refuses
  it ("hooks module did not load: … compiled line N") when:
  - `$` is passed to anything but a function declared at the top of the
    file; closures inside `register` may not take `$`;
  - a noun of `$` such as `$.store` is passed as a value: spell every call
    `$.noun.method(...)` where it is made;
  - an `atom`'s `plugin` and `key` are not string literals.
- A tool registered with `$.tool.register` must answer `{ result }` with a
  string, an array or nothing. An object such as `{ content: [...] }` is
  refused at runtime, although the types say `unknown` and the test kit
  accepts it. Only a live call shows this.
- A loop detached from a dispatch (`void (async () => …)()`) needs a
  `.catch(...)`: a pending `$.clock.sleep` rejects when the plugin unloads.
- A spinner's `requestId` is the agent's id, and a background agent's row has
  its own spinner. `turn.complete` fires for subagent turns too (with
  `agentId`); filter on it.
- `$.ui.blit` answers `{ deny }` when nothing of the plugin is mounted there,
  and refuses another width (a resize is a redraw, not a blit).
- Only a `Box` keeps its `key` in a drawing; `Text` keys are dropped.
- A `ui.render` hook runs once per props change, plugin load or
  `$.ui.invalidate('ui.render')`; a repaint reuses its answer. A blit
  repaints only the Raster, so text drawn beside it changes only when the
  mod invalidates. A paint loop that stops on refused blits must
  invalidate too, or the site can stay frozen when it shows again (the
  person can collapse and expand the band).
- `AbovePrompt` has `isWorking` and `maxRows`; a tree taller than `maxRows`
  scrolls instead of showing whole.
- `ui.toast` and `ui.log` return nothing, not a promise.

### The test kit (`claude-code/testing`)

- Register every test hook before the test's first `$` call.
- The test's `$` only raises events: it has no `$.store`, `$.session.cwd`,
  `$.agent.list` or `$.ui.toast`. Check effects through what the mod draws
  or answers, or through test hooks.
- Engine calls the mod makes need a test answer `{ value }` (for example
  `on('tool.register', ($, e) => ({ value: { tool: \`mcp__<mod>__${e.name}\` } }))`,
  and `command.register`, `agent.list`, `store.get`/`store.set`, `ui.blit`,
  `ui.toast`). `mock.clock` and `mock.store` cover the clock and the store.
- Raised events need an answer beneath the plugin: `session.start` →
  `{ cwd }`, `turn.complete` → `{ text }`, `prompt.compose` → `{ sections }`
  (raise it with a full input), `agent.spawn` → `{ model, agentId }`,
  `session.compact` → `{ messages }` with at least one message, `ui.render`
  → a tree.
- `$.agent.spawn` in a test takes the full spawn input (`tool_use_id`,
  `description`, `subagentType`, `provider`, `parentModel`, `background`,
  `fork`).
- An MCP tool's arguments sit directly on the `tool.call` event, beside a
  required `tool_use_id`.
- A hook that throws shows up only as "no implementation for <event>".
- The kit cannot reload a module. For state an earlier load left, answer
  that one key and pass the rest:
  `on('state.get', ($, e, next) => (e.key === 'warned' ? { value: { value: true, version: 1 } } : next(e)))`.
- `fs.*` test hooks receive resolved absolute paths, not the relative path
  the mod passed; match files by the part the test names.
- `ui.redraw()` redraws whether or not the mod asked to be: count
  `ui.invalidate` in a test hook (answer `{ value: undefined }`) to prove
  the mod asks, or a missing redraw passes the test.
- Build backslashes in test strings with `String.fromCharCode(92)`; a
  `'\\'` literal broke the kit's parser.
- `stage-toons/hooks/harness.tsx` is a working set of engine stand-ins to
  copy from.

## Where things are

- `docs/roadmap.md`: what's next, per mod.
- `docs/superpowers/specs/`, `docs/superpowers/plans/`: specs and plans.
- `<mod>/README.md`: install and use. stage-toons' Clawd sprite comes from
  claude-toons (MIT); keep `stage-toons/NOTICE` with it.
