import { atom, type EngineInterface, read, update } from 'claude-code'

import { config } from '../core/config'
import { CACHE_TTL } from '../core/constants'
import { proof } from '../core/env'
import { ICE, RED, YELLOW } from '../core/palette'
import { COMPACT_CARD_MS } from './compact'
import { setHandoffCard } from './handoff'
import { lastContext } from './lens'
import { COLD_MIN_TOKENS, modelCaches } from './switching'

// How long the main conversation's prompt cache stays warm, in whole minutes left: null before the first response,
// 0 once it has gone cold. Updated only when the minute changes, so the footer redraws once a minute at most.
const cacheLeft = atom({ plugin: 'context-lens', key: 'cacheLeft' } as const, null)
const cacheMemo = atom({ plugin: 'context-lens', key: 'cacheMemo' } as const, null)
const isCompacting = atom({ plugin: 'context-lens', key: 'isCompacting' } as const, false)
// The compact bar: open after Compact is pressed, with a field for what the summary should keep.
const compactAsk = atom({ plugin: 'context-lens', key: 'compactAsk' } as const, false)
const handoffCard = atom({ plugin: 'context-lens', key: 'handoffCard' } as const, null)
// The person closed the cold band; it comes back the next time the cache goes cold.
const isColdHidden = atom({ plugin: 'context-lens', key: 'isColdHidden' } as const, false)

// Shown minutes at or under these turn the countdown yellow, then red: grey while there is time, yellow at 20, red at 5.
const CACHE_YELLOW_MIN = 20
const CACHE_RED_MIN = 5

/** The cache lifetime a response's writes got, when it says; nothing when it wrote nothing or does not say. */
export function cacheTtlOf(usage: unknown): keyof typeof CACHE_TTL | undefined {
  const c = (
    usage as { cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number } } | null
  )?.cache_creation
  if ((c?.ephemeral_1h_input_tokens ?? 0) > 0) return '1h'
  if ((c?.ephemeral_5m_input_tokens ?? 0) > 0) return '5m'
  return undefined
}

/** Most of the prompt came from the cache: it was still warm. */
export function mostlyCached(usage: unknown): boolean {
  const u = (usage ?? {}) as {
    input_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  const read_ = u.cache_read_input_tokens ?? 0
  const all = read_ + (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
  return all > 0 && read_ / all > 0.5
}

/** The context's tokens when the cold band is worth showing: the cache is cold, the band not closed, and the chat big
 * enough that rereading it matters. Null otherwise, and while the size is not known yet. */
export async function coldWorth($: EngineInterface): Promise<number | null> {
  if ((await read($, cacheLeft)) !== 0 || config.hide.includes('cold') || (await read($, isColdHidden))) return null
  const tokens = lastContext?.tokens
  if (coldForced) return tokens ?? 0
  return tokens !== undefined && tokens >= COLD_MIN_TOKENS ? tokens : null
}

/** The countdown's colour for whole minutes left (rounded up, as cacheMinutes gives): none (grey), yellow or red. */
export function cacheColor(minutesLeft: number): string | undefined {
  const shown = minutesLeft - 1
  if (minutesLeft <= 0) return ICE
  if (shown > CACHE_YELLOW_MIN) return undefined
  return shown <= CACHE_RED_MIN ? RED : YELLOW
}

/** The footer's words for the time left: "58m", "<1m", or "Cold". */
export function cacheLabel(minutesLeft: number): string {
  if (minutesLeft <= 0) return '❄ Cold'
  if (minutesLeft === 1) return '<1m'
  return `${minutesLeft - 1}m`
}

export let cacheTtl: keyof typeof CACHE_TTL = '1h'
export const setCacheTtl = (value: typeof cacheTtl) => {
  cacheTtl = value
}
export let cacheExpires = 0
export const setCacheExpires = (value: typeof cacheExpires) => {
  cacheExpires = value
}
/** The countdown's variables live in the module, and a reload starts the module over: the chat's cache did not go cold
 * for that, so the countdown is read back from the session's state before the band draws. */
let cacheRestored = false
export async function restoreCache($: EngineInterface) {
  if (cacheRestored) return
  cacheRestored = true
  const memo = await read($, cacheMemo)
  if (!memo || cacheExpires !== 0 || memo.expires <= 0) {
    // Nothing to go on: a "Cold" left in the shared state by the copy before is not this chat's cache.
    // restoreCache runs inside the band's draw, where a state write is denied: the clear waits for a timer, and checks again then.
    if (cacheExpires === 0 && !coldForced)
      $.clock.after(0, () => void update($, cacheLeft, l => (l === 0 && cacheExpires === 0 && !coldForced ? null : l)))
    return
  }
  cacheExpires = memo.expires
  cacheTtl = memo.ttl
  lastResponseAt = memo.last
}
export function rememberCache($: EngineInterface) {
  return update($, cacheMemo, () => ({ expires: cacheExpires, ttl: cacheTtl, last: lastResponseAt }))
}

/** Writes the minutes left when they changed; the cache tick calls it. */
export async function showCache($: EngineInterface) {
  // No response seen by this copy yet (it loaded mid-chat, after a plugin switch or reload): a 0 left in the shared
  // state by an earlier copy is not this chat's cache, so the countdown goes blank until the next response.
  if (cacheExpires === 0) {
    if (!coldForced && (await read($, cacheLeft)) !== null) {
      await update($, cacheLeft, () => null)
      $.ui.invalidate('ui.render')
    }
    return
  }
  const minutes = await cacheMinutes($)
  const was = await read($, cacheLeft)
  if (minutes === was) return
  await update($, cacheLeft, () => minutes)
  // Going cold or warm adds or removes the band above the prompt; the desktop app redraws that site only when asked.
  if ((minutes === 0) !== (was === 0)) $.ui.invalidate('ui.render')
}

/** Minutes left, rounded up, so "1" means under a minute and 0 means cold. */
export async function cacheMinutes($: EngineInterface): Promise<number> {
  const left = cacheExpires - (await $.clock.now())
  return left <= 0 ? 0 : Math.ceil(left / 60_000)
}

let usageLogged = false
export let lastResponseAt: number | undefined
export const setLastResponseAt = (value: typeof lastResponseAt) => {
  lastResponseAt = value
}
// Main-conversation replies this copy has seen, for /context-lens debug.
export let repliesSeen = 0
/** A response came back: the cache is warm again for its whole lifetime, and the countdown restarts. */
export async function cacheTouched($: EngineInterface, usage: unknown) {
  const now = await $.clock.now()
  repliesSeen++
  if (!usageLogged) {
    usageLogged = true
    void proof($, `first response usage: ${JSON.stringify(usage)}`)
  }
  // When the response does not say, the cache tells by itself: read back after more than 5 minutes means 1 hour.
  const ttl =
    cacheTtlOf(usage) ??
    (lastResponseAt !== undefined && now - lastResponseAt > CACHE_TTL['5m'] && mostlyCached(usage) ? '1h' : undefined)
  lastResponseAt = now
  coldForced = false
  // A reply that wrote only a short 5-minute tail still reads the rest from the 1-hour cache: once 1h is seen, a
  // 5m reading never pulls the countdown back down.
  if (ttl && ttl !== cacheTtl && !(ttl === '5m' && cacheTtl === '1h' && mostlyCached(usage))) {
    cacheTtl = ttl
    void proof($, `cache lifetime ${ttl}`)
  }
  cacheExpires = now + CACHE_TTL[cacheTtl]
  await rememberCache($)
  if (await read($, isColdHidden)) await update($, isColdHidden, () => false)
  await showCache($)
}

/**
 * Compacts the conversation from the footer once the cache has gone cold: the next message would write the whole
 * context to the cache again, so a summary makes it small first. The countdown hides until the next response.
 */
export async function compactCold($: EngineInterface, note = '') {
  if (await read($, isCompacting)) return
  await update($, compactAsk, () => false)
  await update($, isCompacting, () => true)
  await setHandoffCard($, 'compacting', false)
  let compacted = false
  try {
    // The app's own /compact, run as if typed: nothing lands in the prompt box, nothing to send. It waits for the
    // session to be idle, where a direct $.session.compact() is refused whenever the app counts a turn as running.
    // A note goes after /compact as the app's own instructions for the summary.
    await $.command.run({ command: 'compact', args: note.trim() })
    cacheExpires = 0
    modelCaches.clear()
    await rememberCache($)
    await update($, cacheLeft, () => null)
    compacted = true
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    void proof($, `compact failed: ${why}`)
    $.ui.toast(`Context Lens: compact failed: ${why.slice(0, 140)}`)
  } finally {
    await update($, isCompacting, () => false)
    // Complete, or gone when it failed (the toast says why).
    if (compacted) {
      await setHandoffCard($, 'compacted', false)
      $.clock.after(COMPACT_CARD_MS + 100, () => $.ui.invalidate('ui.render'))
    } else await update($, handoffCard, card => (card?.kind === 'compacting' ? null : card))
  }
}
// /context-lens cold shows the band whatever the chat's size, until the next response (a test of the band itself).
export let coldForced = false
export const setColdForced = (value: typeof coldForced) => {
  coldForced = value
}
