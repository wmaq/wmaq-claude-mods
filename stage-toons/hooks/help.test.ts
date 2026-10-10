import { expect, test } from 'claude-code/testing'

import { parseCommand, unknownText } from './command'
import { COMMAND_LINES, HELP_TOPICS, helpText, usage } from './help'
import { DEFAULT_WORKFLOW } from './workflow'

const W = DEFAULT_WORKFLOW

test('/stage help takes a topic, commands, or a word it answers with the topics', () => {
  expect(parseCommand(W, 'help')).toEqual({ kind: 'help', topic: null })
  expect(parseCommand(W, 'HELP Dj')).toEqual({ kind: 'help', topic: 'dj' })
  expect(parseCommand(W, 'help commands')).toEqual({ kind: 'help', topic: 'commands' })
  expect(parseCommand(W, 'help  dj  party')).toEqual({ kind: 'help', topic: 'dj party' })
})

test('the overview names every topic and where to go next', () => {
  const text = helpText(W, null)
  // The engine puts stage-toons: before it.
  expect(text.startsWith('A progress bar of your workflow')).toBe(true)
  for (const id of HELP_TOPICS) expect(text).toMatch(new RegExp(`^  ${id} +\\S`, 'm'))
  expect(text).toContain('/stage help <topic>')
  expect(text).toContain('/stage help commands')
})

test('a topic page has its paragraph, its commands, and what is on now when given', () => {
  const calm = helpText(W, 'calm', 'Calm mode is off.')
  expect(calm).toContain('Calm mode')
  expect(calm).toContain('/stage calm [on | off]')
  expect(calm).not.toContain('/stage dj [on | off]')
  expect(calm.endsWith('Now:\n  Calm mode is off.')).toBe(true)
  // A topic with no setting has no Now.
  expect(helpText(W, 'waiting')).not.toContain('Now:')
  expect(helpText(W, 'waiting')).toContain('/stage demo waiting [scene]')
  // A Now of several lines is indented line by line.
  expect(helpText(W, 'bar', 'Stage 5/10 Plan\nRecent moves:')).toContain('Now:\n  Stage 5/10 Plan\n  Recent moves:')
})

test('every command line belongs to a topic, but /stage help', () => {
  for (const line of COMMAND_LINES) {
    if (line.text(W).includes('/stage help')) expect(line.topics).toEqual([])
    else expect(line.topics.length).toBeGreaterThan(0)
  }
  for (const id of HELP_TOPICS) expect(COMMAND_LINES.some(line => line.topics.includes(id))).toBe(true)
})

test('/stage help commands is the full list, as /stage help was', () => {
  expect(helpText(W, 'commands')).toBe(usage(W))
  expect(usage(W).split('\n')[0]).toMatch(/^Usage: \/stage \[/)
  expect(usage(W)).toContain('  /stage help             the guide: /stage help <topic> for one feature, /stage help commands for this list')
})

test('an unknown topic lists the topics', () => {
  expect(helpText(W, 'me')).toBe(`No help topic "me". Topics: ${HELP_TOPICS.join(', ')}, commands.`)
  expect(unknownText(W, 'bogus')).toBe('Not a /stage command: bogus. /stage help commands lists them all.')
})
