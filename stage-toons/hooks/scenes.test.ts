import { expect, test } from 'claude-code/testing'

import { CLAWD_ORANGE } from './clawd'
import type { PixelBuffer } from './pixels'
import { heroAt, renderFull, renderScene, type Scene, STAGE_H } from './scene'
import { planAudit, specAudit } from './scenes/audit'
import { brainstorm } from './scenes/brainstorm'
import { idle } from './scenes/idle'
import { other } from './scenes/other'
import { plan } from './scenes/plan'
import { roadmap } from './scenes/roadmap'
import { spec } from './scenes/spec'

const SCENE_LIST: Scene[] = [roadmap, brainstorm, spec, specAudit, plan, planAudit, other, idle]

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

test('each stage scene is named for its stage', () => {
  expect(SCENE_LIST.map(s => s.id)).toEqual(['roadmap', 'brainstorm', 'spec', 'spec-audit', 'plan', 'plan-audit', 'other', 'idle'])
})
