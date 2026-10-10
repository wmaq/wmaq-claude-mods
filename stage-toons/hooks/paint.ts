// The paint loop: repaints a site while it is mounted. It reaches the
// engine only through the ports register.tsx builds over $, so it can be
// tested with stand-ins.

import { demoStep } from './demo'
import { AGENT_POLL_MS, endDemo, frameMs, isDeepAsleep, MAX_REFUSED, MAX_REFUSED_UNSEEN, type Mod, PROBE_MS, QUICK_MS, RESEND_MS, type Site } from './mod'

export type Ports = {
  now: () => Promise<number>
  sleep: (ms: number) => Promise<void>
  blit: (frame: { requestId: string; key: 'area'; cells: string; columns: number; rows: number }) => Promise<{ deny?: string }>
  invalidate: () => void
  pollAgents: () => Promise<void>
  // Whether the load that started the loop is still the module's current one.
  isCurrent: () => Promise<boolean>
  // The site's next frame, or null once the demo it plays is over.
  cells: (site: Site, now: number) => string | null
}

// Repaints a site while it is mounted, detached from the render that
// started it: a sleep inside a dispatch would spend its time budget. The
// band's size may change under it.
// A render while the loop sleeps wakes it: what changed (a dissolve
// starting, say) is drawn at once, not after an idle rate's sleep.
export function animate(ports: Ports, mod: Mod, site: Site) {
  if (site.isAnimating) {
    site.wake?.()

    return
  }
  site.isAnimating = true
  site.isAsleep = false
  void (async () => {
    try {
      let refused = 0
      // A newer load took over: it paints the Raster now, so this loop leaves
      // it, and the site, as they are.
      let isReplaced = false
      // The area checks the agent list before its first frame, so an agent
      // that ended while it was away is not drawn seated, then every
      // AGENT_POLL_MS while it knows of agents.
      let polledAt = -Infinity
      // Waiting for a collapsed band to show again (PROBE_MS).
      let isWaiting = false
      while (site.requestId !== undefined && !mod.isHidden && (isWaiting || refused < (site.isSeen ? MAX_REFUSED : MAX_REFUSED_UNSEEN))) {
        if (!(await ports.isCurrent())) {
          isReplaced = true
          break
        }
        const { requestId, columns, rows } = site
        const now = await ports.now()
        if (polledAt === -Infinity) {
          polledAt = now
          await ports.pollAgents()
        } else if (!isWaiting && mod.roster.size > 0 && now - polledAt >= AGENT_POLL_MS) {
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
        const step = mod.demo ? demoStep(mod.demo, now) : null
        if (step && step.index !== mod.demoLineIndex) {
          mod.demoLineIndex = step.index
          ports.invalidate()
        }
        // The frame the Raster already shows is not sent again, but for a
        // resend now and then, which tells the loop whether it is still there.
        if (cells !== site.lastCells || now - site.blittedAt >= RESEND_MS) {
          const answer = await ports.blit({ requestId, key: 'area', cells, columns, rows })
          if (answer.deny === undefined) {
            refused = 0
            isWaiting = false
            site.isSeen = true
            site.lastCells = cells
            site.blittedAt = now
          } else {
            refused += 1
            // Refused: every frame is sent until one is taken, so a Raster
            // that is gone is noticed as quickly as before.
            site.lastCells = null
            if (!site.isSeen && refused >= MAX_REFUSED_UNSEEN) isWaiting = true
          }
        }
        // Deep asleep with the still picture shown: the loop stops, and the
        // next render (a prompt, an agent, a redraw) starts it again.
        if (site.lastCells === cells && isDeepAsleep(mod, now)) {
          site.isAsleep = true
          break
        }
        // A wake ends the sleep early; the sleep itself runs out unheeded.
        // In calm mode, while blits are refused, the loop keeps the quick
        // rate: the refusal budget counts frames, and calm mode's slow rate
        // would stretch it. A render's own frame (already shown, not yet
        // resent) waits at the slow rate.
        // Waiting while deep asleep, it looks less often.
        const ms = isWaiting ? (isDeepAsleep(mod, now) ? RESEND_MS : PROBE_MS) : mod.isCalm && refused > 0 ? QUICK_MS : frameMs(mod, now)
        await Promise.race([ports.sleep(ms), new Promise<void>(resolve => (site.wake = resolve))])
        site.wake = null
      }
      // Refused until it gave up, the band's Raster may be gone for good
      // (the band collapsed) or for now: the hook decides again, and an
      // expanded band repaints instead of standing still.
      if (!isReplaced && site.requestId !== undefined && !mod.isHidden && !site.isAsleep) {
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
