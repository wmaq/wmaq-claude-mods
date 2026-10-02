import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { createBuffer, type PixelBuffer } from './pixels'
import { CLAWD_TOP, heroAt, renderFull, renderScene, type Scene, STAGE_H, STAGE_W } from './scene'
import { REACTIONS, SCENES } from './scenes'
import { C } from './scenes/kit'

const SCENE_LIST: Scene[] = Object.values(SCENES)

const count = (b: PixelBuffer, color: number) => [...b.px].filter(c => c === color).length

test('every scene renders at every moment, width and mood without throwing', () => {
  for (const scene of SCENE_LIST) {
    for (const width of [24, 30, 48]) {
      for (let t = 0; t <= 30; t += 0.1) {
        const b = renderScene(scene, t, width)
        expect(b.w).toBe(width)
        expect(b.h).toBe(STAGE_H)
      }
    }
    for (const mood of ['jump', 'flinch'] as const) renderFull(scene, 1.3, mood)
  }
})

test('Clawd is on stage throughout every scene', () => {
  for (const scene of SCENE_LIST) {
    for (let t = 0.013; t < scene.loop; t += 0.1) expect(count(renderFull(scene, t), CLAWD_ORANGE)).toBeGreaterThan(40)
  }
})

test('every loop is seamless: the hero ends where it began', () => {
  for (const scene of SCENE_LIST) {
    const start = heroAt(scene, 0)
    const end = heroAt(scene, scene.loop - 1 / 12)
    expect(Math.abs(start.x - end.x) + Math.abs(start.y - end.y)).toBeLessThanOrEqual(2)
  }
})

test('every scene is filed under its own id, one per stage plus the auditor and idle', () => {
  for (const [id, scene] of Object.entries(SCENES)) expect(scene.id).toBe(id)
  expect(Object.keys(SCENES).sort()).toEqual(
    ['roadmap', 'brainstorm', 'spec', 'spec-audit', 'plan', 'plan-audit', 'develop', 'claude-test', 'user-test', 'cleanup', 'other', 'auditor', 'idle'].sort(),
  )
})

test('in the auditor scene both Clawds are on stage', () => {
  for (let t = 0.013; t < SCENES.auditor.loop; t += 0.1) {
    const b = renderFull(SCENES.auditor, t)
    expect(count(b, CLAWD_ORANGE)).toBeGreaterThan(40)
    expect(count(b, FABLE_VIOLET)).toBeGreaterThan(40)
  }
})

test('reactions draw without throwing and set the hero mood', () => {
  const hero = { x: 24, y: CLAWD_TOP }
  for (const reaction of Object.values(REACTIONS)) {
    for (let t = 0; t < 3; t += 0.1) reaction.draw(createBuffer(STAGE_W, STAGE_H), t, hero)
  }
  const failure = createBuffer(STAGE_W, STAGE_H)
  REACTIONS.failure.draw(failure, 0.7, hero)
  expect(count(failure, C.red)).toBeGreaterThan(0)
  expect(REACTIONS.failure.mood?.(0.1)).toBe('flinch')
  expect(REACTIONS.advance.mood?.(0.1)).toBe('jump')
  expect(REACTIONS.advance.mood?.(2)).toBeNull()
})

test('Fable walks in from off stage to its place, and back out', () => {
  const fableAt = (id: 'fable-arrives' | 'fable-leaves', t: number) => {
    const b = createBuffer(STAGE_W, STAGE_H)
    REACTIONS[id].draw(b, t, { x: 24, y: CLAWD_TOP })

    return count(b, FABLE_VIOLET)
  }
  expect(fableAt('fable-arrives', 0)).toBe(0)
  expect(fableAt('fable-arrives', 1.99)).toBeGreaterThan(40)
  expect(fableAt('fable-leaves', 0.01)).toBeGreaterThan(40)
  expect(fableAt('fable-leaves', 2)).toBe(0)
})
