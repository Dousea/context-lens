import { describe, expect, test } from 'claude-code/testing'

import {
  applyUsage,
  emptyClock,
  formatRemaining,
  formatTokens,
  formatUntil,
  gauge,
  isRecache,
  cacheLeft,
  pie,
  layoutLine,
  stackedBar,
  warmth,
} from '../hooks/model'
import { stripSvg } from '../hooks/svg/controls'

const MINUTE = 60_000
const usage = (read: number, written: number, uncached = 100) => ({
  input_tokens: uncached,
  output_tokens: 50,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: written,
})

describe('cache clock', () => {
  test('an hour cache is warm, then expiring in its last ten minutes, then cold', () => {
    const clock = applyUsage(usage(90_000, 2_000), 0, '1h')
    expect(warmth(clock, 49 * MINUTE)).toBe('warm')
    expect(warmth(clock, 51 * MINUTE)).toBe('expiring')
    expect(warmth(clock, 60 * MINUTE)).toBe('cold')
  })

  test('a five-minute cache warns in its last minute', () => {
    const clock = applyUsage(usage(10_000, 500), 0, '5m')
    expect(warmth(clock, 3.9 * MINUTE)).toBe('warm')
    expect(warmth(clock, 4.5 * MINUTE)).toBe('expiring')
  })

  test('no request yet reads as uncached', () => {
    expect(warmth(emptyClock('1h'), 0)).toBe('uncached')
  })
})

describe('re-cache detection', () => {
  const warmed = applyUsage(usage(0, 30_000), 0, '1h')

  test('the first request writing the prefix is not a re-cache', () => {
    expect(isRecache(emptyClock('1h'), usage(0, 30_000))).toBe(false)
  })

  test('a later request that rewrites most of its prefix is', () => {
    expect(isRecache(warmed, usage(5_000, 120_000))).toBe(true)
  })

  test('a later request that reads its prefix is not', () => {
    expect(isRecache(warmed, usage(120_000, 25_000))).toBe(false)
  })
})

describe('formatting', () => {
  test('tokens', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(9_100)).toBe('9.1k')
    expect(formatTokens(182_400)).toBe('182k')
    expect(formatTokens(1_000_000)).toBe('1.0M')
  })

  test('remaining time is whole minutes, hours from an hour, and <1m in the last minute', () => {
    expect(formatRemaining(47 * MINUTE + 30_000)).toBe('47m')
    expect(formatRemaining(9 * MINUTE + 5_000)).toBe('9m')
    expect(formatRemaining(60 * MINUTE)).toBe('1h')
    expect(formatRemaining(65 * MINUTE)).toBe('1h5m')
    expect(formatRemaining(30_000)).toBe('<1m')
    expect(formatRemaining(-1)).toBe('<1m')
  })

  test('time to a rate-limit reset', () => {
    expect(formatUntil(3.5 * 24 * 60 * MINUTE)).toBe('3d')
    expect(formatUntil(14.5 * 60 * MINUTE)).toBe('14h')
    expect(formatUntil(134 * MINUTE)).toBe('2h14m')
    expect(formatUntil(37.5 * MINUTE)).toBe('38m')
  })
})

describe('the context bar', () => {
  const view = {
    totalTokens: 60_000,
    maxTokens: 200_000,
    categories: [
      { name: 'System prompt', tokens: 20_000, color: 'promptBorder', kind: 'used' as const },
      { name: 'Messages', tokens: 40_000, color: 'permission', kind: 'used' as const },
      { name: 'Free space', tokens: 120_000, color: 'inactive', kind: 'free' as const },
      { name: 'Autocompact buffer', tokens: 20_000, color: 'inactive', kind: 'buffer' as const },
    ],
  }

  test('each category takes its share of the width, then free space, then the buffer', () => {
    expect(stackedBar(view, null, 20)).toEqual([
      { kind: 'used', color: 'promptBorder', cells: 2 },
      { kind: 'used', color: 'permission', cells: 4 },
      { kind: 'free', color: 'inactive', cells: 12 },
      { kind: 'buffer', color: 'warning', cells: 2 },
    ])
  })

  test('categories scale to the tokens the API counted', () => {
    const cells = stackedBar(view, 120_000, 20)
      .filter(s => s.kind === 'used')
      .map(s => s.cells)
    expect(cells).toEqual([4, 8])
  })

  test("a row of a few percent shows at the desktop strip's fine split, where a terminal's cells round it away", () => {
    const wide = {
      totalTokens: 60_000,
      maxTokens: 1_000_000,
      categories: [
        { name: 'System prompt', tokens: 35_000, color: 'promptBorder', kind: 'used' as const },
        { name: 'Messages', tokens: 25_000, color: 'permission', kind: 'used' as const },
        { name: 'Free space', tokens: 940_000, color: 'inactive', kind: 'free' as const },
      ],
    }
    const messages = (width: number) => stackedBar(wide, null, width).find(s => s.color === 'permission')?.cells ?? 0
    expect(messages(20)).toBe(0)
    expect(messages(1000)).toBe(25)
  })

  test('the cells always add up to the width', () => {
    for (const width of [8, 13, 31, 48]) {
      expect(stackedBar(view, 190_000, width).reduce((sum, s) => sum + s.cells, 0)).toBe(width)
    }
  })
})

describe('the line layout', () => {
  const windows = [
    { label: 'Session', short: '5h', percent: 46, reset: '2h14m' },
    { label: 'Week', short: '7d', percent: 21, reset: '3d' },
  ]
  const ctx = ['84k / 200k', '84k']
  const HEAD = 5

  /** The columns a layout draws, as the band lays it out with one-cell gaps. */
  const drawnWidth = (layout: ReturnType<typeof layoutLine>, head: number | null = HEAD): number =>
    (head === null ? 0 : (layout.cacheLabel ? 'Cache '.length : 0) + head + 3) +
    (layout.short ? 'Ctx' : 'Context').length +
    1 +
    (layout.ctxBar > 0 ? layout.ctxBar + 1 : 0) +
    layout.ctxText.length +
    windows
      .slice(0, layout.windows)
      .reduce(
        (sum, w) =>
          sum +
          3 +
          (layout.short ? w.short : w.label).length +
          1 +
          (layout.style === 'percent' ? 0 : layout.usageBar > 0 ? layout.usageBar + 1 : 2) +
          `${w.percent}%`.length +
          (layout.style === 'full' ? 3 + (w.reset?.length ?? 0) : 0),
        0,
      )

  test('a wide line gives the usage windows bars, sharing half of what the text leaves', () => {
    expect(layoutLine(140, HEAD, ctx, windows)).toMatchObject({
      cacheLabel: true,
      ctxBar: 35,
      usageBar: 16,
      ctxText: '84k / 200k',
      style: 'full',
      windows: 2,
      short: false,
    })
  })

  test('a narrower line draws gauges and gives the context bar all the room', () => {
    expect(layoutLine(100, HEAD, ctx, windows)).toMatchObject({
      cacheLabel: true,
      ctxBar: 25,
      usageBar: 0,
      short: false,
    })
  })

  test('the line fills its columns exactly, with or without the cache clock', () => {
    for (const columns of [60, 70, 90, 110, 140, 200]) {
      expect(drawnWidth(layoutLine(columns, HEAD, ctx, windows))).toBe(columns)
      expect(drawnWidth(layoutLine(columns, null, ctx, windows), null)).toBe(columns)
    }
  })

  test('narrower lines shorten the labels, then drop the window size, the reset times, the gauges, then windows', () => {
    expect(layoutLine(78, HEAD, ctx, windows)).toMatchObject({ short: false, ctxText: '84k / 200k', style: 'full' })
    expect(layoutLine(70, HEAD, ctx, windows)).toMatchObject({ short: true, ctxText: '84k / 200k', style: 'full' })
    expect(layoutLine(60, HEAD, ctx, windows)).toMatchObject({ short: true, ctxText: '84k', style: 'full', windows: 2 })
    expect(layoutLine(50, HEAD, ctx, windows)).toMatchObject({ style: 'gauge', windows: 2 })
    expect(layoutLine(43, HEAD, ctx, windows)).toMatchObject({ style: 'percent', windows: 2 })
    expect(layoutLine(38, HEAD, ctx, windows).windows).toBeLessThan(2)
  })

  test("the cache clock's label goes first, before the other labels shorten", () => {
    // 77 columns hold everything in words with an 8-cell bar; the label's six columns are the first to give way.
    expect(layoutLine(77 + 6, HEAD, ctx, windows)).toMatchObject({ cacheLabel: true, short: false })
    expect(layoutLine(77 + 5, HEAD, ctx, windows)).toMatchObject({ cacheLabel: false, short: false })
    expect(layoutLine(76, HEAD, ctx, windows)).toMatchObject({ cacheLabel: false, short: true })
  })

  test('the context keeps its token count however narrow', () => {
    expect(layoutLine(20, HEAD, ctx, windows).ctxText).toBe('84k')
  })

  test('bars never go below their minimum', () => {
    for (let columns = 30; columns <= 160; columns++) {
      const layout = layoutLine(columns, HEAD, ctx, windows)
      if (layout.ctxBar > 0) expect(layout.ctxBar).toBeGreaterThanOrEqual(8)
      if (layout.usageBar > 0) expect(layout.usageBar).toBeGreaterThanOrEqual(10)
    }
  })

  test('a gauge fills a cell by eighths and never vanishes', () => {
    expect(gauge(0)).toBe('▁')
    expect(gauge(0.46)).toBe('▄')
    expect(gauge(1)).toBe('█')
  })
})

describe('the cache ring', () => {
  test('drains by quarters from full after a request to empty once cold', () => {
    const clock = applyUsage(usage(90_000, 2_000), 0, '1h')
    expect(pie(cacheLeft(clock, 0))).toBe('●')
    expect(pie(cacheLeft(clock, 15 * MINUTE))).toBe('◕')
    expect(pie(cacheLeft(clock, 30 * MINUTE))).toBe('◑')
    expect(pie(cacheLeft(clock, 45 * MINUTE))).toBe('◔')
    expect(pie(cacheLeft(clock, 60 * MINUTE))).toBe('○')
    expect(cacheLeft(emptyClock('1h'), 0)).toBe(0)
  })
})

describe('the desktop strip', () => {
  test('what is used is a band in its theme colours, the free space and the buffer a thinner line', () => {
    const svg = stripSvg([
      { kind: 'used', color: 'permission', cells: 6 },
      { kind: 'free', color: 'inactive', cells: 3 },
      { kind: 'buffer', color: 'warning', cells: 1 },
    ])
    expect(svg).toContain('viewBox="0 0 10 4"')
    expect(svg).toContain('<rect x="0" y="0" width="6" height="4" fill="#b1b9f9"/>')
    expect(svg).toContain('<rect x="6" y="1" width="3" height="2" fill="#3b3b42"/>')
    expect(svg).toContain('<rect x="9" y="1" width="1" height="2" fill="#e0a33a"/>')
  })

  test('a colour the theme table does not know draws dim', () => {
    expect(stripSvg([{ kind: 'used', color: 'diffAdded', cells: 1 }])).toContain('fill="#8b8b93"')
  })
})
