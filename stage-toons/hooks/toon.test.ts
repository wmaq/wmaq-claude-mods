import { expect, test } from 'claude-code/testing'

import { fillRect, getPixel } from './pixels'
import { renderScene, type Scene, type SceneId, STAGE_H, STAGE_W } from './scene'
import { REACTIONS, SCENES } from './scenes'
import { C } from './scenes/kit'
import { type Cast, composeFrame, TOON_ROWS } from './toon'

const solid = (id: SceneId, color: number): Scene => ({ id, loop: 1, focusX: 24, actors: [], backdrop: b => fillRect(b, 0, 0, STAGE_W, STAGE_H, color) })
const exploding: Scene = {
  id: 'plan',
  loop: 1,
  focusX: 24,
  actors: [],
  backdrop: () => {
    throw new Error('boom')
  },
}
const castWith = (scenes: Partial<Record<SceneId, Scene>>, breaks: string[] = []): Cast => ({
  scenes: { ...SCENES, ...scenes },
  reactions: REACTIONS,
  broken: new Set(),
  onBreak: id => breaks.push(id),
})

test('a frame is the base scene cropped to the raster', () => {
  const frame = composeFrame({ base: 'spec', wipe: null, reaction: null }, 0, 30, castWith({ spec: solid('spec', 7) }))
  expect(frame.w).toBe(30)
  expect(TOON_ROWS).toBe(7)
  expect(frame.h).toBe(TOON_ROWS * 2)
  expect([...frame.px].every(c => c === 7)).toBe(true)
})

test('a wipe shows the new scene on the left', () => {
  const frame = composeFrame({ base: 'plan', wipe: { from: 'spec', progress: 0.5 }, reaction: null }, 0, 48, castWith({ spec: solid('spec', 1), plan: solid('plan', 2) }))
  expect(getPixel(frame, 0, 0)).toBe(2)
  expect(getPixel(frame, 47, 0)).toBe(1)
})

test('a reaction draws over the base scene', () => {
  const frame = composeFrame({ base: 'spec', wipe: null, reaction: { id: 'failure', t: 0.7 } }, 0, 48, castWith({ spec: solid('spec', 7) }))
  expect([...frame.px].some(c => c === C.red)).toBe(true)
})

test('a scene that throws is replaced by idle and reported once', () => {
  const breaks: string[] = []
  const cast = castWith({ plan: exploding }, breaks)
  const frame = composeFrame({ base: 'plan', wipe: null, reaction: null }, 0, 48, cast)
  composeFrame({ base: 'plan', wipe: null, reaction: null }, 100, 48, cast)
  expect(breaks).toEqual(['plan'])
  expect([...frame.px]).toEqual([...renderScene(SCENES.idle, 0, 48).px])
})
