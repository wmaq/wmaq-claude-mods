import { expect, test } from 'claude-code/testing'

import { BS } from './harness'
import { firstCommand, LABEL_MAX, labelOf, momentOf, phaseOf, whatOf } from './phase'

const OWN = 'mcp__stage-toons__set_stage'
const bash = (command: string) => phaseOf('Bash', { command }, OWN)

test('tools have the phase of their kind of work, and some none', () => {
  expect(phaseOf('Grep', {}, OWN)).toBe('search')
  expect(phaseOf('Glob', {}, OWN)).toBe('search')
  expect(phaseOf('ToolSearch', {}, OWN)).toBe('search')
  expect(phaseOf('Read', {}, OWN)).toBe('read')
  expect(phaseOf('Edit', {}, OWN)).toBe('edit')
  expect(phaseOf('Write', {}, OWN)).toBe('edit')
  expect(phaseOf('NotebookEdit', {}, OWN)).toBe('edit')
  expect(phaseOf('WebFetch', {}, OWN)).toBe('web')
  expect(phaseOf('WebSearch', {}, OWN)).toBe('web')
  expect(phaseOf('mcp__github__get_me', {}, OWN)).toBe('web')
  expect(phaseOf(OWN, {}, OWN)).toBe(null)
  expect(phaseOf('Agent', {}, OWN)).toBe('agents')
  expect(phaseOf('Workflow', {}, OWN)).toBe('agents')
  for (const tool of ['Skill', 'TaskCreate', 'TaskUpdate', 'TodoWrite', 'AskUserQuestion']) expect(phaseOf(tool, {}, OWN)).toBe(null)
})

test('a shell line is tested, built, git or run, on its first command past cd, assignments and npx', () => {
  const table: [string, string][] = [
    ['npm test', 'test'],
    ['npm run test:unit -- --watch=false', 'test'],
    ['FOO=1 npm test', 'test'],
    ['cd stage-toons && npx -y tsx --test "tools/frames/*.test.ts"', 'test'],
    ['claude plugin test stage-toons', 'test'],
    ['go test ./...', 'test'],
    ['cargo test', 'test'],
    ['python3 -m pytest -q', 'test'],
    ['pytest tests/', 'test'],
    ['node --test', 'test'],
    ['yarn test', 'test'],
    ['npx -y -p typescript@5 tsc -p stage-toons', 'build'],
    ['tsc --noEmit', 'build'],
    ['make -j8', 'build'],
    ['npm ci', 'build'],
    ['npm run build', 'build'],
    ['pip install -r requirements.txt', 'build'],
    ['cargo build --release', 'build'],
    ['claude plugin validate .', 'build'],
    ['git -C x status', 'git'],
    ['git add -A && git commit -m "x"', 'git'],
    ['gh pr view 3', 'git'],
    ['timeout 600 npm test', 'test'],
    ['time npm test', 'test'],
    ['sudo make install', 'build'],
    ['env CI=1 nice -n 5 pytest -x', 'test'],
    ['timeout -k 5 60 git push', 'git'],
    ['make test', 'test'],
    ['make check', 'test'],
    ['ls -la', 'run'],
    ['test -f x && echo yes', 'run'],
    ['npm run dev', 'run'],
    ['cd /tmp', 'run'],
    ['', 'run'],
  ]
  for (const [command, phase] of table) expect(`${command} → ${bash(command)}`).toBe(`${command} → ${phase}`)
})

test('the first command skips leading cd commands', () => {
  expect(firstCommand('cd a; cd b && make all')).toEqual(['make', 'all'])
  expect(firstCommand('cd a')).toEqual(['cd', 'a'])
  expect(firstCommand('cd x && timeout 600 npx -y tsx --test a.ts')).toEqual(['tsx', '--test', 'a.ts'])
})

test('what a call touched: a file name, a pattern, a command, a host, a query, a description', () => {
  expect(whatOf('Read', { file_path: '/home/me/proj/src/auth.ts' })).toBe('auth.ts')
  expect(whatOf('Edit', { file_path: `C:${BS}Dev${BS}proj${BS}main.c` })).toBe('main.c')
  expect(whatOf('NotebookEdit', { notebook_path: '/x/lab.ipynb' })).toBe('lab.ipynb')
  expect(whatOf('Grep', { pattern: 'renderFull' })).toBe('renderFull')
  expect(whatOf('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts')
  expect(whatOf('Bash', { command: 'cd x && npm test -- --watch' })).toBe('npm test')
  expect(whatOf('WebFetch', { url: 'https://example.com/a/b?c' })).toBe('example.com')
  expect(whatOf('WebSearch', { query: 'pixel art' })).toBe('pixel art')
  expect(whatOf('Agent', { description: 'Audit the spec' })).toBe('Audit the spec')
  expect(whatOf('Skill', { skill: 'x' })).toBe('')
  expect(whatOf('Read', {})).toBe('')
})

test('a label is cut to LABEL_MAX with a ~, and anything but printable ASCII is a ?', () => {
  expect(LABEL_MAX).toBe(14)
  expect(labelOf('a-rather-long-file-name.ts')).toBe('a-rather-long~')
  expect(labelOf('a-rather-long~').length).toBe(14)
  expect(labelOf('café.ts')).toBe('caf?.ts')
  expect(whatOf('Read', { file_path: '/x/exactly-14chars' })).toBe('exactly-14chars'.slice(0, 13) + '~')
})

test('the moments a call ends on: a test passed or failed, a commit, a push', () => {
  expect(momentOf('Bash', { command: 'npm test' }, false)).toBe('test-pass')
  expect(momentOf('Bash', { command: 'npm test' }, true)).toBe('test-fail')
  expect(momentOf('Bash', { command: 'git add -A && git commit -m "x"' }, false)).toBe('commit')
  expect(momentOf('Bash', { command: 'git -C repo commit -q -m x' }, false)).toBe('commit')
  expect(momentOf('Bash', { command: 'git commit -m x' }, true)).toBe(null)
  expect(momentOf('Bash', { command: 'git commit -qm x && git push -u origin main' }, false)).toBe('push')
  expect(momentOf('Bash', { command: 'git log --oneline' }, false)).toBe(null)
  expect(momentOf('Bash', { command: 'echo git commit' }, false)).toBe(null)
  expect(momentOf('Read', { file_path: 'x' }, false)).toBe(null)
})
