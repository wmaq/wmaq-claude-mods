// Claude's task list as the bar counts it: each task by id with its
// status, from the main conversation's task tools (TaskCreate, TaskUpdate)
// or the whole list at once (TodoWrite). Pure.

import type { TaskList, TaskStatus } from '../types'

export const NO_TASKS: TaskList = {}

const STATUSES: readonly string[] = ['pending', 'in_progress', 'completed']
const isStatus = (value: unknown): value is TaskStatus => typeof value === 'string' && STATUSES.includes(value)

export const taskCreated = (list: TaskList, id: string): TaskList => ({ ...list, [id]: 'pending' })

// A task's new status; deleted removes it. An id never seen created is
// added.
export function taskUpdated(list: TaskList, id: string, status: unknown): TaskList {
  if (status === 'deleted') {
    if (!(id in list)) return list
    const { [id]: _, ...rest } = list

    return rest
  }

  return isStatus(status) && list[id] !== status ? { ...list, [id]: status } : list
}

// TodoWrite's whole list, by position.
export function todosWritten(todos: unknown): TaskList {
  if (!Array.isArray(todos)) return NO_TASKS
  const list: Record<string, TaskStatus> = {}
  todos.forEach((todo, i) => {
    const status = (todo as { status?: unknown } | null)?.status
    list[`todo-${i}`] = isStatus(status) ? status : 'pending'
  })

  return list
}

export type TaskCount = { done: number; total: number }

// How many tasks are done of how many, or null with none.
export function countOf(list: TaskList): TaskCount | null {
  const statuses = Object.values(list)
  if (statuses.length === 0) return null

  return { done: statuses.filter(s => s === 'completed').length, total: statuses.length }
}

export const isAllDone = (list: TaskList): boolean => {
  const count = countOf(list)

  return count !== null && count.done === count.total
}

// A main turn starts: a list all done showed through its turn, and goes.
export const atTurnStart = (list: TaskList): TaskList => (isAllDone(list) ? NO_TASKS : list)

// The bar's words for the count: "3 of 8 tasks", with a tick when all are done.
export function countText(count: TaskCount): string {
  const words = `${count.done} of ${count.total} task${count.total === 1 ? '' : 's'}`

  return count.done === count.total ? `${words} ✓` : words
}

const field = (value: unknown, key: string): unknown => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined)

// A task id as a result or the arguments give it: a string, or a number.
const idOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined

// The list after a call of the main conversation that did not fail, read
// from its arguments and its result (the tool's output, whose shape the
// engine's types don't give, so each field is checked): TaskCreate adds its
// task (the result's task.id, or a "#3" in a text result), a TaskUpdate
// sets the status it changed to (or the one it asked for) unless its
// result says it failed, TodoWrite gives the whole list (the result's, or
// the one it sent). Any other call, or a result that names no task, leaves
// the list as it was.
export function afterTaskCall(list: TaskList, tool: string, args: Record<string, unknown>, output: unknown): TaskList {
  if (tool === 'TaskCreate') {
    const id = idOf(field(field(output, 'task'), 'id')) ?? (typeof output === 'string' ? /#(\d+)/.exec(output)?.[1] : undefined)

    return id === undefined ? list : taskCreated(list, id)
  }
  if (tool === 'TaskUpdate') {
    if (field(output, 'success') === false) return list
    const id = idOf(field(output, 'taskId')) ?? idOf(args.taskId)
    if (id === undefined) return list

    return taskUpdated(list, id, field(field(output, 'statusChange'), 'to') ?? args.status)
  }
  if (tool === 'TodoWrite') return todosWritten(field(output, 'newTodos') ?? args.todos)

  return list
}
