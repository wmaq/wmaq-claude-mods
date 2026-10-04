import { expect, test } from 'claude-code/testing'

import { cropLeft, IDLE_TOP, placeIdle } from './area'
import { idleFrame } from './idle'
import { createBuffer, EMPTY, getPixel, setPixel } from './pixels'

test('the idle box sits at the bottom-left of the 48 x 14 area', () => {
  expect(IDLE_TOP).toBe(6)
  const box = createBuffer(26, 8)
  setPixel(box, 0, 0, 1)
  setPixel(box, 25, 7, 2)
  const area = placeIdle(box)
  expect([area.w, area.h]).toEqual([48, 14])
  expect(getPixel(area, 0, 6)).toBe(1)
  expect(getPixel(area, 25, 13)).toBe(2)
  expect([...area.px].filter(c => c !== EMPTY)).toHaveLength(2)
})

test('the area is cut from the left, so the idle Clawd stays whole from 27 columns', () => {
  const area = placeIdle(idleFrame('classic', 500))
  const cut = cropLeft(area, 27)
  expect(cut.w).toBe(27)
  for (let y = 0; y < 14; y++) for (let x = 0; x < 27; x++) expect(getPixel(cut, x, y)).toBe(getPixel(area, x, y))
})
