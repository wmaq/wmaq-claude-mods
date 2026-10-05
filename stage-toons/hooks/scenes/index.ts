// The scene library, keyed by each scene's own name. Stages pick their
// scene from it (hooks/workflow.ts); a new scene is a file here and an
// entry below.

import { FABLE_SCENE, type Scene, type SceneId } from '../scene'
import { DEFAULT_WORKFLOW } from '../workflow'
import { blueprint } from './blueprint'
import { bricklaying } from './bricklaying'
import { bugHunt } from './bug-hunt'
import { bugNet } from './bug-net'
import { cake } from './cake'
import { clipboard } from './clipboard'
import { controlPanel } from './control-panel'
import { crashTest } from './crash-test'
import { dice } from './dice'
import { dishes } from './dishes'
import { dominoes } from './dominoes'
import { fableAudit } from './fable-audit'
import { fishing } from './fishing'
import { flashlight } from './flashlight'
import { gift } from './gift'
import { ladder } from './ladder'
import { lightBulbs } from './light-bulbs'
import { mysteryBox } from './mystery-box'
import { proofreadChecklist, proofreadPage } from './proofread'
import { recycling } from './recycling'
import { redPen } from './red-pen'
import { roadTrip } from './road-trip'
import { scales } from './scales'
import { scroll } from './scroll'
import { stamp } from './stamp'
import { standing } from './standing'
import { stargazing } from './stargazing'
import { steppingStones } from './stepping-stones'
import { stickyNotes } from './sticky-notes'
import { sweeping } from './sweeping'
import { terminal } from './terminal'
import { testTubes } from './test-tubes'
import { thoughtClouds } from './thought-clouds'
import { treasureMap } from './treasure-map'
import { waitingBench } from './waiting-bench'
import { workbench } from './workbench'
import { writingDesk } from './writing-desk'

// The table as written: `satisfies` checks it is a valid scene table but
// keeps its own type, so its exact keys make LibraryScene.
const LIBRARY = {
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
  dominoes,
  clipboard,
  terminal,
  'control-panel': controlPanel,
  'waiting-bench': waitingBench,
  dishes,
  flashlight,
  fishing,
  'treasure-map': treasureMap,
  'thought-clouds': thoughtClouds,
  scroll,
  stamp,
  ladder,
  scales,
  workbench,
  'crash-test': crashTest,
  cake,
  recycling,
  'bug-net': bugNet,
  dice,
} satisfies Record<SceneId, Scene>

// A scene's name in the library, checked by tsc: what the default workflow
// and the fixed scenes (Fable's, the fallback, the untracked one) are typed
// with. Names read from files and state stay SceneId (any string).
export type LibraryScene = keyof typeof LIBRARY

// The library, indexed by any string (a name from a file may be unknown).
export const SCENES: Record<SceneId, Scene> = LIBRARY

// What a stage may play: not Fable's scene (it plays while a Fable subagent
// runs, whatever the stage) nor the fallback.
export const STAGE_SCENES: readonly SceneId[] = Object.keys(SCENES).filter(n => n !== 'fable-audit' && n !== 'standing')

// /stage demo's order: the default workflow's scenes stage by stage (track,
// then side), then Fable's.
export const DEMO_ORDER: readonly SceneId[] = [...new Set([...DEFAULT_WORKFLOW.track, ...DEFAULT_WORKFLOW.side].flatMap(s => s.scenes)), FABLE_SCENE]

export { REACTIONS } from './reactions'
