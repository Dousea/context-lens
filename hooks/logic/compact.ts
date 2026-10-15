import { atom, type EngineInterface, read, update } from 'claude-code'

import { compactCold } from './cache'
import { cardRunning, HANDOFF_CARD_MS } from './handoff'

const compactAsk = atom({ plugin: 'context-lens', key: 'compactAsk' } as const, false)
const handoffCard = atom({ plugin: 'context-lens', key: 'handoffCard' } as const, null)

// What is typed in that field. Kept here, not in state: a write per key would redraw the bar under the cursor.
export let compactNote = ''
export const setCompactNote = (value: typeof compactNote) => {
  compactNote = value
}
// When the compact bar opened: its first half second fades the swamped band's colours out (see compactFadeSvg).
export let compactOpenedAt = 0
/** Compact pressed: on desktop a bar asks for an optional note first; the terminal compacts at once. */
export async function openCompact($: EngineInterface, e: { surface: string }) {
  if (e.surface === 'terminal') return compactCold($)
  compactNote = ''
  compactOpenedAt = await $.clock.now()
  await update($, compactAsk, () => true)
}
// When Haiku last wrote a compaction (for /context-lens debug).
export let lastHaikuCompact = 0
export const setLastHaikuCompact = (value: typeof lastHaikuCompact) => {
  lastHaikuCompact = value
}
/** How long "Compact complete" stays above the prompt when nothing else clears it. */
export const COMPACT_CARD_MS = 20_000
/** A settings part's body on desktop is as tall as the overview's row of cards, so the panel keeps its height going in
 * and out of a part. In lines (a Box height is a number of lines or a percentage) at the app's 19 px line: 56 px makes
 * the band 121.5 px tall in every part, as with the cards. */
export const SETTINGS_BODY_H = 56 / 19
/** A handoff's or compact's card for the band above the prompt: while it runs, and once landed until the next message
 * is sent, the ✕ is pressed or its time has passed (COMPACT_CARD_MS, HANDOFF_CARD_MS). */
export async function compactCard($: EngineInterface, working = false) {
  const card = await read($, handoffCard)
  if (!card || cardRunning(card.kind)) return card
  const keep = card.kind === 'compacted' ? COMPACT_CARD_MS : HANDOFF_CARD_MS
  if (working || (card.kind === 'compacted' && card.seen) || (await $.clock.now()) - card.at >= keep) return null
  return card
}

// A compaction written by Haiku 5.5: Anthropic names compaction among the jobs it is built for, at a fraction of the
// chat model's price. Claude Code compacts with the chat's own model and has no setting for another, and the
// summarizer's request does not pass through turn.step, so the mod answers session.compact itself: the transcript as
// text, Haiku's summary back as the conversation. Anything that fails falls through to Claude Code's own compaction.
export const COMPACT_MODEL = 'claude-haiku-5-5'
/** The transcript's most text sent to Haiku: about 600k tokens, inside its window with room for the summary. */
const COMPACT_MAX_CHARS = 2_400_000
const COMPACT_SYSTEM = `You compact a conversation between a user and Claude Code, an AI coding agent, so the work can continue
in a fresh context that holds only your summary. Whoever reads it next knows nothing else about the conversation.

Write a detailed summary with these sections:
1. Primary request and intent: everything the user asked for, in detail, including changes of mind.
2. Key technical concepts: technologies, frameworks, constraints and decisions.
3. Files and code: every file read, created or edited, why it matters, and the important snippets or signatures.
4. Errors and fixes: what went wrong, how it was fixed, and any feedback the user gave about it.
5. Problem solving: what was solved and what is still being worked out.
6. All user messages: every message the user wrote that is not a tool result, briefly and in order.
7. Pending tasks: what the user asked for that is not done.
8. Current work: exactly what was being done right before this summary, with file names and code. The last few
messages come nearly uncut: carry the code and errors from them over in full, since the next step builds on them.
9. Next step: the next step, only if it follows directly from the user's latest request, quoting that request.

Be precise: keep names, paths, numbers, commands and error messages exact. Leave out pleasantries.
Reply with the summary only.`

// The last messages go to Haiku nearly whole: the work in progress (the code just written, the error just seen) lives
// in their tool calls and results, which a short cut would lose mid-task.
export const COMPACT_TAIL = 6
const COMPACT_TAIL_CHARS = 20_000
/** The transcript as plain text for the summarizer: each message, its tool calls and their results, the long ones cut. */
export function compactTranscript(
  messages: readonly {
    role: string
    text: string
    toolUses?: readonly { tool: string; input: unknown; text?: string }[]
    toolResults?: readonly { text?: string }[]
  }[],
  toolChars = 2000,
  tailChars = COMPACT_TAIL_CHARS,
): string {
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)} …[${s.length - n} more characters]` : s)
  const tailFrom = messages.length - COMPACT_TAIL
  return messages
    .map((m, i) => {
      const inTail = i >= tailFrom
      const inputChars = inTail ? tailChars : 400
      const resultChars = inTail ? tailChars : toolChars
      const lines = [`${m.role === 'user' ? 'USER' : 'CLAUDE'}: ${m.text}`.trimEnd()]
      for (const t of m.toolUses ?? []) {
        lines.push(`  [${t.tool} ${cut(JSON.stringify(t.input ?? {}), inputChars)}]`)
        if (t.text) lines.push(`  → ${cut(t.text, resultChars)}`)
      }
      if (!m.toolUses?.length)
        for (const r of m.toolResults ?? []) if (r.text) lines.push(`  → ${cut(r.text, resultChars)}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

/** The transcript cut harder when it does not fit Haiku's window; null when it still does not. */
export function fittingTranscript(messages: Parameters<typeof compactTranscript>[0]): string | null {
  const full = compactTranscript(messages)
  if (full.length <= COMPACT_MAX_CHARS) return full
  const shorter = compactTranscript(messages, 300, 4000)
  return shorter.length <= COMPACT_MAX_CHARS ? shorter : null
}

/** Haiku's summary of the transcript, or why there is none. */
export async function haikuCompaction(
  $: EngineInterface,
  messages: Parameters<typeof compactTranscript>[0],
  instructions?: string,
): Promise<{ text: string } | { fail: string }> {
  const transcript = fittingTranscript(messages)
  if (transcript === null) return { fail: 'the chat is too long for Haiku' }
  const r = await $.model.complete({
    model: COMPACT_MODEL,
    system: COMPACT_SYSTEM,
    prompt: `${transcript}\n\n---\nWrite the summary now.${instructions?.trim() ? `\nThe user asked the summary to keep or stress: ${instructions.trim()}` : ''}`,
    maxTokens: 16000,
    effort: 'medium',
    timeoutMs: 240_000,
  })
  if (!r.isAnswered) return { fail: 'reason' in r ? String(r.reason) : 'no answer' }
  return r.text.trim().length > 200 ? { text: r.text.trim() } : { fail: 'the summary came back empty' }
}
