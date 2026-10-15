import type { Effort, HandoffAfter } from '../../types'
import { type ThemeName, THEMES } from '../theme'
import { EFFORTS } from './constants'

/** The plugin's settings, as read from its options. */
export type JudgeConfig = {
  /** A skill or slash command that writes the handoff instead of the built-in prompt, e.g. "session-handoff". */
  handoffSkill: string
  /** What follows the handoff: clear and carry on, clear and wait, or keep the chat and copy the handoff. The handoff
   *  bar opens on the choice made last; this is the first one. */
  handoffAfter: HandoffAfter
  /** The effort slider, -2 (cheaper) to 2 (smarter): tips the judge's close calls that way. */
  bias: number
  /** Auto never goes below this effort. */
  floor: Effort
  /** Auto never goes above this effort. */
  ceiling: Effort
  /** What the person switched off: the footer's handoff button and any of the alert bands. */
  hide: Hideable[]
  /** The swamp band shows once the context fills this share of the window, in percent. */
  swampAt: number
  /** default: the dashboard band above the prompt; minimal: the footer's small buttons and no band. */
  layout: 'default' | 'minimal'
  /** Who writes a compaction's summary: Haiku 5.5 (the default, a fraction of the price) or the chat's own model. */
  compactWith: 'haiku' | 'session'
  /** advised: the footer slot is Compact until Haiku advises a handoff. always: it is always the Hand off button. */
  handoffButton: 'advised' | 'always'
  /** on: every subagent the chat sends off gets an effort picked by the judge before it starts. */
  subagents: 'on' | 'off'
  /** on (with subagents on): the judge also picks the model of each subagent, never above the one it was given. */
  subagentModel: 'on' | 'off'
  /** on: the judge's picks replace the model and effort a subagent's definition sets. off: the definition's stay. */
  overrideDefinitions: 'on' | 'off'
  /** With Auto for model off, when the judge names another model. on (Hold): a typed prompt waits for Switch or Keep.
   *  off (Show): the prompt goes on and the offer stays above it. never (Off): no offer. */
  holdOffer: 'on' | 'off' | 'never'
  /** The accent colour of everything context-lens draws: the brand violet, Claude orange or cherry-blossom rose. */
  theme: ThemeName
}

/** The swamp thresholds the settings offer, in percent of the context window. */
export const SWAMP_STEPS = [10, 20, 30, 40, 50, 60, 70, 80] as const

/** The parts of context-lens a person can switch off: the Hand off button, the cache timer, the judge's reason line and
 * the context (swamp), running-hot (hot) and cold-cache alerts. The Context card switches off the button and the context
 * alert, the Look card the rest; the judge-down alert always shows. Each alert also has its own ✕. */
export const HIDEABLE = ['handoff', 'timer', 'reason', 'swamp', 'hot', 'cold'] as const
export type Hideable = (typeof HIDEABLE)[number]
// What the app passed to register, so settings kept in the store can be laid over it at session start.
export let pluginOptions: Record<string, unknown> = {}
export const setPluginOptions = (value: typeof pluginOptions) => {
  pluginOptions = value
}
export let config: JudgeConfig = {
  handoffSkill: '',
  handoffAfter: 'continue',
  bias: 0,
  floor: 'low',
  ceiling: 'max',
  hide: [],
  swampAt: 70,
  layout: 'default',
  compactWith: 'haiku',
  handoffButton: 'advised',
  subagents: 'off',
  subagentModel: 'off',
  overrideDefinitions: 'off',
  holdOffer: 'on',
  theme: 'violet',
}
export const setConfig = (value: typeof config) => {
  config = value
}

/** The settings as the engine hands them over (defaults filled in), cleaned to the shape the judge reads. */
export function readConfig(options: unknown): JudgeConfig {
  const o = (options ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    handoffSkill: str(o.handoffSkill).replace(/^\//, ''),
    handoffAfter: (['confirm', 'copy'] as const).find(a => a === str(o.handoffAfter)) ?? 'continue',
    bias: Math.max(-2, Math.min(2, Math.round(Number(str(o.effortBias)) || 0))),
    floor: EFFORTS.includes(str(o.effortFloor) as Effort) ? (str(o.effortFloor) as Effort) : 'low',
    ceiling: EFFORTS.includes(str(o.effortCeiling) as Effort) ? (str(o.effortCeiling) as Effort) : 'max',
    swampAt: SWAMP_STEPS.includes(Number(str(o.swampAt)) as (typeof SWAMP_STEPS)[number]) ? Number(str(o.swampAt)) : 70,
    layout: str(o.layout) === 'minimal' ? 'minimal' : 'default',
    compactWith: str(o.compactWith) === 'session' ? 'session' : 'haiku',
    handoffButton: str(o.handoffButton) === 'always' ? 'always' : 'advised',
    subagents: str(o.subagents) === 'on' ? 'on' : 'off',
    subagentModel: str(o.subagentModel) === 'on' ? 'on' : 'off',
    overrideDefinitions: str(o.overrideDefinitions) === 'on' ? 'on' : 'off',
    holdOffer: (['off', 'never'] as const).find(h => h === str(o.holdOffer)) ?? 'on',
    theme: THEMES.find(t => t === str(o.theme)) ?? 'violet',
    // Everything shows unless switched off; the judge's line too.
    hide: (o.hide === undefined ? '' : str(o.hide))
      .split(',')
      .map(part => part.trim())
      .filter((part): part is Hideable => (HIDEABLE as readonly string[]).includes(part)),
  }
}
