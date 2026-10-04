// The paint loop: repaints a site while it is mounted. It reaches the
// engine only through the ports register.tsx builds over $, so it can be
// tested with stand-ins.

import { demoStep } from './demo'
import { AGENT_POLL_MS, endDemo, frameMs, isDeepAsleep, MAX_REFUSED, MAX_REFUSED_UNSEEN, type Mod, RESEND_MS, type Site, type SiteKind } from './mod'

export type Ports = {
  now: () => Promise<number>
  sleep: (ms: number) => Promise<void>
  blit: (frame: { requestId: string; key: SiteKind; cells: string; columns: number; rows: number }) => Promise<{ deny?: string }>
  invalidate: () => void
  log: (text: string) => void
  pollAgents: () => Promise<void>
  // The site's next frame, or null once the demo it plays is over.
  cells: (site: Site, now: number) => string | null
}

// Repaints a site while it is mounted, detached from the render that
// started it: a sleep inside a dispatch would spend its time budget. The
// site's kind and size may change under it, as the band's do.
export function animate(ports: Ports, mod: Mod, site: Site) {
  if (site.isAnimating) return
  site.isAnimating = true
  site.isAsleep = false
  void (async () => {
    try {
      let refused = 0
      // The area checks the agent list before its first frame, so an agent
      // that ended while it was away is not drawn seated, then every
      // AGENT_POLL_MS while it knows of agents.
      let polledAt = -Infinity
      while (site.requestId !== undefined && !mod.isHidden && refused < (site.isSeen ? MAX_REFUSED : MAX_REFUSED_UNSEEN)) {
        const { requestId, kind, columns, rows } = site
        const now = await ports.now()
        if (kind === 'area' && polledAt === -Infinity) {
          polledAt = now
          await ports.pollAgents()
        } else if (kind === 'area' && mod.roster.size > 0 && now - polledAt >= AGENT_POLL_MS) {
          polledAt = now
          void ports.pollAgents()
        }
        const cells = ports.cells(site, now)
        if (cells === null) {
          // The demo is over. Nothing is awaited from here to the loop's
          // end, so the redraw that brings the band back finds it finished.
          site.requestId = undefined
          endDemo(mod, ports.invalidate)
          break
        }
        // A blit repaints the scene alone: the line naming it is text, so
        // the band is drawn again when the demo moves on.
        const step = kind !== 'toon' && mod.demo ? demoStep(mod.demo, now) : null
        if (step && step.index !== mod.demoLineIndex) {
          mod.demoLineIndex = step.index
          ports.invalidate()
        }
        // The frame the Raster already shows is not sent again, but for a
        // resend now and then, which tells the loop whether it is still there.
        if (cells !== site.lastCells || now - site.blittedAt >= RESEND_MS) {
          const answer = await ports.blit({ requestId, key: kind, cells, columns, rows })
          if (answer.deny === undefined) {
            refused = 0
            site.isSeen = true
            site.lastCells = cells
            site.blittedAt = now
          } else {
            refused += 1
            // Refused: every frame is sent until one is taken, so a Raster
            // that is gone is noticed as quickly as before.
            site.lastCells = null
          }
        }
        // Deep asleep with the still picture shown: the loop stops, and the
        // next render (a prompt, an agent, a redraw) starts it again.
        if (kind === 'area' && site.lastCells === cells && isDeepAsleep(mod, now)) {
          site.isAsleep = true
          break
        }
        await ports.sleep(frameMs(mod, kind, now))
      }
      // Refused until it gave up, the band's Raster may be gone for good
      // (the band collapsed) or for now: the hook decides again, and an
      // expanded band repaints instead of standing still.
      if (site.kind !== 'toon' && site.requestId !== undefined && !mod.isHidden && !site.isAsleep) {
        site.requestId = undefined
        ports.invalidate()
      }
    } finally {
      site.isAnimating = false
    }
  })().catch(() => {
    // The environment unloaded mid-frame (a reload, the session's end).
  })
}
