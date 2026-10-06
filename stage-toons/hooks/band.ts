// The progress bar above the prompt, as lines of styled spans: the stepped
// track, where the work stands and the feature, the Fable tag while an
// auditor runs, and the message. Sized to the band in terminal cells, so
// nothing wraps.

import type { Progress, WidthSetting, Workflow } from '../types'
import type { AreaSize } from './scene'
import { cellWidth, fitCells, NOT_TRACKED, position, stageLabel } from './stages'
import { type TaskCount, countText } from './tasks'
import { TOON_ROWS } from './toon'
import { isDone } from './track'
import { WIDTH_MAX } from './width'
import { isTrack, rank, stageOf } from './workflow'

export type Tone = 'done' | 'current' | 'future' | 'label' | 'tag' | 'message' | 'note'
export type Span = { text: string; tone: Tone }

// How each tone is drawn: the props of its Text (the band's hook), and the
// frame tool's colours.
export const BAR_TONES: Record<Tone, { color?: string; bold?: boolean; dimColor?: boolean }> = {
  done: { color: '#D97757' },
  current: { color: '#D97757', bold: true },
  future: { dimColor: true },
  label: {},
  tag: { color: '#8B7AE8' },
  message: { dimColor: true },
  note: { dimColor: true },
}

// Below this many columns the band is one line.
export const WIDE_MIN = 50
export const TAG = '⌕ Fable reviewing'
// The fewest band columns at which the area under the bar shows (drawn 29
// wide there, cropped).
export const TOON_MIN = 30

// The most rows the area takes, where the band has them (TOON_ROWS, 7, is
// the fewest).
export const AREA_ROWS = 9

export type BandMode = 'none' | 'text' | 'area'
// barLines: how many lines the bar takes, as bandLayout laid it out.
export type BandSite = {
  surface: string
  hasSurvey: boolean
  isAgentView: boolean
  isHidden: boolean
  columns: number
  maxRows: number
  barLines: number
}

// What the band draws: nothing of stage-toons' (yielding), the text bar,
// or the bar over the area, which plays a demo, the stage's scene while
// Claude works, the waiting toon or the idle Clawd. The area is terminal
// only, and shows only where the band has the rows to hold it whole under
// the bar's lines.
export function bandMode(s: BandSite): BandMode {
  if (s.hasSurvey || s.isAgentView || s.isHidden) return 'none'
  if (s.surface !== 'terminal') return 'text'

  return s.columns >= TOON_MIN && s.maxRows >= s.barLines + TOON_ROWS ? 'area' : 'text'
}

// The area's size in a band: as wide as the band (one column spare, as the
// bar keeps) up to the width setting and the widest Raster; 9 rows where
// the band has them under the bar, else 8, else 7. previous: the rows the
// area last showed with, null when it has not shown since the session or
// the last band without it. It shrinks at once, and grows only with a row
// to spare, so a line that comes and goes under it (the spinner's, at a
// turn's start) does not make it flicker.
export function areaSize(s: BandSite, limit: WidthSetting, previous: number | null): AreaSize {
  const columns = Math.min(limit === 'full' ? WIDTH_MAX : limit, s.columns - 1, WIDTH_MAX)
  const room = s.maxRows - s.barLines
  const fit = Math.min(AREA_ROWS, room)
  const rows = previous === null || fit <= previous ? fit : Math.max(previous, Math.min(AREA_ROWS, room - 1))

  return { columns, rows }
}

// The track as it stands: done steps and the links between them, the
// current step, and the steps to come. In Other, the track as it stood at
// the last track stage, all dim. In Done, every step done, none current.
export function trackSpans(w: Workflow, p: Progress): Span[] {
  const isOff = !isTrack(w, p.stage) && !isDone(p.stage)
  const at = isDone(p.stage) ? w.track.length : isTrack(w, p.stage) ? rank(w, p.stage) : rank(w, p.lastTrackStage)
  const lit = (tone: Tone): Tone => (isOff ? 'future' : tone)
  const spans: Span[] = []
  w.track.forEach((_, i) => {
    if (i > 0) spans.push(i <= at ? { text: '━', tone: lit('done') } : { text: '─', tone: 'future' })
    spans.push(i < at ? { text: '●', tone: lit('done') } : i === at ? { text: '◉', tone: lit('current') } : { text: '○', tone: 'future' })
  })

  return spans
}

const lengthOf = (spans: Span[]) => spans.reduce((n, s) => n + cellWidth(s.text), 0)

// The label after the track: the position, then the tasks' count and the
// feature, each dropped in turn (the feature first) while it doesn't fit.
function trackLabel(head: string, p: Progress, tasks: TaskCount | null, room: number): string {
  const count = tasks ? ` · ${countText(tasks)}` : ''
  const feature = p.feature ? ` · ${p.feature}` : ''
  const fits = [`  ${head}${count}${feature}`, `  ${head}${count}`].find(label => cellWidth(label) <= room)

  return fits ?? `  ${head}`
}

// message, when given, stands in for the progress's own (the demo's line);
// tasks, Claude's task list's count, shows after the position.
export function bandLayout(w: Workflow, p: Progress, isAuditing: boolean, columns: number, message?: string, tasks: TaskCount | null = null): Span[][] {
  // One column spare, so a line never touches the edge.
  const width = Math.max(1, columns - 1)
  if (p.stage === null) return untrackedLayout(w, p, isAuditing, columns, width, message, tasks)
  // Done draws as a track stage does: the track, then its label.
  if (!isTrack(w, p.stage) && !isDone(p.stage)) return sideLayout(w, p, isAuditing, columns, width, message ?? p.message)
  const line = message ?? p.message
  if (columns < WIDE_MIN) return [[{ text: fitCells(`${position(w, p)} — ${line}`, width), tone: 'label' }]]
  const track: Span[] = [{ text: ' ', tone: 'label' }, ...trackSpans(w, p)]
  const room = width - lengthOf(track)
  const tag = isAuditing ? `  ${TAG}` : ''
  // The tag goes first, then the feature, then the tasks; what still
  // overflows is cut.
  const label = trackLabel(position(w, p), p, tasks, room)
  const line1: Span[] = [...track, { text: fitCells(label, room), tone: 'label' }]
  if (tag && cellWidth(label) + cellWidth(tag) <= room) line1.push({ text: tag, tone: 'tag' })

  return [line1, [{ text: fitCells(` ${line}`, width), tone: 'message' }]]
}

// Untracked: the dim track, Not tracked yet and the Fable tag when it fits,
// on one line, and the demo's line under it while one plays.
function untrackedLayout(w: Workflow, p: Progress, isAuditing: boolean, columns: number, width: number, message: string | undefined, tasks: TaskCount | null): Span[][] {
  const label = `${NOT_TRACKED}${p.feature ? ` · ${p.feature}` : ''}`
  const demo: Span[][] = message === undefined ? [] : [[{ text: fitCells(` ${message}`, width), tone: 'message' }]]
  if (columns < WIDE_MIN) return [[{ text: fitCells(label, width), tone: 'label' }], ...demo]
  const track: Span[] = [{ text: ' ', tone: 'label' }, ...trackSpans(w, p)]
  const room = width - lengthOf(track)
  const full = tasks ? trackLabel(NOT_TRACKED, p, tasks, room) : `  ${label}`
  const line1: Span[] = [...track, { text: fitCells(full, room), tone: 'label' }]
  const tag = `  ${TAG}`
  if (isAuditing && cellWidth(full) + cellWidth(tag) <= room) line1.push({ text: tag, tone: 'tag' })

  return [line1, ...demo]
}

// A side stage: no track; the stage, the feature, the Fable tag and a dim
// note of the track stage the work returns to. Room runs out: the tag goes,
// then the note, then the feature, then the label is cut.
function sideLayout(w: Workflow, p: Progress, isAuditing: boolean, columns: number, width: number, message: string): Span[][] {
  const head = `${stageOf(w, p.stage)?.label ?? p.stage}`
  if (columns < WIDE_MIN) return [[{ text: fitCells(`${head} — ${message}`, width), tone: 'label' }]]
  const feature = p.feature ? ` · ${p.feature}` : ''
  const note = isTrack(w, p.lastTrackStage) ? `   ↩ ${stageLabel(w, p.lastTrackStage!)}` : ''
  const tag = isAuditing ? `  ${TAG}` : ''
  const full = ` ${head}${feature}`
  const label = cellWidth(full) <= width ? full : ` ${head}`
  const line1: Span[] = [{ text: fitCells(label, width), tone: 'label' }]
  let used = cellWidth(label)
  // The note goes before the feature does: with the feature dropped, no note.
  if (note && label === full && used + cellWidth(note) <= width) {
    line1.push({ text: note, tone: 'note' })
    used += cellWidth(note)
  }
  if (tag && used + cellWidth(tag) <= width) line1.push({ text: tag, tone: 'tag' })

  return [line1, [{ text: fitCells(` ${message}`, width), tone: 'message' }]]
}
