# claude-mods

Claude Code mods (plugins of function hooks, an early-access feature) built
by wmaq with Claude. Each mod is a folder at the repository root, listed in
the marketplace manifest `.claude-plugin/marketplace.json`.

| Mod | What it is | Status |
|---|---|---|
| `stage-toons/` | A progress bar of the workflow below (or a project's own, from `.claude/stage-toons.json`), above the prompt, with pixel-art Clawd scenes under the spinner, an idle Clawd in an area below the bar, and a desk row of helpers there while Claude waits on agents; rules move the bar by themselves, and `/stage log` and `/stage time` read its history | 0.6.4 (v0.6, automatic moves and history; fixes up to 0.6.3; 0.6.4 splits `register.tsx`, tested locally); the frame tool in `tools/frames/`; releases in `stage-toons/CHANGELOG.md`; the plan ahead in `docs/roadmap.md`, ideas in `docs/research/`; the latest review in `docs/reviews/` |

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
10. Cleanup: leftovers, chores, docs; bump the mod's version in
    `<mod>/.claude-plugin/plugin.json` (installed copies update only when it
    changes); move the finished work out of `docs/roadmap.md` into a short
    entry in `<mod>/CHANGELOG.md`; then merge to `main`

**The roadmap holds only what is ahead.** `docs/roadmap.md` lists the
plan's phases and the open leftovers. When a release is finished, delete
its items from the roadmap and add a few lines for it at the top of
`<mod>/CHANGELOG.md` (what it shipped, with the spec, plan or hand-off
that has the details). Minor findings a review leaves open go to the
roadmap's "Open leftovers" list, or into the phase that fixes them; drop
them from there once fixed.

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

- **Disable the installed copy while developing.** With a mod installed from
  the marketplace (`claude plugin install <mod>@claude-mods`), a hot-reload
  copy loads a second one. `claude plugin disable <mod>@claude-mods` before,
  `claude plugin enable <mod>@claude-mods` after.

- **Hot reload uses a copy, not a link.** On Windows a directory junction
  into the hot-reload folder loads the mod once, but saves through it never
  trigger a reload. Copy the mod in and refresh the copy after every change:
  `mkdir -p <copy>/.claude-plugin && cp <mod>/.claude-plugin/plugin.json <copy>/.claude-plugin/ && cp -r <mod>/hooks <mod>/types <copy>/`,
  `<copy>` being `~/.claude/dev-mods/<session id>/<mod>`. Copy
  `plugin.json` alone, not the whole `.claude-plugin`: its `types/` is the
  repository's git-ignored copy from whichever version last loaded there,
  and copied over the hot-reload copy's it fails `tsc` (on `isTeammate`,
  say) until the next reload rewrites it.
  The mod reloads when the turn that changed it ends. When files move
  (v0.4 turned `hooks/idle.ts` into `hooks/idle/`), replace the copy's
  `hooks` wholesale (`rm -rf` it first): a stale file shadows the new
  folder.
- **After `/clear` the mod still loads from the old session's folder.** The
  process keeps watching the hot-reload folder it enabled, named by the
  session id from before `/clear`; the new session id's folder is empty.
  Refresh the copy that is loaded (`ls ~/.claude/dev-mods/*/`), not the new
  folder: writing a mod there asks to enable it and loads a second copy.
  The engine rewrites the copy's `.claude-plugin/types/` only when its
  types change, so their timestamps don't show a reload. To force a
  reload, change a file's content (a comment line, removed after); a
  `touch` may not do it.
- **Live-testing what agents do** (the waiting toon): start background
  agents on different models whose only job is to stay busy for a set time
  with `ping -n <seconds+1> 127.0.0.1 > /dev/null` (`sleep` is blocked), then
  end the turn and let the person watch the band.
- **Git Bash rewrites a commit subject that starts with `/stage`** into a
  Windows path; start the subject with another word.
- **Checks**, from the repository root:
  ```sh
  claude plugin validate <mod>
  claude plugin validate .        # the marketplace manifest
  claude plugin test <mod>
  npx -y -p typescript@5 tsc -p <mod>
  npx -y tsx --test "tools/frames/*.test.ts"   # the frame tool, when it or the drawing changed
  ```
  `tsc -p <mod>` needs `<mod>/.claude-plugin/types/`, which the engine
  writes when it loads the mod from that folder (git-ignored). The repo's
  copy keeps the version that last loaded it: after an upgrade, type-check
  the freshly loaded hot-reload copy too (`tsc -p ~/.claude/dev-mods/<session id>/<mod>`);
  2.1.289's closed agent statuses failed only there. Before that, type-check
  with a tsconfig kept outside the mod whose `include` names the skill's
  `types/claude-code.d.ts` and the mod's `hooks` and `types`.
- **The API reference** is the skill's `types/claude-code.d.ts` (about 20,000
  lines: grep it) and `reference.md`. After a Claude Code upgrade, re-check
  the APIs a mod depends on against the new file.

### Engine rules the docs don't spell out

Learned building stage-toons on 2.1.287 to 2.1.289:

- The engine prefixes a command's answer with the plugin's name
  (`stage-toons: …`); an answer that starts with it shows it twice. A
  tool's refusal (`{ deny }`) is shown as given.
- The engine reads a hooks module's source before loading it, and refuses
  it ("hooks module did not load: … compiled line N") when:
  - `$` is passed to anything but a function declared at the top of the
    file; closures inside `register` may not take `$`;
  - a noun of `$` such as `$.store` is passed as a value: spell every call
    `$.noun.method(...)` where it is made;
  - an `atom`'s `plugin` and `key` are not string literals;
  - a function handed `$` shares its name with anything else declared in
    the file, a local `const` in another hook included ("declared more
    than once");
  - a function handed `$` is imported from another file: `$` is followed
    only into functions declared in the same file. Closures built in
    `register.tsx` that call `$` (`storeOf($)`) may cross imports.
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
- Since 2.1.289 `$.agent.list()` statuses are a closed set,
  `pending | running | waiting | idle | completed | failed | killed`: an
  agent at work is any of the first four, so test for the ended ones, never
  for `running` alone. An agent has one id across `agent.spawn`'s answer,
  its loop's events and the list; teammates fire `agent.spawn` too
  (`isTeammate`), and their calls carry `agentId`.
- Since 2.1.289 a `ui.render` answer that throws while the terminal draws it
  costs that site alone: the engine draws its own there and the session goes
  on.
- `$.agent.list()` may be called from a `ui.render` hook (fire and forget,
  errors caught): 0.5's band does so each time its area shows again. The
  list keeps ended agents for a while ("until the engine drops its task"),
  so a roster built from it must drop `completed`/`failed`/`killed`, and it
  may lag `agent.spawn` and an agent's own `turn.complete`: stage-toons
  trusts the events over the list for 3 s (`LIST_LAG_MS`).

- `context` added to core's own `tool.call` result (`{ ...result, context }`,
  keeping its `ref`) reaches the model, shown as "tool.call hook
  additional context" (checked on 2.1.289). A deny carries none.
- A background Agent call's `tool.call` result comes back before what its
  `agent.spawn` hook does after `next(e)` is done: a note queued there
  rides on the next result instead.
- Closures inside a hook that close over `$` and hand it to a top-level
  function (`() => setStage($, mod, args)`) load fine; only a closure
  taking `$` as its own parameter is refused.
- `turn.start` is raised for main turns only; `turn.complete` carries
  `durationMs`. `$.session.cwd()` follows a worktree.
- `$.store` lives in `~/.claude/plugins/store/<plugin>_inline-<hash>.json`
  (a hot-reloaded copy's): read it to check what a mod saved.

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
  Pin a key that way only when the mod never writes it: `update` on a
  pinned key retries without end. For a key it writes (`usdCredited`),
  answer the earlier load's value only until the mod's first write.
- `fs.*` test hooks receive resolved absolute paths, not the relative path
  the mod passed; match files by the part the test names.
- `ui.redraw()` redraws whether or not the mod asked to be: count
  `ui.invalidate` in a test hook (answer `{ value: undefined }`) to prove
  the mod asks, or a missing redraw passes the test.
- Build backslashes in test strings with `String.fromCharCode(92)`; a
  `'\\'` literal broke the kit's parser.
- `stage-toons/hooks/harness.tsx` is a working set of engine stand-ins to
  copy from. Its `agent.spawn` lists each spawned agent `running` in
  `world.agents` and never ends it: set `world.agents` to end one, or the
  roster takes it back to work once `LIST_LAG_MS` has passed.
- `expect` has no `toBeCloseTo`: round and compare with `toBe`.
- Engine calls with no arguments answer from a test hook by name, as
  `on('session.cwd', () => ({ value: '/proj' }))`; raised `turn.start`
  needs `{ turnId }` beneath. `expect.stringContaining` exists.

## Working as a cloud agent

This section applies only to a Claude Code cloud session (claude.ai/code,
the Claude app): `CLAUDE_CODE_REMOTE_SESSION_ID` is set, and the repository
is a fresh Linux clone. A local session skips it; everything above stands
as written. In a cloud session the rules below take precedence over the
ones above where they differ.

The person follows the session in the Claude app, not in a terminal, so
nothing the mod draws can be seen there. The workflow is the same; what
changes is who checks the drawing, and how the work reaches the person's
PC.

- **Branch and push.** Work on the branch the session names (it starts
  with `claude/`), never `main`. Commit and push to that branch without
  asking: the container is thrown away when the session ends, and the
  person tests by checking out that branch locally. Merging to `main`
  needs the person's approval, and so does a pull request.
- **Names.** The person calls a cloud session (a project thread
  included) **Cloudie**, and the local Claude Code session on their PC
  **Termie**: the one at the terminal, who can see what the mod draws.
  Address hand-offs that need a local check to Termie and the person.
- **Approvals while the person is away.** When the person says they're
  away and trust Cloudie's judgement, Cloudie approves the spec and plan
  itself (after the Fable audits) and says so in the hand-off; Termie
  double-checks them with the person later.
- **Loading the mod.** A fresh container has no installed copy (`claude
  plugin list`). Load the `plugin-authoring` skill, then copy the mod into
  the hot-reload folder it names, as above. The person must answer
  "Enable hot reloading for this session?" in the app; once they have,
  `mcp__stage-toons__set_stage` appears (load it with ToolSearch) and the
  stage bar rule above applies. Refresh the copy after every change, as
  above.
- **Type-checking.** The repository's copy never gets
  `.claude-plugin/types/` in a cloud session: run `tsc -p` on the loaded
  hot-reload copy. Before the mod has loaded, use a tsconfig in the
  scratchpad whose `include` names the skill's `types/claude-code.d.ts`
  and the mod's `hooks` and `types`, with the options from that file's
  header.
- **Claude testing (stage 8).** Covers what can be checked without seeing
  the terminal: `validate`, `test`, `tsc`, the loaded mod's load notice and
  the text answers of its tools and commands (`set_stage`'s answer, the
  system-prompt section). Don't start a second Claude Code (tmux,
  `--plugin-dir`) to look at the drawing: the session's permission check
  refuses it, so it needs the person's explicit permission first.
- **Look at the drawing yourself first.** `tools/frames/` renders what
  the mod draws to PNG contact sheets (its README lists the commands):
  `scene <id>`, `idle <routine>`, `waiting --agents ...`, `band --stage
  <id>`. Before handing over visual work, render sheets of what changed,
  read them (the Read tool shows an image), and fix what looks wrong; the
  hand-off names the sheets checked. Letterforms differ a little from the
  person's terminal font; the cells, colours, layout and art are the
  mod's own. The person's look in a terminal stays the final check.
- **Handing over the visual check.** When the work needs eyes on the
  terminal (a scene, the band, a layout), push the branch and give the
  person what to check: the branch name, the commands to see it
  (`/stage demo <stage>`, `/stage demo waiting`, ...) and what to look
  for. Give each check its starting state and exact steps (`/stage
  roadmap` first, when a rule only moves forwards; that the repo has no
  workflow file until `/stage workflow init`; that stage scenes play only
  while Claude works, or use `/stage demo <stage>`). Termie tests it with them (stage 8's visual part, and 9); carry
  on with work that doesn't depend on the result, and fix what they report
  on the same branch.
- **Linux, not Windows.** The Git Bash note above doesn't apply. There is
  no `ping` and `sleep` is blocked; a background agent stays busy for the
  waiting toon with `timeout <seconds> tail -f /dev/null`.
- **Keep the shell at the repository root.** The session's working
  directory follows the shell's `cd`, and a hot reload's `session.start`
  keys the project's progress by it: after a `cd stage-toons/hooks` the
  reloaded mod saved to `progress:/home/user/claude-mods/stage-toons/hooks`,
  a project of its own. Use absolute paths, or `cd` back before the turn
  ends.

## Where things are

- `docs/roadmap.md`: what's next, per mod, and the open leftovers.
- `<mod>/CHANGELOG.md`: what each release shipped.
- `docs/superpowers/specs/`, `docs/superpowers/plans/`: specs and plans.
- `docs/research/`: research reports (ranked improvement ideas, with the
  notes behind them).
- `docs/reviews/`: code reviews (correctness, performance, security).
- `docs/handoffs/`: what a cloud session did and what to check locally;
  read the latest before testing a cloud session's branch.
- `tools/frames/`: the frame tool, stage-toons' drawing as PNG contact
  sheets (a developer tool, not part of the mod).
- `<mod>/README.md`: install and use. stage-toons' Clawd sprite comes from
  claude-toons (MIT); keep `stage-toons/NOTICE` with it.
