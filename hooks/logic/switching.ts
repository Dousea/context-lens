import { atom, type EngineInterface, read, update } from 'claude-code'

import type { Effort, ModelKey, Steps } from '../../types'
import { cacheSafe, MODELS, STEPS, takesEffort, WEIGHT } from '../core/constants'
import {
  engineEffort,
  lastTyped,
  setEngineEffort,
  setLastTyped,
  setToldAboutEnter,
  toldAboutEnter,
} from '../core/session'
import { choose } from './effort'

const pick = atom({ plugin: 'context-lens', key: 'pick' } as const, null)
const suggestion = atom({ plugin: 'context-lens', key: 'suggestion' } as const, null)
const model = atom({ plugin: 'context-lens', key: 'model' } as const, null)
const paused = atom({ plugin: 'context-lens', key: 'paused' } as const, false)

export function keyOf(id: string): ModelKey | undefined {
  return MODELS.find(m => id.includes(m.key))?.key
}

/** Records the model the session now runs; the pick follows it, so the band never shows a stale one. */
export async function modelIs($: EngineInterface, id: string) {
  const pause = !cacheSafe(id) && takesEffort(id)
  if (pause !== (await read($, paused))) await update($, paused, () => pause)
  const key = keyOf(id)
  if (!key || key === (await read($, model))) return
  await update($, model, () => key)
  // The engine's effort can differ per model, so a change across a switch is not the person's doing;
  // and a model turned down earlier may be suggested again.
  setEngineEffort(undefined)
  declined = null
  settleOffer(false)
  const current = await read($, pick)
  if (current && current.model !== key) await choose($, { ...current, model: key })
  if ((await read($, suggestion)) === key) await update($, suggestion, () => null)
}

export async function sessionModel($: EngineInterface): Promise<ModelKey> {
  return keyOf(await sessionModelId($)) ?? 'sonnet'
}

/** The model this session's requests go out on: a taken offer's, else the app's own. */
export async function sessionModelId($: EngineInterface): Promise<string> {
  return sessionPick ? MODELS.find(m => m.key === sessionPick)!.id : $.session.model()
}
// A model the person turned down; not suggested again until they pick something else.
export let declined: ModelKey | null = null
export const setDeclined = (value: typeof declined) => {
  declined = value
}
// The model a taken offer moved this session to. Only the requests carry it: /model would also make it the app's
// default for every later session. Any /model, the band's Model row or the app's picker moving to another model ends it;
// the app's picker on the model it already runs sends nothing to hear.
export let sessionPick: ModelKey | null = null
export const setSessionPick = (value: typeof sessionPick) => {
  sessionPick = value
}
// Each model's own prompt cache for this chat: when it lapses and how many tokens it holds. Going back to a model whose cache
// is still warm only writes what was added since. A compaction or /clear starts a new prefix, so they are forgotten.
export const modelCaches = new Map<ModelKey, { expires: number; tokens: number }>()
// How the model in `suggestion` is offered: the session switches to it, or the prompt is handed to a subagent on it.
export let suggestedAs: 'switch' | 'subagent' = 'switch'
export const setSuggestedAs = (value: typeof suggestedAs) => {
  suggestedAs = value
}

/** The tokens a model still has in its cache for this chat, or undefined when it has none warm. */
export function warmTokens(key: ModelKey, now: number): number | undefined {
  const cache = modelCaches.get(key)
  return cache && cache.expires > now ? cache.tokens : undefined
}

/** The note a handed-off prompt carries: the chat's model stays, and a subagent on `model` does the task. */
export function subagentNote(model: ModelKey): string {
  return `\n\n[Context Lens, on my behalf: I want a subagent on ${model} to do this task (Agent tool, model: "${model}") to save my usage on the chat's model. Delegate it with a complete brief, even if it looks small, then use its result.]`
}

/**
 * Types a slash command into the prompt box for the person to send with Enter. A command the person
 * sends is read by the app itself, so its own Model and Effort controls follow; one the mod runs
 * inside the engine is not. Never overwrites a draft: returns false when the box is not empty.
 */
export async function typeCommand($: EngineInterface, text: string): Promise<boolean> {
  try {
    const draft = (await $.prompt.read()).text.trim()
    // A draft of your own is never overwritten; the mod's own earlier command is replaced.
    if (draft !== '' && draft !== lastTyped) return false
    const filled = await $.prompt.fill({ text })
    if (filled.isFilled) setLastTyped(text)
    if (filled.isFilled && !toldAboutEnter) {
      setToldAboutEnter(true)
      $.ui.toast(`Press Enter to send ${text} so the app's own control follows`)
    }
    return filled.isFilled
  } catch {
    return false
  }
}

// A prompt waiting for the answer to a model offer: who to tell, the model offered, and when the wait ends.
export let offer: { model: ModelKey; until: number; done: (accepted: boolean) => void } | null = null
// The wait counts against the host's 10-second budget for the prompt.submit hook, which sends the prompt on its own
// once it runs out; the hold ends well before that, so the prompt and the question end together.
const OFFER_HOLD_MS = 8_000

/** Ends the wait: true when the person took the offer, false for Keep, a timeout or anything else. */
export function settleOffer(accepted: boolean) {
  const open = offer
  offer = null
  open?.done(accepted)
}

/** Holds the prompt until the offer is answered; true when it was taken. Only one offer waits at a time. */
export async function holdForOffer($: EngineInterface, model: ModelKey): Promise<boolean> {
  settleOffer(false)
  const until = (await $.clock.now()) + OFFER_HOLD_MS
  $.ui.invalidate('ui.render')
  return new Promise<boolean>(resolve => {
    const timer = $.clock.after(OFFER_HOLD_MS, () => settleOffer(false))
    // A redraw a second, for the countdown in the question.
    const tick = $.clock.every(1000, () => $.ui.invalidate('ui.render'))
    offer = {
      model,
      until,
      done: accepted => {
        timer?.cancel?.()
        tick?.cancel?.()
        resolve(accepted)
      },
    }
  })
}

/**
 * A model change reloads the context, so it only happens when the person says yes. It holds for this session only:
 * the app's own model ends it, and the requests go out as the app sends them again.
 */
export async function switchModel($: EngineInterface, model: ModelKey) {
  try {
    sessionPick = keyOf(await $.session.model()) === model ? null : model
    await modelIs($, await sessionModelId($))
    $.ui.invalidate('ui.render')
    declined = null
    await update($, suggestion, () => null)
    const current = await read($, pick)
    if (current) await choose($, { ...current, model })
  } catch {
    $.ui.toast('Could not switch the model right now')
  }
}

/** Below this a cold cache costs too little to warn about: the next message rereads the chat at full price once. */
export const COLD_MIN_TOKENS = 150_000

/** A switch that writes at most this many tokens more to the cache than staying would costs next to nothing. */
const SMALL_CHAT_TOKENS = 20_000

/** Dollars per million uncached input tokens. Haiku costs five times as much past 100k tokens of context. */
const INPUT_PRICE: Record<ModelKey, number> = { haiku: 0.1, sonnet: 2, opus: 4, fable: 10 }
export const priceOf = (key: ModelKey, tokens: number) => (key === 'haiku' && tokens > 100_000 ? 0.5 : INPUT_PRICE[key])

/** Above this many tokens Haiku is offered as a hand-off to a subagent, never as a switch, warm cache or cold. The judge rates one prompt,
 * but a switch hands Haiku every prompt after it, and a chat this long is ongoing work. Haiku's price pays back its cache
 * write within a few requests at any size, so the price alone would always switch; the quality is what it risks. Sonnet
 * is left to the price: it holds up in long work, and in a warm chat its write does not pay back anyway. */
const HAIKU_SWITCH_MAX_TOKENS = 100_000

/** The requests a cheaper model has to make before its first, dearer cache write pays back. A turn of work makes several;
 * what output saves is left out, so the estimate errs on staying. */
const PAYBACK_REQUESTS = 8

/**
 * How the judge's model is worth offering: 'switch' the session to it, hand the prompt to a 'subagent' on it,
 * or null for nothing (Fable, or the model already in use). Each model has a prompt cache of its own, so a switch writes
 * the chat again at the new model's write price, less what that model still has warm (`warm`, its cached tokens).
 * A cheaper model is a switch when that write pays back within PAYBACK_REQUESTS reads; a stronger one is a quality call
 * that never pays in tokens, so it is a switch only when it writes little more than staying would (a cold, small or
 * still-warm chat). Otherwise the task goes to a subagent, which starts with a small context and leaves the chat's cache
 * warm. Haiku in a chat past HAIKU_SWITCH_MAX_TOKENS is a subagent whatever the cache. A size not known yet counts as a
 * new chat.
 */
export function switchWorth(
  verdict: ModelKey,
  inUse: ModelKey,
  chat: { cold: boolean; tokens?: number; ttl?: '5m' | '1h'; warm?: number },
): 'switch' | 'subagent' | null {
  if (verdict === 'fable' || verdict === inUse) return null
  const tokens = chat.tokens
  if (tokens === undefined) return 'switch'
  if (verdict === 'haiku' && tokens > HAIKU_SWITCH_MAX_TOKENS) return 'subagent'
  const write = chat.ttl === '5m' ? WEIGHT.write : WEIGHT.write1h
  const writtenStay = chat.cold ? tokens : 0
  const writtenGo = Math.max(0, tokens - Math.min(tokens, chat.warm ?? 0))
  // Little more to write than staying would: any switch is near free.
  if (writtenGo - writtenStay <= SMALL_CHAT_TOKENS) return 'switch'
  const rank = (k: ModelKey) => MODELS.findIndex(m => m.key === k)
  if (rank(verdict) > rank(inUse)) return 'subagent'
  const stay = (writtenStay * write + (tokens - writtenStay) * WEIGHT.read) * priceOf(inUse, tokens)
  const go = (writtenGo * write + (tokens - writtenGo) * WEIGHT.read) * priceOf(verdict, tokens)
  const gain = tokens * WEIGHT.read * (priceOf(inUse, tokens) - priceOf(verdict, tokens))
  return go - stay <= PAYBACK_REQUESTS * gain ? 'switch' : 'subagent'
}

/** The requests a task of each size makes, as the judge guesses it. */
const STEP_REQUESTS: Record<Steps, number> = { one: 1, few: 4, many: 12 }
/** What a subagent writes to its cache before it starts: its system prompt, tools and brief. */
const SUBAGENT_START_TOKENS = 15_000

/**
 * Whether handing the prompt to a subagent on `verdict` pays, once switchWorth has turned the switch down. The chat
 * still makes the request that calls the subagent and the one that reads its result, so a task of n requests spares
 * the chat n - 1 reads of its context, against the subagent's own cold start and reads. A one-step task spares
 * nothing. A stronger model is a quality call: it goes to a subagent for any task bigger than one step.
 *
 * The task's size is the smaller of the judge's steps and the size its effort implies: the judge counts one command
 * on several items ("delete those branches") as a few steps, but it rates the effort of such a task low.
 */
export function subagentPays(
  verdict: ModelKey,
  inUse: ModelKey,
  task: { tokens: number; effort: Effort; steps?: Steps },
): boolean {
  const byEffort: Steps = task.effort === 'low' ? 'one' : task.effort === 'medium' ? 'few' : 'many'
  const steps = STEPS[Math.min(STEPS.indexOf(task.steps ?? byEffort), STEPS.indexOf(byEffort))]!
  if (steps === 'one') return false

  const rank = (k: ModelKey) => MODELS.findIndex(m => m.key === k)
  if (rank(verdict) > rank(inUse)) return true

  const requests = STEP_REQUESTS[steps]
  const spared = (requests - 1) * task.tokens * WEIGHT.read * priceOf(inUse, task.tokens)
  const started =
    (SUBAGENT_START_TOKENS * WEIGHT.write + requests * SUBAGENT_START_TOKENS * WEIGHT.read) *
    priceOf(verdict, SUBAGENT_START_TOKENS)
  return spared > started
}
