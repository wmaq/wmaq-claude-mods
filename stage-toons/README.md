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
 ? Debugging · login bug   ↩ 7/10 Develop
 Reproducing the failing login test
```

This is the default workflow. A project can define its own (below).

## How the bar moves

Claude moves it. The mod gives Claude a `set_stage` tool and a short note in
the system prompt listing the stages; Claude calls the tool when the work
moves on (forwards, backwards or skipping) and writes the message under the
bar. Progress is saved per project directory and survives restarts.

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
| `/stage demo [seconds]` | Play every scene, 10 s each (2 to 60); `/stage demo stop` ends it |
| `/stage workflow` | Show the workflow, where it came from, and each stage's scene |
| `/stage workflow init` | Write the default workflow to `.claude/stage-toons.json` to edit |
| `/stage workflow reload` | Read `.claude/stage-toons.json` again and switch to it |

Claude is told about your moves.

## While Claude waits for you

When Claude isn't working, a small Clawd stands left of the bar. He blinks,
glances at the prompt and the bar, taps a foot, and after a minute sits
down and dozes off. He shows in a terminal at least 70 columns wide;
otherwise the bar is text alone.

`/stage demo` plays all 13 scenes of the library in turn below the bar,
each named with the stage that plays it, so you can see them without
waiting for the work to reach each stage. A new prompt ends the demo.

## Your own workflow

A project can define its own stages in `.claude/stage-toons.json`.
`/stage workflow init` writes the default there to start from; edit it,
then `/stage workflow reload`. Without the file, the default applies.

A workflow has `track` stages, in order, and `side` stages, which the work
can enter from any point and leave again. Each stage has an `id` (what
`set_stage` and `/stage` take), a `label` for the bar, a `message` for the
status line, a `when` line telling Claude when to move there, and a `scene`:

```json
{
  "track": [
    { "id": "plan", "label": "Plan", "message": "Writing the plan",
      "when": "writing the implementation plan", "scene": "stepping-stones" }
  ],
  "side": [
    { "id": "debugging", "label": "Debugging", "message": "Hunting a bug",
      "when": "finding and fixing a bug, at any point", "scene": "bug-hunt" }
  ]
}
```

Scenes: road-trip, light-bulbs, writing-desk, proofread-page,
stepping-stones, proofread-checklist, bricklaying, test-tubes, gift,
sweeping, bug-hunt, mystery-box. `/stage demo` plays them all;
`/stage workflow` shows the current workflow and its scenes.

Limits: 1 to 15 track stages, up to 5 side stages; ids are lowercase
letters, digits and dashes. A mistake in the file is reported with where it
is, and the session keeps a working workflow.

## Install

Needs Claude Code 2.1.288 or later with plugin hook modules (early access).

1. Clone the repository wherever you keep your code:

   ```sh
   git clone https://github.com/wmaq/claude-mods.git
   ```

   The mod is the `stage-toons` folder inside it. Below, `<path>` stands for
   that folder's full path, such as `/home/you/src/claude-mods/stage-toons`
   or `C:\src\claude-mods\stage-toons`.

2. Try it for one session:

   ```sh
   claude --plugin-dir <path>
   ```

3. To load it in every session, add the folder to the `env` block of
   `~/.claude/settings.json` (on Windows, write each `\` in the path as
   `\\`), then restart Claude Code:

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "<path>"
     }
   }
   ```

To update, run `git pull` in the clone.

The cartoons draw only in the terminal; the desktop app shows the bar as
text.

## What it costs

The cartoons are drawn locally: the mod makes no model requests. Its only
cost is a short section in the system prompt (about 250 tokens, kept the same
for a whole session so the prompt cache holds) and Claude's occasional
`set_stage` calls.

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
