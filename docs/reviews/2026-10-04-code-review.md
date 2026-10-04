# stage-toons 0.6.1: code review

2026-10-04, branch `claude/relaxed-ramanujan-2qv6ui` at `ac3d111`. Review only:
nothing in the repository was changed apart from this file. The baseline is
green: `claude plugin test stage-toons` gives 315 pass and 0 fail (32 files,
15.5 s). `validate` passes for the mod and for the marketplace, and `tsc -p`
on the loaded hot-reload copy, whose `hooks/` and `types/` match the repo's
byte for byte, prints no errors.

Known leftovers in `docs/roadmap.md` ("Left as they are") and ideas already
in `docs/research/2026-10-04-stage-toons-improvement-ideas.md` are not
reported again unless there is new evidence. Where there is, the item says
so.

## Summary: the top 5 to act on

1. **The idle paint loop never stops** (perf, medium-high, finding P1).
   After Clawd dozes, the area keeps blitting at 6 fps for as long as the
   session sits idle. In 10 minutes of doze it made **3,614 blits that show
   only 6 distinct frames**. Overnight that comes to about 173,000 blits and
   about 900 MB of base64 strings passed to the host (estimate). Fix: doze
   at 333 ms, skip frames identical to the last one, and freeze on a still
   frame after a few minutes of doze. That cuts about 99% of overnight
   frames.
2. **Two spinners share one toon** (correctness, medium, C1). While a
   background agent's row spinner is mounted next to the main spinner, only
   the spinner rendered last animates. A probe measured **1 blit for the
   main spinner and 24 for the agent's in 2 s**, so the main toon stands
   frozen.
3. **Workflow-file regexes can hang the plugin** (security/robustness,
   medium, S1). `bash` rules and `write` globs from a project's
   `.claude/stage-toons.json` run with no limit on every main-conversation
   Bash/Write/Edit call. A plausible rule, `^(\S+\s*)+merge$`, takes 0.7 s on
   a 36-character command and doubles with each extra character;
   `^(a|a)*$` takes 0.9 s on 27 characters. A cloned repository can ship
   such a file.
4. **Frame encoding is the most expensive part of a frame** (perf, medium,
   P2). `encodeCells` costs 50 to 190 µs and about **177 KB of garbage per
   frame**, which is 4 to 12 times the cost of drawing the scene. The plugin
   environment has a native `Uint8Array.prototype.toBase64` (probed). With
   direct writes in `toWords`, the cost drops to **about 4 µs and 5 KB**
   (measured in Bun).
5. **Store traffic and size** (perf/robustness, medium, P4 and P5). Every
   main-conversation Bash, Write, Edit or Skill call reads and validates the
   project's whole progress from the store, even when no rule of that kind
   exists. With a full history that is 37 KB and 0.4 to 0.55 ms per call.
   One full project is 37 KB compact (48.5 KB as the store file prints it),
   so **86 to 113 projects fill the 4 MiB store**. After that every save
   fails.

Smaller confirmed bugs: a mid-turn `/stage workflow reload` loses the turn's
working time so far (C2). A newer version's progress would be overwritten by
this version (C3, latent).

---

## 1. Correctness

**C1. Medium. The main spinner's toon freezes while a background agent's
spinner is mounted.**
Evidence: `register.tsx:1054-1058` keeps one `mod.toon` site.
`mod.toon.requestId = e.requestId` on every Spinner render, and
`animate` blits only to `site.requestId` (`:494`, `:518`). A background
agent's row has its own spinner, whose `requestId` is the agent id
(CLAUDE.md). Probe (`zz-probe.test.tsx`, "two spinners"): with the spinners
`main` and `agent-7` mounted, 2 s of clock gave
`{"main":1,"agent-7":24}` blits. Each later Spinner render (any props change:
mode, word) moves the animation to whichever spinner rendered last. When the
main turn ends, `turn.complete` clears `toon.requestId` (`:936`), which also
stops an agent spinner that held the site.
Why it matters: this is common. Background agents run while Claude works,
and the toon under the main spinner, the mod's main show, stands still.
Fix: keep toon sites in a `Map<requestId, Site>`. One loop composes the
frame once per tick and blits it to every mounted toon site. Drop a site on
its own refusals or on its agent's `turn.complete`, and drop the main site
on the main turn's end. Add a register test with two spinners that counts
blits per `requestId`. The harness's `ui.blit` stand-in needs to record
`e.requestId`.

**C2. Low. A mid-turn `/stage workflow reload` drops the working time
credited so far.**
Evidence: `reloadWorkflow` runs `credited(mod, base, at)` (`register.tsx:614`),
which moves the time since `workSince` into the in-memory progress and
resets `workSince`, but never saves it. At the turn's end `creditTurn`
builds on `raw`. That is the store's copy whenever its `updatedAt` equals
this session's (`:243`, `:346`), and the store's copy lacks the credit
because `creditAt` does not bump `updatedAt`. Probe: a 120 s turn with a
reload at 60 s saved `[["develop",60000]]`.
Why it matters: `/stage` is `immediate`, so it runs while Claude works, and
the time is lost silently.
Fix: in `reloadWorkflow`, either don't credit (leave `workSince` and
`workEntry` alone; the entry key still finds the entry after `reconcile`),
or save the credited copy as the other moves do.

**C3. Low (latent, becomes data loss at the first format change). Progress
from a newer version is overwritten.**
Evidence: `validate` returns null for anything but `v: 1 | 2`
(`progress.ts:42`). `latestProgress` treats null like "nothing stored"
(`register.tsx:238-242`), so the next move or credit saves this version's
v2 over a newer version's record. `entryOf` also drops unknown fields
(`progress.ts:27-37`), so an older session strips a newer version's
history fields on save. `staleKeys` already protects such records from
pruning; saving does not.
Why it matters: the installed copy and a dev copy run side by side
(CLAUDE.md), and P5 suggests a v3 format.
Fix: when the stored value has a numeric `v` above 2, keep the session
read-only for that key (no saves, one toast), or save under a
version-suffixed key. Keep unknown entry fields when re-saving (spread the
raw entry, then override the checked fields).

**C4. Low (unverified live). A collapsed band may restart its loop every
4 s, indefinitely.**
Evidence: when blits are refused 24 times (`MAX_REFUSED_UNSEEN` × 166 ms ≈
4 s), the area loop invalidates (`register.tsx:530-533`). The render then
mounts a Raster and restarts the loop, and the first iteration polls the
agent list (`:496-498`). Probe with blits refused for 60 s and a redraw per
invalidate: **12 invalidations and 268 refused blit attempts a minute**.
Whether the engine runs `ui.render` for a collapsed band, and so makes this
loop real, is not visible in a cloud session.
Fix: check live with the debug log (`/stage hide` excluded). If it cycles,
back off: double the wait before each invalidate (4 s, 8 s, ... capped at
60 s), and reset on a taken blit.

**C5. Low. Pruning holds up session start.**
Evidence: `pruneStore` is awaited inside `session.start` before
`registerTool` and `$.command.register` (`register.tsx:681`, `:714-727`).
It reads every progress key in sequence (`:367-369`). The 100-project case
is 100 round trips plus 27 to 38 ms of `validate` (measured, `staleKeys`).
It runs at most weekly.
Fix: run it detached after registration (`void pruneStore(...)` with its
own catch). It already logs its own failures.

**C6. Nit. `frameMs` runs the idle routine at 83 ms when the waiting toon is
broken.** `register.tsx:87` keys on `seats.since`. With
`isWaitingBroken`, the idle routine stands in at the waiting rate. Add
`&& !mod.isWaitingBroken`.

**C7. Nit. The 30-column minimum is applied in two different ways.**
`TOON_MIN` reads "the fewest columns a toon is drawn in"
(`band.ts:17-18`), but the toon is `viewport - 6` wide (`register.tsx:1055`),
so it is 24 columns at a 30-column viewport. The area is `columns - 1`.
Either reword the comment or apply the minimum to the drawn width.

Checked and not a bug: the queue (`queued`/`settle`, `register.tsx:180-194`)
serialises every move, credit and adoption. A failed step does not block the
next (`then(run, run)`, `catch` on the tail), and own-steps log instead of
failing the call. `latestProgress` with equal timestamps returns the store's
raw copy for credits and this session's fitted copy for moves. That is
right. The roadmap already records the remaining read-to-save window.

## 2. Engine-rule compliance and API use

Every rule in CLAUDE.md's list holds, and `claude plugin validate` agrees:

- `$` goes only to top-level functions of `register.tsx`, and closures only
  close over it.
- Atoms use literal `plugin`/`key`.
- `set_stage` answers `{ result: string }` (`:291`).
- Detached loops end with `.catch` (`:537`).
- `turn.complete` is filtered on `agentId`.
- Refused blits are counted, and the band invalidates when its loop gives
  up.
- Agent statuses follow the closed 2.1.289 set (`agents.ts:21-24`,
  `activity.ts:16`).
- `ui.toast` and `ui.log` are not awaited.

New fact for CLAUDE.md (probed): a `$`-taking function imported from
another file is refused at load ("$ is followed only into a function
declared in this same file, never across an import"). That answers the
research notes' open question. Closures built in `register.tsx` that call
`$` can still cross imports, as `storeOf($)` already does into
`progress.ts`. See D1.

**A1. Nit. The `as unknown as` casts on `tool.call` events**
(`register.tsx:775`, `:789`). They are needed because an MCP tool's
arguments sit on the event. A small typed guard (`argsOf(e): Record<string,
unknown>`) would name the reason once instead of twice.

**A2. Low. The plugin does not use `Uint8Array.prototype.toBase64`.** The
engine's own example uses it (types file, `RasterProps.cells`), and the
environment has it (probe: `typeof toBase64 === 'function'`). See P2.

## 3. Design and maintainability

**D1. Medium. `register.tsx` (1,068 lines, a 30-field `Mod`) can shrink
within the engine's rules.** The research notes list the duplicated
pipelines; this item is how to fix them. Pass ports, not `$`: build
`portsOf($)` in `register.tsx` as an object of closures (`now`, `blit`,
`sleep`, `invalidate`, `listAgents`, `log`). That is the same shape as
`storeOf`. With ports:

- `animate`, `areaCells` and `siteCells` move to a `paint.ts` that takes
  ports, which also makes the loop testable as a pure state machine;
- the four read-credit-apply-commit sites collapse into one
  `move($, mod, build)`;
- demo construction and labels (`register.tsx:816-839`) move to `demo.ts`;
- `Mod`, `Site`, `createMod` and `frameMs` move to a `mod.ts`.

`hooks.json` also takes several `modules`, but separate modules would share
only `$.state` and the store, so ports are the lighter route.

**D2. Low. Duplicated helpers.**
- `rank`/`standing` appear in `auto.ts:175-179`, `stages.ts:114` and
  `workflow.ts:54`. The comment admits it; the cycle could break with a
  tiny `ranks.ts`.
- Code-point counting is written three times: `chars` in `auto.ts:32` and
  `workflow.ts:81`, `charCount` in `stages.ts:22`.
- The drive-letter regex appears in `auto.ts:129` and `progress.ts:19-20`.
- `seat()` hard-codes `[0, 1, 2, 3]` (`waiting/seats.ts:114`) next to an
  unused `SEATS` (`:8`).
- `drawRows` (`waiting/index.ts:45-53`) re-implements `drawSprite` with
  mirroring, and spreads every row into an array every frame.

**D3. Nit. Dead code.**
- `charCount` (`stages.ts:22`) is used nowhere.
- `credit` (`history.ts:40`) is used only by tests.
- `SEATS` (`waiting/seats.ts:8`) is unused.

**D4. Nit. A stale comment.** `idle/index.ts:1-4` still says the idle Clawd
sits "beside the bar". Since v0.5 his box sits at the bottom-left of the
48×7 area (`area.ts`).

**D5. Nit. `SceneId`, `IdleId` and `StageId` are all `string`.** That is
needed for data from files and state. Inside the library, though, the keys
could be typed `keyof typeof SCENES` / `ROUTINES`, to catch a misspelled
scene in `DEFAULT_WORKFLOW` at compile time instead of in a test.

## 4. Tests

The tests are strong on the pure modules: scenes are checked at every
moment, width and mood, loops are seamless, and parsing errors carry their
paths. The register tests cover wiring, sessions, auto moves and the
waiting toon. The gaps that matter:

- **T1. No test for two spinners at once** (C1). The harness's `ui.blit`
  drops `requestId`; add it to `Blit`.
- **T2. No test of the paint loops' lifetime or rate after the doze**
  (P1). Once a freeze exists, assert that blits stop N minutes into the
  doze and resume on the next render.
- **T3. No adversarial rule tests** (S1). Add a parse test that rejects a
  nested quantifier, and a runtime test that a long command against a
  permitted rule stays fast.
- **T4. No test for a mid-turn reload's credit** (C2) or for a newer
  `v` in the store (C3).
- **T5. One test passes even if the behaviour breaks.**
  "the idle Clawd stops repainting when Claude starts working"
  (`register-band.test.tsx:65-75`) never asserts that blits happened
  before the redraw. With a loop that never starts it still passes. Add
  `expect(blitsOf(world, 'area').length).toBeGreaterThan(0)` before the
  redraw.
- **T6. Brittle by design.** "about six frames a second"
  (`register-band.test.tsx:24-27`) pins the exact rate (4 to 8 blits a
  second). A frame-skip (P3) or a doze rate change will need it reworded
  to count distinct frames, or to allow fewer blits.

## 5. Performance

Numbers come from `/tmp/code-review/bench.ts`, `frames.ts`, `cells.ts` and
`enc2.ts`, built from a copy of `hooks/`. Each ran under Node 22 (V8) and
Bun 1.3 (JSC). The Claude Code binary embeds `bun:jsc`, so **the Bun numbers
are the likely ones in the plugin environment**. Host-side costs (each `$`
round trip, the blit decode, the terminal write) cannot be measured from
here and are marked as estimates.

### What one frame costs (measured)

| Work per frame | V8 | Bun/JSC | JS heap garbage |
|---|---|---|---|
| `composeFrame`, mean of 38 scenes (no reaction) | 11 µs | 16 µs | ~13 KB (Clawd pixel objects) |
| `composeFrame` with a wipe and the advance reaction | 26 µs | 29 µs | |
| `encodeCells` (47×7 cells, 5,264 base64 chars) | 48–61 µs | 88–190 µs | **~177 KB** |
|   of which `toWords` (336 temporary arrays) | 13 µs | 21 µs | |
|   of which the JS base64 loop (string `+=`) | 35 µs | 69–180 µs | |
| Encoding with direct writes plus native `toBase64` | 12 µs (JS fallback) | **4.3 µs** | **~5.5 KB** |
| Idle area frame (routine, place, crop, encode) | 64 µs | ~105 µs | ~189 KB |
| Waiting toon, 4 seated (reseat, frame, encode) | 70 µs | 113 µs | |
| `bandLayout` (one band render, 120 columns, wide text) | 96 µs | 94 µs | |

Plugin CPU today is small. The toon costs about 1.3 ms/s at 12 fps (0.13% of
a core) and the idle area about 0.6 ms/s at 6 fps (Bun). Garbage is the
bigger in-plugin cost: about 2.1 MB/s while Claude works, and about 1.1 MB/s
(about 4 GB/h) while idle, all from encoding. The terminal-side work per
frame is very likely larger than the plugin's, so **the number of frames
matters more than the cost of each one**. That is why P1 and P3 come first.

### How much frames change (measured)

| Loop | Rate | Frames identical to the one before | Changed cells per frame (of 329) |
|---|---|---|---|
| Toon (38 scenes, 60 s each) | 83 ms | **48%** | 4–11 |
| Idle classic | 166 ms | **74%** | 0.9 |
| Idle coffee / reading / yo-yo / nyan | 166 ms | 42% / 50% / 16% / 3% | 2.6 / 4.1 / 7.1 / 43 |
| Doze | 166 ms | **50%** (only 6 distinct frames exist) | 3.8 |
| Doze at 333 ms | 333 ms | 0%, with the same picture | |
| Waiting toon, 3 seated | 83 ms | 24% | |

Every frame sends the full 5,264-character payload to the host, even when 1
cell changed.

### Findings

**P1. Medium-high. The idle loop runs all night.**
`animate`'s loop (`register.tsx:493`) ends only when the area unmounts, the
band is hidden or blits are refused. Neither the doze (`idle/doze.ts:9`) nor
time stops it. Probe: 362 blits in the first minute, then **3,614 blits in
10 minutes of doze, 6 distinct frames**. Over an 8-hour night (estimates)
that is about 173,000 iterations. Each one makes 3 host round trips
(`clock.now`, `blit`, `sleep`), so about 520,000 `$` calls, 0.9 GB of base64
strings and about 30 GB of short-lived garbage. The terminal receives a
redraw several times a second the whole time. That keeps a terminal tab
"active" (tmux activity, tab badges), wakes the GPU or renderer, and costs
SSH bandwidth.

The research's idea #10 (calm mode) names this; these numbers are new, and
so is the fix:
1. dozing, draw at 333 ms: halves the blits with no visible change;
2. after `DEEP_SLEEP_MS` of doze (for example 5 min), blit one still frame
   (Clawd sitting, a static "z") and end the loop with the site kept. Any
   render, prompt or agent change starts it again. The `!wasShown`
   restart path already exists (`:1023-1033`);
3. P3's skip of identical frames.

Expected gain: about 99% fewer overnight frames (about 2,000 instead of
about 173,000), and the terminal quiet after 5 minutes.

**P2. Medium. Encoding allocates about 177 KB per frame.**
`pixels.ts:36-52` writes each cell with `words.set([a, b, c], i)`, which
allocates 336 temporary arrays. `pixels.ts:56-69` builds 5,264 characters
with about 2,700 string concatenations. Fix: write the three words by index,
keep one `Uint32Array` per site size, and use `bytes.toBase64()` when present
(it is in the plugin environment), with the current loop as the fallback.
Measured: 88–190 µs down to 4.3 µs (Bun), and 177 KB down to 5.5 KB of
garbage per frame. The existing `base64` test still pins the fallback to
`btoa`'s output.

**P3. Medium. Identical frames are blitted.**
Every iteration blits (`register.tsx:518`), but 48% of toon frames and 74%
of classic-idle frames are unchanged (table). Fix: keep `site.lastCells`.
When `cells === lastCells` and nothing about the site changed (requestId,
columns), skip the blit and keep `refused` as it is. A string comparison of
5 KB costs about 1 µs. Clear `lastCells` on every render, which mounts a
new Raster. Expected gain: about half the blits while working, about
three-quarters while classic idles.

**P4. Medium. The store is read on every rule-kind tool call, including
kinds that have no rules.**
`tool.call` builds a signal for every main-conversation Bash, Write, Edit
and Skill call (`register.tsx:788-790`, `signalOf` `:297-313`). `autoMove`
then reads and validates the whole stored progress before `autoTarget` can
say "no rule" (`:319-322`). Probe: a Bash call under the default workflow,
which has no `bash` rule, made 1 `store.get`; an Edit made 1 `store.get` plus
1 `session.cwd`. At 200 entries a read is 37 KB cloned plus 0.38 ms (V8) to
0.55 ms (Bun) of `validate`, so a 30-command turn spends about 1.1 MB and
about 16 ms on reads that cannot move anything. Fixes:
- (a) skip the signal unless some stage has a rule of that kind
  (`hasRulesOf(w, kind)`). That makes Bash free under the default
  workflow;
- (b) run `autoTarget` on the in-memory progress first, and read the store
  only when it finds a target;
- (c) in `latestProgress`, compare `updatedAt` on the raw object before the
  full `validate` (`:238`). That saves most of the 0.4–0.55 ms on every
  prompt, command and turn end.

Per action today (probe):
- session start: 4 `store.get`, 1 `store.set`, 7 `state.set`,
  1 `agent.list`;
- `set_stage` or a move: 1 get and 1 set;
- prompt: 1 get;
- turn end: 1 get, 1 set (when time was worked) and 1 `agent.list`;
- `/stage`: 1 get.

**P5. Medium. The store fills at about 100 projects, and every turn
rewrites a whole project.**
Measured: a project with 200 entries (feature 40 characters, via 60) is
**36.9 KB compact and 48.6 KB pretty-printed**. The store file on disk is
pretty-printed (`~/.claude/plugins/store/stage-toons_inline-*.json`). The
4 MiB limit therefore holds **86 to 113 such projects**, and active users
reach that within the 180-day prune window. Past it every `store.set`
rejects and the mod warns "couldn't save progress".

`creditTurn` saves the whole value on every main turn's end
(`register.tsx:357`). If the engine rewrites the whole file on each set, as
the pretty-printed single file suggests (estimate, not visible), a turn end
with 20 tracked projects writes about 1 MB.

Fixes, in order of ease:
- (a) a project cap besides age, for example keep the 50 most recently
  updated;
- (b) store `feature` only on the entry where it changes. It repeats in
  every entry, up to 8 KB per project;
- (c) a compact v3 entry such as `[stage, at, by, workMs?, via?]`, about 45%
  smaller. Do C3 first, so older copies don't overwrite v3;
- (d) optional: save the turn's credit debounced (at most every few
  minutes, plus moves and `session.end`, which has a budget for this)
  instead of every turn. That trades a slightly longer race window.

**P6. Low. Two loops run during a demo while Claude works.**
Measured 25 blits/s (toon 13, area 12). This is bounded by the demo's
length, at most 37 scenes × 60 s. Acceptable; noted for completeness.

**P7. Low. The agent-list poll runs while idle teammates exist.**
`register.tsx:499` polls every 2 s while `roster.size > 0`, and the roster
keeps idle teammates (`agents.ts:70-72`), so a session with idle teammates
polls all the while the area shows. Also, when the area shows again,
`checkAgents` runs twice: from the render (`:1031`) and from the loop's first
iteration (`:496-498`). Fix: poll on `atWork(roster).length > 0`, or at 10 s
while only idle teammates remain. Teammate turns fire `agent.spawn` and
`turn.complete` anyway. Drop the render-side call when the loop is about to
poll.

**P8. Low. `bandLayout` takes 94 µs per band render.**
`cellWidth` (`stages.ts:47-56`) runs `Array.from` and scans 55 ranges for
every character, and the layout measures the same strings several times. It
runs once per render, so this is low. A fast path for ASCII text (a
`/^[\x20-\x7e]*$/` test, then `length`) makes common bars nearly free.

**P9. Nit. Per-frame allocations in compose.**
- `castOf` builds an object and a closure every toon frame (`:392-399`);
  hoist it to `Mod`.
- `clawdPixels` allocates about 100 `{x, y, c}` objects per Clawd per
  frame, plus a spread and a filter (`clawd.ts:86-144`). It could cache by
  look, but it is only about 13 KB per frame; low value once P2 lands.

### Already fine

- Scene drawing: 10–16 µs mean, at most about 35 µs under JIT warm-up.
  The first three entries in the bench were warm-up effects, not slow
  scenes.
- Auto-rule matching: 1–2 µs per call for sane rules, even with the
  per-call `RegExp` compile.
- `/stage log 200`: about 7 ms. `/stage time`: about 1 ms. Fine for
  commands.
- Startup: a handful of store and state calls; the workflow file is read
  once a session.
- The band's text renders only on prop or state changes, and a demo's line
  invalidates only when the scene changes (`:513-517`).
- The toon loop stops at the main turn's end, on hide and on refusals.
- The area loop stops while Claude works (text mode).
- The prompt section is fixed per session, so the prompt cache holds.

## 6. Security and robustness

**S1. Medium. Rules from the workflow file can hang the plugin
(catastrophic backtracking).**
Evidence:
- a `bash` rule is any `RegExp` that compiles (`auto.ts:58-64`), limited
  only to 120 characters, and is tested against the whole command on every
  main-conversation Bash call (`auto.ts:164-169`);
- globs become regexes (`auto.ts:109-127`) and run on every Write/Edit.

Measured in Bun:

| Pattern | Input | Time |
|---|---|---|
| `^(a\|a)*$` | 27 characters | 0.9 s |
| `^(\S+\s*)+merge$` (plausible) | 28, 32, 36 characters | 4 ms, 63 ms, 0.7 s, doubling per character |
| glob `*a*a*a*a*a*a*a*a*b` | 30 characters | 32 ms; polynomial with more `*` |

The match is synchronous inside the `tool.call` hook. A JS regex cannot be
interrupted, so the plugin environment's thread stays busy past the 10 s
hook budget (`HookBudget.ms`), and its renders and blits stall. The file
belongs to the project, so a repository can commit one.

Fixes:
- (a) Compile rules once at parse time, which also removes the per-call
  compile.
- (b) Reject risky shapes at parse with path-located errors, like the
  other mistakes: a quantified group that contains a quantifier (star
  height above 1) and alternation inside a quantified group.
- (c) Test against at most the first line and the first 500 characters of
  the command.
- (d) Consider simpler `bash` semantics, a glob over the command (`git
  merge*`) or "starts with", which the research already calls less brittle.
- (e) For globs, collapse runs of `*` and cap the stars at about 8.

**S2. Low. Rule-matched commands are kept in plain text.**
`viaOf` stores `ran <command>` (cut to 60 characters, `auto.ts:213-214`) in
the history and the note. It is saved to the store, shown by `/stage log`,
and sent to Claude. A matched command can carry a token
(`curl -H "Authorization: …"`). Fix: record the rule, not the command
(`bash rule "git merge"`), as `skill` and `agent` already effectively do.

**S3. Low. The workflow file reaches the system prompt.**
`when` lines (up to 120 characters × 20 stages) and labels from
`.claude/stage-toons.json` go into the session-scoped prompt section
(`prompt.ts:33-50`). This is the same trust level as a project's CLAUDE.md,
so it is low on its own. The file is just less likely to be reviewed. Worth
a line in the README ("the workflow file's `when` lines are shown to
Claude").

**S4. Nit. No size limit when reading the workflow file.**
`readWorkflowFile` reads and `JSON.parse`s the whole file
(`register.tsx:545-555`). Refuse files over, for example, 64 KB with an
error.

Checked and fine:
- The mod writes outside its store only `.claude/stage-toons.json`, on an
  explicit `/stage workflow init`, and never over an existing file
  (`register.tsx:573-592`).
- Stored progress is shape-checked field by field; lengths are cut and
  numbers must be finite (`progress.ts:27-65`).
- Parse errors are listed with their paths, and the session keeps a working
  workflow.
- Pruning never touches the session's own key or one it can't read.
- No model requests, no network, no process spawning.

## How this was verified

Repository, read-only:
- `claude plugin test stage-toons`: 315 pass, 0 fail, 15.5 s.
- `claude plugin validate stage-toons` and `claude plugin validate .`: both
  pass.
- `npx -y -p typescript@5 tsc -p ~/.claude/dev-mods/42be0169-…/stage-toons`:
  clean. `diff -r` showed its `hooks/` and `types/` identical to the repo's.

Throwaway work under `/tmp/code-review/` (never the repo):
- `bench.ts`: per-frame and data-path timings (compose per scene, encode
  split, idle, waiting, `bandLayout`, `validate`, `logText`/`timeText`,
  `staleKeys`, `autoTarget`, progress JSON sizes). Built with `bun build`
  and run under `node`; run directly under `bun`.
- Allocation: `node --trace-gc bench.js alloc <path>`, summing
  scavenged megabytes over 20,000 frames. Typed-array backing stores are
  not counted, so the figures are lower bounds.
- `frames.ts` and `cells.ts`: identical-frame share and changed cells per
  frame for every loop at its real rate.
- `enc2.ts`: the encoder rewrite (direct writes plus `toBase64` or a
  byte-table fallback), checked equal to `encodeCells` and timed.
- `redos.ts`, `redos2.ts` and `redos3.ts`: timings of the patterns in S1.
- `plugin/`, a copy of the mod with `hooks/zz-probe.test.tsx` and a harness
  patched to count `store.get`/`set`, `agent.list` and blits per
  `requestId`. Run with `claude plugin test /tmp/code-review/plugin`, it:
  - checked the environment for `toBase64` and timed regexes in it;
  - counted store and list traffic per action;
  - ran two spinners at once (C1);
  - measured the doze's blits over 10 minutes (P1);
  - kept blits refused for 60 s (C4);
  - ran a demo while Claude works (P6);
  - ran a mid-turn reload's credit (C2).
- A `$`-taking helper imported from a second file, rejected by both
  `validate` and the test kit (section 2).

Not verified, because a cloud session can't see the terminal:
- the host's costs per `$` call and per blit, and the terminal output;
- whether a collapsed band still renders (C4);
- whether the store rewrites the whole file on each set (P5).
