import { atom, type EngineInterface, read, update } from 'claude-code'

import type { HotClosed } from '../../types'
import { config } from '../core/config'
import { envHome, envUserProfile } from '../core/env'
import { handoffGlowStep } from '../svg/glows'
import { lastContext, setLastContext } from './lens'

// The context is swamped: tokens read per request, or null below the line. Drives the swamp band.
const swamped = atom({ plugin: 'context-lens', key: 'swamped' } as const, null)
// A usage limit is close: which window, how much is used, when it resets. Null below the line.
const hot = atom({ plugin: 'context-lens', key: 'hot' } as const, null)
// The running-hot band closed with its cross: in which window and how full. Kept in the store too, so a new chat keeps it closed.
const hotHidden = atom({ plugin: 'context-lens', key: 'hotHidden' } as const, null as HotClosed | null)
// Save mode: Auto picks at most medium until this time (ms), when the limit resets.
const saveUntil = atom({ plugin: 'context-lens', key: 'saveUntil' } as const, null)

/** Save mode on or off: Auto stays at medium or below until the limit resets. The hot band's button and
 *  /context-lens save. Says what it did. */
export async function toggleSave($: EngineInterface): Promise<string> {
  const saving = (await read($, saveUntil)) !== null
  const heat = await read($, hot)
  const until = heat?.resetsAt ? new Date(heat.resetsAt).getTime() : (await $.clock.now()) + 5 * 3600_000
  await update($, saveUntil, () => (saving ? null : until))
  return saving ? 'save mode off' : 'save mode on, Auto stays at medium or below until the limit resets'
}
// What /context-lens swamp shows as a test: a swamped chat's context.
export const SWAMP_TOKENS = 150_000
// Closed, the band stays away until the context has grown this much more.
export const SWAMP_REGROW = 50_000

// A usage window this full shows the running-hot band.
const HOT_PERCENT = 80
// Closed, the running-hot band stays away for the rest of its window, and comes back once at this many percent.
export const HOT_FINAL = 95

/** The usage window as the closed band records it: its kind and reset time. */
const hotWindow = (heat: { kind: string; resetsAt: string | null }) =>
  // To the quarter hour: the reset time the app reports can shift by seconds between checks.
  `${heat.kind} ${heat.resetsAt ? Math.round(new Date(heat.resetsAt).getTime() / 900_000) : ''}`

/** Whether the running-hot band shows: always until closed; closed, not again in that window unless it passes HOT_FINAL. */
export function hotVisible(
  heat: { kind: string; percent: number; resetsAt: string | null },
  closed: HotClosed | null,
): boolean {
  if (!closed || closed.window !== hotWindow(heat)) return true
  return heat.percent >= HOT_FINAL && closed.percent < HOT_FINAL
}

let hotClosedLoaded = false
/** The closed band as the store keeps it, read once per session (a new chat starts with the atom empty). */
export async function hotClosedNow($: EngineInterface): Promise<HotClosed | null> {
  if (!hotClosedLoaded) {
    hotClosedLoaded = true
    const kept = (await $.store.get('hotClosed').catch(() => null)) as HotClosed | null
    if (kept && typeof kept.window === 'string') {
      // Read while the band is drawn, when a state write is denied: this draw uses the stored value, a timer saves it.
      $.clock.after(0, () => void update($, hotHidden, () => kept))
      return kept
    }
  }
  return read($, hotHidden)
}

export async function closeHot($: EngineInterface, heat: { kind: string; percent: number; resetsAt: string | null }) {
  const closed: HotClosed = { window: hotWindow(heat), percent: heat.percent }
  await update($, hotHidden, () => closed)
  await $.store.set('hotClosed', closed).catch(() => undefined)
}

/** The fullest of the 5-hour and weekly windows, once one passes HOT_PERCENT. Save mode ends with its window. */
async function checkHot(
  $: EngineInterface,
  limits: readonly { kind: string; percentUsed: number; resetsAt?: string }[],
) {
  const windows = limits.filter(l => l.kind === 'five_hour' || l.kind === 'seven_day')
  const top = windows.sort((a, b) => b.percentUsed - a.percentUsed)[0]
  const next =
    top && top.percentUsed >= HOT_PERCENT
      ? { kind: top.kind, percent: top.percentUsed, resetsAt: top.resetsAt ?? null }
      : null
  const was = await read($, hot)
  if (JSON.stringify(next) !== JSON.stringify(was)) {
    await update($, hot, () => next)
    $.ui.invalidate('ui.render')
  }
  const until = await read($, saveUntil)
  if (until !== null && (await $.clock.now()) >= until) await update($, saveUntil, () => null)
}

/** "14:20" for a reset time today, "Mon 14:20" further out. */
export function resetLabel(iso: string | null, now: number): string {
  if (!iso) return ''
  const at = new Date(iso)
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return at.getTime() - now < 20 * 3600_000
    ? hm
    : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.getDay()]} ${hm}`
}

/** A context share to draw the bars with instead of the real one, from ~/.claude/context-lens-preview.json
 * ({"contextPercent": 45}), so how a level looks can be checked on screen without filling a chat. No file, no change. */
async function previewPercent($: EngineInterface): Promise<number | undefined> {
  const home = (await envUserProfile($)) ?? (await envHome($))
  if (!home) return undefined
  const text = await $.fs.read(`${home}/.claude/context-lens-preview.json`).catch(() => '')
  if (!text) return undefined
  try {
    const n = Number((JSON.parse(text) as { contextPercent?: unknown }).contextPercent)
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined
  } catch {
    return undefined
  }
}

/** Whether the context is swamped, from the status line's figures. Cheap: no counting, no model call. */
export async function checkSwamp($: EngineInterface) {
  const { context, rateLimits } = await $.session.usage()
  const preview = await previewPercent($)
  const tokens =
    preview === undefined ? (context.tokens ?? 0) : Math.round(((context.window || 200_000) * preview) / 100)
  // The app may leave the percent out (or give 0) while it has the tokens and the window: work it out then.
  const percent = preview ?? (context.percent || (context.window ? (tokens / context.window) * 100 : 0))
  if (preview !== undefined && !context.window) context.window = 200_000
  const wasStep = handoffGlowStep(lastContext?.percent ?? 0)
  setLastContext({ tokens, window: context.window ?? 0, percent })
  // The Hand off button turns white and glows harder with the context: redraw the band when it crosses a step.
  if (handoffGlowStep(percent) !== wasStep) $.ui.invalidate('ui.render')
  await checkHot($, rateLimits ?? [])
  const over = percent >= config.swampAt
  const next = over ? tokens : null
  if (next !== (await read($, swamped))) {
    await update($, swamped, () => next)
    $.ui.invalidate('ui.render')
  }
}
