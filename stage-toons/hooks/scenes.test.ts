import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE, FABLE_VIOLET } from './clawd'
import { createBuffer, type PixelBuffer } from './pixels'
import { CLAWD_TOP, heroAt, renderFull, renderScene, type Scene, STAGE_H, STAGE_W } from './scene'
import { REACTIONS, SCENES, STAGE_SCENES } from './scenes'
import { DEFAULT_WORKFLOW } from './workflow'
import { C } from './scenes/kit'

const LIBRARY = [
  'road-trip', 'light-bulbs', 'writing-desk', 'proofread-page', 'stepping-stones', 'proofread-checklist', 'bricklaying', 'test-tubes', 'gift',
  'sweeping', 'bug-hunt', 'mystery-box', 'fable-audit', 'standing',
  'stargazing', 'sticky-notes', 'blueprint', 'red-pen',
  'dominoes', 'clipboard', 'terminal', 'control-panel',
  'waiting-bench', 'dishes', 'flashlight', 'fishing',
]

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
  expect(Object.keys(SCENES).sort()).toEqual([...LIBRARY].sort())
  expect(STAGE_SCENES).toEqual(Object.keys(SCENES).filter(n => n !== 'fable-audit' && n !== 'standing'))
  for (const s of [...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side]) for (const id of s.scenes) expect(STAGE_SCENES).toContain(id)
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

const has = (id: string, color: number, t: number) => count(renderFull(SCENES[id]!, t), color)

test('batch 1, part 1: each new scene shows what it is about', () => {
  // Stars come out one by one; a shooting star crosses at 4.2 s.
  expect(has('stargazing', C.white, 0.1) + has('stargazing', C.gold, 0.1)).toBeLessThan(has('stargazing', C.white, 3.1) + has('stargazing', C.gold, 3.1))
  // The telescope alone is 5 gray pixels.
  expect(has('stargazing', C.gray, 1)).toBeGreaterThan(4)
  // Notes go up on the board, five by the end.
  expect(has('sticky-notes', C.blue, 1.5)).toBe(0)
  expect(has('sticky-notes', C.blue, 2.5)).toBe(9)
  // The plan's lines are drawn out on the blue board.
  expect(has('blueprint', C.white, 0.5)).toBeLessThan(has('blueprint', C.white, 4.9))
  // Mistakes are circled in red, then ticked in green.
  expect(has('red-pen', C.red, 0.5)).toBe(8)
  expect(has('red-pen', C.green, 5)).toBe(12)
})

test('every default stage lists its batch-1 scene second', () => {
  const second = (id: string) => [...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side].find(s => s.id === id)?.scenes[1]
  expect([second('roadmap'), second('brainstorm'), second('spec'), second('spec-audit')]).toEqual(['stargazing', 'sticky-notes', 'blueprint', 'red-pen'])
  expect([second('plan'), second('plan-audit'), second('develop'), second('claude-test')]).toEqual(['dominoes', 'clipboard', 'terminal', 'control-panel'])
  expect([second('user-test'), second('cleanup'), second('debugging'), second('other')]).toEqual(['waiting-bench', 'dishes', 'flashlight', 'fishing'])
})

test('batch 1, part 2: each new scene shows what it is about', () => {
  // Dominoes go up one by one, then all lie flat.
  expect(has('dominoes', C.paper, 0.1)).toBeLessThan(has('dominoes', C.paper, 3.9))
  const standing = (t: number) => [...renderFull(SCENES.dominoes!, t).px].filter((c, i) => c === C.paper && Math.floor(i / 48) === 9).length
  expect(standing(4)).toBe(8)
  expect(standing(6.5)).toBe(0)
  // The clipboard's lines get ticked.
  expect(has('clipboard', C.green, 0.5)).toBe(1)
  expect(has('clipboard', C.green, 7.5)).toBe(4)
  // Code scrolls up the screen.
  expect([...renderFull(SCENES.terminal!, 0.1).px]).not.toEqual([...renderFull(SCENES.terminal!, 0.5).px])
  // Red, red, then green.
  expect(has('control-panel', C.red, 1)).toBe(12)
  expect(has('control-panel', C.green, 4)).toBe(12)
})

test('batch 1, part 3: each new scene shows what it is about', () => {
  // The clock's hand moves.
  expect([...renderFull(SCENES['waiting-bench']!, 0.1).px]).not.toEqual([...renderFull(SCENES['waiting-bench']!, 0.6).px])
  // The dirty stack shrinks as the clean one grows.
  expect(has('dishes', C.white, 0.5)).toBeLessThan(has('dishes', C.white, 5.5))
  // The beam finds the bug: it shows red only while lit.
  expect(has('flashlight', C.red, 0.5)).toBe(0)
  // The lit bug alone is 4 red pixels.
  expect(has('flashlight', C.red, 3.5)).toBeGreaterThan(3)
  expect(has('flashlight', C.beam, 1)).toBeGreaterThan(20)
  // A boot, then a fish.
  expect(has('fishing', C.darkGray, 3.5)).toBeGreaterThan(5)
  expect(has('fishing', C.green, 7)).toBeGreaterThan(5)
})

test('the kit never uses Clawd orange or Fable violet', () => {
  for (const color of Object.values(C)) expect([CLAWD_ORANGE, FABLE_VIOLET]).not.toContain(color)
})

test('every default stage has two scenes after batch 1', () => {
  for (const s of [...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side]) expect(s.scenes).toHaveLength(2)
})
