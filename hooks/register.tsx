import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelUsage, Register } from 'claude-code'

import type { AgentCache, CacheClock, CacheTtl } from '../types'
import {
  applyUsage,
  bar,
  clockTokens,
  emptyClock,
  fillBar,
  fillColor,
  formatRemaining,
  formatTokens,
  isRecache,
  layoutLine,
  remainingMs,
  resolveTtl,
  segmentGlyph,
  stackedBar,
  TOAST_MIN_TOKENS,
  toContextView,
  usageWindow,
  warmth,
  type BarSegment,
  type Warmth,
} from './model'

const TICK_MS = 5_000

const main = atom({ plugin: 'context-lens', key: 'main' } as const, emptyClock('1h'))
const agents = atom({ plugin: 'context-lens', key: 'agents' } as const, [])
const context = atom({ plugin: 'context-lens', key: 'context' } as const, null)
const liveTokens = atom({ plugin: 'context-lens', key: 'liveTokens' } as const, null)
const isRewritten = atom({ plugin: 'context-lens', key: 'isRewritten' } as const, false)
const rateLimits = atom({ plugin: 'context-lens', key: 'rateLimits' } as const, [])
const now = atom({ plugin: 'context-lens', key: 'now' } as const, 0)

const WARMTH_COLOR: Record<Warmth, string> = {
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
    $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL'),
    $.env.get('CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL'),
    $.env.get('FORCE_PROMPT_CACHING_5M'),
    $.env.get('ENABLE_PROMPT_CACHING_1H'),
  ])
  if (force5m) return { main: '5m', agent: '5m' }
  const isSubscription = usage.rateLimits.length > 0
  return {
    main: resolveTtl(mainEnv ?? settings.promptCacheTtl, isSubscription ? '1h' : '5m'),
    agent: resolveTtl(agentEnv ?? settings.subagentPromptCacheTtl, enable1h ? '1h' : '5m'),
  }
}

async function refreshUsage($: EngineInterface): Promise<void> {
  const usage = await $.session.usage({ breakdown: 'summary' })
  await update($, liveTokens, () => usage.context.tokens ?? null)
  await update($, rateLimits, () => usage.rateLimits)
  const breakdown = usage.context.breakdown
  if (breakdown) await update($, context, () => toContextView(breakdown))
}

async function recordRequest(
  $: EngineInterface,
  agentId: string | undefined,
  usage: ModelUsage,
): Promise<void> {
  const [at, ttls] = await Promise.all([$.clock.now(), cacheTtls($)])
  if (agentId === undefined) {
    const previous = await read($, main)
    await update($, isRewritten, () => isRecache(previous, usage) && warmth(previous, at) !== 'cold')
    await update($, main, () => applyUsage(usage, at, ttls.main))
    return
  }
  const known = (await read($, agents)).find(a => a.id === agentId)
  const info = known ? undefined : (await $.agent.list()).find(a => a.id === agentId)
  await update($, agents, list => {
    const type = list.find(a => a.id === agentId)?.type ?? info?.type ?? 'agent'
    const next: AgentCache = { ...applyUsage(usage, at, ttls.agent), id: agentId, type }
    return [...list.filter(a => a.id !== agentId), next]
  })
}

/** A main-thread compaction's summary starts a new cache entry. */
async function afterCompaction($: EngineInterface): Promise<void> {
  await update($, main, clock => emptyClock(clock.ttl))
  await update($, isRewritten, () => false)
  await refreshUsage($)
}

/** The main cache entry (by its lastAt) each toast was last raised for. */
let warnedFor: number | null = null
let coldFor: number | null = null

async function tick($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, now, () => at)

  const clock = await read($, main)
  const tokens = (await read($, liveTokens)) ?? 0
  if (clock.lastAt === null || clock.ttl !== '1h' || tokens < TOAST_MIN_TOKENS) return
  const state = warmth(clock, at)
  if (state === 'expiring' && warnedFor !== clock.lastAt) {
    warnedFor = clock.lastAt
    $.ui.toast(
      `Main cache expires in ${formatRemaining(remainingMs(clock, at) ?? 0)} (${formatTokens(tokens)}). ` +
        'Run /compact while it is warm.',
      { timeoutMs: 15_000 },
    )
  }
  if (state === 'cold' && coldFor !== clock.lastAt) {
    coldFor = clock.lastAt
    $.ui.toast(`Main cache went cold: the next request re-caches ${formatTokens(tokens)}.`, {
      timeoutMs: 15_000,
    })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const startedAt = await $.clock.now()
    await update($, now, () => startedAt)
    void tick($).catch(() => undefined)
    $.clock.every(TICK_MS, () => void tick($).catch(() => undefined))
    void refreshUsage($).catch(() => undefined)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (result.usage) await recordRequest($, e.agentId, result.usage)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (e.changed.includes('rateLimits')) await update($, rateLimits, () => e.rateLimits)
    if (e.changed.includes('context')) await refreshUsage($)
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && !result.skip) await afterCompaction($)
    return result
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, main, clock => emptyClock(clock.ttl))
      await update($, liveTokens, () => null)
      await update($, isRewritten, () => false)
      void refreshUsage($).catch(() => undefined)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const [mainClock, ctx, live, rewritten, limits, at, agentList] = await Promise.all([
      read($, main),
      read($, context),
      read($, liveTokens),
      read($, isRewritten),
      read($, rateLimits),
      read($, now),
      read($, agents),
    ])
    const agentId = e.props.view.agentId
    const agent: AgentCache | undefined =
      agentId === undefined
        ? undefined
        : (agentList.find(a => a.id === agentId) ?? { ...emptyClock('5m'), id: agentId, type: 'agent' })
    if (agent === undefined && mainClock.lastAt === null && ctx === null && limits.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const clock: CacheClock = agent ?? mainClock
    const state = warmth(clock, at)
    const time = cacheTime(state, remainingMs(clock, at))
    const showRewritten = agent === undefined && rewritten && state !== 'cold'
    const headWidth = 2 + time.length + (showRewritten ? ' re-cached'.length : 0)

    const max = ctx?.maxTokens ?? 0
    const used = agent === undefined ? (live ?? ctx?.totalTokens ?? 0) : clockTokens(agent)
    const ctxTexts = max > 0 ? [`${formatTokens(used)}/${formatTokens(max)}`, formatTokens(used)] : [formatTokens(used)]
    const windows = limits.map(l => usageWindow(l, at))
    const layout = layoutLine(e.props.bodyColumns, headWidth, ctxTexts, windows)

    const segments: BarSegment[] =
      max === 0 || layout.ctxBar === 0
        ? []
        : agent === undefined && ctx !== null
          ? stackedBar(ctx, live, layout.ctxBar)
          : fillBar(used / max, layout.ctxBar)

    return (
      <Box flexDirection="row" gap={1}>
        <Text color={WARMTH_COLOR[state]}>●</Text>
        <Text color={state === 'uncached' ? 'inactive' : WARMTH_COLOR[state]}>{time}</Text>
        {showRewritten && <Text color="warning">re-cached</Text>}
        <Text dimColor>│</Text>
        <Text>ctx</Text>
        {segments.length > 0 && (
          <Box flexDirection="row">
            {segments
              .filter(s => s.cells > 0)
              .map((s, i) => (
                <Text key={`s${i}`} color={s.color}>
                  {segmentGlyph(s.kind).repeat(s.cells)}
                </Text>
              ))}
          </Box>
        )}
        <Text>{layout.ctxText}</Text>
        {windows.slice(0, layout.windows).map(w => (
          <Box key={`u-${w.label}`} flexDirection="row" gap={1}>
            <Text dimColor>│</Text>
            <Text>{w.label}</Text>
            {layout.style !== 'percent' && (
              <Text color={fillColor(w.percent / 100)}>{bar(w.percent / 100, layout.usageBar)}</Text>
            )}
            <Text color={layout.style === 'percent' ? fillColor(w.percent / 100) : undefined}>{w.percent}%</Text>
            {layout.style === 'full' && w.reset !== null && <Text dimColor>{w.reset}</Text>}
          </Box>
        ))}
      </Box>
    )
  })
}

function cacheTime(state: Warmth, left: number | null): string {
  if (state === 'uncached') return '—'
  if (state === 'cold') return 'cold'
  return formatRemaining(left ?? 0)
}
