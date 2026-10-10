import { expect, test } from 'claude-code/testing'

import type { Progress, StageId } from '../types'
import { autoMatch, autoTarget, TYPED_SKILL_MS, typedSkill, globRegExp, hasRules, isRiskyPattern, relativePath, ruleMatches, rulesAt, ruleText, type Signal, unknownFrom, viaOf } from './auto'
import { freshProgress } from './stages'
import { DEFAULT_WORKFLOW as W } from './workflow'

const at = (stage: StageId | null, lastTrackStage: StageId | null = stage): Progress => ({ ...freshProgress(0), stage, lastTrackStage })
const skill = (name: string): Signal => ({ kind: 'skill', name })
const write = (path: string): Signal => ({ kind: 'write', path })
const fable = (asked?: string, parentModel = 'claude-opus-5-5'): Signal => ({ kind: 'agent', model: 'claude-fable-5-1', asked, parentModel })

test('a list of rules reads; each mistake is listed with its path', () => {
  const errors: string[] = []
  expect(rulesAt([{ skill: ' superpowers:brainstorming ' }, { write: './docs/specs/**' }, { agent: 'fable', from: ['spec'] }, { bash: 'git merge' }], 'track[0].auto', errors)).toEqual([
    { skill: 'superpowers:brainstorming' },
    { write: 'docs/specs/**' },
    { agent: 'fable', from: ['spec'] },
    { bash: 'git merge' },
  ])
  expect(errors).toEqual([])
  const bad: string[] = []
  expect(rulesAt([{}, { skill: 'a', write: 'b' }, { skill: '' }, { bash: '(' }, { agent: 'two words' }, { skill: 'x', from: [] }, { skill: 'x', when: 'y' }, 'skill'], 'p', bad)).toBeNull()
  expect(bad).toEqual([
    'p[0]: needs one of skill, write, agent, bash, push',
    'p[1]: has more than one of skill, write, agent, bash, push',
    'p[2].skill: empty',
    expect.stringContaining('p[3].bash: not a regular expression'),
    'p[4].agent: one word, a model family such as fable',
    'p[5].from: 0 stage ids; 1 to 20',
    'p[6].when: not a field (skill, write, agent, bash, push, from)',
    'p[7]: not a rule (an object with one of skill, write, agent, bash, push, and perhaps from)',
  ])
  const long: string[] = []
  rulesAt([{ skill: 'x'.repeat(61) }], 'p', long)
  expect(long).toEqual(['p[0].skill: 61 characters, at most 60'])
  const many: string[] = []
  rulesAt(Array.from({ length: 9 }, () => ({ skill: 'x' })), 'p', many)
  expect(many).toEqual(['p: 9 rules; at most 8'])
  const notList: string[] = []
  rulesAt({ skill: 'x' }, 'p', notList)
  expect(notList).toEqual(['p: must be a list of rules'])
})

test('from names stages of the workflow', () => {
  expect(unknownFrom([{ agent: 'fable', from: ['spec', 'spek'] }], 'track[3].auto', ['spec', 'plan'])).toEqual(['track[3].auto[0].from[1]: "spek" is not a stage of this workflow'])
})

test('globs: ** any run, * within a folder, ? one character', () => {
  expect(globRegExp('docs/superpowers/specs/**', false).test('docs/superpowers/specs/a.md')).toBe(true)
  expect(globRegExp('docs/superpowers/specs/**', false).test('docs/superpowers/specs/x/a.md')).toBe(true)
  expect(globRegExp('docs/superpowers/specs/**', false).test('docs/superpowers/plans/a.md')).toBe(false)
  expect(globRegExp('docs/*.md', false).test('docs/a.md')).toBe(true)
  expect(globRegExp('docs/*.md', false).test('docs/x/a.md')).toBe(false)
  expect(globRegExp('**/spec?.md', false).test('spec1.md')).toBe(true)
  expect(globRegExp('**/spec?.md', false).test('a/b/spec2.md')).toBe(true)
  expect(globRegExp('a.(b)+', false).test('a.(b)+')).toBe(true)
  expect(globRegExp('Docs/**', true).test('docs/a')).toBe(true)
  expect(globRegExp('Docs/**', false).test('docs/a')).toBe(false)
})

test('paths are read relative to the project', () => {
  expect(relativePath('/home/me/proj/docs/a.md', '/home/me/proj')).toBe('docs/a.md')
  expect(relativePath('/home/me/proj/docs/a.md', '/home/me/proj/')).toBe('docs/a.md')
  expect(relativePath('/home/me/project2/a.md', '/home/me/proj')).toBe('/home/me/project2/a.md')
  expect(relativePath('./docs/a.md', '/home/me/proj')).toBe('docs/a.md')
  expect(relativePath('/docs/a.md', '/')).toBe('docs/a.md')
  expect(relativePath('C:/docs/a.md', 'C:/')).toBe('docs/a.md')
  const bs = String.fromCharCode(92)
  expect(relativePath(['c:', 'dev', 'proj', 'docs', 'a.md'].join(bs), 'C:/Dev/proj')).toBe('docs/a.md')
})

test('skills match by name, or by the name after the plugin, on either side', () => {
  expect(ruleMatches({ skill: 'superpowers:brainstorming' }, skill('superpowers:brainstorming'), false)).toBe(true)
  expect(ruleMatches({ skill: 'superpowers:brainstorming' }, skill('Superpowers:Brainstorming'), false)).toBe(true)
  expect(ruleMatches({ skill: 'brainstorming' }, skill('superpowers:brainstorming'), false)).toBe(true)
  // A bare name, as skill.prompt may give it, matches a qualified rule.
  expect(ruleMatches({ skill: 'superpowers:brainstorming' }, skill('brainstorming'), false)).toBe(true)
  expect(ruleMatches({ skill: 'superpowers:brainstorming' }, skill('other:brainstorming'), false)).toBe(false)
  expect(ruleMatches({ skill: 'storming' }, skill('superpowers:brainstorming'), false)).toBe(false)
  expect(ruleMatches({ skill: 'brainstorming' }, write('brainstorming'), false)).toBe(false)
})

test('agents match by model family; inheriting it from a parent on it does not count unless asked', () => {
  expect(ruleMatches({ agent: 'fable' }, fable(), false)).toBe(true)
  expect(ruleMatches({ agent: 'fable' }, fable(undefined, 'claude-fable-5-1'), false)).toBe(false)
  expect(ruleMatches({ agent: 'fable' }, fable('fable', 'claude-fable-5-1'), false)).toBe(true)
  expect(ruleMatches({ agent: 'opus' }, fable(), false)).toBe(false)
})

test('bash rules are regular expressions on the command', () => {
  expect(ruleMatches({ bash: 'git merge\\b' }, { kind: 'bash', command: 'git checkout main && git merge feat' }, false)).toBe(true)
  expect(ruleMatches({ bash: '^git merge' }, { kind: 'bash', command: 'git checkout main && git merge feat' }, false)).toBe(false)
})

test('the default rules carry a superpowers run forward through the track', () => {
  expect(autoTarget(W, at(null), skill('superpowers:brainstorming'), false)).toBe('brainstorm')
  expect(autoTarget(W, at('brainstorm'), write('docs/superpowers/specs/2026-10-04-x-design.md'), false)).toBe('spec')
  expect(autoTarget(W, at('spec'), fable('fable'), false)).toBe('spec-audit')
  expect(autoTarget(W, at('spec-audit'), skill('superpowers:writing-plans'), false)).toBe('plan')
  expect(autoTarget(W, at('plan'), fable('fable'), false)).toBe('plan-audit')
  expect(autoTarget(W, at('plan-audit'), skill('superpowers:subagent-driven-development'), false)).toBe('develop')
  expect(autoTarget(W, at('claude-test'), skill('superpowers:finishing-a-development-branch'), false)).toBe('cleanup')
  expect(autoTarget(W, at('develop'), skill('superpowers:systematic-debugging'), false)).toBe('debugging')
})

test('never back, never the same stage; from limits where a rule fires', () => {
  // Fixing the spec in its audit, ticking the plan while developing.
  expect(autoTarget(W, at('spec-audit'), write('docs/superpowers/specs/x.md'), false)).toBeNull()
  expect(autoTarget(W, at('develop'), write('docs/superpowers/plans/x.md'), false)).toBeNull()
  expect(autoTarget(W, at('spec'), write('docs/superpowers/specs/x.md'), false)).toBeNull()
  // The final review while developing, a second audit.
  expect(autoTarget(W, at('develop'), fable('fable'), false)).toBeNull()
  expect(autoTarget(W, at('spec-audit'), fable('fable'), false)).toBeNull()
  expect(autoTarget(W, at('debugging', null), skill('superpowers:systematic-debugging'), false)).toBeNull()
})

test('from a side stage, forward of the track stage it returns to', () => {
  expect(autoTarget(W, at('debugging', 'plan'), skill('superpowers:executing-plans'), false)).toBe('develop')
  expect(autoTarget(W, at('debugging', 'develop'), skill('superpowers:writing-plans'), false)).toBeNull()
  // from names the stage the work is in, not the one it returns to.
  expect(autoTarget(W, at('debugging', 'spec'), fable('fable'), false)).toBeNull()
})

test('the first stage in order whose rule may move the work wins', () => {
  const w = {
    track: [
      { ...W.track[0]!, id: 'a', auto: [{ bash: 'go' }] },
      { ...W.track[1]!, id: 'b', auto: [{ bash: 'go' }] },
      { ...W.track[2]!, id: 'c', auto: [{ bash: 'go' }] },
    ],
    side: [],
  }
  expect(autoTarget(w, at(null), { kind: 'bash', command: 'go' }, false)).toBe('a')
  expect(autoTarget(w, at('a'), { kind: 'bash', command: 'go' }, false)).toBe('b')
  expect(autoTarget(w, at('c'), { kind: 'bash', command: 'go' }, false)).toBeNull()
})

test('why a move happened, cut to 60 characters', () => {
  expect(viaOf(skill('superpowers:brainstorming'))).toBe('skill superpowers:brainstorming')
  expect(viaOf(write('docs/a.md'))).toBe('wrote docs/a.md')
  expect(viaOf(fable())).toBe('agent on claude-fable-5-1')
  // A command is named by its rule: its text may hold a secret.
  expect(viaOf({ kind: 'bash', command: 'curl -H "Authorization: Bearer abc" x' }, { bash: 'curl' })).toBe('bash rule curl')
  expect(viaOf({ kind: 'bash', command: 'git merge' })).toBe('ran a command')
  expect(ruleText({ agent: 'fable', from: ['spec', 'plan'] })).toBe('agent fable from spec, plan')
})

test('patterns that can backtrack for ever are refused, with their path; safe ones pass', () => {
  const BS = String.fromCharCode(92)
  const greedy = `^(${BS}S+${BS}s*)+merge$`
  for (const risky of ['^(a|a)*$', greedy, '(a+)+', '(x(ab)*)+', '(?:a|b){2,}']) expect(isRiskyPattern(risky)).toBe(true)
  for (const safe of ['git merge', '^git (merge|rebase)', '(ab)+', 'a+b*', '[(+*]+', `x${BS}(a+${BS})*`, '(a|b)?']) expect(isRiskyPattern(safe)).toBe(false)
  const errors: string[] = []
  rulesAt([{ bash: greedy }, { write: '*a*a*a*a*a*a*a*a*a*b' }], 'p', errors)
  expect(errors).toEqual([
    'p[0].bash: a repeated group holding another repeat or a choice, as in (a+)* or (a|b)+, can take too long; simplify it',
    'p[1].write: at most 8 *',
  ])
})

test('a rule reads at most the first 500 characters of a command, and stays fast on long ones', () => {
  const BS = String.fromCharCode(92)
  expect(ruleMatches({ bash: 'merge$' }, { kind: 'bash', command: `${'x'.repeat(600)} merge` }, false)).toBe(false)
  const started = Date.now()
  for (let i = 0; i < 200; i++) ruleMatches({ bash: `^(${BS}S+ )*end` }, { kind: 'bash', command: 'word '.repeat(2000) }, false)
  expect(Date.now() - started).toBeLessThan(2000)
})

test('the matched rule comes with the target; three stars read as two', () => {
  expect(autoMatch(W, at(null), skill('superpowers:brainstorming'), false)).toEqual({ stage: 'brainstorm', rule: { skill: 'superpowers:brainstorming' } })
  expect(globRegExp('docs/***/a.md', false).test('docs/x/y/a.md')).toBe(true)
})

test('a typed command and a skill expanded within TYPED_SKILL_MS of each other name the typed skill, the more qualified name', () => {
  const heard = (name: string, ms: number) => ({ name, at: ms })
  expect(typedSkill(heard('superpowers:brainstorming', 0), heard('brainstorming', 5))).toBe('superpowers:brainstorming')
  expect(typedSkill(heard('brainstorming', 0), heard('superpowers:brainstorming', 5))).toBe('superpowers:brainstorming')
  expect(typedSkill(heard('brainstorming', 0), heard('Brainstorming', 5))).toBe('brainstorming')
  // Either may come first.
  expect(typedSkill(heard('superpowers:brainstorming', 5), heard('brainstorming', 0))).toBe('superpowers:brainstorming')
  expect(typedSkill(heard('superpowers:brainstorming', 0), heard('brainstorming', TYPED_SKILL_MS))).toBe('superpowers:brainstorming')
  expect(typedSkill(heard('superpowers:brainstorming', 0), heard('brainstorming', TYPED_SKILL_MS + 1))).toBeNull()
  expect(typedSkill(heard('superpowers:brainstorming', 0), heard('writing-plans', 5))).toBeNull()
  expect(typedSkill(heard('superpowers:brainstorming', 0), heard('other:brainstorming', 5))).toBeNull()
  expect(typedSkill(heard('storming', 0), heard('superpowers:brainstorming', 5))).toBeNull()
  expect(typedSkill(null, heard('brainstorming', 5))).toBeNull()
  expect(typedSkill(heard('brainstorming', 5), null)).toBeNull()
})

const bash = (command: string, pushed?: string): Signal => ({ kind: 'bash', command, ...(pushed === undefined ? {} : { pushed }) })

test("the default's rules move to Done on a push to main or master that went through, or a merged pull request, from Your testing or Cleanup", () => {
  // pushed: the branch core's gitOperation says a push updated, whatever
  // the command looked like.
  const merges = [
    bash('git push origin main', 'main'),
    bash('git push -u origin HEAD:main 2>&1 | tail -3', 'main'),
    bash('git checkout main && git merge --ff-only claude/x && git push', 'main'),
    bash('git push origin master', 'master'),
    bash('gh pr merge 12 --squash'),
    bash('cd repo; gh pr merge'),
  ]
  for (const signal of merges) {
    expect(autoMatch(W, at('cleanup'), signal, false)?.stage).toBe('done')
    expect(autoMatch(W, at('user-test'), signal, false)?.stage).toBe('done')
    expect(autoMatch(W, at('develop'), signal, false)).toBeNull()
  }
  const misses = [
    // Core saw no push go through: up to date, --dry-run, rejected, a
    // deleted branch, or a failed push behind a command that succeeded.
    bash('git push origin main'),
    bash('git push --dry-run origin main'),
    bash('git push origin :main'),
    bash('git commit -m x; git push origin main; git status'),
    bash('git push origin main-fix', 'main-fix'),
    bash('git push origin claude/x', 'claude/x'),
    bash('git push origin Main', 'Main'),
    bash('gh pr merge 12 --auto --squash'),
    bash('gh pr view 12'),
  ]
  for (const signal of misses) expect(autoMatch(W, at('cleanup'), signal, false)).toBeNull()
  for (const rule of W.done!.auto!) expect(isRiskyPattern('bash' in rule ? rule.bash : '')).toBe(false)
  // Done's rules count: the engine listens for commands.
  expect(hasRules(W, 'bash')).toBe(true)
  expect(hasRules({ track: W.track, side: W.side }, 'bash')).toBe(false)
})

test('a push rule names one branch; it reads as pushed to that branch', () => {
  const errors: string[] = []
  expect(rulesAt([{ push: ' main ', from: ['cleanup'] }], 'track[0].auto', errors)).toEqual([{ push: 'main', from: ['cleanup'] }])
  expect(errors).toEqual([])
  rulesAt([{ push: 'main dev' }, { push: '' }, { push: 3 }], 'track[0].auto', errors)
  expect(errors).toEqual(['track[0].auto[0].push: one word, a branch such as main', 'track[0].auto[1].push: empty', 'track[0].auto[2].push: must be text'])
  expect(ruleText({ push: 'main', from: ['cleanup'] })).toBe('push main from cleanup')
  expect(viaOf(bash('git push origin main', 'main'), { push: 'main' })).toBe('pushed to main')
  // Only push rules listen to what core saw: a bash rule reads the command.
  const w = { track: [{ ...W.track[0]!, auto: [{ push: 'release' }] }], side: [] }
  expect(hasRules(w, 'bash')).toBe(true)
  expect(ruleMatches({ push: 'release' }, bash('git push origin release'), false)).toBe(false)
  expect(ruleMatches({ push: 'release' }, bash('x', 'release'), false)).toBe(true)
  expect(ruleMatches({ bash: 'deploy' }, bash('deploy', 'release'), false)).toBe(true)
})

test('from Done only a skill the person typed moves the work: chores after a merge stay in Done', () => {
  const done = at('done', 'cleanup')
  expect(autoMatch(W, done, { kind: 'skill', name: 'superpowers:brainstorming', isTyped: true }, false)?.stage).toBe('brainstorm')
  expect(autoMatch(W, done, skill('superpowers:brainstorming'), false)).toBeNull()
  expect(autoMatch(W, done, skill('superpowers:finishing-a-development-branch'), false)).toBeNull()
  expect(autoMatch(W, done, write('docs/superpowers/specs/x.md'), false)).toBeNull()
  expect(autoMatch(W, done, fable(), false)).toBeNull()
  expect(autoMatch(W, done, bash('git push origin main'), false)).toBeNull()
  // Elsewhere a typed skill moves as any other.
  expect(autoMatch(W, at('roadmap'), { kind: 'skill', name: 'superpowers:brainstorming', isTyped: true }, false)?.stage).toBe('brainstorm')
})
