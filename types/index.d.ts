export type CacheTtl = '5m' | '1h'

/** One loop's prompt cache: when it was last touched and what the last request did with it. */
export type CacheClock = {
  ttl: CacheTtl
  /** Epoch ms of the last answered request; null before the first or after a compaction or /clear. */
  lastAt: number | null
  read: number
  written: number
  uncached: number
}

export type AgentCache = CacheClock & {
  id: string
  type: string
}

export type CategoryKind = 'used' | 'free' | 'buffer' | 'deferred'

export type ContextCategoryView = {
  name: string
  tokens: number
  color: string
  kind: CategoryKind
}

export type ContextView = {
  totalTokens: number
  maxTokens: number
  categories: ContextCategoryView[]
}

/** A rate-limit window as the last response reported it. */
export type RateLimit = {
  kind: string
  percentUsed: number
  resetsAt?: string
}

declare module 'claude-code' {
  interface PluginState {
    'context-lens': {
      main: CacheClock
      agents: AgentCache[]
      context: ContextView | null
      /** The last main-thread response's input tokens, as the API counted them. */
      liveTokens: number | null
      /** Whether the last main-thread request rewrote a cache that was still warm. */
      isRewritten: boolean
      rateLimits: RateLimit[]
      now: number
    }
  }
}
