import type { EngineInterface } from 'claude-code'

import type { Effort, ModelKey, Pick, Steps } from '../../types'
import { EFFORTS, STEPS } from '../core/constants'
import { askHaiku, type Judged, keepsEffort } from './judge'

// The judge benchmark (/context-lens bench): labelled prompts in bench/judge-cases.json, each run through the same
// pipeline a real prompt takes (a short follow-up keeps the current effort, anything else goes to a judge).
export type BenchCase = {
  id: string
  kind: string
  holdout?: boolean
  current: Pick
  context?: string
  message: string
  ok: Effort[]
  /** Every task size a careful person would accept, for the cases labelled with one. */
  steps?: Steps[]
}
export type BenchAnswer = {
  id: string
  judge: string
  effort?: Effort
  by?: string
  why?: string
  sure?: number
  model?: ModelKey
  steps?: Steps
  ms: number
  tokens: number
}

/** Where an answer lands against the labels: right, too low (risks quality), too high (wastes), or no answer. */
export function benchGrade(c: BenchCase, effort: Effort | undefined): 'hit' | 'under' | 'over' | 'none' {
  if (!effort) return 'none'
  if (c.ok.includes(effort)) return 'hit'
  const rank = EFFORTS.indexOf(effort)
  return rank < Math.min(...c.ok.map(e => EFFORTS.indexOf(e))) ? 'under' : 'over'
}

/** Where a task size lands against the labels: right, too few (keeps work in the chat), too many (hands off a small task). */
export function stepsGrade(c: BenchCase, steps: Steps | undefined): 'hit' | 'under' | 'over' | 'none' {
  if (!steps || !c.steps) return 'none'
  if (c.steps.includes(steps)) return 'hit'
  return STEPS.indexOf(steps) < Math.min(...c.steps.map(s => STEPS.indexOf(s))) ? 'under' : 'over'
}

/** The benchmark's table: per judge the share it got right, how it missed, and how fast it was; then per kind. */
export function benchReport(cases: BenchCase[], answers: BenchAnswer[]): string {
  const byId = new Map(cases.map(c => [c.id, c]))
  const judges = [...new Set(answers.map(a => a.judge))]
  const kinds = [...new Set(cases.map(c => c.kind))]
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '-')
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length ? s[Math.floor(s.length / 2)] : 0
  }
  const lines = [
    '| Judge | Right | Too low | Too high | No answer | Median ms |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  for (const j of judges) {
    const mine = answers.filter(a => a.judge === j)
    const g = mine.map(a => benchGrade(byId.get(a.id)!, a.effort))
    const n = (k: string) => g.filter(x => x === k).length
    const asked = mine.filter(a => a.ms > 0).map(a => a.ms)
    lines.push(
      `| ${j} | ${pct(n('hit'), g.length)} | ${n('under')} | ${n('over')} | ${n('none')} | ${asked.length ? median(asked) : '-'} |`,
    )
  }
  // The held-out cases were never tuned against: the honest score. The rest shaped the judge prompts.
  const sets = [
    ['tuned on', cases.filter(c => !c.holdout)],
    ['held out', cases.filter(c => c.holdout)],
  ] as const
  lines.push('', `| Set (cases) | ${judges.join(' | ')} |`, `| --- | ${judges.map(() => '---').join(' | ')} |`)
  for (const [name, set] of sets) {
    if (!set.length) continue
    const ids = set.map(c => c.id)
    const cells = judges.map(j => {
      const mine = answers.filter(a => a.judge === j && ids.includes(a.id))
      return pct(mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit').length, mine.length)
    })
    lines.push(`| ${name} (${set.length}) | ${cells.join(' | ')} |`)
  }
  lines.push('', `| Kind (cases) | ${judges.join(' | ')} |`, `| --- | ${judges.map(() => '---').join(' | ')} |`)
  for (const k of kinds) {
    const ids = cases.filter(c => c.kind === k).map(c => c.id)
    const cells = judges.map(j => {
      const mine = answers.filter(a => a.judge === j && ids.includes(a.id))
      return pct(mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit').length, mine.length)
    })
    lines.push(`| ${k} (${ids.length}) | ${cells.join(' | ')} |`)
  }
  // Does "unsure" predict a miss? The Smarter lean acts on it, so it is measured here.
  const judged = judges.filter(j => !j.startsWith('always'))
  const sureLines = [
    '',
    '| Judge | Sure when right | Sure when wrong | Misses under 65% sure | Misses under 85% sure | Answers under 65% | Answers under 85% |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const j of judged) {
    const mine = answers.filter(a => a.judge === j && a.effort && typeof a.sure === 'number')
    if (!mine.length) continue
    const wrong = mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) !== 'hit')
    const right = mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit')
    const avg = (xs: BenchAnswer[]) =>
      xs.length ? `${Math.round((xs.reduce((t, a) => t + a.sure!, 0) / xs.length) * 100)}%` : '-'
    const under = (xs: BenchAnswer[], t: number) => xs.filter(a => a.sure! < t).length
    sureLines.push(
      `| ${j} (${mine.length} with a score) | ${avg(right)} | ${avg(wrong)} | ${under(wrong, 0.65)} of ${wrong.length} | ${under(wrong, 0.85)} of ${wrong.length} | ${under(mine, 0.65)} | ${under(mine, 0.85)} |`,
    )
  }
  const pickLines = ['', '| Judge | Haiku | Sonnet | Opus | Other |', '| --- | --- | --- | --- | --- |']
  for (const j of judged) {
    const mine = answers.filter(a => a.judge === j && a.model)
    if (!mine.length) continue
    const n = (k: string) => mine.filter(a => a.model === k).length
    pickLines.push(
      `| ${j} | ${n('haiku')} | ${n('sonnet')} | ${n('opus')} | ${mine.length - n('haiku') - n('sonnet') - n('opus')} |`,
    )
  }
  // Too many steps is what hands a small task to a subagent that costs more than it spares.
  const stepLines = ['', '| Judge | Steps right | Too few | Too many | No answer |', '| --- | --- | --- | --- | --- |']
  for (const j of judged) {
    const mine = answers.filter(a => a.judge === j && byId.get(a.id)!.steps)
    if (!mine.length) continue
    const g = mine.map(a => stepsGrade(byId.get(a.id)!, a.steps))
    const n = (k: string) => g.filter(x => x === k).length
    stepLines.push(`| ${j} | ${pct(n('hit'), g.length)} | ${n('under')} | ${n('over')} | ${n('none')} |`)
  }
  lines.push(
    ...(sureLines.length > 3 ? sureLines : []),
    ...(pickLines.length > 3 ? pickLines : []),
    ...(stepLines.length > 3 ? stepLines : []),
  )
  const stepMisses = answers
    .filter(
      a => !a.judge.startsWith('always') && a.steps && ['under', 'over'].includes(stepsGrade(byId.get(a.id)!, a.steps)),
    )
    .map(
      a =>
        `- ${a.judge} ${a.id}: said ${a.steps} steps, wanted ${byId.get(a.id)!.steps!.join('/')}: "${byId.get(a.id)!.message.slice(0, 60)}"`,
    )
  const misses = answers
    .filter(a => !a.judge.startsWith('always') && benchGrade(byId.get(a.id)!, a.effort) !== 'hit')
    .map(
      a =>
        `- ${a.judge}${a.by && a.by !== a.judge ? ` (via ${a.by})` : ''} ${a.id}: said ${a.effort ?? 'nothing'}${a.why ? ` (${a.why})` : ''}, wanted ${byId.get(a.id)!.ok.join('/')}: "${byId.get(a.id)!.message.slice(0, 60)}"`,
    )
  return [
    ...lines,
    '',
    'Misses:',
    ...(misses.length ? misses : ['- none']),
    ...(stepMisses.length ? ['', 'Steps misses:', ...stepMisses] : []),
  ].join('\n')
}

/** Runs every case through each available judge, a few at a time, and returns the answers. */
export async function runBench($: EngineInterface, cases: BenchCase[]): Promise<BenchAnswer[]> {
  const judges: [string, (c: BenchCase) => Promise<Judged | undefined>][] = [
    ['haiku', c => askHaiku($, c.message, c.current, c.context ?? '')],
  ]
  const answers: BenchAnswer[] = []
  // Baselines: what a fixed effort would score on the same labels.
  for (const fixed of ['medium', 'high'] as Effort[])
    for (const c of cases) answers.push({ id: c.id, judge: `always ${fixed}`, effort: fixed, ms: 0, tokens: 0 })
  const jobs = judges.flatMap(([name, ask]) => cases.map(c => ({ name, ask, c })))
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const { name, ask, c } = jobs[next++]
      // The mod never asks a judge about a short follow-up: it keeps the current effort.
      if (keepsEffort(c.message, c.context ?? '')) {
        answers.push({ id: c.id, judge: name, effort: c.current.effort, ms: 0, tokens: 0 })
        continue
      }
      const started = await $.clock.now()
      const got = await ask(c).catch(() => undefined)
      answers.push({
        id: c.id,
        judge: name,
        effort: got?.verdict?.effort,
        by: got?.verdict?.by,
        why: got?.verdict?.why,
        sure: got?.verdict?.sure,
        model: got?.verdict?.model,
        steps: got?.verdict?.steps,
        ms: (await $.clock.now()) - started,
        tokens: got?.tokens ?? 0,
      })
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return answers
}
