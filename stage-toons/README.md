# stage-toons

A stepped progress bar of your development workflow, drawn above the Claude
Code prompt, with little pixel-art cartoons of Clawd under the spinner while
Claude works. When a Fable subagent comes in to audit or to consult, a
second, violet Clawd with a monocle walks on stage to review the work.

```
 ●━●━●━●━◉─○─○─○─○─○  5/10 Plan · stage-toons
 Writing the implementation plan
```

Inspired by [claude-toons](https://github.com/achimala/claude-toons) by
Anshu Chimala, whose Clawd sprite it borrows (MIT; see `NOTICE`).

## The stages

| # | Stage | What it means |
|---|---|---|
| 1 | Roadmap | Roadmap discussion and new-feature brainstorming |
| 2 | Brainstorm | Brainstorming one feature |
| 3 | Spec | Writing the spec |
| 4 | Spec audit | A Fable subagent audits the spec |
| 5 | Plan | Writing the implementation plan |
| 6 | Plan audit | A Fable subagent audits the plan |
| 7 | Develop | Building it |
| 8 | Claude testing | Claude verifies the work |
| 9 | Your testing | You test it |
| 10 | Cleanup | Leftovers, chores and docs |

Beside the track are two side stages, which the work can enter from any
point and leave again:

| Stage | What it means |
|---|---|
| Debugging | Finding and fixing a bug, at any point (`/stage debugging`) |
| Other | Anything that fits none of them (`/stage 0` or `/stage ?`) |

On a side stage the bar shows the stage instead of the track, and the track
stage the work returns to:

```
 Debugging · login bug   ↩ 7/10 Develop
 Reproducing the failing login test
```

This is the default workflow. A project can define its own (below).

## How the bar moves

Claude moves it. The mod gives Claude a `set_stage` tool and a short note in
the system prompt listing the stages; Claude calls the tool when the work
moves on (forwards, backwards or skipping) and writes the message under the
bar. Some steps move it by themselves (below). Progress is saved per
project directory and survives restarts.

You can move it yourself with `/stage`:

| Command | Effect |
|---|---|
| `/stage` | Show the stage and the recent moves |
| `/stage 5`, `/stage plan` | Move to a stage (`0` or `?` for Other) |
| `/stage debugging` | Move to a side stage by its id |
| `/stage next`, `/stage back` | One step |
| `/stage feature <name>` | Name the feature (`/stage feature -` clears it) |
| `/stage message <text>` | Set the message |
| `/stage hide` | Hide or show the bar and the cartoons |
| `/stage demo [<stage> \| idle] [seconds]` | Play every scene, one stage's scenes (by id), or the idle routines, 10 s each (2 to 60); a bare number is the seconds |
| `/stage demo waiting` | Play the waiting toon with pretend agents (about 25 s) |
| `/stage demo stop` | End the demo |
| `/stage workflow` | Show the workflow, where it came from, and each stage's scenes |
| `/stage workflow init` | Write the default workflow to `.claude/stage-toons.json` to edit |
| `/stage workflow reload` | Read `.claude/stage-toons.json` again and switch to it |
| `/stage auto [on \| off]` | Show the rules that move the stage by itself; turn them on or off |
| `/stage log [n]` | The last n moves (15; up to 200) with how long each stage lasted |
| `/stage time` | Time per feature and per stage |

Claude is told about your moves.

### By itself

Some steps of the workflow are plain to see from what Claude does, and the
bar moves on them without waiting for `set_stage`. With the default
workflow and the [superpowers](https://github.com/obra/superpowers) skills:

| Claude... | The bar moves to |
|---|---|
| loads `superpowers:brainstorming` | Brainstorm |
| writes a file under `docs/superpowers/specs/` | Spec |
| starts a Fable subagent during Brainstorm or Spec | Spec audit |
| loads `superpowers:writing-plans`, or writes under `docs/superpowers/plans/` | Plan |
| starts a Fable subagent during Plan | Plan audit |
| loads `superpowers:executing-plans` or `superpowers:subagent-driven-development` | Develop |
| loads `superpowers:finishing-a-development-branch` | Cleanup |
| loads `superpowers:systematic-debugging` | Debugging |

The bar only moves forward this way (or into a side stage): fixing the
spec during its audit, or ticking the plan's boxes while developing, moves
nothing. Only the main conversation counts, not subagents or teammates, and
only files written with Write or Edit. Claude is told of each such move
with the result of the call that made it (for a subagent, the call after
it, as the Agent call answers before the subagent starts), and still calls `set_stage` for
a better message or any other move. `/stage auto off` turns this off, for
every project; a workflow file sets its own rules, and may start its
project's sessions with them off (below).

### History

Each move is kept with the feature, who made it (Claude, you, or `auto`
and why) and how long Claude worked in it, for the last 200 moves.
`/stage log` lists the recent ones with how long each stage lasted;
`/stage time` totals the time per feature and per stage. Wall-clock time
counts the hours nobody worked (a night in Your testing); Claude's working
time is the time its turns ran. Both also show what the work cost, where
it was counted: dollars as `/cost` totals them (compaction and other
plugins' model calls included) and the tokens in and out of Claude's
turns and its agents'. While the session's cost can't be read, the dollars
wait and go to the stage current when it can again.

## While Claude waits for you

When Claude isn't working, the band shows an area below the bar, 48
columns by 7 rows, as the demo does. A small Clawd stands at its left. He
has five routines: the classic one (he blinks, glances at the prompt and
the bar, taps a foot), Nyan Clawd, coffee (he sips from a steaming mug),
reading (he turns the pages of a book) and yo-yo. One is picked each time a
turn starts. Whichever it is, after a minute he sits down and dozes off.

## While Claude waits on agents

When Claude's turn ends while agents still work (background subagents, a
Fable audit, teammates), Clawd walks aside with a cup of coffee and a row
of small helpers sits at laptops beside him, one for each agent at work,
in its model's colour: Sonnet magenta, Opus orange, Fable violet (with a
monocle), Haiku teal, any other model grey. Four seats; more agents wait
for one to free. A helper hops up and walks off when its agent finishes,
and when the last has gone Clawd walks back and his idle routine plays. He
doesn't doze while agents work. `/stage demo waiting` plays it with
pretend agents.

The area shows in a terminal at least 30 columns wide with room for the
bar and 7 rows (8 or 9 rows of band); otherwise the bar is text alone.

`/stage demo` plays all 37 scenes of the library in turn below the bar,
each named with the stage that plays it, so you can see them without
waiting for the work to reach each stage. `/stage demo plan` plays only the
scenes of one stage, `/stage demo idle` the idle routines and
`/stage demo waiting` the waiting toon. A new prompt ends the demo.

## Your own workflow

A project can define its own stages in `.claude/stage-toons.json`.
`/stage workflow init` writes the default there to start from; edit it,
then `/stage workflow reload`. Without the file, the default applies.

A workflow has `track` stages, in order, and `side` stages, which the work
can enter from any point and leave again. Each stage has an `id` (what
`set_stage` and `/stage` take), a `label` for the bar, a `message` for the
status line, a `when` line telling Claude when to move there, and `scenes`:

```json
{
  "track": [
    { "id": "develop", "label": "Develop", "message": "Building it",
      "when": "writing the code", "scenes": ["bricklaying", "terminal"] }
  ],
  "side": [
    { "id": "debugging", "label": "Debugging", "message": "Hunting a bug",
      "when": "finding and fixing a bug, at any point", "scenes": ["bug-hunt"] }
  ]
}
```

A stage may also list `auto` rules: what, done in the main conversation,
moves the work into it (only forward on the track, or into a side stage).
Each rule has one of `skill` (a skill's name; without a `plugin:` part it
matches any plugin's skill of that name), `write` (a glob on the file's
path from the project directory: `**` any run, `*` within a folder, `?`
one character), `agent` (a model family, such as `fable`, that a subagent
runs on) or `bash` (a regular expression on a command), and may add
`from`, the stages it fires from:

```json
"auto": [
  { "skill": "superpowers:writing-plans" },
  { "write": "docs/superpowers/plans/**" },
  { "agent": "fable", "from": ["plan"] },
  { "bash": "git merge" }
]
```

Up to 8 rules a stage. A `bash` rule may not repeat a group that itself
repeats or chooses (`(a+)*`, `(a|b)+`), which can take too long to
match, and reads at most the first 500 characters of a command; a glob
holds at most 8 `*`. The file's `when` lines are shown to Claude in the
system prompt, as CLAUDE.md is. A workflow file in which no stage has an
`auto` field (as `/stage workflow init` wrote before 0.6) takes the
default's rules for the stages it shares with the default by id; give any
stage an `auto` list, even an empty one, and the file has only its own.

Beside `track` and `side`, the file may set how a session on the project
starts: `"auto": false` with the rules off, `"hide": true` with the bar and
the cartoons hidden (and `true` or `false` the other way). Where the file
sets one, it wins over your own `/stage auto` or `/stage hide` setting, at
each session's start and at `/stage workflow reload`; where it says
nothing, yours applies. The commands still change the session at once, and
say when the file starts it otherwise. `/stage workflow init` writes
neither.

```json
{ "auto": false, "hide": true, "track": [ ... ] }
```

A stage lists 1 to 5 scenes, dealt like a shuffled deck: each time the
work enters the stage it shows the next one, every scene once before any
repeats, never the same twice in a row. The
older `"scene": "bug-hunt"` still works. A workflow file keeps its own
lists: a file written by `/stage workflow init` before 0.4.1 names two
scenes per stage, so add the new ones to it (or delete the file to use the
default) to see them.

Scenes: road-trip, light-bulbs, writing-desk, proofread-page,
stepping-stones, proofread-checklist, bricklaying, test-tubes, gift,
sweeping, bug-hunt, mystery-box, and the second and third scene of each
default stage: stargazing, sticky-notes, blueprint, red-pen, dominoes,
clipboard, terminal, control-panel, waiting-bench, dishes, flashlight,
fishing; treasure-map, thought-clouds, scroll, stamp, ladder, scales,
workbench, crash-test, cake, recycling, bug-net, dice. `/stage demo` plays
them all, and a 37th, fable-audit, which plays while a
Fable subagent runs rather than for a stage; `/stage workflow` shows the
current workflow and its scenes.

Limits: 1 to 15 track stages, up to 5 side stages; ids are lowercase
letters, digits and dashes, and not one of `/stage`'s words (`next`,
`back`, `hide`, `demo`, `feature`, `message`, `workflow`, `auto`, `log`,
`time`). A mistake in the file is reported with where it
is, and the session keeps a working workflow.

## Install

Needs Claude Code 2.1.288 or later with plugin hook modules (early access).

The repository is a plugin marketplace. Add it once, install the mod, and
restart Claude Code; it then loads in every session:

```sh
claude plugin marketplace add wmaq/claude-mods
claude plugin install stage-toons@claude-mods
```

To update:

```sh
claude plugin marketplace update claude-mods
claude plugin update stage-toons@claude-mods
```

### From a clone

To run the mod from your own copy instead, clone the repository wherever
you keep your code:

```sh
git clone https://github.com/wmaq/claude-mods.git
```

The mod is the `stage-toons` folder inside it. Below, `<path>` stands for
that folder's full path, such as `/home/you/src/claude-mods/stage-toons` or
`C:\src\claude-mods\stage-toons`.

- For one session: `claude --plugin-dir <path>`.
- For every session, add the folder to the `env` block of
  `~/.claude/settings.json` (on Windows, write each `\` in the path as
  `\\`), then restart Claude Code:

  ```json
  {
    "env": {
      "CLAUDE_CODE_PLUGIN_DIRS": "<path>"
    }
  }
  ```

To update, run `git pull` in the clone. Don't load it this way while the
marketplace copy is enabled: two stage-toons would load.

The cartoons draw only in the terminal; the desktop app shows the bar as
text.

## What it costs

The cartoons are drawn locally: the mod makes no model requests. What it
adds to Claude's context:

- a short section in the system prompt (about 270 tokens, kept the same
  for a whole session so the prompt cache holds);
- Claude's occasional `set_stage` calls and their one-line answers;
- a one-line `[stage-toons]` note when the stage moves by itself or you
  move it with `/stage`.

## Development

```sh
claude plugin validate stage-toons
claude plugin test stage-toons
npx -y -p typescript@5 tsc -p stage-toons
```

`tsc` needs the editor types the engine writes into
`stage-toons/.claude-plugin/types/` the first time it loads the mod.

## Credits

Written by wmaq with Claude. The Clawd sprite is adapted from claude-toons
(MIT, Copyright (c) 2026 Anshu Chimala). stage-toons is MIT licensed; see
`LICENSE`.
