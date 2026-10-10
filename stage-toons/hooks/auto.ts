// Automatic moves: a workflow's rules (a stage's "auto" list), what the
// main conversation did that they match, and the stage a match moves the
// work to. Rules only ever move the work forward on the track, or into a
// side stage.

import type { AutoRule, Progress, StageId, Workflow } from '../types'
import { allStages, isDone, rank, standing } from './track'

export type { AutoRule }

// What the main conversation did: a skill loaded (isTyped: the person
// typed it), a file written (its path relative to the project, /
// separators), a subagent spawned (the model it runs on, the one the call
// asked for, the parent's), a command run (pushed: the branch core's
// gitOperation says a push in it updated, only when one went through).
export type Signal =
  | { kind: 'skill'; name: string; isTyped?: boolean }
  | { kind: 'write'; path: string }
  | { kind: 'agent'; model: string; asked: string | undefined; parentModel: string }
  | { kind: 'bash'; command: string; pushed?: string }

export const KINDS = ['skill', 'write', 'agent', 'bash', 'push'] as const
type Kind = (typeof KINDS)[number]
const FIELDS = [...KINDS, 'from'] as const
export const RULES_MAX = 8
// How much of a line a bash rule reads, how much of each command in it,
// how many repeats a rule may hold, and how many * a glob: a rule from a
// project's file runs on every call, so none may take long. A pattern's
// time on a near miss grows with the text's length to the power of its
// repeats (.*.*.*x).
export const COMMAND_MAX = 500
export const SEGMENT_MAX = 60
export const REPEATS_MAX = 4
export const GLOB_STARS_MAX = 8
// The longest reason for a move the history keeps.
export const VIA_MAX = 60
export const FROM_MAX = 20
const LIMITS: Record<Kind, number> = { skill: 60, agent: 60, write: 120, bash: 120, push: 60 }

const kindOf = (rule: AutoRule): Kind => KINDS.find(k => k in rule)!
const valueOf = (rule: AutoRule): string => (rule as Record<Kind, string>)[kindOf(rule)]

// A text's length in code points, as the limits count it.
export const chars = (text: string): number => Array.from(text).length

// Control characters, a terminal's escapes among them: a file's text
// reaches the bar, the answers and the system prompt, so none may hold one.
export const hasControl = (text: string): boolean => /[\u0000-\u001f\u007f-\u009f]/.test(text)

// A file's value quoted in an error: its escapes written out, cut to 40
// characters.
export const quoted = (text: string): string => JSON.stringify(chars(text) > 40 ? `${Array.from(text).slice(0, 39).join('')}…` : text)
// A key of the file in an error: bare when it is a plain word, else quoted.
export const keyName = (key: string): string => (/^[\w-]{1,40}$/.test(key) ? key : quoted(key))

// One rule: exactly one kind, and perhaps from. The ids in from are checked
// against the workflow once all its stages are read (unknownFrom).
function ruleAt(item: unknown, path: string, errors: string[]): AutoRule | null {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    errors.push(`${path}: not a rule (an object with one of ${KINDS.join(', ')}, and perhaps from)`)

    return null
  }
  const raw = item as Record<string, unknown>
  const before = errors.length
  for (const key of Object.keys(raw)) if (!(FIELDS as readonly string[]).includes(key)) errors.push(`${path}.${keyName(key)}: not a field (${FIELDS.join(', ')})`)
  const kinds = KINDS.filter(k => raw[k] !== undefined)
  if (kinds.length !== 1) {
    errors.push(`${path}: ${kinds.length === 0 ? 'needs one of' : 'has more than one of'} ${KINDS.join(', ')}`)

    return null
  }
  const kind = kinds[0]!
  const value = raw[kind]
  let text = ''
  if (typeof value !== 'string') errors.push(`${path}.${kind}: must be text`)
  else if (value.trim() === '') errors.push(`${path}.${kind}: empty`)
  else if (chars(value.trim()) > LIMITS[kind]) errors.push(`${path}.${kind}: ${chars(value.trim())} characters, at most ${LIMITS[kind]}`)
  else if (hasControl(value)) errors.push(`${path}.${kind}: control characters`)
  else text = kind === 'write' ? value.trim().replace(/^\.\//, '') : value.trim()
  if (text !== '' && kind === 'bash') {
    try {
      new RegExp(text)
      const problem = patternProblem(text)
      if (problem) errors.push(`${path}.bash: ${problem}; simplify it`)
    } catch (error) {
      errors.push(`${path}.bash: not a regular expression: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (text !== '' && kind === 'write' && (text.match(/\*/g)?.length ?? 0) > GLOB_STARS_MAX) errors.push(`${path}.write: at most ${GLOB_STARS_MAX} *`)
  if (text !== '' && kind === 'agent' && /\s/.test(text)) errors.push(`${path}.agent: one word, a model family such as fable`)
  if (text !== '' && kind === 'push' && /\s/.test(text)) errors.push(`${path}.push: one word, a branch such as main`)
  let from: string[] | undefined
  if (raw.from !== undefined) {
    if (!Array.isArray(raw.from) || !raw.from.every(id => typeof id === 'string')) errors.push(`${path}.from: must be a list of stage ids`)
    else if (raw.from.length === 0 || raw.from.length > FROM_MAX) errors.push(`${path}.from: ${raw.from.length} stage ids; 1 to ${FROM_MAX}`)
    else from = (raw.from as string[]).map(id => id.trim())
  }
  if (errors.length !== before) return null

  return { [kind]: text, ...(from ? { from } : {}) } as AutoRule
}

// A stage's "auto" list: its rules, or null with its mistakes listed.
export function rulesAt(value: unknown, path: string, errors: string[]): AutoRule[] | null {
  if (!Array.isArray(value)) {
    errors.push(`${path}: must be a list of rules`)

    return null
  }
  if (value.length > RULES_MAX) {
    errors.push(`${path}: ${value.length} rules; at most ${RULES_MAX}`)

    return null
  }
  const before = errors.length
  const rules = value.map((item, i) => ruleAt(item, `${path}[${i}]`, errors))

  return errors.length === before ? (rules as AutoRule[]) : null
}

// The from ids a stage's rules name that the workflow has no stage for.
export function unknownFrom(rules: readonly AutoRule[], path: string, ids: readonly string[]): string[] {
  const errors: string[] = []
  rules.forEach((rule, i) =>
    rule.from?.forEach((id, j) => {
      if (!ids.includes(id)) errors.push(`${path}[${i}].from[${j}]: ${quoted(id)} is not a stage of this workflow`)
    }),
  )

  return errors
}

const BACKSLASH = String.fromCharCode(92)

// What makes a pattern slow on a near miss, or null: a repeated group
// holding another repeat or a choice, as in (a+)* or (a|b)+, or more than
// REPEATS_MAX repeats in all (*, +, ?, {n,m}; a lazy ? and the ? of (?:
// are none). Escapes and character classes are skipped.
export function patternProblem(source: string): string | null {
  type Group = { hasRepeat: boolean; hasChoice: boolean }
  type Token = 'repeat' | 'open' | 'other'
  const stack: Group[] = [{ hasRepeat: false, hasChoice: false }]
  const isRepeat = (c: string | undefined) => c === '*' || c === '+' || c === '{'
  let repeats = 0
  // What the last token was: a ? after a repeat makes it lazy, after ( it
  // starts (?: or (?=; anywhere else it is a repeat of its own.
  let last: Token = 'other'
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!
    const top = stack[stack.length - 1]!
    const bounds = c === '{' ? /^\{\d+(,\d*)?\}/.exec(source.slice(i)) : null
    let token: Token = 'other'
    if (c === BACKSLASH) i += 1
    else if (c === '[') {
      for (i += 1; i < source.length && source[i] !== ']'; i++) if (source[i] === BACKSLASH) i += 1
    } else if (c === '(') {
      stack.push({ hasRepeat: false, hasChoice: false })
      token = 'open'
    } else if (c === '|') top.hasChoice = true
    else if (c === '?' && last !== 'other') token = last === 'repeat' ? 'other' : 'open'
    else if (c === '*' || c === '+' || c === '?' || bounds) {
      repeats += 1
      if (c !== '?') top.hasRepeat = true
      if (bounds) i += bounds[0].length - 1
      token = 'repeat'
    } else if (c === ')' && stack.length > 1) {
      const group = stack.pop()!
      const isRepeated = isRepeat(source[i + 1])
      if (isRepeated && (group.hasRepeat || group.hasChoice)) return 'a repeated group holding another repeat or a choice, as in (a+)* or (a|b)+, can take too long'
      if (group.hasRepeat || isRepeated) stack[stack.length - 1]!.hasRepeat = true
    }
    last = token
  }

  return repeats > REPEATS_MAX ? `${repeats} repeats (*, +, ?, {n,m}) can take too long; at most ${REPEATS_MAX}` : null
}

// The commands of a line a bash rule reads, split at ; & | and line ends,
// each without its separators and spaces around, so ^ and $ match at its
// ends.
const commandsOf = (command: string): string[] => command.slice(0, COMMAND_MAX).split(/[;&|\n]+/).map(part => part.trim().slice(0, SEGMENT_MAX).trimEnd())

// Rules' regular expressions, compiled once each.
const compiled = new Map<string, RegExp>()
function regExpOf(key: string, make: () => RegExp): RegExp {
  let found = compiled.get(key)
  if (!found) {
    found = make()
    compiled.set(key, found)
  }

  return found
}

// A glob as a regular expression on a whole path: ** any run of characters
// (a **/ also none), * any run without /, ? one character but /.
export function globRegExp(glob: string, ignoreCase: boolean): RegExp {
  let source = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*' && glob[i + 1] === '*') {
      // Three stars or more read as two.
      while (glob[i + 1] === '*') i += 1
      if (glob[i + 1] === '/') {
        i += 1
        source += '(?:.*/)?'
      } else {
        source += '.*'
      }
    } else if (c === '*') source += '[^/]*'
    else if (c === '?') source += '[^/]'
    else source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }

  return new RegExp(`^${source}$`, ignoreCase ? 'i' : '')
}

export const isWindowsPath = (path: string): boolean => /^[A-Za-z]:/.test(path)

// A file's path relative to the project directory, with / separators; a
// path outside it stays whole. A Windows path compares without case.
export function relativePath(file: string, cwd: string): string {
  const path = file.replace(/\\/g, '/')
  let dir = cwd.replace(/\\/g, '/')
  while (dir.length > 1 && dir.endsWith('/')) dir = dir.slice(0, -1)
  if (dir === '/' && path.startsWith('/')) return path.slice(1)
  const head = path.slice(0, dir.length)
  const isSame = isWindowsPath(dir) ? head.toLowerCase() === dir.toLowerCase() : head === dir
  if (dir !== '' && isSame && path[dir.length] === '/') return path.slice(dir.length + 1)

  return path.replace(/^\.\//, '')
}

const hasFamily = (model: string | undefined, family: string): boolean => model !== undefined && model.toLowerCase().includes(family.toLowerCase())

// Whether a rule matches what was done. A spawn that only inherited the
// family from a parent on it does not count, unless the call named it. A
// push rule listens to commands, and reads what core saw them push.
export function ruleMatches(rule: AutoRule, signal: Signal, isWindows: boolean): boolean {
  const kind = kindOf(rule)
  if ((kind === 'push' ? 'bash' : kind) !== signal.kind) return false
  const value = valueOf(rule)
  switch (signal.kind) {
    case 'skill': {
      const name = signal.name.toLowerCase()
      const want = value.toLowerCase()

      // A bare name on either side matches the other's part after the
      // plugin's name: skill.prompt may name a skill bare.
      return name === want || (!want.includes(':') && name.endsWith(`:${want}`)) || (!name.includes(':') && want.endsWith(`:${name}`))
    }
    case 'write':
      return regExpOf(`write ${isWindows} ${value}`, () => globRegExp(value, isWindows)).test(signal.path)
    case 'agent':
      return hasFamily(signal.model, value) && (!hasFamily(signal.parentModel, value) || hasFamily(signal.asked, value))
    case 'bash':
      if (kind === 'push') return signal.pushed === value
      try {
        const pattern = regExpOf(`bash ${value}`, () => new RegExp(value))

        return commandsOf(signal.command).some(part => pattern.test(part))
      } catch {
        return false
      }
  }
}

// How long a command the person typed and a skill's expansion wait for
// each other: the engine does not say which of the two comes first.
export const TYPED_SKILL_MS = 10_000

// A name heard, and when: the command typed, or the skill expanded.
export type Heard = { name: string; at: number }

// The skill the person just typed, when the command and the skill expanded
// name the same one (exactly, or one bare and the other with its plugin's
// name) within TYPED_SKILL_MS of each other: the more qualified of the two
// names. Otherwise null: a skill expanded with no command around it (a
// preload into a subagent, or the Skill tool's) is not one the person typed.
export function typedSkill(typed: Heard | null, expanded: Heard | null): string | null {
  if (typed === null || expanded === null || Math.abs(typed.at - expanded.at) > TYPED_SKILL_MS) return null
  const a = typed.name.toLowerCase()
  const b = expanded.name.toLowerCase()
  if (a === b) return typed.name
  if (!b.includes(':') && a.endsWith(`:${b}`)) return typed.name
  if (!a.includes(':') && b.endsWith(`:${a}`)) return expanded.name

  return null
}

// The stage what was done moves the work to, or null: the first stage, in
// workflow order, with a rule that matches and may move the work there. A
// rule moves the work into a side stage, into Done, or forward on the
// track; never to the stage it is in, never back. From Done only a skill
// the person typed moves it (a new round): post-merge chores stay in Done.
export function autoMatch(w: Workflow, p: Progress, signal: Signal, isWindows: boolean): { stage: StageId; rule: AutoRule } | null {
  if (isDone(p.stage) && !(signal.kind === 'skill' && signal.isTyped === true)) return null
  const at = standing(w, p)
  for (const stage of allStages(w)) {
    if (stage.id === p.stage) continue
    if (rank(w, stage.id) >= 0 && rank(w, stage.id) <= at) continue
    const rule = (stage.auto ?? []).find(r => (r.from === undefined || (p.stage !== null && r.from.includes(p.stage))) && ruleMatches(r, signal, isWindows))
    if (rule) return { stage: stage.id, rule }
  }

  return null
}

const short = (text: string, max: number): string => {
  const clean = text.replace(/\s+/g, ' ').trim()
  const list = Array.from(clean)

  return list.length <= max ? clean : `${list.slice(0, max - 1).join('')}…`
}

// Why a move happened, as the history and the note say it. A command is
// named by the rule it matched, not by its text, which may hold a secret.
export function viaOf(signal: Signal, rule?: AutoRule): string {
  switch (signal.kind) {
    case 'skill':
      return short(`skill ${signal.name}`, VIA_MAX)
    case 'write':
      return short(`wrote ${signal.path}`, VIA_MAX)
    case 'agent':
      return short(`agent on ${signal.model}`, VIA_MAX)
    case 'bash':
      if (rule && 'push' in rule) return short(`pushed to ${rule.push}`, VIA_MAX)

      return short(rule && 'bash' in rule ? `bash rule ${rule.bash}` : 'ran a command', VIA_MAX)
  }
}

// Whether any stage of the workflow has rules, or rules that listen to
// one kind of signal (push rules to commands).
export const hasRules = (w: Workflow, kind?: Signal['kind']): boolean =>
  allStages(w).some(s => (s.auto ?? []).some(rule => kind === undefined || kind in rule || (kind === 'bash' && 'push' in rule)))

// A rule as /stage workflow and /stage auto list it.
export const ruleText = (rule: AutoRule): string => `${kindOf(rule)} ${valueOf(rule)}${rule.from ? ` from ${rule.from.join(', ')}` : ''}`
