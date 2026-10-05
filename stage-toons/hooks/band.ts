// The progress bar above the prompt, as lines of styled spans: the stepped
// track, where the work stands and the feature, the Fable tag while an
// auditor runs, and the message. Sized to the band in terminal cells, so
// nothing wraps.

import type { Progress, Workflow } from '../types'
import { STAGE_W } from './scene'
import { cellWidth, fitCells, NOT_TRACKED, position, stageLabel } from './stages'
import { TOON_ROWS } from './toon'
import { isDone } from './track'
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
// The fewest terminal columns at which the toon under the spinner and the
// area under the bar show (drawn 24 and 29 wide there, cropped).
export const TOON_MIN = 30

// How wide the toon under the spinner is drawn in a viewport this many
// columns wide: the spinner's own columns to its left are kept clear.
export const toonColumns = (viewport: number) => Math.min(STAGE_W, viewport - 6)
// How wide the area under the bar is drawn in a band this many columns wide:
// one column spare, as the bar keeps.
export const areaColumns = (columns: number) => Math.min(STAGE_W, columns - 1)

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

// message, when given, stands in for the progress's own (the demo's line).
export function bandLayout(w: Workflow, p: Progress, isAuditing: boolean, columns: number, message?: string): Span[][] {
  // One column spare, so a line never touches the edge.
  const width = Math.max(1, columns - 1)
  if (p.stage === null) return untrackedLayout(w, p, isAuditing, columns, width, message)
  // Done draws as a track stage does: the track, then its label.
  if (!isTrack(w, p.stage) && !isDone(p.stage)) return sideLayout(w, p, isAuditing, columns, width, message ?? p.message)
  const line = message ?? p.message
  if (columns < WIDE_MIN) return [[{ text: fitCells(`${position(w, p)} — ${line}`, width), tone: 'label' }]]
  const track: Span[] = [{ text: ' ', tone: 'label' }, ...trackSpans(w, p)]
  const room = width - lengthOf(track)
  const withFeature = `  ${position(w, p)}${p.feature ? ` · ${p.feature}` : ''}`
  const tag = isAuditing ? `  ${TAG}` : ''
  // The tag goes first, then the feature; what still overflows is cut.
  const label = cellWidth(withFeature) <= room ? withFeature : `  ${position(w, p)}`
  const line1: Span[] = [...track, { text: fitCells(label, room), tone: 'label' }]
  if (tag && cellWidth(label) + cellWidth(tag) <= room) line1.push({ text: tag, tone: 'tag' })

  return [line1, [{ text: fitCells(` ${line}`, width), tone: 'message' }]]
}

// Untracked: the dim track, Not tracked yet and the Fable tag when it fits,
// on one line, and the demo's line under it while one plays.
function untrackedLayout(w: Workflow, p: Progress, isAuditing: boolean, columns: number, width: number, message?: string): Span[][] {
  const label = `${NOT_TRACKED}${p.feature ? ` · ${p.feature}` : ''}`
  const demo: Span[][] = message === undefined ? [] : [[{ text: fitCells(` ${message}`, width), tone: 'message' }]]
  if (columns < WIDE_MIN) return [[{ text: fitCells(label, width), tone: 'label' }], ...demo]
  const track: Span[] = [{ text: ' ', tone: 'label' }, ...trackSpans(w, p)]
  const room = width - lengthOf(track)
  const line1: Span[] = [...track, { text: fitCells(`  ${label}`, room), tone: 'label' }]
  const tag = `  ${TAG}`
  if (isAuditing && cellWidth(`  ${label}`) + cellWidth(tag) <= room) line1.push({ text: tag, tone: 'tag' })

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
