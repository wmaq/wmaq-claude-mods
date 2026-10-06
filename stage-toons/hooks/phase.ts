// What kind of work a tool call is (its phase), what it touched (the
// label beside the phase's badge), and the moments that get a line said:
// all from the tool's name and its arguments, nothing else.

export type Phase = 'search' | 'read' | 'edit' | 'test' | 'build' | 'git' | 'run' | 'web' | 'agents'
export const PHASES: readonly Phase[] = ['search', 'read', 'edit', 'test', 'build', 'git', 'run', 'web', 'agents']

// How long a label may be, with the ~ that marks one cut short (the
// raster's text is ASCII, so no ellipsis).
export const LABEL_MAX = 14

type Args = Record<string, unknown>

const TOOL_PHASES: Record<string, Phase> = {
  Grep: 'search',
  Glob: 'search',
  ToolSearch: 'search',
  Read: 'read',
  NotebookRead: 'read',
  Edit: 'edit',
  Write: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  WebFetch: 'web',
  WebSearch: 'web',
  Agent: 'agents',
  Task: 'agents',
  Workflow: 'agents',
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

// The commands of a shell line, split at && || ; | and newlines (quotes are
// not read: a separator inside one splits too, which only shortens a label).
const commandsOf = (line: string): string[][] =>
  line
    .split(/&&|\|\||[;|\n]/)
    .map(part => part.trim().split(/\s+/).filter(word => word !== ''))
    .filter(words => words.length > 0)

const isAssignment = (word: string) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(word)

// The options of a wrapper that take a value of their own.
const WRAPPERS: Record<string, readonly string[]> = {
  npx: ['-p', '--package'],
  env: ['-u', '--unset', '-C', '--chdir'],
  sudo: ['-u', '-g', '-C', '-h', '-p'],
  nice: ['-n', '--adjustment'],
  timeout: ['-s', '--signal', '-k', '--kill-after'],
  time: ['-f', '--format', '-o', '--output'],
}

// The runners named with a word of their own before the command.
const RUNNERS: Record<string, string> = { uv: 'run', poetry: 'run', pnpm: 'exec', pipenv: 'run' }

// A command's words without what only runs it: environment assignments,
// the wrappers (npx, env, sudo, nice, timeout with its duration, time)
// with their options, and uv run, poetry run, pnpm exec, pipenv run.
function bare(words: readonly string[]): string[] {
  let i = 0
  for (;;) {
    while (i < words.length && isAssignment(words[i]!)) i++
    if (RUNNERS[words[i] ?? ''] !== undefined && words[i + 1] === RUNNERS[words[i]!]) {
      i += 2
      continue
    }
    const wrapper = WRAPPERS[words[i] ?? '']
    if (!wrapper) break
    const isTimeout = words[i] === 'timeout'
    i++
    while (i < words.length && words[i]!.startsWith('-')) i += wrapper.includes(words[i]!) ? 2 : 1
    if (isTimeout) i++
  }

  return words.slice(i)
}

// The first command of a shell line that does something: leading cd's are
// skipped, and what only runs it is stripped.
export function firstCommand(line: string): string[] {
  const commands = commandsOf(line).map(bare)
  const first = commands.find(words => words.length > 0 && words[0] !== 'cd')

  return first ?? commands.find(words => words.length > 0) ?? []
}

const TEST_RUNNERS = new Set(['jest', 'vitest', 'pytest', 'mocha', 'rspec', 'phpunit', 'ctest'])
const TEST_SUBCOMMANDS = new Set(['go', 'cargo', 'dotnet', 'mvn', 'gradle', 'gradlew', './gradlew', 'bun', 'deno'])
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn'])
const BUILD_TOOLS = new Set(['tsc', 'make', 'cmake', 'webpack', 'gradle', 'mvn'])

function isTest(w: readonly string[]): boolean {
  const [a = '', b = '', c = ''] = w
  if (TEST_RUNNERS.has(a)) return true
  if (TEST_SUBCOMMANDS.has(a) && b === 'test') return true
  if (PACKAGE_MANAGERS.has(a) && (b === 'test' || b === 't' || b.startsWith('test:') || (b === 'run' && c.startsWith('test')))) return true
  if (a === 'claude' && b === 'plugin' && c === 'test') return true
  if (a === 'make' && (b === 'test' || b === 'check')) return true
  if ((a === 'tsx' || a === 'node' || a === 'bun') && w.includes('--test')) return true

  return /^python3?$/.test(a) && b === '-m' && c === 'pytest'
}

function isBuild(w: readonly string[]): boolean {
  const [a = '', b = '', c = ''] = w
  if (BUILD_TOOLS.has(a)) return true
  if ((a === 'cargo' || a === 'go' || a === 'dotnet') && b === 'build') return true
  if (PACKAGE_MANAGERS.has(a) || a === 'bun') {
    if (a === 'yarn' && b === '') return true
    if (['ci', 'install', 'i', 'add', 'build'].includes(b)) return true
    if (b === 'run' && c.startsWith('build')) return true
  }
  if (/^pip3?$/.test(a) && b === 'install') return true
  if (a === 'vite' && b === 'build') return true

  return a === 'claude' && b === 'plugin' && c === 'validate'
}

// The phase of a call of the main conversation, or null when it shows no
// badge (a skill, the task tools, the mod's own tool). ownTool: the mod's
// set_stage, an MCP tool that is not web work.
export function phaseOf(tool: string, args: Args, ownTool: string): Phase | null {
  if (tool === 'Bash') {
    const w = firstCommand(text(args.command))
    if (isTest(w)) return 'test'
    if (isBuild(w)) return 'build'
    if (w[0] === 'git' || w[0] === 'gh') return 'git'

    return 'run'
  }
  if (tool.startsWith('mcp__')) return tool === ownTool ? null : 'web'

  return TOOL_PHASES[tool] ?? null
}

// A label cut to LABEL_MAX with a ~, anything outside printable ASCII a ?.
export function labelOf(value: string): string {
  const ascii = value.trim().replace(/[^\x20-\x7e]/g, '?')

  return ascii.length > LABEL_MAX ? `${ascii.slice(0, LABEL_MAX - 1)}~` : ascii
}

const baseName = (path: string) => path.split(/[\\/]/).filter(part => part !== '').at(-1) ?? ''

function hostOf(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url.trim())

  return m ? m[1]! : url
}

// What a call touched, as its badge's label: a file's name, a pattern, a
// command's first two words, a host, a query, an agent's description; ''
// when it names nothing.
export function whatOf(tool: string, args: Args): string {
  switch (tool) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      return labelOf(baseName(text(args.file_path)))
    case 'NotebookEdit':
    case 'NotebookRead':
      return labelOf(baseName(text(args.notebook_path) || text(args.file_path)))
    case 'Grep':
    case 'Glob':
      return labelOf(text(args.pattern))
    case 'Bash':
      return labelOf(gitless(firstCommand(text(args.command))).slice(0, 2).join(' '))
    case 'WebFetch':
      return labelOf(hostOf(text(args.url)))
    case 'WebSearch':
      return labelOf(text(args.query))
    case 'Agent':
    case 'Task':
    case 'Workflow':
      return labelOf(text(args.description))
    default:
      return ''
  }
}

// A git command's words without git's global options (-C <dir>, -c k=v,
// --no-pager): git, then its verb and what follows. Other commands as
// given.
function gitless(words: readonly string[]): string[] {
  if (words[0] !== 'git') return [...words]
  let i = 1
  while (i < words.length && words[i]!.startsWith('-')) i += words[i] === '-C' || words[i] === '-c' ? 2 : 1

  return ['git', ...words.slice(i)]
}

// The moments a call says a line at, as it ends: a test run that passed or
// failed, a commit, a push (anywhere in the shell line).
export type Moment = 'test-pass' | 'test-fail' | 'commit' | 'push'

export function momentOf(tool: string, args: Args, isError: boolean): Moment | null {
  if (tool !== 'Bash') return null
  const commands = commandsOf(text(args.command)).map(bare)
  if (isTest(firstCommand(text(args.command)))) return isError ? 'test-fail' : 'test-pass'
  if (isError) return null
  const gitDoes = (verb: string) => commands.some(w => w[0] === 'git' && gitless(w)[1] === verb)
  if (gitDoes('push')) return 'push'

  return gitDoes('commit') ? 'commit' : null
}
