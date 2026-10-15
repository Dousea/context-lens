import { atom, type EngineInterface, read, type RenderInput } from 'claude-code'

import type { AgentCache } from '../../types'
import { LENS_WARMTH_COLOR } from '../logic/lens'
import {
  bar,
  type BarSegment,
  clockTokens,
  emptyClock,
  fillBar,
  fillColor,
  formatRemaining,
  formatTokens,
  layoutLine,
  remainingMs,
  segmentGlyph,
  stackedBar,
  usageWindow,
  type Warmth,
  warmth,
} from '../model'
import { themedEls } from '../theme'

const lensMain = atom({ plugin: 'context-lens', key: 'lensMain' } as const, emptyClock('1h'))
const lensAgents = atom({ plugin: 'context-lens', key: 'lensAgents' } as const, [])
const lensContext = atom({ plugin: 'context-lens', key: 'lensContext' } as const, null)
const lensLiveTokens = atom({ plugin: 'context-lens', key: 'lensLive' } as const, null)
const lensRewritten = atom({ plugin: 'context-lens', key: 'lensRewritten' } as const, false)
const lensLimits = atom({ plugin: 'context-lens', key: 'lensLimits' } as const, [])
const lensNow = atom({ plugin: 'context-lens', key: 'lensNow' } as const, 0)

function lensCacheTime(state: Warmth, left: number | null): string {
  if (state === 'uncached') return '—'
  if (state === 'cold') return 'cold'
  return formatRemaining(left ?? 0)
}

/** The lens's row, `columns` wide: the cache timer, the context bar and the usage windows; null when there is
 * nothing to show yet. A subagent in view shows its own clock. */
export async function lensRow($: EngineInterface, e: RenderInput<'AbovePrompt'>, columns: number) {
  const [mainClock, ctx, live, rewritten, limits, at, agentList] = await Promise.all([
    read($, lensMain),
    read($, lensContext),
    read($, lensLiveTokens),
    read($, lensRewritten),
    read($, lensLimits),
    read($, lensNow),
    read($, lensAgents),
  ])
  const agentId = e.props.view.agentId
  const agent: AgentCache | undefined =
    agentId === undefined
      ? undefined
      : (agentList.find(a => a.id === agentId) ?? { ...emptyClock('5m'), id: agentId, type: 'agent' })
  if (agent === undefined && mainClock.lastAt === null && ctx === null && limits.length === 0) return null

  const { Box, Text } = themedEls($.ui.resolve(e))
  const clock = agent ?? mainClock
  const state = warmth(clock, at)
  const time = lensCacheTime(state, remainingMs(clock, at))
  const showRewritten = agent === undefined && rewritten && state !== 'cold'
  const headWidth = 2 + time.length + (showRewritten ? ' re-cached'.length : 0)

  const max = ctx?.maxTokens ?? 0
  const used = agent === undefined ? (live ?? ctx?.totalTokens ?? 0) : clockTokens(agent)
  const ctxTexts = max > 0 ? [`${formatTokens(used)}/${formatTokens(max)}`, formatTokens(used)] : [formatTokens(used)]
  const windows = limits.map(l => usageWindow(l, at))
  const layout = layoutLine(columns, headWidth, ctxTexts, windows)

  const segments: BarSegment[] =
    max === 0 || layout.ctxBar === 0
      ? []
      : agent === undefined && ctx !== null
        ? stackedBar(ctx, live, layout.ctxBar)
        : fillBar(used / max, layout.ctxBar)

  return (
    <Box key="lens-row" flexDirection="row" gap={1}>
      <Text color={LENS_WARMTH_COLOR[state]}>●</Text>
      <Text color={state === 'uncached' ? 'inactive' : LENS_WARMTH_COLOR[state]}>{time}</Text>
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
}
