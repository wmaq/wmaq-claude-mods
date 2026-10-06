// The width setting (/stage width, the workflow file's "width"): how many
// columns the area under the bar may grow to, or full for the band's whole
// width.

import type { WidthSetting } from '../types'
import { STAGE_W } from './scene'

// The widest Raster the engine draws: a wider one is refused, and nothing
// shows.
export const WIDTH_MAX = 512
export const DEFAULT_WIDTH = 120

// Whether a value is a width setting: a whole number of columns from the
// core's 48 to 512, or 'full'.
export const isWidth = (value: unknown): value is WidthSetting =>
  value === 'full' || (typeof value === 'number' && Number.isInteger(value) && value >= STAGE_W && value <= WIDTH_MAX)

// A width as /stage width takes it, a number or full; null for anything
// else.
export function parseWidth(word: string): WidthSetting | null {
  if (word === 'full') return 'full'
  const n = /^\d+$/.test(word) ? Number(word) : NaN

  return isWidth(n) ? n : null
}

export const WIDTH_USAGE = `Usage: /stage width [<n> | full], n a whole number of columns from ${STAGE_W} to ${WIDTH_MAX}.`

const widthWords = (width: WidthSetting): string => (width === 'full' ? "the band's whole width" : `${width} columns`)

// The setting as words in a sentence: 'the cartoons up to 120 columns'.
export const widthSettingWords = (width: WidthSetting): string => `the cartoons up to ${widthWords(width)}`

// /stage width's answer. room: the columns the band has for the area
// (null before a band was drawn); fileWidth, what the project's workflow
// file starts the session with, if it says.
export function widthText(width: WidthSetting, room: number | null, fileWidth?: WidthSetting): string {
  const grows = width === 'full' ? `The cartoons grow to the band's whole width, up to ${WIDTH_MAX} columns` : `The cartoons grow up to ${width} columns`
  const band = room === null ? '' : ` (the band has room for ${room})`
  const file = fileWidth === undefined ? '' : ` This project's workflow file starts it at ${fileWidth}.`

  return `${grows}${band}. /stage width <n> or /stage width full changes it.${file}`
}
