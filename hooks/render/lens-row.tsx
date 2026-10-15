import { atom, type EngineInterface, read, type RenderInput } from 'claude-code'

import type { AgentCache } from '../../types'
import { config } from '../core/config'
import { DASH_TEXT, themeHex } from '../core/palette'
import { LENS_WARMTH_COLOR } from '../logic/lens'
import {
  type BarSegment,
  BUFFER_COLOR,
  clockTokens,
  CONTEXT_LABEL,
  emptyClock,
  fillBar,
  fillColor,
  formatRemaining,
  formatTokens,
  gauge,
  layoutLine,
  remainingMs,
  segmentGlyph,
  stackedBar,
  usageWindow,
  type Warmth,
  warmth,
} from '../model'
import { ringSvg, stripSvg } from '../svg/controls'
import { themedEls } from '../theme'

const lensMain = atom({ plugin: 'context-lens', key: 'lensMain' } as const, emptyClock('1h'))
const lensAgents = atom({ plugin: 'context-lens', key: 'lensAgents' } as const, [])
const lensContext = atom({ plugin: 'context-lens', key: 'lensContext' } as const, null)
const lensLiveTokens = atom({ plugin: 'context-lens', key: 'lensLive' } as const, null)
const lensRewritten = atom({ plugin: 'context-lens', key: 'lensRewritten' } as const, false)
const lensLimits = atom({ plugin: 'context-lens', key: 'lensLimits' } as const, [])
const lensNow = atom({ plugin: 'context-lens', key: 'lensNow' } as const, 0)

const STRIP_STEPS = 1000

function lensCacheTime(state: Warmth, left: number | null): string {
  if (state === 'uncached') return '—'
  if (state === 'cold') return 'cold'
  return formatRemaining(left ?? 0)
}

/** The lens's row, `columns` wide: the cache timer, the context bar and the usage windows; null when there is
 * nothing to show yet. A subagent in view shows its own clock. Hiding the cache timer in the settings drops the clock. */
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

  const els = themedEls($.ui.resolve(e))
  const { Box, Text } = els
  // Off the terminal the font is proportional: a run of rule glyphs wraps and leaves gaps, and a one-cell gauge reads as
  // a stray glyph. There the context bar is a drawn strip and each usage window a ring.
  const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : undefined
  const clock = agent ?? mainClock
  const state = warmth(clock, at)
  const time = lensCacheTime(state, remainingMs(clock, at))
  const showRewritten = agent === undefined && rewritten && state !== 'cold'
  const showClock = !config.hide.includes('timer')
  const headWidth = showClock ? 2 + time.length + (showRewritten ? ' re-cached'.length : 0) : null

  const max = ctx?.maxTokens ?? 0
  const used = agent === undefined ? (live ?? ctx?.totalTokens ?? 0) : clockTokens(agent)
  const ctxTexts = max > 0 ? [`${formatTokens(used)} / ${formatTokens(max)}`, formatTokens(used)] : [formatTokens(used)]
  const windows = limits.map(l => usageWindow(l, at))
  const layout = layoutLine(columns, headWidth, ctxTexts, windows, Svg === undefined)

  // A drawn strip has no cells to round to: it splits finely, so a row of a few percent keeps its colour.
  const cells = Svg ? STRIP_STEPS : layout.ctxBar
  const segments: BarSegment[] =
    max === 0 || layout.ctxBar === 0
      ? []
      : agent === undefined && ctx !== null
        ? stackedBar(ctx, live, cells)
        : fillBar(used / max, cells)

  const lineBar = (key: string, parts: readonly BarSegment[]) => (
    <Box key={key} flexDirection="row">
      {parts
        .filter(s => s.cells > 0)
        .map((s, i) => (
          <Text key={`${key}-${i}`} color={s.color}>
            {segmentGlyph(s.kind).repeat(s.cells)}
          </Text>
        ))}
    </Box>
  )
  // The main chat's rows by what they hold; a subagent's clock has no breakdown.
  const breakdown = agent === undefined && ctx !== null ? ctx.categories : []
  // The window size is dim beside the tokens used: `152k / 250k`.
  const [usedText, maxText] = layout.ctxText.split(' / ')

  return (
    <Box key="lens-row" flexDirection="row" gap={1} alignItems="center">
      {showClock && <Text color={LENS_WARMTH_COLOR[state]}>●</Text>}
      {showClock && <Text color={state === 'uncached' ? 'inactive' : LENS_WARMTH_COLOR[state]}>{time}</Text>}
      {showClock && showRewritten && <Text color="warning">re-cached</Text>}
      {showClock && <Text dimColor>·</Text>}
      {/* On the desktop the context is a hover scope: the pointer on it reveals its breakdown, which the app draws as a card
          above it, as wide as the context; the rows wrap to fit it. */}
      <Box
        key="lens-context"
        position="relative"
        flexDirection="row"
        gap={1}
        alignItems="center"
        flexGrow={Svg ? 1 : 0}
        flexShrink={1}
        minWidth={0}
      >
        <Text dimColor>{layout.short ? CONTEXT_LABEL.short : CONTEXT_LABEL.label}</Text>
        {segments.length > 0 && Svg && (
          <Box
            key="ctx-bar"
            flexGrow={1}
            flexShrink={1}
            width={0}
            minWidth={0}
            flexDirection="column"
            justifyContent="center"
          >
            <Svg source={stripSvg(segments)} alt={`${layout.ctxText} tokens of context`} height={4} />
          </Box>
        )}
        {segments.length > 0 && !Svg && lineBar('ctx-bar', segments)}
        {/* The band's own text colour: the app's default follows its theme, not the band's look, and is lost on a light band
          in a dark app. */}
        <Text color={DASH_TEXT}>{usedText}</Text>
        {maxText && <Text dimColor>/ {maxText}</Text>}
        {Svg && breakdown.length > 0 && (
          <Box
            position="absolute"
            left={0}
            right={0}
            display="none"
            hover={{ display: 'flex' }}
            flexDirection="row"
            flexWrap="wrap"
            columnGap={2}
            rowGap={0}
          >
            {breakdown.map(c => (
              <Box key={`ctx-${c.name}`} flexDirection="row" gap={1} flexShrink={0}>
                <Text color={c.kind === 'buffer' ? BUFFER_COLOR : c.kind === 'free' ? 'inactive' : c.color}>■</Text>
                <Text dimColor>{c.name}</Text>
                <Text>{formatTokens(c.tokens)}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      {windows.slice(0, layout.windows).map(w => (
        <Box key={`u-${w.short}`} flexDirection="row" gap={1} flexShrink={0} alignItems="center">
          <Text dimColor>·</Text>
          <Text dimColor>{layout.short ? w.short : w.label}</Text>
          {layout.style !== 'percent' && Svg && (
            <Box key={`u-${w.short}-ring`} flexShrink={0}>
              <Svg
                source={ringSvg(w.percent, themeHex(fillColor(w.percent / 100)))}
                alt={`${w.percent}% of the ${w.label.toLowerCase()} limit`}
                width={14}
                height={14}
              />
            </Box>
          )}
          {layout.style !== 'percent' && !Svg && layout.usageBar === 0 && (
            <Text color={fillColor(w.percent / 100)}>{gauge(w.percent / 100)}</Text>
          )}
          {layout.usageBar > 0 && lineBar(`u-${w.short}-bar`, fillBar(w.percent / 100, layout.usageBar))}
          <Text color={fillColor(w.percent / 100)}>{w.percent}%</Text>
          {layout.style === 'full' && w.reset !== null && <Text dimColor>↻ {w.reset}</Text>}
        </Box>
      ))}
    </Box>
  )
}
