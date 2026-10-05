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
const castWith = (scenes: Record<SceneId, Scene>, breaks: string[] = []): Cast => ({
  scenes: { ...SCENES, ...scenes },
  reactions: REACTIONS,
  broken: new Set(),
  onBreak: id => breaks.push(id),
})

test('a frame is the base scene cropped to the raster', () => {
  const frame = composeFrame({ base: 'spec', time: 0, reaction: null }, 30, castWith({ spec: solid('spec', 7) }))
  expect(frame.w).toBe(30)
  expect(TOON_ROWS).toBe(7)
  expect(frame.h).toBe(TOON_ROWS * 2)
  expect([...frame.px].every(c => c === 7)).toBe(true)
})

test("a frame is the scene at the shot's time, its own clock", () => {
  // Column 0 lit for the loop's first half second.
  const blink: Scene = { id: 'spec', loop: 1, focusX: 24, actors: [], backdrop: (b, t) => fillRect(b, 0, 0, 1, 1, t < 0.5 ? 3 : 4) }
  const cast = castWith({ spec: blink })
  expect(getPixel(composeFrame({ base: 'spec', time: 0.25, reaction: null }, 48, cast), 0, 0)).toBe(3)
  expect(getPixel(composeFrame({ base: 'spec', time: 2.75, reaction: null }, 48, cast), 0, 0)).toBe(4)
})

test("a scene that fades at its loop point dissolves its last moment into the new loop's start", () => {
  const fading: Scene = { id: 'spec', loop: 1, focusX: 24, actors: [], fadesAtLoop: true, backdrop: (b, t) => fillRect(b, 0, 0, STAGE_W, STAGE_H, t < 0.5 ? 1 : 2) }
  const cast = castWith({ spec: fading })
  const colours = (time: number) => new Set(composeFrame({ base: 'spec', time, reaction: null }, 48, cast).px)
  expect([...colours(1.2)].sort()).toEqual([1, 2])
  expect([...colours(1.6)]).toEqual([2])
  // Its first loop starts clean.
  expect([...colours(0.2)]).toEqual([1])
})

test('a reaction draws over the base scene', () => {
  const frame = composeFrame({ base: 'spec', time: 0, reaction: { id: 'failure', t: 0.7 } }, 48, castWith({ spec: solid('spec', 7) }))
  expect([...frame.px].some(c => c === C.red)).toBe(true)
})

test('a scene that throws is replaced by idle and reported once', () => {
  const breaks: string[] = []
  const cast = castWith({ plan: exploding }, breaks)
  const frame = composeFrame({ base: 'plan', time: 0, reaction: null }, 48, cast)
  composeFrame({ base: 'plan', time: 0.1, reaction: null }, 48, cast)
  expect(breaks).toEqual(['plan'])
  expect([...frame.px]).toEqual([...renderScene(SCENES.standing!, 0, 48).px])
})

test("a scene's camera crops where it points, and holds on the scene's focus while a reaction plays", () => {
  // Column x painted in colour x + 1, a camera on the right half.
  const striped: Scene = {
    id: 'spec',
    loop: 1,
    focusX: 10,
    focus: () => 40,
    actors: [],
    backdrop: b => {
      for (let x = 0; x < STAGE_W; x++) fillRect(b, x, 0, 1, STAGE_H, x + 1)
    },
  }
  const cast = castWith({ spec: striped })
  const left = (reaction: { id: 'failure'; t: number } | null) => getPixel(composeFrame({ base: 'spec', time: 0, reaction }, 24, cast), 0, STAGE_H - 1)
  expect(left(null)).toBe(24 + 1)
  expect(left({ id: 'failure', t: 0.7 })).toBe(0 + 1)
})
