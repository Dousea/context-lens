import { atom, type EngineInterface, type ModelUsage, read, update } from 'claude-code'

import type { AgentCache, CacheTtl, Effort, ModelKey } from '../../types'
import { envAgentCacheTtl, envCacheTtl, envEnable1h, envForce5m } from '../core/env'
import { applyUsage, emptyClock, isRecache, resolveTtl, toContextView, type Warmth, warmth } from '../model'

const lensMain = atom({ plugin: 'context-lens', key: 'lensMain' } as const, emptyClock('1h'))
const lensAgents = atom({ plugin: 'context-lens', key: 'lensAgents' } as const, [])
const lensContext = atom({ plugin: 'context-lens', key: 'lensContext' } as const, null)
const lensLiveTokens = atom({ plugin: 'context-lens', key: 'lensLive' } as const, null)
const lensRewritten = atom({ plugin: 'context-lens', key: 'lensRewritten' } as const, false)
const lensLimits = atom({ plugin: 'context-lens', key: 'lensLimits' } as const, [])
const lensNow = atom({ plugin: 'context-lens', key: 'lensNow' } as const, 0)

// The context figures from the last usage check, for the cache tooltip.
export let lastContext: { tokens: number; window: number; percent: number } | null = null
export const setLastContext = (value: typeof lastContext) => {
  lastContext = value
}

// --- The lens: prompt-cache timers, the context window and rate-limit usage, one row in the band --------------------

export const LENS_TICK_MS = 5_000

export const LENS_WARMTH_COLOR: Record<Warmth, string> = {
  uncached: 'inactive',
  warm: 'success',
  expiring: 'warning',
  cold: 'error',
}

/** The TTLs the engine picks, in the order the promptCacheTtl and subagentPromptCacheTtl settings document. */
async function cacheTtls($: EngineInterface): Promise<{ main: CacheTtl; agent: CacheTtl }> {
  const [settings, usage, mainEnv, agentEnv, force5m, enable1h] = await Promise.all([
    $.settings.read(),
    $.session.usage(),
    envCacheTtl($),
    envAgentCacheTtl($),
    envForce5m($),
    envEnable1h($),
  ])
  if (force5m) return { main: '5m', agent: '5m' }
  const isSubscription = usage.rateLimits.length > 0
  return {
    main: resolveTtl(mainEnv ?? settings.promptCacheTtl, isSubscription ? '1h' : '5m'),
    agent: resolveTtl(agentEnv ?? settings.subagentPromptCacheTtl, enable1h ? '1h' : '5m'),
  }
}

export async function refreshUsage($: EngineInterface): Promise<void> {
  const usage = await $.session.usage({ breakdown: 'summary' })
  await update($, lensLiveTokens, () => usage.context.tokens ?? null)
  await update($, lensLimits, () => usage.rateLimits)
  const breakdown = usage.context.breakdown
  if (breakdown) await update($, lensContext, () => toContextView(breakdown))
}

export async function recordRequest(
  $: EngineInterface,
  agentId: string | undefined,
  usage: ModelUsage,
  ran?: { model?: ModelKey; effort?: Effort },
): Promise<void> {
  const [at, ttls] = await Promise.all([$.clock.now(), cacheTtls($)])
  if (agentId === undefined) {
    const previous = await read($, lensMain)
    await update($, lensRewritten, () => isRecache(previous, usage) && warmth(previous, at) !== 'cold')
    await update($, lensMain, () => applyUsage(usage, at, ttls.main))
    return
  }
  const known = (await read($, lensAgents)).find(a => a.id === agentId)
  const info = known ? undefined : (await $.agent.list()).find(a => a.id === agentId)
  await update($, lensAgents, list => {
    const type = list.find(a => a.id === agentId)?.type ?? info?.type ?? 'agent'
    const next: AgentCache = {
      ...applyUsage(usage, at, ttls.agent),
      id: agentId,
      type,
      ...(ran?.model ? { model: ran.model } : {}),
      ...(ran?.effort ? { effort: ran.effort } : {}),
    }
    return [...list.filter(a => a.id !== agentId), next]
  })
}

/** A main-thread compaction's summary starts a new cache entry. */
export async function afterCompaction($: EngineInterface): Promise<void> {
  await update($, lensMain, clock => emptyClock(clock.ttl))
  await update($, lensRewritten, () => false)
  await refreshUsage($)
}

export async function lensTick($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, lensNow, () => at)
}

/** The session started: the first read of the usage. Called from the dashboard's own session.start hook: one plugin
 * may hook an event once. */
export async function lensStarted($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, lensNow, () => at)
  void refreshUsage($).catch(() => undefined)
}
