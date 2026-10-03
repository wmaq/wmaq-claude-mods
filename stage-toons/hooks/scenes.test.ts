import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { createBuffer, type PixelBuffer } from './pixels'
import { CLAWD_TOP, heroAt, renderFull, renderScene, type Scene, STAGE_H, STAGE_W } from './scene'
import { REACTIONS, SCENES, STAGE_SCENES } from './scenes'
import { DEFAULT_WORKFLOW } from './workflow'
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

test('Clawd stands on the bottom row of a 14-pixel stage, with six pixels of headroom', () => {
  const b = renderFull(SCENES.standing!, 0)
  const rows = [...b.px].flatMap((c, i) => (c === CLAWD_ORANGE ? [Math.floor(i / b.w)] : []))
  expect(STAGE_H).toBe(14)
  expect(Math.min(...rows)).toBe(6)
  expect(Math.max(...rows)).toBe(STAGE_H - 1)
})

// The gold pixels' columns and rows, and the box's outer columns.
const goldOf = (b: PixelBuffer) => [...b.px].flatMap((c, i) => (c === C.gold ? [{ x: i % b.w, y: Math.floor(i / b.w) }] : []))

test('the Other scene shows one question mark, whole and centred over the box', () => {
  for (let t = 0.013; t < SCENES['mystery-box']!.loop; t += 0.05) {
    const b = renderFull(SCENES['mystery-box']!, t)
    const gold = goldOf(b)
    expect(gold).toHaveLength(5)
    const box = [...b.px].flatMap((c, i) => (c === C.woodDark ? [i % b.w] : []))
    const centre = (Math.min(...box) + Math.max(...box)) / 2
    const dot = gold.reduce((a, p) => (p.y > a.y ? p : a))
    if (Math.min(...box) === 28) expect(dot.x).toBe(centre)
  }
})

test("the auditor's question mark shows whole", () => {
  expect(goldOf(renderFull(SCENES['fable-audit']!, 1))).toHaveLength(5)
})

test('every loop is seamless: the hero ends where it began', () => {
  for (const scene of SCENE_LIST) {
    const start = heroAt(scene, 0)
    const end = heroAt(scene, scene.loop - 1 / 12)
    expect(Math.abs(start.x - end.x) + Math.abs(start.y - end.y)).toBeLessThanOrEqual(2)
  }
})

test('every scene is filed under its own name: the library', () => {
  for (const [id, scene] of Object.entries(SCENES)) expect(scene.id).toBe(id)
  expect(Object.keys(SCENES).sort()).toEqual(
    ['road-trip', 'light-bulbs', 'writing-desk', 'proofread-page', 'stepping-stones', 'proofread-checklist', 'bricklaying', 'test-tubes', 'gift', 'sweeping', 'bug-hunt', 'mystery-box', 'fable-audit', 'standing'].sort(),
  )
  expect(STAGE_SCENES).toEqual(Object.keys(SCENES).filter(n => n !== 'fable-audit' && n !== 'standing'))
  for (const s of [...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side]) expect(STAGE_SCENES).toContain(s.scene)
})

test('in the auditor scene both Clawds are on stage', () => {
  for (let t = 0.013; t < SCENES['fable-audit']!.loop; t += 0.1) {
    const b = renderFull(SCENES['fable-audit']!, t)
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

test('bug-hunt: the bug and the magnifying glass are on stage throughout', () => {
  for (let t = 0.013; t < SCENES['bug-hunt']!.loop; t += 0.1) {
    const b = renderFull(SCENES['bug-hunt']!, t)
    expect(count(b, C.red)).toBeGreaterThan(1)
    expect(count(b, C.glass)).toBeGreaterThan(2)
  }
})
