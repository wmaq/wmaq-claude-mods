import type { Scene, SceneId } from '../scene'
import { planAudit, specAudit } from './audit'
import { auditor } from './auditor'
import { brainstorm } from './brainstorm'
import { claudeTest } from './claude-test'
import { cleanup } from './cleanup'
import { develop } from './develop'
import { idle } from './idle'
import { other } from './other'
import { plan } from './plan'
import { roadmap } from './roadmap'
import { spec } from './spec'
import { userTest } from './user-test'

export const SCENES: Record<SceneId, Scene> = {
  roadmap,
  brainstorm,
  spec,
  'spec-audit': specAudit,
  plan,
  'plan-audit': planAudit,
  develop,
  'claude-test': claudeTest,
  'user-test': userTest,
  cleanup,
  other,
  auditor,
  idle,
}

export { REACTIONS } from './reactions'
