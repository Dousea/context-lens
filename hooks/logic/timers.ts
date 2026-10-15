import type { EngineInterface } from 'claude-code'

import { lastRenderAt, writeRenderLog } from '../core/debug'
import { checkSwamp } from './alerts'
import { showCache } from './cache'
import { finishHandoff, handoffTimer, setHandoffTimer } from './handoff'
import { lastContext, LENS_TICK_MS, lensTick } from './lens'

const CACHE_TICK_MS = 15_000

// Redraws still owed after a chat was opened again: the app may draw the band before it is ready for one, so the
// session's 1 s timer asks again a few times (see redrawSoon).
let redrawsOwed = 0
// When the redraws were asked for: once the band has been drawn after that, none are owed any more, since each redraw
// rebuilds the band and restarts its animations.
let redrawAskedAt = 0
// A draw this soon after the ask may come before the app has the band up, so it does not count.
const REDRAW_SETTLE_MS = 500
export function redrawSoon(times = 5) {
  redrawsOwed = Math.max(redrawsOwed, times)
  redrawAskedAt = Date.now()
}
const HANDOFF_POLL_MS = 1000

/** The session's timers. A reload loads the module again with no session start, so the band's first draw starts them
 * too; a session start restarts them, cancelling the ones the draw started. */
export let timersFrom: 'start' | 'draw' | null = null
export const setTimersFrom = (value: typeof timersFrom) => {
  timersFrom = value
}
let tickers: { cancel: () => void }[] = []
export let timersScheduled = false
export const setTimersScheduled = (value: typeof timersScheduled) => {
  timersScheduled = value
}
export function startTimers($: EngineInterface, from: 'start' | 'draw') {
  if (timersFrom === 'start' || (timersFrom === 'draw' && from === 'draw')) return
  timersFrom = from
  // A timer started inside a request ends with that request, so the clocks live here.
  tickers.forEach(ticker => ticker.cancel())
  tickers = [
    $.clock.every(CACHE_TICK_MS, () => void showCache($).catch(() => undefined)),
    $.clock.every(CACHE_TICK_MS, () => void checkSwamp($).catch(() => undefined)),
    $.clock.every(LENS_TICK_MS, () => void lensTick($).catch(() => undefined)),
  ]
  // Read the usage at once too, so the context is there from the start rather than a tick later.
  void checkSwamp($)
    .then(() => $.ui.invalidate('ui.render'))
    .catch(() => undefined)
  // A written handoff is cleared and resent from here: a hook the turn waits on may not run commands.
  handoffTimer?.cancel()
  setHandoffTimer(
    $.clock.every(HANDOFF_POLL_MS, () => {
      if (redrawsOwed > 0) {
        // Drawn since the ask: the band is up to date, so a redraw would only restart its animations.
        if (lastRenderAt > redrawAskedAt + REDRAW_SETTLE_MS) redrawsOwed = 0
        else {
          redrawsOwed--
          $.ui.invalidate('ui.render')
        }
      }
      // Right after a start the app may not have the usage yet: ask each second until it has, so the context shows.
      if (!lastContext || !lastContext.window)
        void checkSwamp($)
          .then(() => lastContext?.window && $.ui.invalidate('ui.render'))
          .catch(() => undefined)
      void writeRenderLog($).catch(() => undefined)
      void finishHandoff($).catch(() => undefined)
    }),
  )
}
