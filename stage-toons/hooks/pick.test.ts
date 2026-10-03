import { expect, test } from 'claude-code/testing'

import { pickOne } from './pick'

test('one item is always that item', () => {
  expect(pickOne(['gift'], 'gift', 0.9)).toBe('gift')
  expect(pickOne(['gift'], undefined, 0)).toBe('gift')
})

test('the item shown last is left out when there is another', () => {
  expect(pickOne(['a', 'b'], 'a', 0)).toBe('b')
  expect(pickOne(['a', 'b'], 'a', 0.99)).toBe('b')
  expect(pickOne(['a', 'b', 'c'], 'b', 0)).toBe('a')
  expect(pickOne(['a', 'b', 'c'], 'b', 0.99)).toBe('c')
})

test('with no last item, or one not in the list, all are candidates', () => {
  expect(pickOne(['a', 'b', 'c'], undefined, 0)).toBe('a')
  expect(pickOne(['a', 'b', 'c'], undefined, 0.5)).toBe('b')
  expect(pickOne(['a', 'b', 'c'], 'gone', 0.99)).toBe('c')
  expect(pickOne(['a', 'b', 'c'], undefined, 0.9999999)).toBe('c')
})
