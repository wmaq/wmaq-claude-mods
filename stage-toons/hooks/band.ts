// The progress bar above the prompt, as lines of styled spans: the stepped
// track, where the work stands and the feature, the Fable tag while an
// auditor runs, and the message. Sized to the band so nothing wraps.

import type { Progress, Workflow } from '../types'
import { charCount, fitText, NOT_TRACKED, position, stageLabel } from './stages'
import { TOON_ROWS } from './toon'
import { isTrack, rank, stageOf } from './workflow'

export type Tone = 'done' | 'current' | 'future' | 'label' | 'tag' | 'message' | 'note'
export type Span = { text: string; tone: Tone }

// Below this many columns the band is one line.
export const WIDE_MIN = 50
export const TAG = '⌕ Fable reviewing'
// The fewest columns a toon is drawn in, cropped.
export const TOON_MIN = 30

export type BandMode = 'none' | 'text' | 'area'
// barLines: how many lines the bar takes, as bandLayout laid it out.
export type BandSite = {
  surface: string
  isWorking: boolean
  hasSurvey: boolean
  isAgentView: boolean
  isHidden: boolean
  columns: number
  maxRows: number
  hasDemo: boolean
  barLines: number
}

// What the band draws: nothing of stage-toons' (yielding), the text bar,
// or the bar over the area, which plays the demo, the waiting toon or the
// idle Clawd. The area is terminal only, shows while Claude waits or a demo
// plays, and only where the band has the rows to hold it whole under the
// bar's lines.
export function bandMode(s: BandSite): BandMode {
  if (s.hasSurvey || s.isAgentView || s.isHidden) return 'none'
  if (s.surface !== 'terminal' || (s.isWorking && !s.hasDemo)) return 'text'

  return s.columns >= TOON_MIN && s.maxRows >= s.barLines + TOON_ROWS ? 'area' : 'text'
}

// The track as it stands: done steps and the links between them, the
// current step, and the steps to come. In Other, the track as it stood at
// the last track stage, all dim.
export function trackSpans(w: Workflow, p: Progress): Span[] {
  const isOff = !isTrack(w, p.stage)
  const at = isTrack(w, p.stage) ? rank(w, p.stage) : rank(w, p.lastTrackStage)
  const lit = (tone: Tone): Tone => (isOff ? 'future' : tone)
  const spans: Span[] = []
  w.track.forEach((_, i) => {
    if (i > 0) spans.push(i <= at ? { text: '━', tone: lit('done') } : { text: '─', tone: 'future' })
    spans.push(i < at ? { text: '●', tone: lit('done') } : i === at ? { text: '◉', tone: lit('current') } : { text: '○', tone: 'future' })
  })

  return spans
}

const lengthOf = (spans: Span[]) => spans.reduce((n, s) => n + charCount(s.text), 0)

// message, when given, stands in for the progress's own (the demo's line).
export function bandLayout(w: Workflow, p: Progress, isAuditing: boolean, columns: number, message?: string): Span[][] {
  // One column spare, so a line never touches the edge.
  const width = Math.max(1, columns - 1)
  if (p.stage === null) return untrackedLayout(w, p, isAuditing, columns, width, message)
  if (!isTrack(w, p.stage)) return sideLayout(w, p, isAuditing, columns, width, message ?? p.message)
  const line = message ?? p.message
  if (columns < WIDE_MIN) return [[{ text: fitText(`${position(w, p)} — ${line}`, width), tone: 'label' }]]
  const track: Span[] = [{ text: ' ', tone: 'label' }, ...trackSpans(w, p)]
  const room = width - lengthOf(track)
  const withFeature = `  ${position(w, p)}${p.feature ? ` · ${p.feature}` : ''}`
  const tag = isAuditing ? `  ${TAG}` : ''
  // The tag goes first, then the feature; what still overflows is cut.
  const label = charCount(withFeature) <= room ? withFeature : `  ${position(w, p)}`
  const line1: Span[] = [...track, { text: fitText(label, room), tone: 'label' }]
  if (tag && charCount(label) + charCount(tag) <= room) line1.push({ text: tag, tone: 'tag' })

  return [line1, [{ text: fitText(` ${line}`, width), tone: 'message' }]]
}

// Untracked: the dim track, Not tracked yet and the Fable tag when it fits,
// on one line, and the demo's line under it while one plays.
function untrackedLayout(w: Workflow, p: Progress, isAuditing: boolean, columns: number, width: number, message?: string): Span[][] {
  const label = `${NOT_TRACKED}${p.feature ? ` · ${p.feature}` : ''}`
  const demo: Span[][] = message === undefined ? [] : [[{ text: fitText(` ${message}`, width), tone: 'message' }]]
  if (columns < WIDE_MIN) return [[{ text: fitText(label, width), tone: 'label' }], ...demo]
  const track: Span[] = [{ text: ' ', tone: 'label' }, ...trackSpans(w, p)]
  const room = width - lengthOf(track)
  const line1: Span[] = [...track, { text: fitText(`  ${label}`, room), tone: 'label' }]
  const tag = `  ${TAG}`
  if (isAuditing && charCount(`  ${label}`) + charCount(tag) <= room) line1.push({ text: tag, tone: 'tag' })

  return [line1, ...demo]
}

// A side stage: no track; the stage, the feature, the Fable tag and a dim
// note of the track stage the work returns to. Room runs out: the tag goes,
// then the note, then the feature, then the label is cut.
function sideLayout(w: Workflow, p: Progress, isAuditing: boolean, columns: number, width: number, message: string): Span[][] {
  const head = `${stageOf(w, p.stage)?.label ?? p.stage}`
  if (columns < WIDE_MIN) return [[{ text: fitText(`${head} — ${message}`, width), tone: 'label' }]]
  const feature = p.feature ? ` · ${p.feature}` : ''
  const note = isTrack(w, p.lastTrackStage) ? `   ↩ ${stageLabel(w, p.lastTrackStage!)}` : ''
  const tag = isAuditing ? `  ${TAG}` : ''
  const full = ` ${head}${feature}`
  const label = charCount(full) <= width ? full : ` ${head}`
  const line1: Span[] = [{ text: fitText(label, width), tone: 'label' }]
  let used = charCount(label)
  // The note goes before the feature does: with the feature dropped, no note.
  if (note && label === full && used + charCount(note) <= width) {
    line1.push({ text: note, tone: 'note' })
    used += charCount(note)
  }
  if (tag && used + charCount(tag) <= width) line1.push({ text: tag, tone: 'tag' })

  return [line1, [{ text: fitText(` ${message}`, width), tone: 'message' }]]
}
