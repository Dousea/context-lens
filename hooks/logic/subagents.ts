import { atom, type EngineInterface, read, update } from 'claude-code'

import type { Effort, ModelKey, Pick } from '../../types'
import { config } from '../core/config'
import { EFFORTS, EMPTY_SPENT, MODELS } from '../core/constants'
import { bounded, capped, judge, tipped } from './judge'
import { asSpent, weighted } from './spend'

const saved = atom({ plugin: 'context-lens', key: 'saved' } as const, EMPTY_SPENT)
const saveUntil = atom({ plugin: 'context-lens', key: 'saveUntil' } as const, null)

// Effort for subagents: the effort the judge picked for each subagent, by its id. A subagent's first request can come
// before its spawn resolves with the id (seen 2026-10-10), so a pick waits under the spawn's description and type
// until a request from an unknown subagent claims it through $.agent.list().
// With Cheaper model for subagents on it also holds the model the judge named, when it was sure; the step clamps it to the model the
// subagent was given (see subagentModelFor).
// Every spawn also leaves what its Agent call named (a model, an effort) and its parent's model, so its requests can
// tell what the subagent inherits from what was set for it (see subagentSteerable).
export type SubagentPick = { effort: Effort; model?: ModelKey }
export type SpawnCall = { model: boolean; effort: boolean; parentModel?: ModelKey }
type SubagentSpawn = { pick?: SubagentPick; call: SpawnCall }
export const subagentSpawns = new Map<string, SubagentSpawn>()
export let subagentWaiting: ({ description: string; type: string; parentId?: string } & SubagentSpawn)[] = []
export const setSubagentWaiting = (value: typeof subagentWaiting) => {
  subagentWaiting = value
}
// The Agent calls that named an effort, by tool_use_id, until their spawn reads them.
export const callEfforts = new Set<string>()

/** How sure the judge must be of a task to give its subagent another model: the Smarter lean's own line for a close call. */
export const SUBAGENT_MODEL_SURE = 0.65

/**
 * The model a subagent runs on when the judge named one: only a cheaper model than the one it was given (never Fable,
 * never a dearer one), else null and it keeps its own. A subagent starts with a small context and a cache of its own,
 * so the switch costs next to nothing there, unlike in the chat.
 */
export function subagentModelFor(wanted: ModelKey | undefined, given: ModelKey | undefined): ModelKey | null {
  if (!wanted || !given || wanted === 'fable') return null
  const rank = (k: ModelKey) => MODELS.findIndex(m => m.key === k)
  return rank(wanted) < rank(given) ? wanted : null
}

/** What the judge reads for a subagent: its task, said to be one, so it judges the subagent's work. */
export function subagentQuestion(prompt: string, type: string): string {
  return `${prompt.slice(0, 4000)}

[This is the task Claude gave a ${type} subagent, not a message from the person. Judge the effort that subagent needs to do it well.]`
}

/** The lowest effort a subagent gets: medium, or the person's Min when higher, never above their Max. A subagent's answer
 * goes back to the chat unchecked, and at low it miscounted where medium did not (bench/results/helpers-2026-10-10.md). */
export function subagentFloor(floor: Effort, ceiling: Effort): Effort {
  const i = Math.min(Math.max(EFFORTS.indexOf(floor), EFFORTS.indexOf('medium')), EFFORTS.indexOf(ceiling))
  return EFFORTS[i]!
}

/** The judge's effort for a subagent's task, within the person's slider, Min and Max and save mode; null without a verdict. */
export async function subagentEffort($: EngineInterface, prompt: string, type: string): Promise<Pick | null> {
  const { verdict } = await judge($, subagentQuestion(prompt, type), null)
  if (!verdict) return null
  const saving = (await read($, saveUntil)) !== null
  const leaned = tipped(verdict.effort, verdict.sure, config.bias)
  const effort = capped(bounded(leaned, subagentFloor(config.floor, config.ceiling), config.ceiling), saving)
  return {
    ...verdict,
    effort,
    why:
      effort !== leaned && EFFORTS.indexOf(leaned) < EFFORTS.indexOf(effort)
        ? `${verdict.why} (subagents start at medium)`
        : verdict.why,
  }
}

/** The effort (and model) picked for this subagent, claiming a waiting pick the first time its id is seen. */
export async function subagentSpawnOf($: EngineInterface, id: string): Promise<SubagentSpawn | undefined> {
  const known = subagentSpawns.get(id)
  if (known || subagentWaiting.length === 0) return known
  const info = (await $.agent.list().catch(() => [])).find(a => a.id === id)
  if (!info) return undefined
  const match = subagentWaiting.find(
    w => w.description === info.description && w.type === info.type && w.parentId === info.parentId,
  )
  if (!match) return undefined
  subagentWaiting = subagentWaiting.filter(w => w !== match)
  const spawn: SubagentSpawn = { pick: match.pick, call: match.call }
  subagentSpawns.set(id, spawn)
  return spawn
}

async function subagentPickOf($: EngineInterface, id: string): Promise<SubagentPick | undefined> {
  return (await subagentSpawnOf($, id))?.pick
}

/**
 * What of a subagent's request the mod may change: the model and the effort it inherits from its parent, and with
 * Override definitions on also those its definition sets; never one its Agent call named. The definition is not
 * readable, so a model other than the parent's or an effort other than the chat's is taken as the definition's. A
 * definition that sets the parent's own looks inherited, which changes nothing it asked for.
 */
export function subagentSteerable(
  request: { model?: ModelKey; effort?: unknown },
  parent: { model?: ModelKey; effort?: unknown },
  call: SpawnCall | undefined,
  override: boolean,
): { model: boolean; effort: boolean } {
  const modelInherited = !parent.model || !request.model || request.model === parent.model
  const effortInherited = typeof parent.effort !== 'string' || request.effort === parent.effort
  return {
    model: !call?.model && (modelInherited || override),
    effort: !call?.effort && (effortInherited || override),
  }
}

/** The effort picked for this subagent. */
export async function subagentEffortOf($: EngineInterface, id: string): Promise<Effort | undefined> {
  return (await subagentPickOf($, id))?.effort
}

/** Counts one request of a subagent the judge steered, for /context-lens stats. */
export async function subagentTally($: EngineInterface, usage: Parameters<typeof weighted>[0]) {
  await update($, saved, old => {
    const t = asSpent(old)
    return {
      ...t,
      subagents: { ...t.subagents, requests: t.subagents.requests + 1, cost: t.subagents.cost + weighted(usage) },
    }
  })
}
