import type { Effort, ModelKey, Spent, Steps } from '../../types'

// The ladders the two sliders walk, cheapest first.
export const MODELS: { key: ModelKey; label: string; long: string; id: string }[] = [
  { key: 'haiku', label: 'Haiku', long: 'Haiku 5.5', id: 'claude-haiku-5-5' },
  { key: 'sonnet', label: 'Sonnet', long: 'Sonnet 5.5', id: 'claude-sonnet-5-5' },
  { key: 'opus', label: 'Opus', long: 'Opus 5.5', id: 'claude-opus-5-5' },
  { key: 'fable', label: 'Fable', long: 'Fable 5.1', id: 'claude-fable-5-1' },
]
export const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
export const STEPS: Steps[] = ['one', 'few', 'many']
// What one token costs relative to an uncached input token, the same ratios on every Claude model. Measured over
// 80k requests of real Claude Code use, cache reads are about 76% of a session's cost, cache writes 16% and output 8%: effort
// mostly changes how many tool calls a prompt makes, not what one answer writes, so all four are counted.
// A write to the 1-hour cache costs twice the input price, to the 5-minute one 1.25 times.
export const WEIGHT = { input: 1, write: 1.25, write1h: 2, read: 0.1, out: 5 }
// Changing effort between two requests keeps the prompt cache on these models only. On Fable 5.1 and older Opus
// the next request rewrote 56-100% of the cache (measured), which costs more than any effort can save. Haiku 5.5 is
// not measured: it is taken to behave like Opus and Sonnet 5.5, and a rewrite of its cache is the cheapest there is.
export const cacheSafe = (modelId: string) => /(opus|sonnet|haiku)-5-5/.test(modelId)
// Haiku before 5.5 runs without an effort level.
export const takesEffort = (modelId: string) => !/haiku-[1-4]|3-(5-)?haiku/.test(modelId)
export const EFFORT_LABELS: Record<Effort, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max',
}
export const EMPTY_SPENT: Spent = {
  prompts: 0,
  requests: 0,
  input: 0,
  write: 0,
  writeHour: 0,
  read: 0,
  out: 0,
  byEffort: {},
  judge: { haiku: 0, ms: 0, tokens: 0 },
  subagents: { runs: {}, requests: 0, cost: 0 },
}
// The prompt cache lives this long after the last request read or wrote it. A response may say which lifetime its
// cache writes got (usage.cache_creation: ephemeral_1h / ephemeral_5m); until one does, 1 hour is assumed: 99% of
// the cache writes in 80k requests of real Claude Code use (289k of 292k) were 1 hour.
export const CACHE_TTL = { '5m': 5 * 60_000, '1h': 60 * 60_000 } as const
export const COMPACT_FADE_MS = 450
// The frost is drawn larger than the band and cut by it: wide enough for the right side, tall enough for any band.
export const FROST_WIDTH = 440
export const FROST_HEIGHT = 64

/** Context share from which the dashboard's Handoff button turns white: below it a handoff saves little. */
export const HANDOFF_LOUD_AT = 30
