import { type Engine, expect, test } from 'claude-code/testing'

import { callTool, endTurn, engine, runStage, START, submit } from './harness'

const text = (answer: unknown) => (answer as { text?: string }).text ?? ''

// A command as the person types it (composer), or as another origin runs it.
const typeCommand = ($: Engine, command: string, kind = 'composer') => $.command.run({ command, args: '', origin: { kind } } as never)

// A skill's prompt as the engine expands it: typed, through the Skill tool, or preloaded.
const expand = ($: Engine, skill: string) => $.skill.prompt({ skill, text: `The ${skill} skill.` })

// The engine beneath: a command other than /stage runs and prints nothing,
// and a skill's prompt reads as computed.
function engineWithSkills(on: Parameters<typeof engine>[0]) {
  const made = engine(on)
  on('command.run', () => ({ text: '' }))
  on('skill.prompt', ($, e) => ({ text: e.text }))

  return made
}

test('a skill the person types moves the stage, by auto, and Claude hears of it with the first tool result', async ($, on) => {
  engineWithSkills(on)
  await $.session.start(START)
  await typeCommand($, 'superpowers:brainstorming')
  expect(text(await expand($, 'brainstorming'))).toBe('The brainstorming skill.')
  expect(text(await runStage($, ''))).toContain('2/10 Brainstorm by auto (skill superpowers:brainstorming), just now')
  expect((await callTool($, 'Read', { file_path: 'x' })).context?.[1]).toContain('[stage-toons] The stage moved by itself to 2/10 Brainstorm (skill superpowers:brainstorming)')
})

test('the skill expanded before its command is heard moves the stage too, and the note rides the next prompt', async ($, on) => {
  const { world } = engineWithSkills(on)
  await $.session.start(START)
  await expand($, 'superpowers:writing-plans')
  await typeCommand($, 'writing-plans')
  expect(text(await runStage($, ''))).toContain('5/10 Plan by auto (skill superpowers:writing-plans)')
  await submit($)
  expect(world.prompts.at(-1)?.[0]).toContain('[stage-toons] The stage moved by itself to 5/10 Plan')
})

test('bare names on both sides match a qualified rule', async ($, on) => {
  engineWithSkills(on)
  await $.session.start(START)
  await typeCommand($, 'brainstorming')
  await expand($, 'brainstorming')
  expect(text(await runStage($, ''))).toContain('2/10 Brainstorm by auto (skill brainstorming)')
})

test('a skill expanded with no command around it (a preload) moves nothing', async ($, on) => {
  engineWithSkills(on)
  await $.session.start(START)
  await expand($, 'superpowers:brainstorming')
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
})

test('a skill expanded 11 s after the command moves nothing', async ($, on) => {
  const { clock } = engineWithSkills(on)
  await $.session.start(START)
  await typeCommand($, 'superpowers:brainstorming')
  await clock.advance(11_000)
  await expand($, 'brainstorming')
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
})

test("a plugin's command, or one the person typed for another skill, moves nothing", async ($, on) => {
  engineWithSkills(on)
  await $.session.start(START)
  await typeCommand($, 'superpowers:brainstorming', 'plugin')
  await expand($, 'brainstorming')
  await typeCommand($, 'superpowers:writing-plans')
  await expand($, 'superpowers:brainstorming')
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
})

test("the main turn's end forgets a command its skill never followed", async ($, on) => {
  engineWithSkills(on)
  await $.session.start(START)
  await typeCommand($, 'superpowers:brainstorming')
  await endTurn($)
  await expand($, 'brainstorming')
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
})

test('/stage auto off stops a typed skill from moving the stage', async ($, on) => {
  engineWithSkills(on)
  await $.session.start(START)
  await runStage($, 'auto off')
  await typeCommand($, 'superpowers:brainstorming')
  await expand($, 'brainstorming')
  expect(text(await runStage($, ''))).toContain('Not tracked yet')
})

test('a /stage typed between the command and its skill is not heard as a command', async ($, on) => {
  engineWithSkills(on)
  await $.session.start(START)
  await typeCommand($, 'superpowers:brainstorming')
  await runStage($, '')
  await expand($, 'brainstorming')
  expect(text(await runStage($, ''))).toContain('2/10 Brainstorm by auto (skill superpowers:brainstorming)')
})
