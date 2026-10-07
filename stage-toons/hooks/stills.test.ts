import { expect, test } from 'claude-code/testing'

import { LAYER_CLEAR_Y } from './frames'
import { IDLE_IDS, routineOf, routineStill } from './idle'
import { heroAt, stillOf } from './scene'
import { SCENES } from './scenes'

// The stills: the moment calm mode holds each picture at.
// Scenes whose hero's head is above the layer's room at every moment on a
// 7-row area (the 8- and 9-row areas' headroom gives it room there).
const HIGH_HEADS = ['fishing', 'waiting-bench']

test("every library scene and idle routine has a still within its loop", () => {
  for (const [id, scene] of Object.entries(SCENES)) {
    expect(scene.still === undefined ? id : 'set').toBe('set')
    expect(stillOf(scene) >= 0 && stillOf(scene) < scene.loop ? 'in' : id).toBe('in')
  }
  for (const id of [...IDLE_IDS, 'celebrate', 'show-off:plan']) {
    const r = routineOf(id)!
    expect(r.still === undefined ? id : 'set').toBe('set')
    expect(routineStill(id) >= 0 && routineStill(id) < r.loop ? 'in' : id).toBe('in')
  }
  // An unknown routine holds classic's.
  expect(routineStill('nope')).toBe(routineOf('classic')!.still!)
  expect(stillOf({ ...SCENES['standing']!, still: undefined })).toBe(SCENES['standing']!.loop / 2)
})

test("every library scene's hero has room for the pop-ups at its still on a 7-row area, but for the named high heads", () => {
  for (const [id, scene] of Object.entries(SCENES)) {
    const isClear = heroAt(scene, stillOf(scene)).y >= LAYER_CLEAR_Y
    expect(`${id}: ${isClear}`).toBe(`${id}: ${!HIGH_HEADS.includes(id)}`)
  }
})
