import { describe, expect, test } from 'claude-code/testing'

import {
  applyUsage,
  emptyClock,
  formatRemaining,
  formatTokens,
  formatUntil,
  isRecache,
  layoutLine,
  stackedBar,
  warmth,
} from '../hooks/model'

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

  test('remaining time is minutes from ten up, m:ss below', () => {
    expect(formatRemaining(47 * MINUTE)).toBe('47m')
    expect(formatRemaining(9 * MINUTE + 5_000)).toBe('9:05')
    expect(formatRemaining(-1)).toBe('0:00')
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

  test('the cells always add up to the width', () => {
    for (const width of [8, 13, 31, 48]) {
      expect(stackedBar(view, 190_000, width).reduce((sum, s) => sum + s.cells, 0)).toBe(width)
    }
  })
})

describe('the line layout', () => {
  const windows = [
    { label: '5h', percent: 46, reset: '2h14m' },
    { label: '7d', percent: 21, reset: '3d' },
  ]
  const ctx = ['84k/200k', '84k']
  const HEAD = 5

  /** The columns a layout draws, as the band lays it out with one-cell gaps. */
  const drawnWidth = (layout: ReturnType<typeof layoutLine>): number =>
    HEAD +
    3 +
    'ctx '.length +
    (layout.ctxBar > 0 ? layout.ctxBar + 1 : 0) +
    layout.ctxText.length +
    windows
      .slice(0, layout.windows)
      .reduce(
        (sum, w) =>
          sum +
          3 +
          w.label.length +
          1 +
          (layout.style === 'percent' ? 0 : layout.usageBar + 1) +
          `${w.percent}%`.length +
          (layout.style === 'full' ? 1 + (w.reset?.length ?? 0) : 0),
        0,
      )

  test('the bars split what the text leaves, half to the context', () => {
    const layout = layoutLine(140, HEAD, ctx, windows)
    expect(layout).toMatchObject({ ctxText: '84k/200k', style: 'full', windows: 2, usageBar: 22, ctxBar: 46 })
  })

  test('the line fills its columns exactly', () => {
    for (const columns of [70, 90, 110, 140, 200]) {
      expect(drawnWidth(layoutLine(columns, HEAD, ctx, windows))).toBe(columns)
    }
  })

  test('narrower lines drop the window size, then the reset times, then the usage bars, then windows', () => {
    expect(layoutLine(66, HEAD, ctx, windows)).toMatchObject({ ctxText: '84k', style: 'full', windows: 2 })
    expect(layoutLine(58, HEAD, ctx, windows)).toMatchObject({ style: 'bar', windows: 2 })
    expect(layoutLine(45, HEAD, ctx, windows)).toMatchObject({ style: 'percent', windows: 2, usageBar: 0 })
    expect(layoutLine(38, HEAD, ctx, windows).windows).toBeLessThan(2)
  })

  test('the context keeps its token count however narrow', () => {
    expect(layoutLine(20, HEAD, ctx, windows).ctxText).toBe('84k')
  })

  test('bars never go below their minimum', () => {
    for (let columns = 30; columns <= 160; columns++) {
      const layout = layoutLine(columns, HEAD, ctx, windows)
      if (layout.ctxBar > 0) expect(layout.ctxBar).toBeGreaterThanOrEqual(8)
      if (layout.style !== 'percent' && layout.windows > 0) expect(layout.usageBar).toBeGreaterThanOrEqual(5)
    }
  })
})
