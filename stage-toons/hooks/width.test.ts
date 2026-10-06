import { expect, test } from 'claude-code/testing'

import { DEFAULT_WIDTH, isWidth, parseWidth, WIDTH_MAX, WIDTH_USAGE, widthText } from './width'

test('a width setting is a whole number of columns from 48 to 512, or full', () => {
  expect([DEFAULT_WIDTH, WIDTH_MAX]).toEqual([120, 512])
  for (const good of [48, 120, 512, 'full']) expect(isWidth(good)).toBe(true)
  for (const bad of [47, 513, 90.5, '120', 'Full', null, undefined, NaN]) expect(isWidth(bad)).toBe(false)
  expect(parseWidth('90')).toBe(90)
  expect(parseWidth('full')).toBe('full')
  expect(parseWidth('090')).toBe(90)
  expect(parseWidth('9e1')).toBe(null)
  expect(WIDTH_USAGE).toBe('Usage: /stage width [<n> | full], n a whole number of columns from 48 to 512.')
})

test("/stage width's answer: the width, the band's room once a band was drawn, and the file's setting", () => {
  expect(widthText(120, 139)).toBe('The cartoons grow up to 120 columns (the band has room for 139). /stage width <n> or /stage width full changes it.')
  expect(widthText(120, null)).toBe('The cartoons grow up to 120 columns. /stage width <n> or /stage width full changes it.')
  expect(widthText('full', 99, 80)).toBe(
    "The cartoons grow to the band's whole width, up to 512 columns (the band has room for 99). /stage width <n> or /stage width full changes it. This project's workflow file starts it at 80.",
  )
})
