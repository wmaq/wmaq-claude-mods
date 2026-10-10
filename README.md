# wmaq-claude-mods

[![check](https://github.com/wmaq/wmaq-claude-mods/actions/workflows/check.yml/badge.svg)](https://github.com/wmaq/wmaq-claude-mods/actions/workflows/check.yml)

Mods for [Claude Code](https://claude.com/claude-code): plugins of function
hooks that change what Claude Code shows and does. They need Claude Code
2.1.288 or later with plugin hook modules (early access).

![stage-toons: the bar above the prompt, and Clawd at work below it](docs/media/stage-toons.gif)

| Mod | What it does | Version |
|---|---|---|
| [stage-toons](stage-toons/README.md) | A stepped progress bar of your development workflow above the prompt, with pixel-art cartoons of Clawd while Claude works | 1.0.0 ([changes](stage-toons/CHANGELOG.md)) |

The repository is a plugin marketplace:

```sh
claude plugin marketplace add wmaq/wmaq-claude-mods
claude plugin install stage-toons@wmaq-claude-mods
```

## How it was made

Built by wmaq with Claude Code: most commits are co-written with Claude.
Each feature went through the workflow stage-toons draws: a brainstorm, a
written spec audited by a second model, a plan audited the same way,
test-driven development, a review, and testing in a live session (more
in [`docs/`](docs/README.md)). [`CLAUDE.md`](CLAUDE.md)
is the project's instructions for Claude, with the engine behaviour
learned along the way. What is planned next is in
[docs/roadmap.md](docs/roadmap.md).

## License

MIT; see [LICENSE](LICENSE). stage-toons' Clawd sprite comes from
[claude-toons](https://github.com/achimala/claude-toons) (MIT; see
`stage-toons/NOTICE`).

An independent project, not affiliated with or endorsed by Anthropic.
Claude and Claude Code are trademarks of Anthropic.
