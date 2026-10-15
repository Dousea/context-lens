import { atom, type EngineInterface, update } from 'claude-code'

import type { Effort, ModelKey, Pick, Spent } from '../../types'
import { EFFORT_LABELS, EFFORTS, EMPTY_SPENT, WEIGHT } from '../core/constants'

// What the prompts Auto steered cost this session, measured, and what judging them took.
const saved = atom({ plugin: 'context-lens', key: 'saved' } as const, EMPTY_SPENT)

const TURN_LINES_KEPT = 200
export type TurnLine = { effort?: Effort; model?: ModelKey; cost?: number }
// The session's state ends with the process: the lines are kept in the store too, by session id (the transcript's name, which
// a --resume keeps), so a restarted or resumed chat still draws what each reply ran on. The newest sessions are kept.
const TURN_LINES_SESSIONS = 30
let storedTurnLines: { session: string; lines: Record<string, TurnLine> } | null = null

export const withTurnLine = (lines: Record<string, TurnLine>, key: string, line: TurnLine) =>
  Object.fromEntries([
    ...Object.entries(lines)
      .filter(([k]) => k !== key)
      .slice(1 - TURN_LINES_KEPT),
    [key, line],
  ])

export async function storedLinesOf($: EngineInterface): Promise<Record<string, TurnLine>> {
  const session = await $.session.id().catch(() => '')
  if (!session) return {}

  if (storedTurnLines?.session !== session) {
    const all = await $.store.get('turnLines').catch(() => undefined)
    const lines = all && typeof all === 'object' ? (all as Record<string, unknown>)[session] : undefined
    storedTurnLines = { session, lines: lines && typeof lines === 'object' ? (lines as Record<string, TurnLine>) : {} }
  }
  return storedTurnLines.lines
}

export async function storeTurnLine($: EngineInterface, key: string, line: TurnLine) {
  const session = await $.session.id().catch(() => '')
  if (!session) return

  const lines = withTurnLine(await storedLinesOf($), key, line)
  const all = await $.store.get('turnLines').catch(() => undefined)
  const others = Object.entries(all && typeof all === 'object' ? all : {})
    .filter(([k]) => k !== session)
    .slice(1 - TURN_LINES_SESSIONS)

  await $.store.set('turnLines', Object.fromEntries([...others, [session, lines]]))
  storedTurnLines = { session, lines }
}
// The weighted tokens of the requests (the chat's and its subagents') since the prompt; kept in turnLines when the turn ends.
export let turnCost = 0
export const setTurnCost = (value: typeof turnCost) => {
  turnCost = value
}
// What the reply's last main-thread request ran on: the footer's model and effort.
export let ranThisTurn: { model?: ModelKey; effort?: Effort } | null = null
export const setRanThisTurn = (value: typeof ranThisTurn) => {
  ranThisTurn = value
}

/**
 * The tally in its current shape. A hot reload keeps the state an older version wrote ({ requests, actual,
 * baseline } before 0.2.0), so every read goes through this.
 */
export function asSpent(t: unknown): Spent {
  const v = (t ?? {}) as Partial<Spent>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  const judged = (v.judge ?? {}) as Partial<Spent['judge']>
  // Stats from 0.3.0 and earlier hold the subagents' counts under helpers.
  const ran = (v.subagents ?? (v as { helpers?: Spent['subagents'] }).helpers) as
    Partial<Spent['subagents']> | undefined
  return {
    prompts: num(v.prompts),
    requests: num(v.requests),
    input: num(v.input),
    write: num(v.write),
    writeHour: num(v.writeHour),
    read: num(v.read),
    out: num(v.out),
    byEffort: v.byEffort && typeof v.byEffort === 'object' ? v.byEffort : {},
    judge: { haiku: num(judged.haiku), ms: num(judged.ms), tokens: num(judged.tokens) },
    subagents: {
      runs: ran?.runs && typeof ran.runs === 'object' ? ran.runs : {},
      requests: num(ran?.requests),
      cost: num(ran?.cost),
    },
  }
}

/** The saved footer line of a reply: the one written at its end. The footer's duration is the turn's own, but the saved one is
 * matched within a second in case the two are read at slightly different moments. */
export function turnLineFor<T>(lines: Record<string, T>, ms: number): T | undefined {
  const exact = lines[String(ms)]
  if (exact) return exact
  let best: T | undefined
  let gap = 1000
  for (const [k, v] of Object.entries(lines)) {
    const d = Math.abs(Number(k) - ms)
    if (d < gap) {
      gap = d
      best = v
    }
  }
  return best
}

/** A request's tokens weighted by price, in input-token terms (see WEIGHT). The cache writes are priced by the lifetime the
 * request says it wrote (1 hour or 5 minutes); one that does not say is counted as 5 minutes. */
export function weighted(usage: {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_creation?: { ephemeral_1h_input_tokens?: number | null } | null
}): number {
  const written = usage.cache_creation_input_tokens ?? 0
  const hour = Math.min(written, usage.cache_creation?.ephemeral_1h_input_tokens ?? 0)
  return (
    (usage.input_tokens ?? 0) * WEIGHT.input +
    hour * WEIGHT.write1h +
    (written - hour) * WEIGHT.write +
    (usage.cache_read_input_tokens ?? 0) * WEIGHT.read +
    (usage.output_tokens ?? 0) * WEIGHT.out
  )
}

/** Adds one request Auto steered: every kind of token it used, under the effort it ran at. */
export async function tally(
  $: EngineInterface,
  effort: Effort,
  usage: Parameters<typeof weighted>[0] & { input_tokens: number; output_tokens: number },
) {
  const cached = usage.cache_read_input_tokens ?? 0
  const write = usage.cache_creation_input_tokens ?? 0
  const cost = weighted(usage)
  await update($, saved, old => {
    const t = asSpent(old)
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 }
    return {
      ...t,
      requests: t.requests + 1,
      input: t.input + usage.input_tokens,
      write: t.write + write,
      writeHour: t.writeHour + Math.min(write, usage.cache_creation?.ephemeral_1h_input_tokens ?? 0),
      read: t.read + cached,
      out: t.out + usage.output_tokens,
      byEffort: { ...t.byEffort, [effort]: { ...bucket, cost: bucket.cost + cost } },
    }
  })
}

/** Counts one prompt Auto judged: under its effort, and what the judge took. */
export async function countPrompt(
  $: EngineInterface,
  effort: Effort | undefined,
  by: Pick['by'] | undefined,
  ms: number,
  judgeTokens: number,
) {
  await update($, saved, old => {
    const t = asSpent(old)
    const judged = {
      haiku: t.judge.haiku + (by === 'haiku' ? 1 : 0),
      ms: t.judge.ms + ms,
      tokens: t.judge.tokens + judgeTokens,
    }
    if (!effort) return { ...t, judge: judged }
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 }
    return {
      ...t,
      judge: judged,
      prompts: t.prompts + 1,
      byEffort: { ...t.byEffort, [effort]: { ...bucket, prompts: bucket.prompts + 1 } },
    }
  })
}

/** 1234 -> "1.2k", 87 -> "87". */
export function tokens(n: number): string {
  const v = Math.abs(n)
  const text = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
  return n < 0 ? `-${text}` : text
}

const share = (part: number, whole: number) => `${Math.round((part / whole) * 100)} %`

/**
 * What /context-lens stats answers: what the prompts Auto steered cost, measured, split by kind and by effort,
 * and what the judge took. No "saved" figure: what a prompt would have cost at another effort is not known,
 * since effort mostly changes how many tool calls it makes. Cost is in tokens weighted as priced (WEIGHT).
 */
export function savedText(raw: Spent): string {
  const t = asSpent(raw)
  const judged = t.judge.haiku
  const subagentRuns = EFFORTS.reduce((n, e) => n + (t.subagents.runs[e] ?? 0), 0)
  if (t.prompts === 0 && judged === 0 && subagentRuns === 0) return 'nothing measured yet'
  const input = t.input * WEIGHT.input
  const write = t.writeHour * WEIGHT.write1h + (t.write - t.writeHour) * WEIGHT.write
  const cached = t.read * WEIGHT.read
  const out = t.out * WEIGHT.out
  const total = input + write + cached + out
  const lines = [
    `${t.prompts} prompts, ${t.requests} requests, cost about ${tokens(Math.round(total))} tokens weighted by price` +
      (total > 0
        ? ` (cache reads ${share(cached, total)}, cache writes ${share(write, total)}, output ${share(out, total)})`
        : ''),
  ]
  const per = EFFORTS.filter(e => t.byEffort[e]?.prompts).map(e => {
    const b = t.byEffort[e]!
    return `${EFFORT_LABELS[e]} ${b.prompts}, average ${tokens(Math.round(b.cost / b.prompts))}`
  })
  if (per.length) lines.push(`Per prompt: ${per.join('; ')}`)
  if (subagentRuns) {
    const per = EFFORTS.filter(e => t.subagents.runs[e]).map(e => `${EFFORT_LABELS[e]} ${t.subagents.runs[e]}`)
    lines.push(
      `Subagents: ${subagentRuns} (${per.join(', ')}), ${t.subagents.requests} requests, cost about ${tokens(Math.round(t.subagents.cost))} tokens`,
    )
  }
  if (judged) {
    lines.push(
      `Judge: Haiku ${t.judge.haiku}, average ${Math.round(t.judge.ms / judged)} ms, ${tokens(t.judge.tokens)} tokens in all`,
    )
  }
  return lines.join('\n')
}

/** k/M for token counts: 420000 -> "420k", 1000000 -> "1.0M". */
export function kTokens(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
}
