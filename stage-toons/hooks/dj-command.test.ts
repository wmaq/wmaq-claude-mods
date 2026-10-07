import { expect, test } from 'claude-code/testing'

import { djPartyText, djText, parseCommand, unknownText } from './command'
import { demoFor, DJ_DEMO_CHANGE_MS, DJ_DEMO_SECONDS, DJ_DEMO_TRACKS, djDemoAt, startDemo } from './demo'
import { createMod } from './mod'
import { heard, NO_MUSIC, type NowPlaying } from './nowplaying'
import { STAGE_SCENES } from './scenes'
import { DEFAULT_WORKFLOW, parseWorkflow } from './workflow'

// Clawd DJ's commands and demo: /stage dj, /stage demo dj, what they answer.
const START = 1_000_000
const FIGURE: NowPlaying = { artist: 'Linkin Park', title: 'Figure.09', isPlaying: true }

test('/stage dj and /stage demo dj parse; dj is one of /stage\'s words', () => {
  expect(parseCommand(DEFAULT_WORKFLOW, 'dj')).toEqual({ kind: 'dj', isOn: null })
  expect(parseCommand(DEFAULT_WORKFLOW, 'DJ on')).toEqual({ kind: 'dj', isOn: true })
  expect(parseCommand(DEFAULT_WORKFLOW, 'dj off')).toEqual({ kind: 'dj', isOn: false })
  expect(parseCommand(DEFAULT_WORKFLOW, 'dj loud')).toEqual({ kind: 'usage' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'dj party')).toEqual({ kind: 'dj-party', isOn: null })
  expect(parseCommand(DEFAULT_WORKFLOW, 'dj Party ON')).toEqual({ kind: 'dj-party', isOn: true })
  expect(parseCommand(DEFAULT_WORKFLOW, 'dj party off')).toEqual({ kind: 'dj-party', isOn: false })
  expect(parseCommand(DEFAULT_WORKFLOW, 'dj party loud')).toEqual({ kind: 'usage' })
  expect(parseCommand(DEFAULT_WORKFLOW, 'demo dj')).toEqual({ kind: 'demo-dj', seconds: DJ_DEMO_SECONDS })
  expect(parseCommand(DEFAULT_WORKFLOW, 'demo dj 5')).toEqual({ kind: 'demo-dj', seconds: 5 })
  expect(parseCommand(DEFAULT_WORKFLOW, 'demo dj 99')).toEqual({ kind: 'usage' })
  expect(unknownText(DEFAULT_WORKFLOW, 'dj loud')).toBe('Not a /stage command: dj loud. /stage help lists them all.')
  const named = parseWorkflow(JSON.stringify({ track: [{ id: 'dj', label: 'DJ', message: 'Mixing' }] }), STAGE_SCENES)
  expect('errors' in named && named.errors.some(e => e.includes('"dj" is one of /stage\'s words'))).toBe(true)
})

test("/stage dj party's answer: the full light show, or the gentle booth", () => {
  expect(djPartyText(true)).toBe('DJ party lights on: the speakers, the floor, the booth and the box light up with the beat. /stage dj party off calms them.')
  expect(djPartyText(false)).toBe('DJ party lights off: the booth glows steady while Clawd bobs to the beat. /stage dj party on lights it up.')
})

test("/stage dj's answer: off, waiting for Spotify, or the track playing", () => {
  expect(djText(false, NO_MUSIC)).toBe("DJ mode is off. /stage dj on: while Spotify plays, Clawd DJs and the track's name shows.")
  expect(djText(true, NO_MUSIC)).toBe('DJ mode on: waiting for Spotify to play. /stage dj off turns it off.')
  expect(djText(true, heard(NO_MUSIC, FIGURE))).toBe('DJ mode on: ♪ Linkin Park – Figure.09')
  // The DJ picture broke this session: the usual cartoons show, and the
  // answer says so rather than naming a track that isn't drawn.
  expect(djText(true, heard(NO_MUSIC, FIGURE), true)).toBe('DJ mode on, but the DJ picture failed this session (the debug log says why): the usual cartoons show. /stage dj on tries again.')
  expect(djText(false, NO_MUSIC, true)).toBe("DJ mode is off. /stage dj on: while Spotify plays, Clawd DJs and the track's name shows.")
})

test('the DJ demo: a long title, the second track from 8 s, two dancers where the floor has room', () => {
  const demo = { kind: 'dj' as const, at: START, seconds: DJ_DEMO_SECONDS }
  expect(djDemoAt(demo, START, 120).track).toEqual(DJ_DEMO_TRACKS[0])
  expect(djDemoAt(demo, START + DJ_DEMO_CHANGE_MS, 120).track).toEqual(DJ_DEMO_TRACKS[1])
  expect(djDemoAt(demo, START, 120).dancers.entries.map(e => [e.kind, e.x, e.arrivedAt - START])).toEqual([
    ['opus', 45, 0],
    ['fable', 55, 500],
  ])
  expect(djDemoAt(demo, START, 48).dancers.entries).toHaveLength(1)
  const { demo: made, label } = demoFor({ kind: 'demo-dj', seconds: 20 }, DEFAULT_WORKFLOW, START)
  expect(made).toEqual({ kind: 'dj', at: START, seconds: 20 })
  const mod = createMod()
  expect(startDemo(mod, made, label, START, false, 2)).toBe('Playing Clawd DJ for 20 s: a long title, a track change, two helpers dancing. /stage demo stop ends it.')
})
