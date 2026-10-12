export type ModelKey = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** What the prompts Auto steered cost, measured: tokens by kind, and per effort the prompts and their weighted cost. */
export type Spent = {
  prompts: number
  requests: number
  input: number
  write: number
  read: number
  out: number
  byEffort: Partial<Record<Effort, { prompts: number; cost: number }>>
  /** How often each judge decided, the time it took in all (ms), and its tokens. */
  judge: { haiku: number; ms: number; tokens: number }
  /** Prompts that ran on a cheaper model than the chat's, and how many of those the person then redid. */
  moved: number
  redone: number
  /** Subagents the judge picked an effort for: how many per effort, their requests, and what those cost (weighted). */
  helpers: { runs: Partial<Record<Effort, number>>; requests: number; cost: number }
}

/** What the next turn runs with, and who decided it. */
export type Pick = {
  model: ModelKey
  effort: Effort
  /** A few words on why, shown dim in the band. */
  why: string
  /** named: the person said the level in the prompt ("max effort"). */
  by: 'haiku' | 'manual' | 'named'
  /** How sure the judge was of the effort, 0-1, when it said. */
  sure?: number
  /** Haiku only: why a handoff would suit now (a few words), when it said it would. */
  handoff?: string
}

/** What follows a handoff: clear and carry on, clear and wait, or keep the chat and copy it. */
export type HandoffAfter = 'continue' | 'confirm' | 'copy'

/** A choice in the handoff bar: quick (a fork) or full (the person's skill), then what follows. */
export type HandoffChoice = { kind: 'quick' | 'full'; after: HandoffAfter }

/** The settings panel's unsaved changes, by field, as the settings store them (strings). */
export type SettingsDraft = {
  bias?: string
  floor?: string
  ceiling?: string
  handoffAfter?: string
  handoffSkill?: string
  /** Comma-separated parts switched off: handoff, cold, swamp, hot, down. */
  hide?: string
  swampAt?: string
  /** default (dashboard band) or minimal (footer buttons). */
  layout?: string
  /** haiku (Haiku 5.5 writes the compaction's summary) or session (the chat's own model). */
  compactWith?: string
  /** advised (the slot is Compact until Haiku advises a handoff) or always (the slot is the Handoff button). */
  handoffButton?: string
  /** on: a prompt the judge calls simple runs on a cheaper model than the chat's; off: always the chat's model. */
  modelAuto?: string
  /** on: each subagent gets an effort picked by the judge before it starts; off: it runs at the chat's effort. */
  helpers?: string
  /** violet (the brand), orange (Claude's) or rose (cherry blossom). */
  theme?: string
  appearance?: string
}

/** One step of the task the progress bar follows: a todo or a task. */
export type ProgressStep = {
  id: string
  /** What the step is ("Run the tests"). */
  label: string
  /** The step while it runs ("Running the tests"). */
  doing: string
  status: 'pending' | 'in_progress' | 'completed'
}

/** The progress bar's state: where the task is, and its steps. */
export type Progress = {
  phase: 'planning' | 'working' | 'asking' | 'paused' | 'done'
  steps: ProgressStep[]
}

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
      /** Auto on effort: every prompt is judged and its effort applied. */
      isAuto: boolean
      /** The last change Auto made to the effort, shown for a moment as "Low → High". */
      switched: { from: Effort; to: Effort } | null
      /** What the prompts Auto steered cost this session, measured (see Spent). */
      saved: Spent
      /** The session runs a model where an effort change rewrites the prompt cache: Auto waits. */
      paused: boolean
      /** Whole minutes the prompt cache stays warm: null before the first response, 0 once cold. */
      cacheLeft: number | null
      /** What the cache countdown knows, kept here because a reload starts the module's own variables over. */
      cacheMemo: { expires: number; ttl: '5m' | '1h'; last?: number } | null
      /** A compaction started from the footer's Compact button is running. */
      isCompacting: boolean
      /** The compact bar is open, asking for an optional note. */
      compactAsk: boolean
      /** The cold band was closed until the cache goes cold again. */
      isColdHidden: boolean
      /** Why the picked judge is failing, or null. */
      judgeDown: string | null
      judgeTest: { ok: boolean | null; text: string } | null
      /** The reason the judge-down band was closed for. */
      judgeDownHidden: string | null
      /** The settings panel is open above the prompt. */
      settingsOpen: boolean
      settingsCard: 'effort' | 'judge' | 'handoff' | 'show' | null
      /** Changes made in the settings panel and not saved yet. */
      settingsDraft: SettingsDraft
      /** The user and plugin skills, read when the settings panel opens. */
      installedSkills: string[]
      /** The fullest usage window once past 80%, or null. */
      hot: { kind: string; percent: number; resetsAt: string | null } | null
      /** Percent at which the running-hot band was closed. */
      hotHidden: number | null
      /** Save mode until this time (ms), or null. */
      saveUntil: number | null
      /** Context tokens read per request once the chat is swamped, else null. */
      swamped: number | null
      /** Tokens at which the swamp band was closed; it returns once the context grows well past it. */
      swampHiddenAt: number | null
      /** Why Haiku thinks a handoff would suit now, shown with Handoff lit; null when it has no advice. */
      handoffAdvice: string | null
      /** The first-run setup is not done yet. */
      setupPending: boolean
      /** Where a handoff is: null idle, writing, or clearing and resending. */
      handoffStage: 'writing' | 'clearing' | null
      /** The handoff bar above the prompt, open with the choice shown in it, or null. */
      handoffPick: HandoffChoice | null
      /** The newest reply's text: the reply card hangs under its last block. */
      lastAnswer: string
      /** What the newest reply cost: tokens weighted by price over the main thread's requests, and its time. */
      lastTurn: { cost: number; ms: number } | null
      /** The handoff card under the newest reply, from the start of a handoff until the reply after it lands. */
      handoffCard: { kind: 'writing' | 'done' | 'copied'; full: boolean; at: number; seen: boolean } | null
      /** The setup guide's step, or null when it is closed. */
      setupStep: 'lean' | 'handoff' | 'look' | 'done' | null
      /** Choices made in the setup guide, saved together at Done or the cross. */
      setupDraft: SettingsDraft
      /** Auto on model: the judge may suggest another model (never switched without a yes). Off by default. */
      isAutoModel: boolean
      pick: Pick | null
      isJudging: boolean
      suggestion: ModelKey | null
      /** The effort the person last set outside the mod (the app's control, their /effort): what the app shows. */
      appEffort: string | null
      /** The model the session runs now, as the engine last reported it (start, a switch, a request). */
      model: ModelKey | null
      /** The task the progress bar follows, or null when there is none. */
      progress: Progress | null
      /** The step list the progress bar was closed for; a new list shows it again. */
      progressHidden: string | null
      /** Context lens: the main thread's prompt cache. */
      lensMain: CacheClock
      /** Context lens: each subagent's own prompt cache. */
      lensAgents: AgentCache[]
      /** Context lens: the context window by category. */
      lensContext: ContextView | null
      /** Context lens: the last main-thread response's input tokens, as the API counted them. */
      lensLive: number | null
      /** Context lens: whether the last main-thread request rewrote a cache that was still warm. */
      lensRewritten: boolean
      /** Context lens: the rate-limit windows as the last response reported them. */
      lensLimits: RateLimit[]
      /** Context lens: the clock's last tick, so the countdown redraws. */
      lensNow: number
    }
  }
}
