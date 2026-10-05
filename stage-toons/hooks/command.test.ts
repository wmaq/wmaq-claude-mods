import { expect, test } from 'claude-code/testing'

import { autoText, moveFor, parseCommand, showText, unknownText, usage, workflowSummary } from './command'
import { applyMove, freshProgress } from './stages'
import { DEFAULT_WORKFLOW } from './workflow'

const W = DEFAULT_WORKFLOW

test('/stage arguments parse into commands', () => {
  expect(parseCommand(DEFAULT_WORKFLOW, '')).toEqual({ kind: 'show' })
  expect(parseCommand(DEFAULT_WORKFLOW, '   ')).toEqual({ kind: 'show' })
  expect(parseCommand(DEFAULT_WORKFLOW, '5')).toEqual({ kind: 'move', stage: 'plan' })
  expect(parseCommand(DEFAULT_WORKFLOW, ' Plan ')).toEqual({ kind: 'move', stage: 'plan' })
  expect(parseCommand(DEFAULT_WORKFLOW, '?')).toEqual({ kind: 'move', stage: 'other' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'NEXT')).toEqual({ kind: 'next' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'back')).toEqual({ kind: 'back' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'hide')).toEqual({ kind: 'hide' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'feature  stage toons ')).toEqual({ kind: 'feature', name: 'stage toons' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'message Writing task 3')).toEqual({ kind: 'message', text: 'Writing task 3' })
  for (const bad of ['11', 'feature', 'message', 'next please', 'plan now', 'deploy']) expect(parseCommand(DEFAULT_WORKFLOW, bad)).toEqual({ kind: 'usage' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'HELP')).toEqual({ kind: 'help' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'help me')).toEqual({ kind: 'usage' })
})

test('a /stage it does not understand answers one line, naming the stage it may have meant', () => {
  expect(unknownText(W, ' set  roadmap ')).toBe('Not a /stage command: set roadmap. Did you mean /stage roadmap? /stage help lists them all.')
  expect(unknownText(W, 'plan now')).toBe('Not a /stage command: plan now. Did you mean /stage plan? /stage help lists them all.')
  expect(unknownText(W, 'bogus')).toBe('Not a /stage command: bogus. /stage help lists them all.')
  // A known word with a bad argument hints no stage: the seconds were wrong, not the stage.
  expect(unknownText(W, 'demo plan 99')).toBe('Not a /stage command: demo plan 99. /stage help lists them all.')
})

test('/stage demo takes the library, a stage by id, or idle, with seconds per item, or stop', () => {
  expect(parseCommand(W, 'demo')).toEqual({ kind: 'demo', seconds: 10, stage: null })
  expect(parseCommand(W, 'Demo 4')).toEqual({ kind: 'demo', seconds: 4, stage: null })
  expect(parseCommand(W, 'demo 60')).toEqual({ kind: 'demo', seconds: 60, stage: null })
  expect(parseCommand(W, 'demo develop')).toEqual({ kind: 'demo', seconds: 10, stage: 'develop' })
  expect(parseCommand(W, 'demo develop 5')).toEqual({ kind: 'demo', seconds: 5, stage: 'develop' })
  expect(parseCommand(W, 'demo idle')).toEqual({ kind: 'demo-idle', seconds: 10 })
  expect(parseCommand(W, 'demo idle 5')).toEqual({ kind: 'demo-idle', seconds: 5 })
  expect(parseCommand(W, 'demo stop')).toEqual({ kind: 'demo-stop' })
  expect(parseCommand(W, 'demo waiting')).toEqual({ kind: 'demo-waiting' })
  expect(parseCommand(W, 'Demo Waiting')).toEqual({ kind: 'demo-waiting' })
  for (const bad of ['demo 1', 'demo 61', 'demo 2.5', 'demo x', 'demo 5 6', 'demo -3', 'demo nope', 'demo develop 1', 'demo idle x', 'demo stop now', 'demo develop 5 6', 'demo waiting 5', 'demo waiting now']) {
    expect(parseCommand(W, bad)).toEqual({ kind: 'usage' })
  }
  expect(usage(W)).toContain('/stage demo [<stage> | idle] [seconds]')
  expect(usage(W)).toContain('/stage demo waiting')
})

test('commands move the progress as the user', () => {
  const p = freshProgress(0)
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'move', stage: 'spec' }, 5)).toMatchObject({ stage: 'spec', message: 'Writing the spec', history: [{ stage: 'spec', at: 5, by: 'user' }] })
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'next' }, 5).stage).toBe('roadmap')
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'back' }, 5).stage).toBeNull()
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'feature', name: 'gauge' }, 5).feature).toBe('gauge')
  expect(moveFor(DEFAULT_WORKFLOW, moveFor(DEFAULT_WORKFLOW, p, { kind: 'feature', name: 'gauge' }, 5), { kind: 'feature', name: '-' }, 6).feature).toBeNull()
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'message', text: 'poking' }, 5).message).toBe('poking')
  expect(moveFor(DEFAULT_WORKFLOW, p, { kind: 'show' }, 5)).toBe(p)
})

test('/stage alone shows the state and the latest moves first', () => {
  let p = applyMove(DEFAULT_WORKFLOW, freshProgress(0), { stage: 'spec', by: 'claude', at: 0 })
  p = applyMove(DEFAULT_WORKFLOW, p, { stage: 'plan', by: 'user', at: 60_000 })
  expect(showText(DEFAULT_WORKFLOW, p, 3 * 60_000)).toBe(
    [
      'Stage 5/10 Plan · no feature · "Writing the implementation plan"',
      'Recent moves:',
      '  5/10 Plan by user, 2m ago',
      '  3/10 Spec by claude, 3m ago',
    ].join('\n'),
  )
  expect(showText(DEFAULT_WORKFLOW, freshProgress(0), 0)).toBe('Stage Not tracked yet · no feature')
  expect(usage(DEFAULT_WORKFLOW)).toContain('/stage next')
})

test('the usage lists the workflow stages and says where 0 goes', () => {
  expect(usage(DEFAULT_WORKFLOW)).toContain('(0 or ? for Other)')
  expect(usage(DEFAULT_WORKFLOW)).toContain('Stages: 1 roadmap, 2 brainstorm, 3 spec, 4 spec-audit, 5 plan, 6 plan-audit, 7 develop, 8 claude-test, 9 user-test, 10 cleanup, done, debugging, 0 other')
  expect(usage(DEFAULT_WORKFLOW)).toContain('  /stage done             the feature is finished (merged); the next move starts a new one')
  const small = { track: DEFAULT_WORKFLOW.track.slice(0, 2), side: [] }
  expect(usage(small)).toContain('Stages: 1 roadmap, 2 brainstorm')
  expect(usage(small)).not.toContain('0 or ?')
})

test('/stage workflow shows, inits or reloads the workflow', () => {
  expect(parseCommand(W, 'workflow')).toEqual({ kind: 'workflow' })
  expect(parseCommand(W, 'Workflow INIT')).toEqual({ kind: 'workflow-init' })
  expect(parseCommand(W, 'workflow reload')).toEqual({ kind: 'workflow-reload' })
  expect(parseCommand(W, 'workflow edit')).toEqual({ kind: 'usage' })
  expect(usage(W)).toContain('/stage workflow [init | reload]')
})

test('the workflow summary says where it came from and lists the stages with their scenes', () => {
  const lines = workflowSummary(W, 'default').split('\n')
  expect(lines[0]).toBe('Workflow: the default (no .claude/stage-toons.json; /stage workflow init writes it there to edit)')
  expect(lines).toContain(`  7 develop: Develop (${W.track[6]!.scenes.join(', ')}) · auto: skill superpowers:executing-plans; skill superpowers:subagent-driven-development`)
  expect(lines).toContain(`  0 other: Other (${W.side[1]!.scenes.join(', ')})`)
  const two = { track: [{ ...W.track[0]!, scenes: ['road-trip', 'gift'] }], side: [] }
  expect(workflowSummary(two, 'file').split('\n')).toEqual(['Workflow: from .claude/stage-toons.json', 'Track:', '  1 roadmap: Roadmap (road-trip, gift)', 'Past the track:', '  done: Done (fireworks)'])
  const done = lines.find(line => line.startsWith('  done: '))
  expect(done?.startsWith('  done: Done (fireworks) · auto: bash ')).toBe(true)
  expect(done?.endsWith(' from user-test, cleanup')).toBe(true)
  expect(lines.indexOf('Past the track:')).toBe(lines.indexOf('Side:') - 2)
})

test('/stage auto, log and time parse', () => {
  expect(parseCommand(W, 'auto')).toEqual({ kind: 'auto', isOn: null })
  expect(parseCommand(W, 'Auto OFF')).toEqual({ kind: 'auto', isOn: false })
  expect(parseCommand(W, 'auto on')).toEqual({ kind: 'auto', isOn: true })
  expect(parseCommand(W, 'log')).toEqual({ kind: 'log', count: 15 })
  expect(parseCommand(W, 'log 200')).toEqual({ kind: 'log', count: 200 })
  expect(parseCommand(W, 'time')).toEqual({ kind: 'time' })
  for (const bad of ['auto maybe', 'log 0', 'log 201', 'log x', 'time now']) expect(parseCommand(W, bad)).toEqual({ kind: 'usage' })
  expect(usage(W)).toContain('/stage auto [on | off]')
  expect(usage(W)).toContain('/stage log [n]')
  expect(usage(W)).toContain('/stage time')
})

test('/stage auto lists the rules by the stage they move to; a workflow without rules says how to add them', () => {
  const text = autoText(W, true)
  expect(text).toContain('Automatic moves are on: /stage auto off turns them off.')
  expect(text).toContain('  spec-audit: agent fable from brainstorm, spec')
  expect(text).toContain('  plan: skill superpowers:writing-plans; write docs/superpowers/plans/**')
  expect(text).not.toContain('roadmap:')
  const bare = { track: W.track.map(({ auto: _, ...s }) => s), side: [] }
  expect(autoText(bare, false)).toBe(['Automatic moves are off: /stage auto on turns them on.', 'This workflow has no rules: give a stage an "auto" list in .claude/stage-toons.json.'].join(String.fromCharCode(10)))
})

test('/stage shows why an automatic move happened; the summary lists rules', () => {
  const p = applyMove(W, freshProgress(0), { stage: 'spec', by: 'auto', via: 'wrote docs/superpowers/specs/a.md', at: 0 })
  expect(showText(W, p, 0)).toContain('3/10 Spec by auto (wrote docs/superpowers/specs/a.md), just now')
  expect(workflowSummary(W, 'default')).toContain('  2 brainstorm: Brainstorm (light-bulbs, sticky-notes, thought-clouds) · auto: skill superpowers:brainstorming')
})

test('/stage done moves to Done; a word after it is not a command of its own', () => {
  expect(parseCommand(W, 'done')).toEqual({ kind: 'move', stage: 'done' })
  expect(parseCommand(W, ' DONE ')).toEqual({ kind: 'move', stage: 'done' })
  expect(unknownText(W, 'done now')).toBe('Not a /stage command: done now. Did you mean /stage done? /stage help lists them all.')
  expect(unknownText(W, 'demo plan 99')).toBe('Not a /stage command: demo plan 99. /stage help lists them all.')
})

test('/stage auto lists the rules into Done after the track', () => {
  const text = autoText(W, true)
  expect(text).toContain('Rules, by the stage they move the work to (only forward on the track, into Done, or into a side stage; from Done only a skill you type):')
  const lines = text.split(String.fromCharCode(10))
  const done = lines.findIndex(line => line.startsWith('  done: bash '))
  expect(lines[done - 1]).toBe('  cleanup: skill superpowers:finishing-a-development-branch')
  expect(lines[done + 1]).toBe('  debugging: skill superpowers:systematic-debugging')
})
