import { expect, test } from 'claude-code/testing'

import { atTurnStart, countOf, countText, isAllDone, NO_TASKS, taskCreated, taskUpdated, todosWritten } from './tasks'

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
