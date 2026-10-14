import type { ModelUsage, SessionContextBreakdown } from 'claude-code'

import type { CacheClock, CacheTtl, CategoryKind, ContextView, RateLimit } from '../types'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** A request counts as a re-cache when it writes at least this much and reads less than it writes. */
export const RECACHE_MIN_TOKENS = 20_000

export const ttlMs = (ttl: CacheTtl): number => (ttl === '1h' ? 60 : 5) * MINUTE_MS

/** The warning window before expiry: ten minutes of an hour, one minute of five. */
export const warnMs = (ttl: CacheTtl): number => ttlMs(ttl) / 6

export const emptyClock = (ttl: CacheTtl): CacheClock => ({
  ttl,
  lastAt: null,
  read: 0,
  written: 0,
  uncached: 0,
})

export type Warmth = 'uncached' | 'warm' | 'expiring' | 'cold'

/** Milliseconds until the cache entry lapses; negative once it has, null before any request. */
export const remainingMs = (clock: CacheClock, now: number): number | null =>
  clock.lastAt === null ? null : clock.lastAt + ttlMs(clock.ttl) - now

export const warmth = (clock: CacheClock, now: number): Warmth => {
  const left = remainingMs(clock, now)
  if (left === null) return 'uncached'
  if (left <= 0) return 'cold'
  return left <= warnMs(clock.ttl) ? 'expiring' : 'warm'
}

/** Whether a request that followed an earlier one rewrote its prefix instead of reading it. */
export const isRecache = (previous: CacheClock, usage: ModelUsage): boolean =>
  previous.lastAt !== null &&
  usage.cache_creation_input_tokens >= RECACHE_MIN_TOKENS &&
  usage.cache_read_input_tokens < usage.cache_creation_input_tokens

export const applyUsage = (usage: ModelUsage, at: number, ttl: CacheTtl): CacheClock => ({
  ttl,
  lastAt: at,
  read: usage.cache_read_input_tokens,
  written: usage.cache_creation_input_tokens,
  uncached: usage.input_tokens,
})

export const clockTokens = (clock: CacheClock): number => clock.read + clock.written + clock.uncached

export const formatTokens = (n: number): string => {
  if (n >= 999_500) return `${(n / 1_000_000).toFixed(n >= 9_950_000 ? 0 : 1)}M`
  if (n >= 9_950) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/** `47m` from ten minutes up, `9:05` below, `0:00` once lapsed. */
export const formatRemaining = (ms: number): string => {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  if (seconds >= 600) return `${Math.ceil(seconds / 60)}m`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Time to a rate-limit reset: `3d`, `14h`, `2h14m`, `38m`. */
export const formatUntil = (ms: number): string => {
  const left = Math.max(0, ms)
  if (left >= DAY_MS) return `${Math.floor(left / DAY_MS)}d`
  if (left >= 10 * HOUR_MS) return `${Math.floor(left / HOUR_MS)}h`
  if (left >= HOUR_MS) return `${Math.floor(left / HOUR_MS)}h${Math.floor((left % HOUR_MS) / MINUTE_MS)}m`
  return `${Math.ceil(left / MINUTE_MS)}m`
}

export const bar = (fraction: number, width: number): string => {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export const resolveTtl = (explicit: unknown, fallback: CacheTtl): CacheTtl =>
  explicit === '5m' || explicit === '1h' ? explicit : fallback

export const toContextView = (breakdown: SessionContextBreakdown): ContextView => ({
  totalTokens: breakdown.totalTokens,
  maxTokens: breakdown.rawMaxTokens,
  categories: breakdown.categories
    .filter(c => c.tokens > 0 && c.kind !== 'deferred')
    .map(c => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind })),
})

/** The autocompact buffer: free space the engine compacts before it reaches. */
const BUFFER_COLOR = 'warning'

export type BarSegment = { kind: CategoryKind; color: string; cells: number }

/**
 * The context as one bar: each used category in its /context colour, then free
 * space, then the autocompact buffer. Used categories are scaled to `used`, the
 * API's count, since the breakdown only estimates them.
 */
export const stackedBar = (view: ContextView, used: number | null, width: number): BarSegment[] => {
  const max = Math.max(1, view.maxTokens)
  const usedCategories = view.categories.filter(c => c.kind === 'used')
  const estimated = usedCategories.reduce((sum, c) => sum + c.tokens, 0)
  const scale = used !== null && estimated > 0 ? used / estimated : 1
  const buffer = view.categories.filter(c => c.kind === 'buffer').reduce((sum, c) => sum + c.tokens, 0)
  const bufferCells = Math.min(width, Math.round((buffer / max) * width))
  const usable = width - bufferCells

  const segments: BarSegment[] = []
  let tokens = 0
  let end = 0
  for (const c of usedCategories) {
    tokens += c.tokens * scale
    const next = Math.min(usable, Math.round((tokens / max) * width))
    if (next > end) segments.push({ kind: 'used', color: c.color, cells: next - end })
    end = Math.max(end, next)
  }
  if (usable > end) segments.push({ kind: 'free', color: 'inactive', cells: usable - end })
  if (bufferCells > 0) segments.push({ kind: 'buffer', color: BUFFER_COLOR, cells: bufferCells })
  return segments
}

/** A plain fill bar as segments, coloured by how full it is. */
export const fillBar = (fraction: number, width: number): BarSegment[] => {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width)
  return [
    { kind: 'used', color: fillColor(fraction), cells: filled },
    { kind: 'free', color: 'inactive', cells: width - filled },
  ]
}

export const segmentGlyph = (kind: CategoryKind): string => (kind === 'used' ? '█' : '░')

export type UsageStyle = 'full' | 'bar' | 'percent'

/** One rate-limit window as the line draws it. */
export type UsageWindow = { label: string; percent: number; reset: string | null }

const USAGE_STYLES: readonly UsageStyle[] = ['full', 'bar', 'percent']
const SEPARATOR = 3 // ' │ '
const MIN_CTX_BAR = 8
const MIN_USAGE_BAR = 5

export const usageWindow = (limit: RateLimit, now: number): UsageWindow => {
  const resetsAt = limit.resetsAt === undefined ? NaN : Date.parse(limit.resetsAt)
  return {
    label: RATE_LABEL[limit.kind] ?? limit.kind,
    percent: Math.round(limit.percentUsed),
    reset: Number.isNaN(resetsAt) ? null : formatUntil(resetsAt - now),
  }
}

const RATE_LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: '$' }

/** Columns a usage window's text takes in a style, its gaps included but not its bar. */
const usageTextWidth = (w: UsageWindow, style: UsageStyle): number =>
  w.label.length +
  1 +
  (style === 'percent' ? 0 : 1) +
  `${w.percent}%`.length +
  (style === 'full' && w.reset !== null ? 1 + w.reset.length : 0)

/** Bar widths in cells; `usageBar` is each usage window's, 0 in the `percent` style. */
export type LineLayout = { ctxBar: number; usageBar: number; ctxText: string; style: UsageStyle; windows: number }

/**
 * Fills `columns`: the text takes what it needs and the bars split the rest,
 * half to the context bar and half shared by the usage bars. When the bars no
 * longer fit at their minimum, the context drops its window size (never its
 * token count), then the usage windows lose their reset times, then their bars,
 * then drop from the end, and last the context bar goes.
 */
export const layoutLine = (
  columns: number,
  headWidth: number,
  ctxTexts: readonly string[],
  windows: readonly UsageWindow[],
): LineLayout => {
  for (let n = windows.length; n >= 0; n--) {
    for (const style of USAGE_STYLES) {
      for (const ctxText of ctxTexts) {
        const usageText = windows.slice(0, n).reduce((sum, w) => sum + SEPARATOR + usageTextWidth(w, style), 0)
        const room = columns - headWidth - SEPARATOR - 'ctx '.length - 1 - ctxText.length - usageText
        const bars = style === 'percent' ? 0 : n
        const usageBar = bars === 0 ? 0 : Math.floor(room / 2 / bars)
        const ctxBar = room - usageBar * bars
        if (ctxBar >= MIN_CTX_BAR && (bars === 0 || usageBar >= MIN_USAGE_BAR)) {
          return { ctxBar, usageBar, ctxText, style, windows: n }
        }
      }
    }
  }
  return { ctxBar: 0, usageBar: 0, ctxText: ctxTexts[ctxTexts.length - 1] ?? '', style: 'percent', windows: 0 }
}

export const fillColor = (fraction: number): string => {
  if (fraction >= 0.85) return 'error'
  if (fraction >= 0.65) return 'warning'
  return 'success'
}
