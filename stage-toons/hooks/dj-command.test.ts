import { expect, test } from 'claude-code/testing'

import { DJ_ASKING, DJ_DENIED, DJ_NEEDS_PLAYERCTL, DJ_NEEDS_TERMINAL, DJ_NO_WSL, djBlockedText, djPartyText, djText, parseCommand, unknownText } from './command'
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

test("/stage dj's answer while macOS's Automation permission is asked for or denied; the track once a read goes through", () => {
  expect(DJ_ASKING).toBe('DJ mode on: reading Spotify timed out. If macOS is asking whether your terminal may control Spotify, allow it, and the music shows.')
  expect(DJ_DENIED).toBe("DJ mode on, but macOS doesn't let your terminal control Spotify: switch it on in System Settings › Privacy & Security › Automation, under your terminal's name.")
  expect(djText(true, NO_MUSIC, false, 'asking')).toBe(DJ_ASKING)
  expect(djText(true, NO_MUSIC, false, 'denied')).toBe(DJ_DENIED)
  expect(djText(true, heard(NO_MUSIC, FIGURE), false, null)).toBe('DJ mode on: ♪ Linkin Park – Figure.09')
  // Off says off, whatever the last read left; a broken picture says so first.
  expect(djText(false, NO_MUSIC, false, 'denied')).toBe("DJ mode is off. /stage dj on: while Spotify plays, Clawd DJs and the track's name shows.")
  expect(djText(true, NO_MUSIC, true, 'denied')).toContain('the DJ picture failed this session')
})

test("where DJ mode can't read: no terminal or another OS, Linux without playerctl, WSL", () => {
  expect(DJ_NEEDS_TERMINAL).toBe('DJ mode needs Claude Code in a terminal on Windows, macOS or Linux.')
  expect(DJ_NEEDS_PLAYERCTL).toBe('DJ mode on Linux needs playerctl (from your package manager): it reads Spotify through MPRIS.')
  expect(DJ_NO_WSL).toBe("DJ mode can't reach Spotify on Windows from WSL: run Claude Code in a Windows terminal for it.")
  expect(djBlockedText('none')).toBe(DJ_NEEDS_TERMINAL)
  expect(djBlockedText('linux-missing')).toBe(DJ_NEEDS_PLAYERCTL)
  expect(djBlockedText('wsl')).toBe(DJ_NO_WSL)
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
