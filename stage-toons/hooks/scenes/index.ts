// The scene library, keyed by each scene's own name. Stages pick their
// scene from it (hooks/workflow.ts); a new scene is a file here and an
// entry below.

import type { Scene, SceneId } from '../scene'
import { blueprint } from './blueprint'
import { bricklaying } from './bricklaying'
import { bugHunt } from './bug-hunt'
import { fableAudit } from './fable-audit'
import { gift } from './gift'
import { lightBulbs } from './light-bulbs'
import { mysteryBox } from './mystery-box'
import { proofreadChecklist, proofreadPage } from './proofread'
import { redPen } from './red-pen'
import { roadTrip } from './road-trip'
import { standing } from './standing'
import { stargazing } from './stargazing'
import { steppingStones } from './stepping-stones'
import { stickyNotes } from './sticky-notes'
import { sweeping } from './sweeping'
import { testTubes } from './test-tubes'
import { writingDesk } from './writing-desk'

export const SCENES: Record<SceneId, Scene> = {
  'road-trip': roadTrip,
  'light-bulbs': lightBulbs,
  'writing-desk': writingDesk,
  'proofread-page': proofreadPage,
  'stepping-stones': steppingStones,
  'proofread-checklist': proofreadChecklist,
  bricklaying,
  'test-tubes': testTubes,
  gift,
  sweeping,
  'bug-hunt': bugHunt,
  'mystery-box': mysteryBox,
  'fable-audit': fableAudit,
  standing,
  stargazing,
  'sticky-notes': stickyNotes,
  blueprint,
  'red-pen': redPen,
}

// What a stage may play: not Fable's scene (it plays while a Fable subagent
// runs, whatever the stage) nor the fallback.
export const STAGE_SCENES: readonly SceneId[] = Object.keys(SCENES).filter(n => n !== 'fable-audit' && n !== 'standing')

// /stage demo's order: the default track's scenes, then the side scenes,
// then Fable.
export const DEMO_ORDER: readonly SceneId[] = [
  'road-trip',
  'light-bulbs',
  'writing-desk',
  'proofread-page',
  'stepping-stones',
  'proofread-checklist',
  'bricklaying',
  'test-tubes',
  'gift',
  'sweeping',
  'bug-hunt',
  'mystery-box',
  'fable-audit',
]

export { REACTIONS } from './reactions'
