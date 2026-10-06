import { expect, test } from 'claude-code/testing'

import { afterTaskCall, atTurnStart, countOf, countText, isAllDone, NO_TASKS, sameCount, TASK_TOOLS, taskCreated, taskUpdated, todosWritten } from './tasks'

test('tasks are counted as they are created, updated and deleted', () => {
  let list = taskCreated(NO_TASKS, '1')
  list = taskCreated(list, '2')
  expect(countOf(list)).toEqual({ done: 0, total: 2 })
  list = taskUpdated(list, '1', 'in_progress')
  list = taskUpdated(list, '1', 'completed')
  expect(countOf(list)).toEqual({ done: 1, total: 2 })
  list = taskUpdated(list, '2', 'deleted')
  expect(countOf(list)).toEqual({ done: 1, total: 1 })
  expect(countOf(NO_TASKS)).toBe(null)
})

test('an update of a task never seen created adds it; an unknown status or a repeat changes nothing', () => {
  const list = taskUpdated(NO_TASKS, '7', 'completed')
  expect(countOf(list)).toEqual({ done: 1, total: 1 })
  expect(taskUpdated(list, '7', 'bogus')).toBe(list)
  expect(taskUpdated(list, '7', 'completed')).toBe(list)
  expect(taskUpdated(list, '8', 'deleted')).toBe(list)
})

test("TodoWrite's list is the whole list", () => {
  const list = todosWritten([
    { content: 'a', status: 'completed', activeForm: 'A' },
    { content: 'b', status: 'in_progress', activeForm: 'B' },
    { content: 'c', status: 'pending', activeForm: 'C' },
  ])
  expect(countOf(list)).toEqual({ done: 1, total: 3 })
  expect(todosWritten('nope')).toEqual(NO_TASKS)
})

test('a list all done goes at the next turn start; one with work left stays', () => {
  const done = taskUpdated(taskCreated(NO_TASKS, '1'), '1', 'completed')
  expect(isAllDone(done)).toBe(true)
  expect(atTurnStart(done)).toEqual(NO_TASKS)
  const open = taskCreated(done, '2')
  expect(atTurnStart(open)).toBe(open)
  expect(isAllDone(NO_TASKS)).toBe(false)
})

test("the bar's words: 3 of 8 tasks, with a tick when all are done", () => {
  expect(countText({ done: 3, total: 8 })).toBe('3 of 8 tasks')
  expect(countText({ done: 1, total: 1 })).toBe('1 of 1 task ✓')
  expect(countText({ done: 8, total: 8 })).toBe('8 of 8 tasks ✓')
})

test("a call's result moves the list: TaskCreate's id, TaskUpdate's status change, TodoWrite's new list", () => {
  let list = afterTaskCall(NO_TASKS, 'TaskCreate', { subject: 'a' }, { task: { id: '1', subject: 'a' } })
  list = afterTaskCall(list, 'TaskCreate', { subject: 'b' }, { task: { id: '2', subject: 'b' } })
  expect(countOf(list)).toEqual({ done: 0, total: 2 })
  // The status it changed to, else the one asked for.
  list = afterTaskCall(list, 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: true, taskId: '1', updatedFields: ['status'], statusChange: { from: 'pending', to: 'completed' } })
  list = afterTaskCall(list, 'TaskUpdate', { taskId: '2', status: 'in_progress' }, { success: true, taskId: '2', updatedFields: ['status'] })
  expect(list).toEqual({ '1': 'completed', '2': 'in_progress' })
  // A failed update, a malformed result, another tool: nothing changes.
  expect(afterTaskCall(list, 'TaskUpdate', { taskId: '2', status: 'completed' }, { success: false, taskId: '2', updatedFields: [] })).toBe(list)
  expect(afterTaskCall(list, 'TaskCreate', {}, 'created')).toBe(list)
  // Other shapes: a numeric id, an id in a text result, an update answered in text.
  expect(countOf(afterTaskCall(list, 'TaskCreate', {}, { task: { id: 3 } }))).toEqual({ done: 1, total: 3 })
  expect(countOf(afterTaskCall(list, 'TaskCreate', {}, 'Task #4 created successfully: c'))).toEqual({ done: 1, total: 3 })
  expect(afterTaskCall(list, 'TaskUpdate', { taskId: '2', status: 'completed' }, 'Updated task #2 status')).toEqual({ '1': 'completed', '2': 'completed' })
  expect(afterTaskCall(list, 'Read', { file_path: 'a' }, 'text')).toBe(list)
  expect(countOf(afterTaskCall(list, 'TodoWrite', { todos: [] }, { oldTodos: [], newTodos: [{ content: 'x', status: 'completed', activeForm: 'X' }] }))).toEqual({ done: 1, total: 1 })
  expect(countOf(afterTaskCall(list, 'TodoWrite', { todos: [{ content: 'x', status: 'pending', activeForm: 'X' }] }, 'ok'))).toEqual({ done: 0, total: 1 })
})

test('sameCount: the same done and total, or both none', () => {
  expect(sameCount(null, null)).toBe(true)
  expect(sameCount({ done: 1, total: 2 }, { done: 1, total: 2 })).toBe(true)
  expect(sameCount({ done: 1, total: 2 }, { done: 2, total: 2 })).toBe(false)
  expect(sameCount(null, { done: 0, total: 1 })).toBe(false)
  expect([...TASK_TOOLS].sort()).toEqual(['TaskCreate', 'TaskUpdate', 'TodoWrite'])
})
