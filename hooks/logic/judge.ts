import { atom, type EngineInterface, read, update } from 'claude-code'

import type { Effort, ModelKey, Pick, Steps } from '../../types'
import { EFFORTS, MODELS, STEPS } from '../core/constants'
import { loadedSession, renderLog } from '../core/debug'
import { proof } from '../core/env'
import { JUDGE_FADE_MS, JUDGE_RISE_MS, JUDGE_STEP_MS } from '../svg/glows'
import { COMPACT_MODEL } from './compact'
import { lastContext } from './lens'

// Why the judge is failing, or null when it works.
const judgeDown = atom({ plugin: 'context-lens', key: 'judgeDown' } as const, null)

const JUDGE_SYSTEM = `You choose which Claude model and reasoning effort an agentic assistant (it reads files, runs tools and edits things, not only code) should use for the user's next message. Pick the cheapest pair that will still do the job well.

Models, cheapest first:
- haiku: quick questions, lookups, renames, small edits in one or two files, summaries, chit-chat. It can read files and run tools; pick it for any small, well-defined job.
- sonnet: normal coding, edits across a few files, explanations, writing.
- opus: hard debugging, architecture, large refactors, careful reviews.
- fable: the hardest long-horizon or research-level work.

Effort: low for quick answers, medium for normal work, high for hard problems, xhigh or max only for very hard ones.

Effort is relative to the model in use ("Current" names it): a stronger model needs less effort for the same job. Opus at medium does about what Sonnet does at high, and Fable is stronger again. So for one and the same task pick one step lower on Opus than on Sonnet, and lower still on Fable; on Sonnet, go one step higher for hard work than you would on Opus.

Judge the SCOPE and the amount of work, not whether it is code. A short message can ask for a lot: "go through my whole drive and clean it up", "review the entire repo", "migrate everything" are big, multi-step, tool-heavy jobs where mistakes are costly: never low, usually high. Low is only for answers that need no tools and no planning.

If the message answers a question in the assistant's last reply (picks an option, says which one, confirms a plan), judge only the work that answer starts, as the reply describes it, not the length of the answer and not the work done before the question: "B" can mean "build the complicated section B" (high), while "yes" or "no" to one small action ("should I archive this?", "delete the old ones too?") is low, and picking a value for one setting (a log level, a colour, a font) is low. But picking which way to build something ("option 1", "the same shapes", "B") starts that build: judge the build. Approving a whole plan or several steps takes the effort of that plan. A plain "yes", "ok" or "do it" after "Is that OK? Then I'll build X" or "Should I build X?" approves building X: judge X, not the word.

A message that pushes back on, corrects or adds to a plan or claim under discussion continues that work: keep at least the effort that work had, never drop to low for it. Thanks, praise or a closing remark with no new request is low. A question about how to do something, or about effort itself, that needs no tools is low.

If the person asks for deep thought ("think hard", "ultrathink", "be thorough"), pick at least high; if they ask for a quick answer, pick low.

If the message is a short follow-up to ongoing work ("yes", "go", "ok", "continue", or the same in any language), keep the current pair. Thanks or praise with no new request ("ok perfect, thanks") is not a follow-up: it is low and one step.

Steps: how many tool calls and replies the task takes. one: a single command, lookup or plain answer, even when the command acts on several items ("delete those branches", "rename it in this file"). few: a handful of reads or edits. many: a broad search, many files or long multi-step work.

Reply with JSON only: {"model":"haiku|sonnet|opus|fable","effort":"low|medium|high|xhigh|max","steps":"one|few|many","sure":0.0-1.0 how sure you are of the effort,"why":"at most 6 words, in the user's language"}`

/** Reads `{ model, effort, why }` out of a reply, or nothing when it doesn't hold one. */
export function parseVerdict(
  text: string,
): { model: ModelKey; effort: Effort; why: string; sure?: number; steps?: Steps; handoff?: string } | undefined {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(match[0])
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null) return undefined
  const { model, effort, why, sure, steps, handoff } = raw as Record<string, unknown>
  const key = typeof model === 'string' ? model.toLowerCase() : ''
  const found = MODELS.find(m => key === m.key || key === m.id || key.includes(m.key))
  if (!found || !EFFORTS.includes(effort as Effort)) return undefined
  const how = typeof sure === 'number' && sure >= 0 && sure <= 1 ? { sure } : {}
  // Only a reason counts: "handoff":"" or false is no advice.
  const advice = typeof handoff === 'string' && handoff.trim() ? { handoff: handoff.trim().slice(0, 70) } : {}
  return {
    model: found.key,
    effort: effort as Effort,
    why: typeof why === 'string' ? why.slice(0, 60) : '',
    ...how,
    ...(STEPS.includes(steps as Steps) ? { steps: steps as Steps } : {}),
    ...advice,
  }
}

/**
 * What the judge reads besides the new message: the person's previous message and the assistant's last reply. The
 * reply is kept long and from its end, where a question with options ("A, B or C?") sits: "B" alone looks like a
 * small job, the reply says what B sets off.
 */
export async function recentContext($: EngineInterface): Promise<string> {
  return contextFrom(await $.session.messages())
}

/** The context text from the conversation so far: the last user message, short, and the assistant's last reply's end. */
export function contextFrom(messages: readonly { role: string; text: string }[]): string {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const lastAssistant = lastAssistantText(messages)
  return [
    lastUser ? `user: ${lastUser.text.slice(0, 400)}` : '',
    lastAssistant ? `assistant: ${lastAssistant.slice(-2000)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** The assistant's last reply, or nothing. */
export function lastAssistantText(messages: readonly { role: string; text: string }[]): string {
  return [...messages].reverse().find(m => m.role === 'assistant' && m.text.trim())?.text ?? ''
}

/** The skill or custom command a typed "/name args" runs, or nothing for the app's own commands and Context Lens's. */
export async function typedSkill(
  $: EngineInterface,
  text: string,
): Promise<{ name: string; description: string } | undefined> {
  const name = text.trim().slice(1).split(/\s+/)[0]
  if (!name) return undefined
  const found = (await $.command.list().catch(() => [])).find(c => c.name === name)
  if (!found || !['user', 'plugin', 'mcp'].includes(found.source) || found.plugin === 'context-lens') return undefined
  return { name, description: found.description ?? '' }
}

const LEVEL_WORD = '(low|medium|high|xhigh|x-high|extra[- ]high|max|maximum)'
const NAMED_LEVEL = new RegExp(
  `\\b${LEVEL_WORD}\\s+effort\\b|\\beffort(?:\\s+level)?\\s*(?:[:=]|to|at|of|on)?\\s*${LEVEL_WORD}\\b|\\bxhigh\\b`,
  'gi',
)
const LEVEL_OF: Record<string, Effort> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  'x-high': 'xhigh',
  'extra high': 'xhigh',
  'extra-high': 'xhigh',
  max: 'max',
  maximum: 'max',
}

/**
 * The level a prompt asks for by name ("max effort", "effort: high", "xhigh"), or nothing. The word effort must sit
 * beside the level, so "a medium sized image" names nothing, and "don't use max effort" is a no. A named level runs
 * without the judge, which would also call prompts that only describe hard work "named".
 */
export function namedEffort(text: string): Effort | undefined {
  for (const m of text.matchAll(NAMED_LEVEL)) {
    const before = text.slice(Math.max(0, m.index - 20), m.index).toLowerCase()
    if (/\b(not|no|don'?t|never|without|instead of)\b/.test(before)) continue
    return LEVEL_OF[(m[1] ?? m[2] ?? 'xhigh').toLowerCase().replace(/\s+/, ' ')]
  }
  return undefined
}

/** A short follow-up such as "go", "ok", "yes", "continue": two words and a dozen characters at most. */
export function isFollowUp(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && t.length <= 12 && t.split(/\s+/).length <= 2
}

/**
 * Whether the assistant's last reply ended on a question ("Should I archive it?", "A, B or C?"). A short message
 * after one answers it, and the answer can start a small or a big job, so it goes to the judge instead of keeping
 * the effort.
 */
export function endsOnQuestion(context: string): boolean {
  const reply = context.split('\nassistant: ').pop() ?? ''
  return context.includes('assistant: ') && reply.slice(-400).includes('?')
}

/** The message as the judge reads it: images and files it carries are named, since the judge sees only text. */
export function withAttachments(text: string, attachments?: readonly { type: string }[]): string {
  if (!attachments?.length) return text
  const counts = new Map<string, number>()
  for (const a of attachments) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  const said = [...counts].map(([type, n]) => `${n} ${type}${n > 1 ? 's' : ''}`).join(', ')
  return `${text}

[The message comes with ${said} to look at.]`
}

/** The message as the judge reads it when it was typed while a task was still running. */
export function withMidTurn(text: string, effort: Effort): string {
  return `${text}

[Sent while the assistant was still working on the last task at ${effort} effort. If it adds to, corrects or steers that task, keep ${effort}; judge it on its own only if it is a separate new request.]`
}
// A lower verdict for a message typed mid-turn, applied when that turn ends (see prompt.submit).
export let heldPick: Pick | null = null
export const setHeldPick = (value: typeof heldPick) => {
  heldPick = value
}

/** A short follow-up that keeps the current effort: "go" between two steps, not an answer to a question. */
export function keepsEffort(message: string, context: string): boolean {
  return isFollowUp(message) && !endsOnQuestion(context)
}

export type Judged = { verdict?: Pick; tokens: number }

/** Why a judge the person picked could not answer, in words: what a status code means for them. */
export function judgeFailure(name: string, status: number | 'timeout'): string {
  if (status === 'timeout') return `${name} did not answer in time`
  if (status === 401 || status === 403) return `${name} was refused (${status}): check your Claude login`
  if (status === 402) return `${name} is out of credits (${status})`
  if (status === 429) return `${name} is rate limited (${status})`
  return `${name} failed (${status})`
}
const warned = new Set<string>()
/** Tells the person once per session and reason that the judge failed; the effort stays as it is. */
function warnJudge($: EngineInterface, reason: string) {
  void proof($, `judge fallback: ${reason}`)
  void update($, judgeDown, () => reason).then(() => $.ui.invalidate('ui.render'))
  if (warned.has(reason)) return
  warned.add(reason)
  $.ui.toast(`Context Lens: ${reason}. The model and effort stay as they are.`)
}

/** The text the judge reads: the current pair, the last turns and the next message. */
function judgeQuestion(prompt: string, current: Pick | null, context: string): string {
  return [
    current ? `Current: ${current.model} / ${current.effort}` : 'Current: none',
    context ? `Recent conversation:\n${context}` : '',
    `Next message:\n${prompt.slice(0, 2000)}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Haiku judges, through the session's own login: no key, nothing else to set up. Never throws. */
export async function judge($: EngineInterface, prompt: string, current: Pick | null): Promise<Judged> {
  const context = await recentContext($).catch(() => '')
  return askHaiku($, prompt, current, context)
}

/**
 * Haiku 5.5 by name: Claude Code builds that predate it map the plain alias to Haiku 4.5, at ten times the price.
 * Where 5.5 does not answer, the alias stands in.
 */
export async function completeWithHaiku(
  $: EngineInterface,
  request: Omit<Parameters<EngineInterface['model']['complete']>[0], 'model'>,
) {
  const named = await $.model.complete({ ...request, model: COMPACT_MODEL })
  return named.isAnswered ? named : $.model.complete({ ...request, model: 'haiku' })
}

/** Haiku through the session's own login: the judge, and it needs no key. */
export async function askHaiku(
  $: EngineInterface,
  prompt: string,
  current: Pick | null,
  context: string,
): Promise<Judged> {
  const used =
    lastContext && lastContext.window ? `Context used: ${Math.round(lastContext.percent)}% of the window` : ''
  const asked = [judgeQuestion(prompt, current, context), used].filter(Boolean).join('\n\n')
  const r = await completeWithHaiku($, {
    system: JUDGE_SYSTEM,
    prompt: asked,
    maxTokens: 160,
    effort: 'low',
    timeoutMs: 6000,
  })
  const verdict = r.isAnswered ? parseVerdict(r.text) : undefined
  const tokens = r.isAnswered && r.usage ? r.usage.input_tokens + r.usage.output_tokens : 0
  // The API refused or could not be reached (a login problem, no credits, a rate limit): say so once, in the
  // judge-down band. An abort (Esc, the timeout) or an empty reply is no failure of the judge. An answer takes the band away.
  if (!r.isAnswered && r.reason === 'api-error')
    warnJudge($, r.status === null ? 'Haiku could not be reached' : judgeFailure('Haiku', r.status))
  else if (r.isAnswered && verdict && (await read($, judgeDown))) await update($, judgeDown, () => null)
  return { verdict: verdict && { ...verdict, by: 'haiku' }, tokens }
}

/**
 * The effort slider tips close calls only: a verdict the judge was unsure of moves one step toward cheaper or smarter.
 * The outer stops count more calls as close. A sure verdict, or one without a confidence, stays as it is.
 */
export function tipped(effort: Effort, sure: number | undefined, bias: number): Effort {
  if (!bias || sure === undefined || sure >= (Math.abs(bias) === 1 ? 0.65 : 0.85)) return effort
  const i = Math.max(0, Math.min(EFFORTS.length - 1, EFFORTS.indexOf(effort) + Math.sign(bias)))
  return EFFORTS[i]!
}

/** Floor and ceiling from the settings: what Auto picks stays between them. */
export function bounded(effort: Effort, floor: Effort, ceiling: Effort): Effort {
  const lo = EFFORTS.indexOf(floor)
  const hi = Math.max(lo, EFFORTS.indexOf(ceiling))
  return EFFORTS[Math.max(lo, Math.min(hi, EFFORTS.indexOf(effort)))]!
}

/** Save mode caps what Auto picks at medium; a higher pick comes down to it. */
export function capped(effort: Effort, saving: boolean): Effort {
  return saving && EFFORTS.indexOf(effort) > EFFORTS.indexOf('medium') ? 'medium' : effort
}
/** Redraws the band every JUDGE_STEP_MS from `from` ms over `span` ms, so each piece of the rise or fade is drawn in turn. */
export function drawGlowSteps($: EngineInterface, from: number, span: number) {
  for (let at = Math.max(0, from); at <= from + span + JUDGE_STEP_MS; at += JUDGE_STEP_MS)
    $.clock.after(at + 5, () => $.ui.invalidate('ui.render'))
}
// When the judge started, and when it gave its verdict (null while it decides).
export let judgeStartedAt = 0
export const setJudgeStartedAt = (value: typeof judgeStartedAt) => {
  judgeStartedAt = value
}
export let judgeEndedAt: number | null = 0
export const setJudgeEndedAt = (value: typeof judgeEndedAt) => {
  judgeEndedAt = value
}
/** The verdict is in: the rim starts fading now, together with the effort word's flash, not after the effort and model
 * are applied. Redraws when the fade swaps in and once it is over. */
export async function endJudgeGlow($: EngineInterface, why: string) {
  if (judgeEndedAt !== null) return
  judgeEndedAt = await $.clock.now().catch(() => Date.now())
  const fadeAt = Math.max(judgeEndedAt, judgeStartedAt + JUDGE_RISE_MS) - judgeEndedAt
  renderLog.push(
    `${new Date().toISOString()} ${loadedSession} glow: ${why} ${judgeEndedAt - judgeStartedAt} ms after start, fade in ${fadeAt} ms`,
  )
  drawGlowSteps($, fadeAt, JUDGE_FADE_MS)
  $.ui.invalidate('ui.render')
}
