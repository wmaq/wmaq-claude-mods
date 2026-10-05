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
// asked for, the parent's), a command run.
export type Signal =
  | { kind: 'skill'; name: string; isTyped?: boolean }
  | { kind: 'write'; path: string }
  | { kind: 'agent'; model: string; asked: string | undefined; parentModel: string }
  | { kind: 'bash'; command: string }

export const KINDS = ['skill', 'write', 'agent', 'bash'] as const
type Kind = (typeof KINDS)[number]
const FIELDS = [...KINDS, 'from'] as const
export const RULES_MAX = 8
// How much of a command a bash rule reads, and how many * a glob may hold:
// a rule from a project's file runs on every call, so neither may take long.
export const COMMAND_MAX = 500
export const GLOB_STARS_MAX = 8
// The longest reason for a move the history keeps.
export const VIA_MAX = 60
export const FROM_MAX = 20
const LIMITS: Record<Kind, number> = { skill: 60, agent: 60, write: 120, bash: 120 }

const kindOf = (rule: AutoRule): Kind => KINDS.find(k => k in rule)!
const valueOf = (rule: AutoRule): string => (rule as Record<Kind, string>)[kindOf(rule)]

// A text's length in code points, as the limits count it.
export const chars = (text: string): number => Array.from(text).length

// One rule: exactly one kind, and perhaps from. The ids in from are checked
// against the workflow once all its stages are read (unknownFrom).
function ruleAt(item: unknown, path: string, errors: string[]): AutoRule | null {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    errors.push(`${path}: not a rule (an object with one of ${KINDS.join(', ')}, and perhaps from)`)

    return null
  }
  const raw = item as Record<string, unknown>
  const before = errors.length
  for (const key of Object.keys(raw)) if (!(FIELDS as readonly string[]).includes(key)) errors.push(`${path}.${key}: not a field (${FIELDS.join(', ')})`)
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
  else text = kind === 'write' ? value.trim().replace(/^\.\//, '') : value.trim()
  if (text !== '' && kind === 'bash') {
    try {
      new RegExp(text)
      if (isRiskyPattern(text)) errors.push(`${path}.bash: a repeated group holding another repeat or a choice, as in (a+)* or (a|b)+, can take too long; simplify it`)
    } catch (error) {
      errors.push(`${path}.bash: not a regular expression: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (text !== '' && kind === 'write' && (text.match(/\*/g)?.length ?? 0) > GLOB_STARS_MAX) errors.push(`${path}.write: at most ${GLOB_STARS_MAX} *`)
  if (text !== '' && kind === 'agent' && /\s/.test(text)) errors.push(`${path}.agent: one word, a model family such as fable`)
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
      if (!ids.includes(id)) errors.push(`${path}[${i}].from[${j}]: "${id}" is not a stage of this workflow`)
    }),
  )

  return errors
}

const BACKSLASH = String.fromCharCode(92)

// Whether a pattern repeats a group that itself repeats or chooses, as in
// (a+)* or (a|b)+: the shapes that make a regular expression backtrack
// for ever on a near miss. Escapes and character classes are skipped.
export function isRiskyPattern(source: string): boolean {
  type Group = { hasRepeat: boolean; hasChoice: boolean }
  const stack: Group[] = [{ hasRepeat: false, hasChoice: false }]
  const isRepeat = (c: string | undefined) => c === '*' || c === '+' || c === '{'
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!
    const top = stack[stack.length - 1]!
    if (c === BACKSLASH) i += 1
    else if (c === '[') {
      for (i += 1; i < source.length && source[i] !== ']'; i++) if (source[i] === BACKSLASH) i += 1
    } else if (c === '(') stack.push({ hasRepeat: false, hasChoice: false })
    else if (c === '|') top.hasChoice = true
    else if (isRepeat(c)) top.hasRepeat = true
    else if (c === ')' && stack.length > 1) {
      const group = stack.pop()!
      const isRepeated = isRepeat(source[i + 1])
      if (isRepeated && (group.hasRepeat || group.hasChoice)) return true
      if (group.hasRepeat || isRepeated) stack[stack.length - 1]!.hasRepeat = true
    }
  }

  return false
}

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
// family from a parent on it does not count, unless the call named it.
export function ruleMatches(rule: AutoRule, signal: Signal, isWindows: boolean): boolean {
  const kind = kindOf(rule)
  if (kind !== signal.kind) return false
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
      try {
        return regExpOf(`bash ${value}`, () => new RegExp(value)).test(signal.command.slice(0, COMMAND_MAX))
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

export const autoTarget = (w: Workflow, p: Progress, signal: Signal, isWindows: boolean): StageId | null => autoMatch(w, p, signal, isWindows)?.stage ?? null

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
      return short(rule && 'bash' in rule ? `bash rule ${rule.bash}` : 'ran a command', VIA_MAX)
  }
}

// Whether any stage of the workflow has rules, or rules of one kind.
export const hasRules = (w: Workflow, kind?: Signal['kind']): boolean =>
  allStages(w).some(s => (s.auto ?? []).some(rule => kind === undefined || kind in rule))

// A rule as /stage workflow and /stage auto list it.
export const ruleText = (rule: AutoRule): string => `${kindOf(rule)} ${valueOf(rule)}${rule.from ? ` from ${rule.from.join(', ')}` : ''}`
