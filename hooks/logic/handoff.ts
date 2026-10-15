import { atom, type EngineInterface, type ModelForkResult, read, update } from 'claude-code'

import type { HandoffAfter, HandoffChoice } from '../../types'
import { config } from '../core/config'
import { proof } from '../core/env'
import { HANDOFF_BOX_AT } from '../svg/glows'
import { cacheExpires, cacheMinutes } from './cache'
import { COMPACT_MODEL, compactTranscript, fittingTranscript } from './compact'
import { completeWithHaiku, lastAssistantText } from './judge'
import { lastContext } from './lens'

const cacheLeft = atom({ plugin: 'context-lens', key: 'cacheLeft' } as const, null)
// Where a handoff is: null idle, writing (the handoff turn runs), clearing (clear and resend).
const handoffStage = atom({ plugin: 'context-lens', key: 'handoffStage' } as const, null)
// The handoff bar above the prompt, open with the choice shown in it, or null.
const handoffPick = atom({ plugin: 'context-lens', key: 'handoffPick' } as const, null)
// Why Haiku thinks a handoff would suit now, or null. It lights Handoff and says why; there is no percent threshold.
const handoffAdvice = atom({ plugin: 'context-lens', key: 'handoffAdvice' } as const, null)
const handoffCard = atom({ plugin: 'context-lens', key: 'handoffCard' } as const, null)

// The handoff card above the prompt: shown from the start of a handoff, and once it lands ('done' in the
// cleared chat, 'copied'). It goes with the next message, its ✕, or HANDOFF_CARD_MS after it was set.
export type HandoffCard = {
  kind: 'writing' | 'done' | 'copied' | 'compacting' | 'compacted'
  full: boolean
  at: number
  seen: boolean
}
// Kinds still under way: they stay until they land, with moving art. Compacting shares the card with the handoff.
export const cardRunning = (kind: HandoffCard['kind']) => kind === 'writing' || kind === 'compacting'
// Kinds that landed well: the card turns green with a checkmark.
export const cardLanded = (kind: HandoffCard['kind']) => kind === 'done' || kind === 'compacted'
export const HANDOFF_CARD_MS = 2 * 60_000

export async function setHandoffCard($: EngineInterface, kind: HandoffCard['kind'], full: boolean, seen = false) {
  const at = await $.clock.now()
  await update($, handoffAdvice, () => null)
  await update($, handoffCard, () => ({ kind, full, at, seen }))
  // Gone after a while even with no reply; a timer that dies with its request leaves the next reply to clear it.
  if (!cardRunning(kind)) {
    try {
      $.clock.after(HANDOFF_CARD_MS, () => void update($, handoffCard, card => (card && card.at === at ? null : card)))
    } catch {}
  }
}

// Whether a fresh chat would now serve better than carrying on: Haiku's call, whatever judge picks the effort. It runs
// from HANDOFF_CHECK_FROM percent of context, every HANDOFF_CHECK_EVERY messages, so it costs a cent now and then. It
// reads more than the effort judge: what the chat was for, the trail of topics, the last turns, the context and the cache.
const HANDOFF_CHECK_FROM = 30
const HANDOFF_CHECK_EVERY = 2
const HANDOFF_SYSTEM = `You decide whether the person should hand off now: start a fresh chat that carries over a short summary, instead of carrying on in this one. You are shown what the chat was for, the trail of what the person asked, the last turns, the next message, how full the context is and whether the cache is cold.

Say yes only for a clear reason: the task just finished and the next message is something else, the topic has changed so the old context is dead weight, the chat keeps going in circles on the same problem, or a long chat now holds so much unrelated history that a clean start would be sharper. A normal next step of the same work is never a reason, a long chat by itself is not one, and neither is a high context share when the work is going well. When unsure, say no: a wrong yes costs the person more than a missed one.

Reply with JSON only: {"handoff":"reason of at most 8 words, in the person's language"} for yes, or {"handoff":null} for no.`

/** What the handoff check reads: the chat's purpose, a trail of the person's messages, the last reply's end. */
export function handoffEvidence(
  messages: readonly { role: string; text: string }[],
  next: string,
  percent: number,
  cold: boolean,
): string {
  const asked = messages.filter(m => m.role === 'user' && m.text.trim())
  const first = asked[0]?.text.slice(0, 500) ?? ''
  const trail = asked.slice(-8, -1).map(m => `- ${m.text.slice(0, 160).replace(/\s+/g, ' ')}`)
  const reply = lastAssistantText(messages).slice(-700)
  return [
    first ? `What the chat was for (first message):\n${first}` : '',
    trail.length ? `Trail of earlier messages:\n${trail.join('\n')}` : '',
    reply ? `The assistant's last reply (its end):\n${reply}` : '',
    `Next message:\n${next.slice(0, 600)}`,
    `Context used: ${Math.round(percent)}% of the window; ${asked.length} messages so far; the cache is ${cold ? 'cold' : 'warm'}.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Reads Haiku's answer: a reason, or null for no (anything unreadable is no). */
export function parseHandoffAnswer(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const { handoff } = JSON.parse(match[0]) as { handoff?: unknown }
    return typeof handoff === 'string' && handoff.trim() ? handoff.trim().slice(0, 70) : null
  } catch {
    return null
  }
}

let promptsSinceHandoffCheck = 0
/** Called with each message the person sends. Sets or clears the advice; never throws, never holds the message. */
export async function checkHandoff($: EngineInterface, next: string) {
  const percent = lastContext?.percent ?? 0
  if (percent < HANDOFF_CHECK_FROM) {
    promptsSinceHandoffCheck = 0
    if ((await read($, handoffAdvice)) !== null) {
      await update($, handoffAdvice, () => null)
      $.ui.invalidate('ui.render')
    }
    return
  }
  promptsSinceHandoffCheck++
  if (promptsSinceHandoffCheck < HANDOFF_CHECK_EVERY) return
  promptsSinceHandoffCheck = 0
  try {
    const evidence = handoffEvidence(
      await $.session.messages(),
      next,
      percent,
      (await cacheMinutes($)) === 0 && cacheExpires > 0,
    )
    const r = await completeWithHaiku($, {
      system: HANDOFF_SYSTEM,
      prompt: evidence,
      maxTokens: 60,
      effort: 'low',
      timeoutMs: 8000,
    })
    if (!r.isAnswered) return
    const reason = parseHandoffAnswer(r.text)
    void proof($, `handoff check at ${Math.round(percent)}%: ${reason ?? 'no'}`)
    if (reason !== (await read($, handoffAdvice))) {
      await update($, handoffAdvice, () => reason)
      $.ui.invalidate('ui.render')
    }
  } catch {
    // A failed check changes nothing.
  }
}

// The handoff: one click writes a handoff, clears the chat and sends the handoff into it as the first message.
// The quick handoff is written by a fork, which has no tools: it says what the chat last saw and marks what it cannot
// check. The full handoff (the person's own skill) is the one that inspects git and saves files.
export const HANDOFF_PROMPT = [
  'Write a handoff so this work can continue in a fresh chat that has no other context.',
  '',
  'Start with the project, its folder and the branch. Then:',
  '- Goal: one or two lines.',
  '- Done: what changed, with file paths, and how each change was checked. Never present something planned, skipped or untested as done.',
  '- Not done: what is half done, and the concrete blocker (a failed check, a missing approval, an open question).',
  '- Git: local changes, local commits, pushed commits and open PRs, as last seen in this chat. You cannot check now, so say "as of last check".',
  '- Next steps in priority order. Make the first one runnable: a file path, a command or a specific decision. Mark every step that needs the user with "needs user".',
  "- To resume: the start command, the preview URL, and the limits on what is allowed (what needs the user's approval, test vs production).",
  '- Do not redo: decisions made and why, approaches that failed.',
  '',
  'Give only the final state of anything that changed during the chat. Point to specs, plans and files instead of ' +
    'copying them. Leave out what is finished and no longer matters. Never include secrets, environment values or raw ' +
    'logs. Write in the language the user writes in. Short bullets, at most about 40 lines. Do not use tools. Reply ' +
    'with the handoff only, no preamble or farewell.',
].join('\n')

/** The full handoff when no skill of the person's is picked: a turn that may check git and save the handoff, then
 * replies with it. Slower than the quick fork, and it leaves HANDOFF.md in the project for the next chat to read. */
export const HANDOFF_FULL_PROMPT = [
  'Write a handoff so this work can continue in a fresh chat that has no other context. You may use tools for this.',
  '',
  '1. Check the real state: git status, the last few commits, whether the branch is pushed, open PRs if gh is set up.',
  '2. Rewrite HANDOFF.md in the project root from scratch (keep it under 80 lines): branch and open PRs, what is half done,',
  '   next steps with the first one runnable, what only the user can do, and pointers to specs, plans and files.',
  '   Never put secrets or environment values in it.',
  '3. Reply with the handoff itself, in the same shape:',
  '',
  HANDOFF_PROMPT.split('\n').slice(2).join('\n').replace('Do not use tools. ', ''),
].join('\n')

/** The first message of the fresh chat: the handoff, then what to do with it. */
export function handoffMessage(handoff: string, after: HandoffAfter, skill?: string): string {
  const ask =
    after === 'confirm'
      ? 'Read this, say in two lines where things stand and what is next, then wait for me.'
      : 'Continue with the next step. If it is marked "needs user", say what you need and wait.'
  // A full handoff is the person's own skill: it saves the handoff (a file, memories), and its last words in the chat
  // are often only a note that it did. The new chat is told to read what the skill saved before anything else.
  if (skill)
    return (
      `Handoff from the previous chat: it ran /${skill}, which saved the handoff. Its last words there:\n\n${handoff.trim()}\n\n` +
      `First read the handoff /${skill} saved: the files named above, or HANDOFF.md in the project if none is named. ${ask}`
    )
  return `Handoff from the previous chat:\n\n${handoff.trim()}\n\n${ask}`
}

// The handoff's text once its turn has ended, waiting for the chat to go idle so it can be cleared and resent.
export let handoffText: string | undefined
export const setHandoffText = (value: typeof handoffText) => {
  handoffText = value
}
let handoffDriving = false

// A handoff asked for and not begun: begun from the session's timer, where a prompt may be sent (a command or a press
// may hold the turn, and the app refuses a prompt sent from there).
let handoffQueued = false
// Quick: a fork with the built-in prompt, seconds. Full: the person's own skill as a turn, which may check and save.
let handoffFull = false
// What follows this handoff once it is written (HandoffAfter).
let handoffThen: HandoffAfter = 'continue'

/** Starts a handoff: asks for it (built-in prompt or the person's own skill); the rest follows when it is written. */
export async function startHandoff($: EngineInterface, full = false, after: HandoffAfter = config.handoffAfter) {
  if ((await read($, handoffStage)) !== null) return
  await update($, handoffStage, () => 'writing')
  handoffFull = full
  handoffThen = after
  handoffQueued = true
  await setHandoffCard($, 'writing', handoffFull)
}

/** The choice the handoff bar opens on: the one made last, else quick and the configured after. */
export async function lastHandoffChoice($: EngineInterface): Promise<HandoffChoice> {
  const kept = (await $.store.get('handoffChoice').catch(() => null)) as Partial<HandoffChoice> | null
  const kind = kept?.kind === 'full' ? 'full' : 'quick'
  const after = (['continue', 'confirm', 'copy'] as const).find(a => a === kept?.after) ?? config.handoffAfter
  return { kind, after }
}

/** Opens the handoff bar above the prompt: the footer's ⇥ and the swamp band's Handoff. */
export async function openHandoffBar($: EngineInterface) {
  if ((await read($, handoffStage)) !== null) return
  const choice = await lastHandoffChoice($)
  await update($, handoffPick, () => choice)
  $.ui.invalidate('ui.render')
}
// The narrowest bar (in cells) that still has room for a Compact button beside Auto and Handoff.
export const COMPACT_BUTTON_MIN_COLUMNS = 80
export async function closeHandoffBar($: EngineInterface) {
  await update($, handoffPick, () => null)
  $.ui.invalidate('ui.render')
}

/** Go in the handoff bar: keeps the choice for next time and starts the handoff. */
export async function goHandoff($: EngineInterface, choice: HandoffChoice) {
  await $.store.set('handoffChoice', choice).catch(() => undefined)
  await closeHandoffBar($)
  await startHandoff($, choice.kind === 'full', choice.after)
}

/** What the handoff does, by the choice: who writes it, then what follows. */
export function handoffWhat(choice: HandoffChoice, skill: string): { by: string; then: string } {
  const by =
    choice.kind === 'full'
      ? skill
        ? `/${skill}, slower`
        : 'Checks git and saves HANDOFF.md, slower'
      : 'Done in seconds'
  const then =
    choice.after === 'copy'
      ? 'Copied, chat stays.'
      : choice.after === 'confirm'
        ? 'Clears chat, then waits.'
        : 'Clears chat, carries on.'
  return { by, then }
}

/** What a handoff fork came to, in a few words for /context-lens debug: its reason when it wrote nothing. */
export function forkOutcome(result: unknown, ms: number): string {
  const took = `${(ms / 1000).toFixed(1)}s`
  if (result instanceof Error) return `threw: ${result.message.slice(0, 120)} (${took})`
  const r = result as ModelForkResult | undefined
  if (!r || typeof r !== 'object' || !('isAnswered' in r)) return `threw: ${String(result).slice(0, 120)} (${took})`
  if (r.isAnswered) {
    const u = r.usage
    const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
    const cached = input ? Math.round((u.cache_read_input_tokens / input) * 100) : 0
    return r.text.trim()
      ? `answered, ${u.output_tokens} out, ${cached}% cached (${took})`
      : `answered with blank text (${took})`
  }
  if (r.reason === 'api-error') return `api-error ${r.status ?? 'no response'} ${r.error} (${took})`
  return `${r.reason} (${took})`
}

/** Writes the handoff: quick by a fork with the built-in prompt, full by the person's own skill as a turn. Runs from the timer. */
async function writeHandoff($: EngineInterface) {
  if (!handoffQueued) return
  handoffQueued = false
  try {
    if (handoffFull) {
      // The person's skill, or the built-in full prompt as a turn: either way its reply is the handoff.
      if (config.handoffSkill) await $.command.run({ command: config.handoffSkill, args: '' })
      else await $.prompt.submit({ text: HANDOFF_FULL_PROMPT })
      return
    }
    // A cold cache: a fork would reread the whole chat at full price and write it to the cache again (one handoff took
    // 8% of a person's 5-hour limit). Haiku writes it from the transcript instead, at a fraction of the price.
    const now = await $.clock.now().catch(() => Date.now())
    if ((await read($, cacheLeft)) === 0 || (cacheExpires > 0 && now >= cacheExpires)) {
      const messages = await $.session.messages().catch(() => [])
      const got = messages.length ? await haikuHandoff($, messages).catch(() => null) : null
      await $.store
        .set('lastFork', {
          at: Date.now(),
          outcome: got ? 'cold cache: written by Haiku' : 'cold cache: Haiku failed, forked',
        })
        .catch(() => undefined)
      if (got) {
        handoffText = got
        return
      }
    }
    // The built-in handoff is written by a fork: the same model over this chat as it stands, its start read from the
    // prompt cache, no tools and no turn in the chat. Much quicker than a turn that may go exploring first.
    const startedAt = Date.now()
    const forked = await $.model.fork({ prompt: HANDOFF_PROMPT }).catch((error: unknown) => error)
    const outcome = forkOutcome(forked, Date.now() - startedAt)
    // Kept in the store: before a chat's first message the mod's session may start afresh, and its variables with it.
    await $.store.set('lastFork', { at: Date.now(), outcome }).catch(() => undefined)
    const answered = forked as ModelForkResult
    if (answered?.isAnswered && answered.text.trim()) {
      handoffText = answered.text
      return
    }
    // Nothing to fork (no reply yet) or the fork failed: write it as a turn instead, and say why.
    if (!outcome.startsWith('nothing-to-fork'))
      $.ui.toast(`context-lens: the fork wrote no handoff (${outcome}); writing it as a turn`)
    await $.prompt.submit({ text: HANDOFF_PROMPT })
  } catch (error) {
    await update($, handoffStage, () => null)
    $.ui.toast(
      `context-lens: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`,
    )
  }
}

/** Clears the chat and sends the written handoff into it. Runs from the session's timer, when nothing waits on it. */
export async function finishHandoff($: EngineInterface) {
  await writeHandoff($)
  if (handoffText === undefined || handoffDriving) return
  handoffDriving = true
  const text = handoffText
  handoffText = undefined
  try {
    if (handoffThen === 'copy') {
      // The chat stays: the handoff goes to the clipboard, ready to paste into another chat. Should the clipboard
      // refuse, it goes in the prompt box instead, to cut from there.
      const message = handoffMessage(text, 'continue', handoffFull ? config.handoffSkill : undefined)
      const copied = await $.ui.copy({ text: message }).catch(() => ({ isCopied: false as const }))
      // Under the reply already there, so the next reply takes it away.
      await setHandoffCard($, 'copied', handoffFull, true)
      if (copied.isCopied) $.ui.toast('context-lens: handoff copied. Paste it into a new chat.')
      else {
        await $.prompt.fill({ text: message, mode: 'replace' })
        $.ui.toast('context-lens: the clipboard refused, so the handoff is in the prompt box')
      }
      return
    }
    await update($, handoffStage, () => 'clearing')
    await $.command.run({ command: 'clear', args: '' })
    // Under the first reply of the cleared chat, gone with the one after it.
    await setHandoffCard($, 'done', handoffFull)
    await $.prompt.submit({ text: handoffMessage(text, handoffThen, handoffFull ? config.handoffSkill : undefined) })
  } catch (error) {
    await update($, handoffCard, () => null)
    $.ui.toast(
      `context-lens: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`,
    )
  } finally {
    handoffDriving = false
    await update($, handoffStage, () => null)
  }
}
export let handoffTimer: { cancel: () => void } | undefined
export const setHandoffTimer = (value: typeof handoffTimer) => {
  handoffTimer = value
}
// Handoff is calm until Haiku says a fresh chat would suit now (handoffAdvice); then it is the white box with a glow.
// What the band last read from handoffAdvice, so the drawing helpers need no await.
export let adviceNow: string | null = null
export const setAdviceNow = (value: typeof adviceNow) => {
  adviceNow = value
}
const HANDOFF_ADVICE_LEVEL = 50
// "Always" (the Hand off button setting) keeps the slot as Handoff, calm in a grey box, and loud only once advised.
export const handoffLevel = () =>
  adviceNow ? HANDOFF_ADVICE_LEVEL : config.handoffButton === 'always' ? HANDOFF_BOX_AT : 0
export const handoffLoud = () => adviceNow !== null
export const handoffSlot = () => handoffLoud() || config.handoffButton === 'always'

/** The quick handoff written by Haiku from the transcript, for a chat whose cache went cold; null when it fails. */
async function haikuHandoff(
  $: EngineInterface,
  messages: Parameters<typeof compactTranscript>[0],
): Promise<string | null> {
  const transcript = fittingTranscript(messages)
  if (transcript === null) return null
  const r = await $.model.complete({
    model: COMPACT_MODEL,
    system:
      'You read a conversation between a user and Claude Code, an AI coding agent, and write the handoff the user asks for.',
    prompt: `${transcript}\n\n---\n${HANDOFF_PROMPT}`,
    maxTokens: 4000,
    effort: 'medium',
    timeoutMs: 120_000,
  })
  return r.isAnswered && r.text.trim().length > 100 ? r.text.trim() : null
}
