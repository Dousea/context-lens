import {
  atom,
  type EngineInterface,
  type ModelForkResult,
  type ModelUsage,
  read,
  type Register,
  type RenderInput,
  update,
} from 'claude-code'

import type {
  AgentCache,
  CacheTtl,
  Effort,
  HandoffAfter,
  HandoffChoice,
  HotClosed,
  ModelKey,
  Pick,
  SettingsDraft,
  Spent,
  Steps,
} from '../types'
import { ART_COLUMNS, ART_FRAME_MS, ART_MIN_WIDTH, ART_ROWS, artFrame, type ArtKind, MOVING } from './art'
import { MARK_SVG } from './brand-mark'
import {
  config,
  type Hideable,
  type JudgeConfig,
  pluginOptions,
  readConfig,
  setConfig,
  setPluginOptions,
  type SettingsCard,
  SWAMP_STEPS,
} from './core/config'
import {
  CACHE_TTL,
  cacheSafe,
  COMPACT_FADE_MS,
  EFFORT_LABELS,
  EFFORTS,
  EMPTY_SPENT,
  FROST_HEIGHT,
  FROST_WIDTH,
  MODELS,
  STEPS,
  takesEffort,
  WEIGHT,
} from './core/constants'
import {
  drawsTimed,
  firstDrawLogged,
  lastRenderAt,
  lastRenderBranch,
  lastRenderError,
  lastRenderProps,
  loadedAt,
  loadedSession,
  probeLevel,
  renderCalls,
  renderLog,
  sessionStarted,
  setDrawsTimed,
  setFirstDrawLogged,
  setLastRenderAt,
  setLastRenderBranch,
  setLastRenderError,
  setLastRenderProps,
  setLoadedAt,
  setLoadedSession,
  setProbeLevel,
  setRenderCalls,
  setSessionStarted,
  writeRenderLog,
} from './core/debug'
import {
  envAgentCacheTtl,
  envCacheTtl,
  envEnable1h,
  envForce5m,
  envHome,
  envUserProfile,
  homeDir,
  noClaudeHint,
  ownVersion,
  pluginId,
  proof,
  readOwnVersion,
  runClaude,
} from './core/env'
import {
  ACCENT,
  applyTheme,
  BOG,
  BOG_BG,
  BOG_EDGE,
  BRAND_BG,
  BRAND_EDGE,
  CARD_CLOSE_HOVER,
  CARD_HOVER,
  CARD_HOVER_EDGE,
  DASH_BG,
  DASH_DIM,
  DASH_EDGE,
  DASH_HEAD,
  DASH_TEXT,
  DONE_ACCENT,
  DONE_BG,
  DONE_EDGE,
  EMBER,
  EMBER_BG,
  EMBER_EDGE,
  FLASH_COLOR,
  HOVER_BOX,
  ICE,
  ICE_BG,
  ICE_EDGE,
  RED,
  refreshAppearance,
  SLATE,
  SLATE_BG,
  SLATE_EDGE,
  UNINSTALL_RED,
  YELLOW,
} from './core/palette'
import {
  classicStart,
  engineEffort,
  lastRequest,
  lastTyped,
  pickCarried,
  setClassicStart,
  setEngineEffort,
  setLastRequest,
  setLastTyped,
  setPickCarried,
  setToldAboutEnter,
  setTurnBusy,
  toldAboutEnter,
  turnBusy,
} from './core/session'
import {
  applyUsage,
  bar,
  type BarSegment,
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
  toContextView,
  usageWindow,
  type Warmth,
  warmth,
} from './model'
import {
  autoSwitchSvg,
  binSvg,
  cacheClockSvg,
  enterSvg,
  GO_CELLS,
  GO_W,
  goPillSvg,
  handoffLook,
  handoffPillSvg,
  KIND_CELLS,
  KIND_H,
  KIND_W,
  kindFlipAt,
  kindSwitchSvg,
  ringSvg,
  rowIconSvg,
  setKindFlipAt,
  settingsSvg,
} from './svg/controls'
import {
  AUTO_GLOW_H,
  AUTO_GLOW_MS,
  AUTO_GLOW_W,
  autoGlowSvg,
  COLD_GLOW_MS,
  coldGlowSvg,
  compactFadeSvg,
  GLOW_H,
  GLOW_W,
  HANDOFF_BOX_AT,
  HANDOFF_PILL_H,
  HANDOFF_PILL_W,
  handoffGlowStep,
  handoffGlowSvg,
  inPhase,
  JUDGE_FADE_MS,
  JUDGE_RISE_MS,
  JUDGE_STEP_MS,
  judgeGlowAt,
} from './svg/glows'
import {
  BRAND_SVG,
  DASH_MARK_OFF,
  DASH_SVG,
  DONE_MARK_SVG,
  DONE_SVG,
  DOWN_SVG,
  EMBER_SVG,
  FROST_SVG,
  HANDOFF_SVG,
  INTRO_SVG,
  SETTINGS_MARK,
  SETTINGS_TITLE,
  SWAMP_SVG,
} from './svg/scenes'
import { themedEls, type ThemeName, THEMES } from './theme'
import { PILL_H, THINK_W, thinkingSvg } from './thinking'

export { HIDEABLE, type Hideable, type JudgeConfig, readConfig, SWAMP_STEPS } from './core/config'
export { cacheSafe, EFFORTS, MODELS, takesEffort } from './core/constants'
export { claudeCandidates, noClaudeHint } from './core/env'
export {
  autoSwitchSvg,
  cacheClockSvg,
  enterSvg,
  handoffLook,
  handoffPillSvg,
  kindSwitchSvg,
  ringSvg,
  rowIconSvg,
  settingsSvg,
} from './svg/controls'
export {
  autoGlowSvg,
  coldGlowSvg,
  easeInOut,
  handoffGlowStep,
  handoffGlowSvg,
  inPhase,
  JUDGE_FADE_MS,
  JUDGE_PIECE_MS,
  JUDGE_RISE_MS,
  JUDGE_STEP_MS,
  judgeBrightnessAt,
  judgeGlowAt,
  judgeGlowSvg,
} from './svg/glows'
export { INTRO_SVG } from './svg/scenes'

// Auto is two switches. `isAuto` is effort (the name stays: it is what the store and state hold);
// `isAutoModel` lets the judge suggest another model and starts off.
const isAuto = atom({ plugin: 'context-lens', key: 'isAuto' } as const, true)
const isAutoModel = atom({ plugin: 'context-lens', key: 'isAutoModel' } as const, false)
const pick = atom({ plugin: 'context-lens', key: 'pick' } as const, null)
const isJudging = atom({ plugin: 'context-lens', key: 'isJudging' } as const, false)
const suggestion = atom({ plugin: 'context-lens', key: 'suggestion' } as const, null)
const appEffort = atom({ plugin: 'context-lens', key: 'appEffort' } as const, null)
const model = atom({ plugin: 'context-lens', key: 'model' } as const, null)
// The last change Auto made to the effort, shown for a moment as "Low → High" and then cleared.
const switched = atom({ plugin: 'context-lens', key: 'switched' } as const, null)
// What the prompts Auto steered cost this session, measured, and what judging them took.
const saved = atom({ plugin: 'context-lens', key: 'saved' } as const, EMPTY_SPENT)
// True while the session runs a model where Auto must not change effort (see cacheSafe).
const paused = atom({ plugin: 'context-lens', key: 'paused' } as const, false)
// How long the main conversation's prompt cache stays warm, in whole minutes left: null before the first response,
// 0 once it has gone cold. Updated only when the minute changes, so the footer redraws once a minute at most.
const cacheLeft = atom({ plugin: 'context-lens', key: 'cacheLeft' } as const, null)
const cacheMemo = atom({ plugin: 'context-lens', key: 'cacheMemo' } as const, null)
const isCompacting = atom({ plugin: 'context-lens', key: 'isCompacting' } as const, false)
// The compact bar: open after Compact is pressed, with a field for what the summary should keep.
const compactAsk = atom({ plugin: 'context-lens', key: 'compactAsk' } as const, false)
// Where a handoff is: null idle, writing (the handoff turn runs), clearing (clear and resend).
const handoffStage = atom({ plugin: 'context-lens', key: 'handoffStage' } as const, null)
// The handoff bar above the prompt, open with the choice shown in it, or null.
const handoffPick = atom({ plugin: 'context-lens', key: 'handoffPick' } as const, null)
// The context is swamped: tokens read per request, or null below the line. Drives the swamp band.
const swamped = atom({ plugin: 'context-lens', key: 'swamped' } as const, null)
// Why Haiku thinks a handoff would suit now, or null. It lights Handoff and says why; there is no percent threshold.
const handoffAdvice = atom({ plugin: 'context-lens', key: 'handoffAdvice' } as const, null)
const handoffCard = atom({ plugin: 'context-lens', key: 'handoffCard' } as const, null)

// The newest reply's text, so the warning card goes under its last block and nowhere else.
const lastAnswer = atom({ plugin: 'context-lens', key: 'lastAnswer' } as const, '')
// What each reply's footer says (effort, model, cost), by the reply's duration in ms: written when the turn ends, so a later
// effort or model change leaves the older footers as they were.
const turnLines = atom({ plugin: 'context-lens', key: 'turnLines' } as const, {})
// The swamp band was closed at this many tokens; it comes back once the context has grown well past it.
const swampHiddenAt = atom({ plugin: 'context-lens', key: 'swampHiddenAt' } as const, null)
// The first-run setup is not done: the footer offers "Setup".
const setupPending = atom({ plugin: 'context-lens', key: 'setupPending' } as const, false)
// The context-lens settings panel is open above the prompt.
const settingsOpen = atom({ plugin: 'context-lens', key: 'settingsOpen' } as const, false)
// The user and plugin skills, read when the settings panel opens.
const installedSkills = atom({ plugin: 'context-lens', key: 'installedSkills' } as const, [])
// What was changed in the panel and not saved yet, by field; Save applies it all, the cross drops it.
const settingsDraft = atom({ plugin: 'context-lens', key: 'settingsDraft' } as const, {})
// Why the judge is failing, or null when it works.
const judgeDown = atom({ plugin: 'context-lens', key: 'judgeDown' } as const, null)
const settingsCard = atom({ plugin: 'context-lens', key: 'settingsCard' } as const, null)
// The judge-down band was closed for this reason; a new reason shows it again.
const judgeDownHidden = atom({ plugin: 'context-lens', key: 'judgeDownHidden' } as const, null)
// A usage limit is close: which window, how much is used, when it resets. Null below the line.
const hot = atom({ plugin: 'context-lens', key: 'hot' } as const, null)
// The running-hot band closed with its cross: in which window and how full. Kept in the store too, so a new chat keeps it closed.
const hotHidden = atom({ plugin: 'context-lens', key: 'hotHidden' } as const, null as HotClosed | null)
// Save mode: Auto picks at most medium until this time (ms), when the limit resets.
const saveUntil = atom({ plugin: 'context-lens', key: 'saveUntil' } as const, null)
// The person closed the cold band; it comes back the next time the cache goes cold.
const isColdHidden = atom({ plugin: 'context-lens', key: 'isColdHidden' } as const, false)
// The setup guide above the prompt: which step it shows, or null when it is closed.
const setupStep = atom({ plugin: 'context-lens', key: 'setupStep' } as const, null)
// What was picked in the setup guide and not saved yet: it is saved in one go at Done or ✕. Each saved setting reloads
// the plugin, and the app says so in the chat, so a save per click filled the chat with notices.
const setupDraft = atom({ plugin: 'context-lens', key: 'setupDraft' } as const, {})

const lensMain = atom({ plugin: 'context-lens', key: 'lensMain' } as const, emptyClock('1h'))
const lensAgents = atom({ plugin: 'context-lens', key: 'lensAgents' } as const, [])
const lensContext = atom({ plugin: 'context-lens', key: 'lensContext' } as const, null)
const lensLiveTokens = atom({ plugin: 'context-lens', key: 'lensLive' } as const, null)
const lensRewritten = atom({ plugin: 'context-lens', key: 'lensRewritten' } as const, false)
const lensLimits = atom({ plugin: 'context-lens', key: 'lensLimits' } as const, [])
const lensNow = atom({ plugin: 'context-lens', key: 'lensNow' } as const, 0)
const SWITCHED_MS = 2500
const CACHE_TICK_MS = 15_000
// Shown minutes at or under these turn the countdown yellow, then red: grey while there is time, yellow at 20, red at 5.
const CACHE_YELLOW_MIN = 20
const CACHE_RED_MIN = 5
// What is typed in that field. Kept here, not in state: a write per key would redraw the bar under the cursor.
let compactNote = ''
// When the compact bar opened: its first half second fades the swamped band's colours out (see compactFadeSvg).
let compactOpenedAt = 0
// The handoff card above the prompt: shown from the start of a handoff, and once it lands ('done' in the
// cleared chat, 'copied'). It goes with the next message, its ✕, or HANDOFF_CARD_MS after it was set.
type HandoffCard = {
  kind: 'writing' | 'done' | 'copied' | 'compacting' | 'compacted'
  full: boolean
  at: number
  seen: boolean
}
// Kinds still under way: they stay until they land, with moving art. Compacting shares the card with the handoff.
const cardRunning = (kind: HandoffCard['kind']) => kind === 'writing' || kind === 'compacting'
// Kinds that landed well: the card turns green with a checkmark.
const cardLanded = (kind: HandoffCard['kind']) => kind === 'done' || kind === 'compacted'
const HANDOFF_CARD_MS = 2 * 60_000

async function setHandoffCard($: EngineInterface, kind: HandoffCard['kind'], full: boolean, seen = false) {
  const at = await $.clock.now()
  await update($, handoffAdvice, () => null)
  await update($, handoffCard, () => ({ kind, full, at, seen }))
  // Gone after a while even with no reply; a timer that dies with its request leaves the next reply to clear it.
  if (!cardRunning(kind)) {
    try {
      $.clock.after(HANDOFF_CARD_MS, () => void update($, handoffCard, card => (card && card.at === at ? null : card)))
    } catch {}
  }
}
const TURN_LINES_KEPT = 200
type TurnLine = { effort?: Effort; model?: ModelKey; cost?: number }
// The session's state ends with the process: the lines are kept in the store too, by session id (the transcript's name, which
// a --resume keeps), so a restarted or resumed chat still draws what each reply ran on. The newest sessions are kept.
const TURN_LINES_SESSIONS = 30
let storedTurnLines: { session: string; lines: Record<string, TurnLine> } | null = null

const withTurnLine = (lines: Record<string, TurnLine>, key: string, line: TurnLine) =>
  Object.fromEntries([
    ...Object.entries(lines)
      .filter(([k]) => k !== key)
      .slice(1 - TURN_LINES_KEPT),
    [key, line],
  ])

async function storedLinesOf($: EngineInterface): Promise<Record<string, TurnLine>> {
  const session = await $.session.id().catch(() => '')
  if (!session) return {}

  if (storedTurnLines?.session !== session) {
    const all = await $.store.get('turnLines').catch(() => undefined)
    const lines = all && typeof all === 'object' ? (all as Record<string, unknown>)[session] : undefined
    storedTurnLines = { session, lines: lines && typeof lines === 'object' ? (lines as Record<string, TurnLine>) : {} }
  }
  return storedTurnLines.lines
}

async function storeTurnLine($: EngineInterface, key: string, line: TurnLine) {
  const session = await $.session.id().catch(() => '')
  if (!session) return

  const lines = withTurnLine(await storedLinesOf($), key, line)
  const all = await $.store.get('turnLines').catch(() => undefined)
  const others = Object.entries(all && typeof all === 'object' ? all : {})
    .filter(([k]) => k !== session)
    .slice(1 - TURN_LINES_SESSIONS)

  await $.store.set('turnLines', Object.fromEntries([...others, [session, lines]]))
  storedTurnLines = { session, lines }
}
// The weighted tokens of the requests (the chat's and its subagents') since the prompt; kept in turnLines when the turn ends.
let turnCost = 0
// What the reply's last main-thread request ran on: the footer's model and effort.
let ranThisTurn: { model?: ModelKey; effort?: Effort } | null = null
/** The settings panel's parts: a card each on the overview, and what the part is for, said once it is open. */
const CARDS: readonly { id: SettingsCard; title: string; about: string }[] = [
  {
    id: 'auto',
    title: 'Auto',
    about: "How Auto picks. The slider tips the judge's close calls; Never below and Never above bound every pick.",
  },
  { id: 'subagents', title: 'Subagents', about: 'What the subagents the chat sends off run on.' },
  {
    id: 'context',
    title: 'Context',
    about: 'What happens as the chat fills up: the alert, compacting and the handoff.',
  },
  { id: 'look', title: 'Look', about: 'How context-lens looks and which parts of it show. Uninstall removes it.' },
]
const BIAS_WORDS = ['Cheapest', 'Cheaper', 'Balanced', 'Smarter', 'Smartest'] as const
const THEME_LABELS: Record<ThemeName, string> = { violet: 'Violet', orange: 'Claude orange', rose: 'Cherry blossom' }
// The dashboard's mark: its size, and its look with Auto off.
const DASH_MARK_SIZE = 18
/** How long a band's entrance runs: it is drawn only this long after the band appears, since every redraw of the band
 * (a choice, the minute tick) would replay it. */
const INTRO_MS = 1300
// The band last drawn above the prompt, and when it appeared (see introShows).
let introKind = ''
let introAt = 0
// How far the entrance on screen is, for introLayer.
let introElapsed = 0
// Set when a band replaces another, taken by the first draw of the new one.
let introFresh = false
/** Whether the band of `kind` is still in its entrance: true for INTRO_MS after it replaced another band. */
async function introShows($: EngineInterface, kind: string): Promise<boolean> {
  const now = await $.clock.now()
  if (kind !== introKind) {
    introKind = kind
    introAt = now
    introFresh = true
    $.clock.after(INTRO_MS + 100, () => $.ui.invalidate('ui.render'))
  }
  introElapsed = now - introAt
  return introElapsed < INTRO_MS
}
// The mark beside a card's title, sized to one line of text.
const TITLE_MARK_SIZE = 16

/** A card's title with the context-lens mark where the ✦ stood; the ✦ stays where the surface draws no images. */
function markTitle(
  els: { Box: unknown; Text: unknown; Svg?: unknown },
  key: string,
  color: string,
  title: string,
  mark = MARK_SVG,
) {
  const {
    Box: B,
    Text: T,
    Svg: S,
  } = els as unknown as {
    Box: (p: Record<string, unknown>) => unknown
    Text: (p: Record<string, unknown>) => unknown
    Svg?: (p: Record<string, unknown>) => unknown
  }
  if (!S)
    return (
      <T key={key} color={color} bold wrap="truncate">
        {title}
      </T>
    )
  return (
    <B key={key} flexDirection="row" alignItems="center" flexShrink={1} minWidth={0}>
      <B flexShrink={0} marginRight={1} alignItems="center">
        <S source={mark} alt="context-lens" width={TITLE_MARK_SIZE} height={TITLE_MARK_SIZE} />
      </B>
      <T color={color} bold wrap="truncate">
        {title.replace(/^✦ /, '')}
      </T>
    </B>
  )
}

/** The entrance layer (INTRO_SVG) in a band's own colours, or nothing once the entrance is over. */
function introLayer(
  els: { Box: unknown; Svg?: unknown },
  key: string,
  show: boolean,
  wash = '#8b6cff',
  light = '#b9a7ff',
) {
  if (!els.Svg || !show) return null
  const { Box: B, Svg: S } = els as unknown as {
    Box: (p: Record<string, unknown>) => unknown
    Svg: (p: Record<string, unknown>) => unknown
  }
  return (
    <B key={`${key}-intro`} position="absolute" top={-1} left={0} right={0} bottom={-1}>
      <S
        source={inPhase(INTRO_SVG.replace('#8b6cff', wash).replace('#b9a7ff', light), introElapsed)}
        alt=""
        width={1600}
        height={240}
      />
    </B>
  )
}

const JUDGE_SYSTEM = `You choose which Claude model and reasoning effort an agentic assistant (it reads files, runs tools and edits things, not only code) should use for the user's next message. Pick the cheapest pair that will still do the job well.

Models, cheapest first:
- haiku: quick questions, lookups, renames, small edits in one or two files, summaries, chit-chat. It can read files and run tools; pick it for any small, well-defined job.
- sonnet: normal coding, edits across a few files, explanations, writing.
- opus: hard debugging, architecture, large refactors, careful reviews.
- fable: the hardest long-horizon or research-level work.

Effort: low for quick answers, medium for normal work, high for hard problems, xhigh or max only for very hard ones.

Effort is relative to the model in use ("Current" names it): a stronger model needs less effort for the same job. Opus at medium does about what Sonnet does at high, and Fable is stronger again. So for one and the same task pick one step lower on Opus than on Sonnet, and lower still on Fable; on Sonnet, go one step higher for hard work than you would on Opus.

Judge the SCOPE and the amount of work, not whether it is code. A short message can ask for a lot: "go through my whole drive and clean it up", "review the entire repo", "migrate everything" are big, multi-step, tool-heavy jobs where mistakes are costly: never low, usually high. Low is only for answers that need no tools and no planning.

If the message answers a question in the assistant's last reply (picks an option, says which one, confirms a plan), judge only the work that answer starts, as the reply describes it, not the length of the answer and not the work done before the question: "B" can mean "build the complicated section B" (high), while "yes" or "no" to one small action ("should I archive this?", "delete the old ones too?") is low, and picking a value for one setting (a log level, a colour, a font) is low. But picking which way to build something ("option 1", "the same shapes", "B") starts that build: judge the build. Approving a whole plan or several steps takes the effort of that plan. A plain "yes", "ok" or "do it" after "Is that OK? Then I'll build X" or "Should I build X?" approves building X: judge X, not the word.

A message that pushes back on, corrects or adds to a plan or claim under discussion continues that work: keep at least the effort that work had, never drop to low for it. Thanks, praise or a closing remark with no new request is low. A question about how to do something, or about effort itself, that needs no tools is low.

If the person asks for deep thought ("think hard", "ultrathink", "be thorough"), pick at least high; if they ask for a quick answer, pick low.

If the message is a short follow-up to ongoing work ("yes", "go", "ok", "continue", or the same in any language), keep the current pair. Thanks or praise with no new request ("ok perfect, thanks") is not a follow-up: it is low and one step.

Steps: how many tool calls and replies the task takes. one: a single command, lookup or plain answer, even when the command acts on several items ("delete those branches", "rename it in this file"). few: a handful of reads or edits. many: a broad search, many files or long multi-step work.

Reply with JSON only: {"model":"haiku|sonnet|opus|fable","effort":"low|medium|high|xhigh|max","steps":"one|few|many","sure":0.0-1.0 how sure you are of the effort,"why":"at most 6 words, in the user's language"}`

/** Reads `{ model, effort, why }` out of a reply, or nothing when it doesn't hold one. */
export function parseVerdict(
  text: string,
): { model: ModelKey; effort: Effort; why: string; sure?: number; steps?: Steps; handoff?: string } | undefined {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(match[0])
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null) return undefined
  const { model, effort, why, sure, steps, handoff } = raw as Record<string, unknown>
  const key = typeof model === 'string' ? model.toLowerCase() : ''
  const found = MODELS.find(m => key === m.key || key === m.id || key.includes(m.key))
  if (!found || !EFFORTS.includes(effort as Effort)) return undefined
  const how = typeof sure === 'number' && sure >= 0 && sure <= 1 ? { sure } : {}
  // Only a reason counts: "handoff":"" or false is no advice.
  const advice = typeof handoff === 'string' && handoff.trim() ? { handoff: handoff.trim().slice(0, 70) } : {}
  return {
    model: found.key,
    effort: effort as Effort,
    why: typeof why === 'string' ? why.slice(0, 60) : '',
    ...how,
    ...(STEPS.includes(steps as Steps) ? { steps: steps as Steps } : {}),
    ...advice,
  }
}

/**
 * What the judge reads besides the new message: the person's previous message and the assistant's last reply. The
 * reply is kept long and from its end, where a question with options ("A, B or C?") sits: "B" alone looks like a
 * small job, the reply says what B sets off.
 */
async function recentContext($: EngineInterface): Promise<string> {
  return contextFrom(await $.session.messages())
}

/** The context text from the conversation so far: the last user message, short, and the assistant's last reply's end. */
export function contextFrom(messages: readonly { role: string; text: string }[]): string {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const lastAssistant = lastAssistantText(messages)
  return [
    lastUser ? `user: ${lastUser.text.slice(0, 400)}` : '',
    lastAssistant ? `assistant: ${lastAssistant.slice(-2000)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** The assistant's last reply, or nothing. */
function lastAssistantText(messages: readonly { role: string; text: string }[]): string {
  return [...messages].reverse().find(m => m.role === 'assistant' && m.text.trim())?.text ?? ''
}

/** The skill or custom command a typed "/name args" runs, or nothing for the app's own commands and context-lens's. */
async function typedSkill(
  $: EngineInterface,
  text: string,
): Promise<{ name: string; description: string } | undefined> {
  const name = text.trim().slice(1).split(/\s+/)[0]
  if (!name) return undefined
  const found = (await $.command.list().catch(() => [])).find(c => c.name === name)
  if (!found || !['user', 'plugin', 'mcp'].includes(found.source) || found.plugin === 'context-lens') return undefined
  return { name, description: found.description ?? '' }
}

const LEVEL_WORD = '(low|medium|high|xhigh|x-high|extra[- ]high|max|maximum)'
const NAMED_LEVEL = new RegExp(
  `\\b${LEVEL_WORD}\\s+effort\\b|\\beffort(?:\\s+level)?\\s*(?:[:=]|to|at|of|on)?\\s*${LEVEL_WORD}\\b|\\bxhigh\\b`,
  'gi',
)
const LEVEL_OF: Record<string, Effort> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  'x-high': 'xhigh',
  'extra high': 'xhigh',
  'extra-high': 'xhigh',
  max: 'max',
  maximum: 'max',
}

/**
 * The level a prompt asks for by name ("max effort", "effort: high", "xhigh"), or nothing. The word effort must sit
 * beside the level, so "a medium sized image" names nothing, and "don't use max effort" is a no. A named level runs
 * without the judge, which would also call prompts that only describe hard work "named".
 */
export function namedEffort(text: string): Effort | undefined {
  for (const m of text.matchAll(NAMED_LEVEL)) {
    const before = text.slice(Math.max(0, m.index - 20), m.index).toLowerCase()
    if (/\b(not|no|don'?t|never|without|instead of)\b/.test(before)) continue
    return LEVEL_OF[(m[1] ?? m[2] ?? 'xhigh').toLowerCase().replace(/\s+/, ' ')]
  }
  return undefined
}

/** A short follow-up such as "go", "ok", "yes", "continue": two words and a dozen characters at most. */
export function isFollowUp(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && t.length <= 12 && t.split(/\s+/).length <= 2
}

/**
 * Whether the assistant's last reply ended on a question ("Should I archive it?", "A, B or C?"). A short message
 * after one answers it, and the answer can start a small or a big job, so it goes to the judge instead of keeping
 * the effort.
 */
export function endsOnQuestion(context: string): boolean {
  const reply = context.split('\nassistant: ').pop() ?? ''
  return context.includes('assistant: ') && reply.slice(-400).includes('?')
}

/** The message as the judge reads it: images and files it carries are named, since the judge sees only text. */
export function withAttachments(text: string, attachments?: readonly { type: string }[]): string {
  if (!attachments?.length) return text
  const counts = new Map<string, number>()
  for (const a of attachments) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  const said = [...counts].map(([type, n]) => `${n} ${type}${n > 1 ? 's' : ''}`).join(', ')
  return `${text}

[The message comes with ${said} to look at.]`
}

/** The message as the judge reads it when it was typed while a task was still running. */
export function withMidTurn(text: string, effort: Effort): string {
  return `${text}

[Sent while the assistant was still working on the last task at ${effort} effort. If it adds to, corrects or steers that task, keep ${effort}; judge it on its own only if it is a separate new request.]`
}
// A lower verdict for a message typed mid-turn, applied when that turn ends (see prompt.submit).
let heldPick: Pick | null = null

/** A short follow-up that keeps the current effort: "go" between two steps, not an answer to a question. */
export function keepsEffort(message: string, context: string): boolean {
  return isFollowUp(message) && !endsOnQuestion(context)
}

type Judged = { verdict?: Pick; tokens: number }

/** Why a judge the person picked could not answer, in words: what a status code means for them. */
export function judgeFailure(name: string, status: number | 'timeout'): string {
  if (status === 'timeout') return `${name} did not answer in time`
  if (status === 401 || status === 403) return `${name} was refused (${status}): check your Claude login`
  if (status === 402) return `${name} is out of credits (${status})`
  if (status === 429) return `${name} is rate limited (${status})`
  return `${name} failed (${status})`
}
const warned = new Set<string>()
/** Tells the person once per session and reason that the judge failed; the effort stays as it is. */
function warnJudge($: EngineInterface, reason: string) {
  void proof($, `judge fallback: ${reason}`)
  void update($, judgeDown, () => reason).then(() => $.ui.invalidate('ui.render'))
  if (warned.has(reason)) return
  warned.add(reason)
  $.ui.toast(`context-lens: ${reason}. The effort stays as it is.`)
}

/** The text the judge reads: the current pair, the last turns and the next message. */
function judgeQuestion(prompt: string, current: Pick | null, context: string): string {
  return [
    current ? `Current: ${current.model} / ${current.effort}` : 'Current: none',
    context ? `Recent conversation:\n${context}` : '',
    `Next message:\n${prompt.slice(0, 2000)}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Haiku judges, through the session's own login: no key, nothing else to set up. Never throws. */
async function judge($: EngineInterface, prompt: string, current: Pick | null): Promise<Judged> {
  const context = await recentContext($).catch(() => '')
  return askHaiku($, prompt, current, context)
}

/**
 * Haiku 5.5 by name: Claude Code builds that predate it map the plain alias to Haiku 4.5, at ten times the price.
 * Where 5.5 does not answer, the alias stands in.
 */
async function completeWithHaiku(
  $: EngineInterface,
  request: Omit<Parameters<EngineInterface['model']['complete']>[0], 'model'>,
) {
  const named = await $.model.complete({ ...request, model: COMPACT_MODEL })
  return named.isAnswered ? named : $.model.complete({ ...request, model: 'haiku' })
}

/** Haiku through the session's own login: the judge, and it needs no key. */
async function askHaiku($: EngineInterface, prompt: string, current: Pick | null, context: string): Promise<Judged> {
  const used =
    lastContext && lastContext.window ? `Context used: ${Math.round(lastContext.percent)}% of the window` : ''
  const asked = [judgeQuestion(prompt, current, context), used].filter(Boolean).join('\n\n')
  const r = await completeWithHaiku($, {
    system: JUDGE_SYSTEM,
    prompt: asked,
    maxTokens: 160,
    effort: 'low',
    timeoutMs: 6000,
  })
  const verdict = r.isAnswered ? parseVerdict(r.text) : undefined
  const tokens = r.isAnswered && r.usage ? r.usage.input_tokens + r.usage.output_tokens : 0
  // The API refused or could not be reached (a login problem, no credits, a rate limit): say so once, in the
  // judge-down band. An abort (Esc, the timeout) or an empty reply is no failure of the judge. An answer takes the band away.
  if (!r.isAnswered && r.reason === 'api-error')
    warnJudge($, r.status === null ? 'Haiku could not be reached' : judgeFailure('Haiku', r.status))
  else if (r.isAnswered && verdict && (await read($, judgeDown))) await update($, judgeDown, () => null)
  return { verdict: verdict && { ...verdict, by: 'haiku' }, tokens }
}

// Whether a fresh chat would now serve better than carrying on: Haiku's call, whatever judge picks the effort. It runs
// from HANDOFF_CHECK_FROM percent of context, every HANDOFF_CHECK_EVERY messages, so it costs a cent now and then. It
// reads more than the effort judge: what the chat was for, the trail of topics, the last turns, the context and the cache.
const HANDOFF_CHECK_FROM = 30
const HANDOFF_CHECK_EVERY = 2
const HANDOFF_SYSTEM = `You decide whether the person should hand off now: start a fresh chat that carries over a short summary, instead of carrying on in this one. You are shown what the chat was for, the trail of what the person asked, the last turns, the next message, how full the context is and whether the cache is cold.

Say yes only for a clear reason: the task just finished and the next message is something else, the topic has changed so the old context is dead weight, the chat keeps going in circles on the same problem, or a long chat now holds so much unrelated history that a clean start would be sharper. A normal next step of the same work is never a reason, a long chat by itself is not one, and neither is a high context share when the work is going well. When unsure, say no: a wrong yes costs the person more than a missed one.

Reply with JSON only: {"handoff":"reason of at most 8 words, in the person's language"} for yes, or {"handoff":null} for no.`

/** What the handoff check reads: the chat's purpose, a trail of the person's messages, the last reply's end. */
export function handoffEvidence(
  messages: readonly { role: string; text: string }[],
  next: string,
  percent: number,
  cold: boolean,
): string {
  const asked = messages.filter(m => m.role === 'user' && m.text.trim())
  const first = asked[0]?.text.slice(0, 500) ?? ''
  const trail = asked.slice(-8, -1).map(m => `- ${m.text.slice(0, 160).replace(/\s+/g, ' ')}`)
  const reply = lastAssistantText(messages).slice(-700)
  return [
    first ? `What the chat was for (first message):\n${first}` : '',
    trail.length ? `Trail of earlier messages:\n${trail.join('\n')}` : '',
    reply ? `The assistant's last reply (its end):\n${reply}` : '',
    `Next message:\n${next.slice(0, 600)}`,
    `Context used: ${Math.round(percent)}% of the window; ${asked.length} messages so far; the cache is ${cold ? 'cold' : 'warm'}.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Reads Haiku's answer: a reason, or null for no (anything unreadable is no). */
export function parseHandoffAnswer(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const { handoff } = JSON.parse(match[0]) as { handoff?: unknown }
    return typeof handoff === 'string' && handoff.trim() ? handoff.trim().slice(0, 70) : null
  } catch {
    return null
  }
}

let promptsSinceHandoffCheck = 0
/** Called with each message the person sends. Sets or clears the advice; never throws, never holds the message. */
async function checkHandoff($: EngineInterface, next: string) {
  const percent = lastContext?.percent ?? 0
  if (percent < HANDOFF_CHECK_FROM) {
    promptsSinceHandoffCheck = 0
    if ((await read($, handoffAdvice)) !== null) {
      await update($, handoffAdvice, () => null)
      $.ui.invalidate('ui.render')
    }
    return
  }
  promptsSinceHandoffCheck++
  if (promptsSinceHandoffCheck < HANDOFF_CHECK_EVERY) return
  promptsSinceHandoffCheck = 0
  try {
    const evidence = handoffEvidence(
      await $.session.messages(),
      next,
      percent,
      (await cacheMinutes($)) === 0 && cacheExpires > 0,
    )
    const r = await completeWithHaiku($, {
      system: HANDOFF_SYSTEM,
      prompt: evidence,
      maxTokens: 60,
      effort: 'low',
      timeoutMs: 8000,
    })
    if (!r.isAnswered) return
    const reason = parseHandoffAnswer(r.text)
    void proof($, `handoff check at ${Math.round(percent)}%: ${reason ?? 'no'}`)
    if (reason !== (await read($, handoffAdvice))) {
      await update($, handoffAdvice, () => reason)
      $.ui.invalidate('ui.render')
    }
  } catch {
    // A failed check changes nothing.
  }
}

// The judge benchmark (/context-lens bench): labelled prompts in bench/judge-cases.json, each run through the same
// pipeline a real prompt takes (a short follow-up keeps the current effort, anything else goes to a judge).
export type BenchCase = {
  id: string
  kind: string
  holdout?: boolean
  current: Pick
  context?: string
  message: string
  ok: Effort[]
  /** Every task size a careful person would accept, for the cases labelled with one. */
  steps?: Steps[]
}
export type BenchAnswer = {
  id: string
  judge: string
  effort?: Effort
  by?: string
  why?: string
  sure?: number
  model?: ModelKey
  steps?: Steps
  ms: number
  tokens: number
}

/** Where an answer lands against the labels: right, too low (risks quality), too high (wastes), or no answer. */
export function benchGrade(c: BenchCase, effort: Effort | undefined): 'hit' | 'under' | 'over' | 'none' {
  if (!effort) return 'none'
  if (c.ok.includes(effort)) return 'hit'
  const rank = EFFORTS.indexOf(effort)
  return rank < Math.min(...c.ok.map(e => EFFORTS.indexOf(e))) ? 'under' : 'over'
}

/** Where a task size lands against the labels: right, too few (keeps work in the chat), too many (hands off a small task). */
export function stepsGrade(c: BenchCase, steps: Steps | undefined): 'hit' | 'under' | 'over' | 'none' {
  if (!steps || !c.steps) return 'none'
  if (c.steps.includes(steps)) return 'hit'
  return STEPS.indexOf(steps) < Math.min(...c.steps.map(s => STEPS.indexOf(s))) ? 'under' : 'over'
}

/** The benchmark's table: per judge the share it got right, how it missed, and how fast it was; then per kind. */
export function benchReport(cases: BenchCase[], answers: BenchAnswer[]): string {
  const byId = new Map(cases.map(c => [c.id, c]))
  const judges = [...new Set(answers.map(a => a.judge))]
  const kinds = [...new Set(cases.map(c => c.kind))]
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '-')
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length ? s[Math.floor(s.length / 2)] : 0
  }
  const lines = [
    '| Judge | Right | Too low | Too high | No answer | Median ms |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  for (const j of judges) {
    const mine = answers.filter(a => a.judge === j)
    const g = mine.map(a => benchGrade(byId.get(a.id)!, a.effort))
    const n = (k: string) => g.filter(x => x === k).length
    const asked = mine.filter(a => a.ms > 0).map(a => a.ms)
    lines.push(
      `| ${j} | ${pct(n('hit'), g.length)} | ${n('under')} | ${n('over')} | ${n('none')} | ${asked.length ? median(asked) : '-'} |`,
    )
  }
  // The held-out cases were never tuned against: the honest score. The rest shaped the judge prompts.
  const sets = [
    ['tuned on', cases.filter(c => !c.holdout)],
    ['held out', cases.filter(c => c.holdout)],
  ] as const
  lines.push('', `| Set (cases) | ${judges.join(' | ')} |`, `| --- | ${judges.map(() => '---').join(' | ')} |`)
  for (const [name, set] of sets) {
    if (!set.length) continue
    const ids = set.map(c => c.id)
    const cells = judges.map(j => {
      const mine = answers.filter(a => a.judge === j && ids.includes(a.id))
      return pct(mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit').length, mine.length)
    })
    lines.push(`| ${name} (${set.length}) | ${cells.join(' | ')} |`)
  }
  lines.push('', `| Kind (cases) | ${judges.join(' | ')} |`, `| --- | ${judges.map(() => '---').join(' | ')} |`)
  for (const k of kinds) {
    const ids = cases.filter(c => c.kind === k).map(c => c.id)
    const cells = judges.map(j => {
      const mine = answers.filter(a => a.judge === j && ids.includes(a.id))
      return pct(mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit').length, mine.length)
    })
    lines.push(`| ${k} (${ids.length}) | ${cells.join(' | ')} |`)
  }
  // Does "unsure" predict a miss? The Smarter lean acts on it, so it is measured here.
  const judged = judges.filter(j => !j.startsWith('always'))
  const sureLines = [
    '',
    '| Judge | Sure when right | Sure when wrong | Misses under 65% sure | Misses under 85% sure | Answers under 65% | Answers under 85% |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const j of judged) {
    const mine = answers.filter(a => a.judge === j && a.effort && typeof a.sure === 'number')
    if (!mine.length) continue
    const wrong = mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) !== 'hit')
    const right = mine.filter(a => benchGrade(byId.get(a.id)!, a.effort) === 'hit')
    const avg = (xs: BenchAnswer[]) =>
      xs.length ? `${Math.round((xs.reduce((t, a) => t + a.sure!, 0) / xs.length) * 100)}%` : '-'
    const under = (xs: BenchAnswer[], t: number) => xs.filter(a => a.sure! < t).length
    sureLines.push(
      `| ${j} (${mine.length} with a score) | ${avg(right)} | ${avg(wrong)} | ${under(wrong, 0.65)} of ${wrong.length} | ${under(wrong, 0.85)} of ${wrong.length} | ${under(mine, 0.65)} | ${under(mine, 0.85)} |`,
    )
  }
  const pickLines = ['', '| Judge | Haiku | Sonnet | Opus | Other |', '| --- | --- | --- | --- | --- |']
  for (const j of judged) {
    const mine = answers.filter(a => a.judge === j && a.model)
    if (!mine.length) continue
    const n = (k: string) => mine.filter(a => a.model === k).length
    pickLines.push(
      `| ${j} | ${n('haiku')} | ${n('sonnet')} | ${n('opus')} | ${mine.length - n('haiku') - n('sonnet') - n('opus')} |`,
    )
  }
  // Too many steps is what hands a small task to a subagent that costs more than it spares.
  const stepLines = ['', '| Judge | Steps right | Too few | Too many | No answer |', '| --- | --- | --- | --- | --- |']
  for (const j of judged) {
    const mine = answers.filter(a => a.judge === j && byId.get(a.id)!.steps)
    if (!mine.length) continue
    const g = mine.map(a => stepsGrade(byId.get(a.id)!, a.steps))
    const n = (k: string) => g.filter(x => x === k).length
    stepLines.push(`| ${j} | ${pct(n('hit'), g.length)} | ${n('under')} | ${n('over')} | ${n('none')} |`)
  }
  lines.push(
    ...(sureLines.length > 3 ? sureLines : []),
    ...(pickLines.length > 3 ? pickLines : []),
    ...(stepLines.length > 3 ? stepLines : []),
  )
  const stepMisses = answers
    .filter(
      a => !a.judge.startsWith('always') && a.steps && ['under', 'over'].includes(stepsGrade(byId.get(a.id)!, a.steps)),
    )
    .map(
      a =>
        `- ${a.judge} ${a.id}: said ${a.steps} steps, wanted ${byId.get(a.id)!.steps!.join('/')}: "${byId.get(a.id)!.message.slice(0, 60)}"`,
    )
  const misses = answers
    .filter(a => !a.judge.startsWith('always') && benchGrade(byId.get(a.id)!, a.effort) !== 'hit')
    .map(
      a =>
        `- ${a.judge}${a.by && a.by !== a.judge ? ` (via ${a.by})` : ''} ${a.id}: said ${a.effort ?? 'nothing'}${a.why ? ` (${a.why})` : ''}, wanted ${byId.get(a.id)!.ok.join('/')}: "${byId.get(a.id)!.message.slice(0, 60)}"`,
    )
  return [
    ...lines,
    '',
    'Misses:',
    ...(misses.length ? misses : ['- none']),
    ...(stepMisses.length ? ['', 'Steps misses:', ...stepMisses] : []),
  ].join('\n')
}

/** Runs every case through each available judge, a few at a time, and returns the answers. */
async function runBench($: EngineInterface, cases: BenchCase[]): Promise<BenchAnswer[]> {
  const judges: [string, (c: BenchCase) => Promise<Judged | undefined>][] = [
    ['haiku', c => askHaiku($, c.message, c.current, c.context ?? '')],
  ]
  const answers: BenchAnswer[] = []
  // Baselines: what a fixed effort would score on the same labels.
  for (const fixed of ['medium', 'high'] as Effort[])
    for (const c of cases) answers.push({ id: c.id, judge: `always ${fixed}`, effort: fixed, ms: 0, tokens: 0 })
  const jobs = judges.flatMap(([name, ask]) => cases.map(c => ({ name, ask, c })))
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const { name, ask, c } = jobs[next++]
      // The mod never asks a judge about a short follow-up: it keeps the current effort.
      if (keepsEffort(c.message, c.context ?? '')) {
        answers.push({ id: c.id, judge: name, effort: c.current.effort, ms: 0, tokens: 0 })
        continue
      }
      const started = await $.clock.now()
      const got = await ask(c).catch(() => undefined)
      answers.push({
        id: c.id,
        judge: name,
        effort: got?.verdict?.effort,
        by: got?.verdict?.by,
        why: got?.verdict?.why,
        sure: got?.verdict?.sure,
        model: got?.verdict?.model,
        steps: got?.verdict?.steps,
        ms: (await $.clock.now()) - started,
        tokens: got?.tokens ?? 0,
      })
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return answers
}

function keyOf(id: string): ModelKey | undefined {
  return MODELS.find(m => id.includes(m.key))?.key
}

/** Records the model the session now runs; the pick follows it, so the band never shows a stale one. */
async function modelIs($: EngineInterface, id: string) {
  const pause = !cacheSafe(id) && takesEffort(id)
  if (pause !== (await read($, paused))) await update($, paused, () => pause)
  const key = keyOf(id)
  if (!key || key === (await read($, model))) return
  await update($, model, () => key)
  // The engine's effort can differ per model, so a change across a switch is not the person's doing;
  // and a model turned down earlier may be suggested again.
  setEngineEffort(undefined)
  declined = null
  settleOffer(false)
  const current = await read($, pick)
  if (current && current.model !== key) await choose($, { ...current, model: key })
  if ((await read($, suggestion)) === key) await update($, suggestion, () => null)
}

async function sessionModel($: EngineInterface): Promise<ModelKey> {
  return keyOf(await sessionModelId($)) ?? 'sonnet'
}

/** The model this session's requests go out on: a taken offer's, else the app's own. */
async function sessionModelId($: EngineInterface): Promise<string> {
  return sessionPick ? MODELS.find(m => m.key === sessionPick)!.id : $.session.model()
}
// A model the person turned down; not suggested again until they pick something else.
let declined: ModelKey | null = null
// The model a taken offer moved this session to. Only the requests carry it: /model would also make it the app's
// default for every later session. Any /model, the band's Model row or the app's picker moving to another model ends it;
// the app's picker on the model it already runs sends nothing to hear.
let sessionPick: ModelKey | null = null
// Each model's own prompt cache for this chat: when it lapses and how many tokens it holds. Going back to a model whose cache
// is still warm only writes what was added since. A compaction or /clear starts a new prefix, so they are forgotten.
const modelCaches = new Map<ModelKey, { expires: number; tokens: number }>()
// How the model in `suggestion` is offered: the session switches to it, or the prompt is handed to a subagent on it.
let suggestedAs: 'switch' | 'subagent' = 'switch'

/** The tokens a model still has in its cache for this chat, or undefined when it has none warm. */
function warmTokens(key: ModelKey, now: number): number | undefined {
  const cache = modelCaches.get(key)
  return cache && cache.expires > now ? cache.tokens : undefined
}

/** The note a handed-off prompt carries: the chat's model stays, and a subagent on `model` does the task. */
export function subagentNote(model: ModelKey): string {
  return `\n\n[context-lens, on my behalf: I want a subagent on ${model} to do this task (Agent tool, model: "${model}") to save my usage on the chat's model. Delegate it with a complete brief, even if it looks small, then use its result.]`
}

/**
 * Types a slash command into the prompt box for the person to send with Enter. A command the person
 * sends is read by the app itself, so its own Model and Effort controls follow; one the mod runs
 * inside the engine is not. Never overwrites a draft: returns false when the box is not empty.
 */
async function typeCommand($: EngineInterface, text: string): Promise<boolean> {
  try {
    const draft = (await $.prompt.read()).text.trim()
    // A draft of your own is never overwritten; the mod's own earlier command is replaced.
    if (draft !== '' && draft !== lastTyped) return false
    const filled = await $.prompt.fill({ text })
    if (filled.isFilled) setLastTyped(text)
    if (filled.isFilled && !toldAboutEnter) {
      setToldAboutEnter(true)
      $.ui.toast(`Press Enter to send ${text} so the app's own control follows`)
    }
    return filled.isFilled
  } catch {
    return false
  }
}

// A prompt waiting for the answer to a model offer: who to tell, the model offered, and when the wait ends.
let offer: { model: ModelKey; until: number; done: (accepted: boolean) => void } | null = null
// The wait counts against the host's 10-second budget for the prompt.submit hook, which sends the prompt on its own
// once it runs out; the hold ends well before that, so the prompt and the question end together.
const OFFER_HOLD_MS = 8_000

/** Ends the wait: true when the person took the offer, false for Keep, a timeout or anything else. */
function settleOffer(accepted: boolean) {
  const open = offer
  offer = null
  open?.done(accepted)
}

/** Holds the prompt until the offer is answered; true when it was taken. Only one offer waits at a time. */
async function holdForOffer($: EngineInterface, model: ModelKey): Promise<boolean> {
  settleOffer(false)
  const until = (await $.clock.now()) + OFFER_HOLD_MS
  $.ui.invalidate('ui.render')
  return new Promise<boolean>(resolve => {
    const timer = $.clock.after(OFFER_HOLD_MS, () => settleOffer(false))
    // A redraw a second, for the countdown in the question.
    const tick = $.clock.every(1000, () => $.ui.invalidate('ui.render'))
    offer = {
      model,
      until,
      done: accepted => {
        timer?.cancel?.()
        tick?.cancel?.()
        resolve(accepted)
      },
    }
  })
}

/**
 * A model change reloads the context, so it only happens when the person says yes. It holds for this session only:
 * the app's own model ends it, and the requests go out as the app sends them again.
 */
async function switchModel($: EngineInterface, model: ModelKey) {
  try {
    sessionPick = keyOf(await $.session.model()) === model ? null : model
    await modelIs($, await sessionModelId($))
    $.ui.invalidate('ui.render')
    declined = null
    await update($, suggestion, () => null)
    const current = await read($, pick)
    if (current) await choose($, { ...current, model })
  } catch {
    $.ui.toast('Could not switch the model right now')
  }
}

/**
 * The tally in its current shape. A hot reload keeps the state an older version wrote ({ requests, actual,
 * baseline } before 0.2.0), so every read goes through this.
 */
export function asSpent(t: unknown): Spent {
  const v = (t ?? {}) as Partial<Spent>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  const judged = (v.judge ?? {}) as Partial<Spent['judge']>
  // Stats from 0.3.0 and earlier hold the subagents' counts under helpers.
  const ran = (v.subagents ?? (v as { helpers?: Spent['subagents'] }).helpers) as
    Partial<Spent['subagents']> | undefined
  return {
    prompts: num(v.prompts),
    requests: num(v.requests),
    input: num(v.input),
    write: num(v.write),
    writeHour: num(v.writeHour),
    read: num(v.read),
    out: num(v.out),
    byEffort: v.byEffort && typeof v.byEffort === 'object' ? v.byEffort : {},
    judge: { haiku: num(judged.haiku), ms: num(judged.ms), tokens: num(judged.tokens) },
    subagents: {
      runs: ran?.runs && typeof ran.runs === 'object' ? ran.runs : {},
      requests: num(ran?.requests),
      cost: num(ran?.cost),
    },
  }
}

/** The saved footer line of a reply: the one written at its end. The footer's duration is the turn's own, but the saved one is
 * matched within a second in case the two are read at slightly different moments. */
export function turnLineFor<T>(lines: Record<string, T>, ms: number): T | undefined {
  const exact = lines[String(ms)]
  if (exact) return exact
  let best: T | undefined
  let gap = 1000
  for (const [k, v] of Object.entries(lines)) {
    const d = Math.abs(Number(k) - ms)
    if (d < gap) {
      gap = d
      best = v
    }
  }
  return best
}

/** A request's tokens weighted by price, in input-token terms (see WEIGHT). The cache writes are priced by the lifetime the
 * request says it wrote (1 hour or 5 minutes); one that does not say is counted as 5 minutes. */
export function weighted(usage: {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_creation?: { ephemeral_1h_input_tokens?: number | null } | null
}): number {
  const written = usage.cache_creation_input_tokens ?? 0
  const hour = Math.min(written, usage.cache_creation?.ephemeral_1h_input_tokens ?? 0)
  return (
    (usage.input_tokens ?? 0) * WEIGHT.input +
    hour * WEIGHT.write1h +
    (written - hour) * WEIGHT.write +
    (usage.cache_read_input_tokens ?? 0) * WEIGHT.read +
    (usage.output_tokens ?? 0) * WEIGHT.out
  )
}

/** Adds one request Auto steered: every kind of token it used, under the effort it ran at. */
async function tally(
  $: EngineInterface,
  effort: Effort,
  usage: Parameters<typeof weighted>[0] & { input_tokens: number; output_tokens: number },
) {
  const cached = usage.cache_read_input_tokens ?? 0
  const write = usage.cache_creation_input_tokens ?? 0
  const cost = weighted(usage)
  await update($, saved, old => {
    const t = asSpent(old)
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 }
    return {
      ...t,
      requests: t.requests + 1,
      input: t.input + usage.input_tokens,
      write: t.write + write,
      writeHour: t.writeHour + Math.min(write, usage.cache_creation?.ephemeral_1h_input_tokens ?? 0),
      read: t.read + cached,
      out: t.out + usage.output_tokens,
      byEffort: { ...t.byEffort, [effort]: { ...bucket, cost: bucket.cost + cost } },
    }
  })
}

/** Counts one prompt Auto judged: under its effort, and what the judge took. */
async function countPrompt(
  $: EngineInterface,
  effort: Effort | undefined,
  by: Pick['by'] | undefined,
  ms: number,
  judgeTokens: number,
) {
  await update($, saved, old => {
    const t = asSpent(old)
    const judged = {
      haiku: t.judge.haiku + (by === 'haiku' ? 1 : 0),
      ms: t.judge.ms + ms,
      tokens: t.judge.tokens + judgeTokens,
    }
    if (!effort) return { ...t, judge: judged }
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 }
    return {
      ...t,
      judge: judged,
      prompts: t.prompts + 1,
      byEffort: { ...t.byEffort, [effort]: { ...bucket, prompts: bucket.prompts + 1 } },
    }
  })
}

/** The cache lifetime a response's writes got, when it says; nothing when it wrote nothing or does not say. */
export function cacheTtlOf(usage: unknown): keyof typeof CACHE_TTL | undefined {
  const c = (
    usage as { cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number } } | null
  )?.cache_creation
  if ((c?.ephemeral_1h_input_tokens ?? 0) > 0) return '1h'
  if ((c?.ephemeral_5m_input_tokens ?? 0) > 0) return '5m'
  return undefined
}

/** Most of the prompt came from the cache: it was still warm. */
export function mostlyCached(usage: unknown): boolean {
  const u = (usage ?? {}) as {
    input_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  const read_ = u.cache_read_input_tokens ?? 0
  const all = read_ + (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
  return all > 0 && read_ / all > 0.5
}

/** Save mode on or off: Auto stays at medium or below until the limit resets. The hot band's button and
 *  /context-lens save. Says what it did. */
async function toggleSave($: EngineInterface): Promise<string> {
  const saving = (await read($, saveUntil)) !== null
  const heat = await read($, hot)
  const until = heat?.resetsAt ? new Date(heat.resetsAt).getTime() : (await $.clock.now()) + 5 * 3600_000
  await update($, saveUntil, () => (saving ? null : until))
  return saving ? 'save mode off' : 'save mode on, Auto stays at medium or below until the limit resets'
}

/** Below this a cold cache costs too little to warn about: the next message rereads the chat at full price once. */
const COLD_MIN_TOKENS = 150_000

/** A switch that writes at most this many tokens more to the cache than staying would costs next to nothing. */
const SMALL_CHAT_TOKENS = 20_000

/** Dollars per million uncached input tokens. Haiku costs five times as much past 100k tokens of context. */
const INPUT_PRICE: Record<ModelKey, number> = { haiku: 0.1, sonnet: 2, opus: 4, fable: 10 }
export const priceOf = (key: ModelKey, tokens: number) => (key === 'haiku' && tokens > 100_000 ? 0.5 : INPUT_PRICE[key])

/** Above this many tokens Haiku is offered as a hand-off to a subagent, never as a switch, warm cache or cold. The judge rates one prompt,
 * but a switch hands Haiku every prompt after it, and a chat this long is ongoing work. Haiku's price pays back its cache
 * write within a few requests at any size, so the price alone would always switch; the quality is what it risks. Sonnet
 * is left to the price: it holds up in long work, and in a warm chat its write does not pay back anyway. */
const HAIKU_SWITCH_MAX_TOKENS = 100_000

/** The requests a cheaper model has to make before its first, dearer cache write pays back. A turn of work makes several;
 * what output saves is left out, so the estimate errs on staying. */
const PAYBACK_REQUESTS = 8

/**
 * How the judge's model is worth offering: 'switch' the session to it, hand the prompt to a 'subagent' on it,
 * or null for nothing (Fable, or the model already in use). Each model has a prompt cache of its own, so a switch writes
 * the chat again at the new model's write price, less what that model still has warm (`warm`, its cached tokens).
 * A cheaper model is a switch when that write pays back within PAYBACK_REQUESTS reads; a stronger one is a quality call
 * that never pays in tokens, so it is a switch only when it writes little more than staying would (a cold, small or
 * still-warm chat). Otherwise the task goes to a subagent, which starts with a small context and leaves the chat's cache
 * warm. Haiku in a chat past HAIKU_SWITCH_MAX_TOKENS is a subagent whatever the cache. A size not known yet counts as a
 * new chat.
 */
export function switchWorth(
  verdict: ModelKey,
  inUse: ModelKey,
  chat: { cold: boolean; tokens?: number; ttl?: '5m' | '1h'; warm?: number },
): 'switch' | 'subagent' | null {
  if (verdict === 'fable' || verdict === inUse) return null
  const tokens = chat.tokens
  if (tokens === undefined) return 'switch'
  if (verdict === 'haiku' && tokens > HAIKU_SWITCH_MAX_TOKENS) return 'subagent'
  const write = chat.ttl === '5m' ? WEIGHT.write : WEIGHT.write1h
  const writtenStay = chat.cold ? tokens : 0
  const writtenGo = Math.max(0, tokens - Math.min(tokens, chat.warm ?? 0))
  // Little more to write than staying would: any switch is near free.
  if (writtenGo - writtenStay <= SMALL_CHAT_TOKENS) return 'switch'
  const rank = (k: ModelKey) => MODELS.findIndex(m => m.key === k)
  if (rank(verdict) > rank(inUse)) return 'subagent'
  const stay = (writtenStay * write + (tokens - writtenStay) * WEIGHT.read) * priceOf(inUse, tokens)
  const go = (writtenGo * write + (tokens - writtenGo) * WEIGHT.read) * priceOf(verdict, tokens)
  const gain = tokens * WEIGHT.read * (priceOf(inUse, tokens) - priceOf(verdict, tokens))
  return go - stay <= PAYBACK_REQUESTS * gain ? 'switch' : 'subagent'
}

/** The requests a task of each size makes, as the judge guesses it. */
const STEP_REQUESTS: Record<Steps, number> = { one: 1, few: 4, many: 12 }
/** What a subagent writes to its cache before it starts: its system prompt, tools and brief. */
const SUBAGENT_START_TOKENS = 15_000

/**
 * Whether handing the prompt to a subagent on `verdict` pays, once switchWorth has turned the switch down. The chat
 * still makes the request that calls the subagent and the one that reads its result, so a task of n requests spares
 * the chat n - 1 reads of its context, against the subagent's own cold start and reads. A one-step task spares
 * nothing. A stronger model is a quality call: it goes to a subagent for any task bigger than one step.
 *
 * The task's size is the smaller of the judge's steps and the size its effort implies: the judge counts one command
 * on several items ("delete those branches") as a few steps, but it rates the effort of such a task low.
 */
export function subagentPays(
  verdict: ModelKey,
  inUse: ModelKey,
  task: { tokens: number; effort: Effort; steps?: Steps },
): boolean {
  const byEffort: Steps = task.effort === 'low' ? 'one' : task.effort === 'medium' ? 'few' : 'many'
  const steps = STEPS[Math.min(STEPS.indexOf(task.steps ?? byEffort), STEPS.indexOf(byEffort))]
  if (steps === 'one') return false

  const rank = (k: ModelKey) => MODELS.findIndex(m => m.key === k)
  if (rank(verdict) > rank(inUse)) return true

  const requests = STEP_REQUESTS[steps]
  const spared = (requests - 1) * task.tokens * WEIGHT.read * priceOf(inUse, task.tokens)
  const started =
    (SUBAGENT_START_TOKENS * WEIGHT.write + requests * SUBAGENT_START_TOKENS * WEIGHT.read) *
    priceOf(verdict, SUBAGENT_START_TOKENS)
  return spared > started
}

/** The context's tokens when the cold band is worth showing: the cache is cold, the band not closed, and the chat big
 * enough that rereading it matters. Null otherwise, and while the size is not known yet. */
async function coldWorth($: EngineInterface): Promise<number | null> {
  if ((await read($, cacheLeft)) !== 0 || config.hide.includes('cold') || (await read($, isColdHidden))) return null
  const tokens = lastContext?.tokens
  if (coldForced) return tokens ?? 0
  return tokens !== undefined && tokens >= COLD_MIN_TOKENS ? tokens : null
}

/** The countdown's colour for whole minutes left (rounded up, as cacheMinutes gives): none (grey), yellow or red. */
export function cacheColor(minutesLeft: number): string | undefined {
  const shown = minutesLeft - 1
  if (minutesLeft <= 0) return ICE
  if (shown > CACHE_YELLOW_MIN) return undefined
  return shown <= CACHE_RED_MIN ? RED : YELLOW
}

/** The footer's words for the time left: "58m", "<1m", or "Cold". */
export function cacheLabel(minutesLeft: number): string {
  if (minutesLeft <= 0) return '❄ Cold'
  if (minutesLeft === 1) return '<1m'
  return `${minutesLeft - 1}m`
}

/** The dashboard's countdown to the second: "58:41", or "Cold" once it ran out. */
export function cacheClock(msLeft: number): string {
  if (msLeft <= 0) return '❄ Cold'
  const s = Math.ceil(msLeft / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

let cacheTtl: keyof typeof CACHE_TTL = '1h'
let cacheExpires = 0
/** The countdown's variables live in the module, and a reload starts the module over: the chat's cache did not go cold
 * for that, so the countdown is read back from the session's state before the band draws. */
let cacheRestored = false
async function restoreCache($: EngineInterface) {
  if (cacheRestored) return
  cacheRestored = true
  const memo = await read($, cacheMemo)
  if (!memo || cacheExpires !== 0 || memo.expires <= 0) {
    // Nothing to go on: a "Cold" left in the shared state by the copy before is not this chat's cache.
    // restoreCache runs inside the band's draw, where a state write is denied: the clear waits for a timer, and checks again then.
    if (cacheExpires === 0 && !coldForced)
      $.clock.after(0, () => void update($, cacheLeft, l => (l === 0 && cacheExpires === 0 && !coldForced ? null : l)))
    return
  }
  cacheExpires = memo.expires
  cacheTtl = memo.ttl
  lastResponseAt = memo.last
}
const rememberCache = ($: EngineInterface) =>
  update($, cacheMemo, () => ({ expires: cacheExpires, ttl: cacheTtl, last: lastResponseAt }))
// What /context-lens swamp shows as a test: a swamped chat's context.
const SWAMP_TOKENS = 150_000
// Closed, the band stays away until the context has grown this much more.
const SWAMP_REGROW = 50_000

// A usage window this full shows the running-hot band.
const HOT_PERCENT = 80
// Closed, the running-hot band stays away for the rest of its window, and comes back once at this many percent.
export const HOT_FINAL = 95

/** The usage window as the closed band records it: its kind and reset time. */
const hotWindow = (heat: { kind: string; resetsAt: string | null }) =>
  // To the quarter hour: the reset time the app reports can shift by seconds between checks.
  `${heat.kind} ${heat.resetsAt ? Math.round(new Date(heat.resetsAt).getTime() / 900_000) : ''}`

/** Whether the running-hot band shows: always until closed; closed, not again in that window unless it passes HOT_FINAL. */
export function hotVisible(
  heat: { kind: string; percent: number; resetsAt: string | null },
  closed: HotClosed | null,
): boolean {
  if (!closed || closed.window !== hotWindow(heat)) return true
  return heat.percent >= HOT_FINAL && closed.percent < HOT_FINAL
}

let hotClosedLoaded = false
/** The closed band as the store keeps it, read once per session (a new chat starts with the atom empty). */
async function hotClosedNow($: EngineInterface): Promise<HotClosed | null> {
  if (!hotClosedLoaded) {
    hotClosedLoaded = true
    const kept = (await $.store.get('hotClosed').catch(() => null)) as HotClosed | null
    if (kept && typeof kept.window === 'string') await update($, hotHidden, () => kept)
  }
  return read($, hotHidden)
}

async function closeHot($: EngineInterface, heat: { kind: string; percent: number; resetsAt: string | null }) {
  const closed: HotClosed = { window: hotWindow(heat), percent: heat.percent }
  await update($, hotHidden, () => closed)
  await $.store.set('hotClosed', closed).catch(() => undefined)
}

/** The fullest of the 5-hour and weekly windows, once one passes HOT_PERCENT. Save mode ends with its window. */
async function checkHot(
  $: EngineInterface,
  limits: readonly { kind: string; percentUsed: number; resetsAt?: string }[],
) {
  const windows = limits.filter(l => l.kind === 'five_hour' || l.kind === 'seven_day')
  const top = windows.sort((a, b) => b.percentUsed - a.percentUsed)[0]
  const next =
    top && top.percentUsed >= HOT_PERCENT
      ? { kind: top.kind, percent: top.percentUsed, resetsAt: top.resetsAt ?? null }
      : null
  const was = await read($, hot)
  if (JSON.stringify(next) !== JSON.stringify(was)) {
    await update($, hot, () => next)
    $.ui.invalidate('ui.render')
  }
  const until = await read($, saveUntil)
  if (until !== null && (await $.clock.now()) >= until) await update($, saveUntil, () => null)
}

/** "14:20" for a reset time today, "Mon 14:20" further out. */
export function resetLabel(iso: string | null, now: number): string {
  if (!iso) return ''
  const at = new Date(iso)
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return at.getTime() - now < 20 * 3600_000
    ? hm
    : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.getDay()]} ${hm}`
}

/**
 * The effort slider tips close calls only: a verdict the judge was unsure of moves one step toward cheaper or smarter.
 * The outer stops count more calls as close. A sure verdict, or one without a confidence, stays as it is.
 */
export function tipped(effort: Effort, sure: number | undefined, bias: number): Effort {
  if (!bias || sure === undefined || sure >= (Math.abs(bias) === 1 ? 0.65 : 0.85)) return effort
  const i = Math.max(0, Math.min(EFFORTS.length - 1, EFFORTS.indexOf(effort) + Math.sign(bias)))
  return EFFORTS[i]
}

/** Floor and ceiling from the settings: what Auto picks stays between them. */
export function bounded(effort: Effort, floor: Effort, ceiling: Effort): Effort {
  const lo = EFFORTS.indexOf(floor)
  const hi = Math.max(lo, EFFORTS.indexOf(ceiling))
  return EFFORTS[Math.max(lo, Math.min(hi, EFFORTS.indexOf(effort)))]
}

/** Save mode caps what Auto picks at medium; a higher pick comes down to it. */
export function capped(effort: Effort, saving: boolean): Effort {
  return saving && EFFORTS.indexOf(effort) > EFFORTS.indexOf('medium') ? 'medium' : effort
}

/** A context share to draw the bars with instead of the real one, from ~/.claude/context-lens-preview.json
 * ({"contextPercent": 45}), so how a level looks can be checked on screen without filling a chat. No file, no change. */
async function previewPercent($: EngineInterface): Promise<number | undefined> {
  const home = (await envUserProfile($)) ?? (await envHome($))
  if (!home) return undefined
  const text = await $.fs.read(`${home}/.claude/context-lens-preview.json`).catch(() => '')
  if (!text) return undefined
  try {
    const n = Number((JSON.parse(text) as { contextPercent?: unknown }).contextPercent)
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined
  } catch {
    return undefined
  }
}

/** Whether the context is swamped, from the status line's figures. Cheap: no counting, no model call. */
async function checkSwamp($: EngineInterface) {
  const { context, rateLimits } = await $.session.usage()
  const preview = await previewPercent($)
  const tokens =
    preview === undefined ? (context.tokens ?? 0) : Math.round(((context.window || 200_000) * preview) / 100)
  // The app may leave the percent out (or give 0) while it has the tokens and the window: work it out then.
  const percent = preview ?? (context.percent || (context.window ? (tokens / context.window) * 100 : 0))
  if (preview !== undefined && !context.window) context.window = 200_000
  const wasStep = handoffGlowStep(lastContext?.percent ?? 0)
  lastContext = { tokens, window: context.window ?? 0, percent }
  // The Handoff button turns white and glows harder with the context: redraw the band when it crosses a step.
  if (handoffGlowStep(percent) !== wasStep) $.ui.invalidate('ui.render')
  await checkHot($, rateLimits ?? [])
  const over = percent >= config.swampAt
  const next = over ? tokens : null
  if (next !== (await read($, swamped))) {
    await update($, swamped, () => next)
    $.ui.invalidate('ui.render')
  }
}

// Redraws still owed after a chat was opened again: the app may draw the band before it is ready for one, so the
// session's 1 s timer asks again a few times (see redrawSoon).
let redrawsOwed = 0
// The countdown's minute the band was last redrawn for (see cacheClockSvg).
let clockMinute = -1
// When the redraws were asked for: once the band has been drawn after that, none are owed any more, since each redraw
// rebuilds the band and restarts its animations.
let redrawAskedAt = 0
// A draw this soon after the ask may come before the app has the band up, so it does not count.
const REDRAW_SETTLE_MS = 500
function redrawSoon(times = 5) {
  redrawsOwed = Math.max(redrawsOwed, times)
  redrawAskedAt = Date.now()
}

/** Writes the minutes left when they changed; the cache tick calls it. */
async function showCache($: EngineInterface) {
  // No response seen by this copy yet (it loaded mid-chat, after a plugin switch or reload): a 0 left in the shared
  // state by an earlier copy is not this chat's cache, so the countdown goes blank until the next response.
  if (cacheExpires === 0) {
    if (!coldForced && (await read($, cacheLeft)) !== null) {
      await update($, cacheLeft, () => null)
      $.ui.invalidate('ui.render')
    }
    return
  }
  const minutes = await cacheMinutes($)
  const was = await read($, cacheLeft)
  if (minutes === was) return
  await update($, cacheLeft, () => minutes)
  // Going cold or warm adds or removes the band above the prompt; the desktop app redraws that site only when asked.
  if ((minutes === 0) !== (was === 0)) $.ui.invalidate('ui.render')
}

/** Minutes left, rounded up, so "1" means under a minute and 0 means cold. */
async function cacheMinutes($: EngineInterface): Promise<number> {
  const left = cacheExpires - (await $.clock.now())
  return left <= 0 ? 0 : Math.ceil(left / 60_000)
}

let usageLogged = false
let lastResponseAt: number | undefined
// Main-conversation replies this copy has seen, for /context-lens debug.
let repliesSeen = 0
/** A response came back: the cache is warm again for its whole lifetime, and the countdown restarts. */
async function cacheTouched($: EngineInterface, usage: unknown) {
  const now = await $.clock.now()
  repliesSeen++
  if (!usageLogged) {
    usageLogged = true
    void proof($, `first response usage: ${JSON.stringify(usage)}`)
  }
  // When the response does not say, the cache tells by itself: read back after more than 5 minutes means 1 hour.
  const ttl =
    cacheTtlOf(usage) ??
    (lastResponseAt !== undefined && now - lastResponseAt > CACHE_TTL['5m'] && mostlyCached(usage) ? '1h' : undefined)
  lastResponseAt = now
  coldForced = false
  // A reply that wrote only a short 5-minute tail still reads the rest from the 1-hour cache: once 1h is seen, a
  // 5m reading never pulls the countdown back down.
  if (ttl && ttl !== cacheTtl && !(ttl === '5m' && cacheTtl === '1h' && mostlyCached(usage))) {
    cacheTtl = ttl
    void proof($, `cache lifetime ${ttl}`)
  }
  cacheExpires = now + CACHE_TTL[cacheTtl]
  await rememberCache($)
  if (await read($, isColdHidden)) await update($, isColdHidden, () => false)
  await showCache($)
}

/**
 * Compacts the conversation from the footer once the cache has gone cold: the next message would write the whole
 * context to the cache again, so a summary makes it small first. The countdown hides until the next response.
 */
async function compactCold($: EngineInterface, note = '') {
  if (await read($, isCompacting)) return
  await update($, compactAsk, () => false)
  await update($, isCompacting, () => true)
  await setHandoffCard($, 'compacting', false)
  let compacted = false
  try {
    // The app's own /compact, run as if typed: nothing lands in the prompt box, nothing to send. It waits for the
    // session to be idle, where a direct $.session.compact() is refused whenever the app counts a turn as running.
    // A note goes after /compact as the app's own instructions for the summary.
    await $.command.run({ command: 'compact', args: note.trim() })
    cacheExpires = 0
    modelCaches.clear()
    await rememberCache($)
    await update($, cacheLeft, () => null)
    compacted = true
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    void proof($, `compact failed: ${why}`)
    $.ui.toast(`context-lens: compact failed: ${why.slice(0, 140)}`)
  } finally {
    await update($, isCompacting, () => false)
    // Complete, or gone when it failed (the toast says why).
    if (compacted) {
      await setHandoffCard($, 'compacted', false)
      $.clock.after(COMPACT_CARD_MS + 100, () => $.ui.invalidate('ui.render'))
    } else await update($, handoffCard, card => (card?.kind === 'compacting' ? null : card))
  }
}

// The handoff: one click writes a handoff, clears the chat and sends the handoff into it as the first message.
// The quick handoff is written by a fork, which has no tools: it says what the chat last saw and marks what it cannot
// check. The full handoff (the person's own skill) is the one that inspects git and saves files.
export const HANDOFF_PROMPT = [
  'Write a handoff so this work can continue in a fresh chat that has no other context.',
  '',
  'Start with the project, its folder and the branch. Then:',
  '- Goal: one or two lines.',
  '- Done: what changed, with file paths, and how each change was checked. Never present something planned, skipped or untested as done.',
  '- Not done: what is half done, and the concrete blocker (a failed check, a missing approval, an open question).',
  '- Git: local changes, local commits, pushed commits and open PRs, as last seen in this chat. You cannot check now, so say "as of last check".',
  '- Next steps in priority order. Make the first one runnable: a file path, a command or a specific decision. Mark every step that needs the user with "needs user".',
  "- To resume: the start command, the preview URL, and the limits on what is allowed (what needs the user's approval, test vs production).",
  '- Do not redo: decisions made and why, approaches that failed.',
  '',
  'Give only the final state of anything that changed during the chat. Point to specs, plans and files instead of ' +
    'copying them. Leave out what is finished and no longer matters. Never include secrets, environment values or raw ' +
    'logs. Write in the language the user writes in. Short bullets, at most about 40 lines. Do not use tools. Reply ' +
    'with the handoff only, no preamble or farewell.',
].join('\n')

/** The full handoff when no skill of the person's is picked: a turn that may check git and save the handoff, then
 * replies with it. Slower than the quick fork, and it leaves HANDOFF.md in the project for the next chat to read. */
export const HANDOFF_FULL_PROMPT = [
  'Write a handoff so this work can continue in a fresh chat that has no other context. You may use tools for this.',
  '',
  '1. Check the real state: git status, the last few commits, whether the branch is pushed, open PRs if gh is set up.',
  '2. Rewrite HANDOFF.md in the project root from scratch (keep it under 80 lines): branch and open PRs, what is half done,',
  '   next steps with the first one runnable, what only the user can do, and pointers to specs, plans and files.',
  '   Never put secrets or environment values in it.',
  '3. Reply with the handoff itself, in the same shape:',
  '',
  HANDOFF_PROMPT.split('\n').slice(2).join('\n').replace('Do not use tools. ', ''),
].join('\n')

/** The first message of the fresh chat: the handoff, then what to do with it. */
export function handoffMessage(handoff: string, after: HandoffAfter, skill?: string): string {
  const ask =
    after === 'confirm'
      ? 'Read this, say in two lines where things stand and what is next, then wait for me.'
      : 'Continue with the next step. If it is marked "needs user", say what you need and wait.'
  // A full handoff is the person's own skill: it saves the handoff (a file, memories), and its last words in the chat
  // are often only a note that it did. The new chat is told to read what the skill saved before anything else.
  if (skill)
    return (
      `Handoff from the previous chat: it ran /${skill}, which saved the handoff. Its last words there:\n\n${handoff.trim()}\n\n` +
      `First read the handoff /${skill} saved: the files named above, or HANDOFF.md in the project if none is named. ${ask}`
    )
  return `Handoff from the previous chat:\n\n${handoff.trim()}\n\n${ask}`
}

// The handoff's text once its turn has ended, waiting for the chat to go idle so it can be cleared and resent.
let handoffText: string | undefined
let handoffDriving = false

// A handoff asked for and not begun: begun from the session's timer, where a prompt may be sent (a command or a press
// may hold the turn, and the app refuses a prompt sent from there).
let handoffQueued = false
// Quick: a fork with the built-in prompt, seconds. Full: the person's own skill as a turn, which may check and save.
let handoffFull = false
// What follows this handoff once it is written (HandoffAfter).
let handoffThen: HandoffAfter = 'continue'

/** Starts a handoff: asks for it (built-in prompt or the person's own skill); the rest follows when it is written. */
async function startHandoff($: EngineInterface, full = false, after: HandoffAfter = config.handoffAfter) {
  if ((await read($, handoffStage)) !== null) return
  await update($, handoffStage, () => 'writing')
  handoffFull = full
  handoffThen = after
  handoffQueued = true
  await setHandoffCard($, 'writing', handoffFull)
}

/** The choice the handoff bar opens on: the one made last, else quick and the configured after. */
async function lastHandoffChoice($: EngineInterface): Promise<HandoffChoice> {
  const kept = (await $.store.get('handoffChoice').catch(() => null)) as Partial<HandoffChoice> | null
  const kind = kept?.kind === 'full' ? 'full' : 'quick'
  const after = (['continue', 'confirm', 'copy'] as const).find(a => a === kept?.after) ?? config.handoffAfter
  return { kind, after }
}

/** Opens the handoff bar above the prompt: the footer's ⇥ and the swamp band's Handoff. */
async function openHandoffBar($: EngineInterface) {
  if ((await read($, handoffStage)) !== null) return
  const choice = await lastHandoffChoice($)
  await update($, handoffPick, () => choice)
  $.ui.invalidate('ui.render')
}
// The narrowest bar (in cells) that still has room for a Compact button beside Auto and Handoff.
const COMPACT_BUTTON_MIN_COLUMNS = 80
/** Compact pressed: on desktop a bar asks for an optional note first; the terminal compacts at once. */
async function openCompact($: EngineInterface, e: { surface: string }) {
  if (e.surface === 'terminal') return compactCold($)
  compactNote = ''
  compactOpenedAt = await $.clock.now()
  await update($, compactAsk, () => true)
}
async function closeHandoffBar($: EngineInterface) {
  await update($, handoffPick, () => null)
  $.ui.invalidate('ui.render')
}

/** Go in the handoff bar: keeps the choice for next time and starts the handoff. */
async function goHandoff($: EngineInterface, choice: HandoffChoice) {
  await $.store.set('handoffChoice', choice).catch(() => undefined)
  await closeHandoffBar($)
  await startHandoff($, choice.kind === 'full', choice.after)
}

/** What the handoff does, by the choice: who writes it, then what follows. */
export function handoffWhat(choice: HandoffChoice, skill: string): { by: string; then: string } {
  const by =
    choice.kind === 'full'
      ? skill
        ? `/${skill}, slower`
        : 'Checks git and saves HANDOFF.md, slower'
      : 'Done in seconds'
  const then =
    choice.after === 'copy'
      ? 'Copied, chat stays.'
      : choice.after === 'confirm'
        ? 'Clears chat, then waits.'
        : 'Clears chat, carries on.'
  return { by, then }
}

/** What a handoff fork came to, in a few words for /context-lens debug: its reason when it wrote nothing. */
export function forkOutcome(result: unknown, ms: number): string {
  const took = `${(ms / 1000).toFixed(1)}s`
  if (result instanceof Error) return `threw: ${result.message.slice(0, 120)} (${took})`
  const r = result as ModelForkResult | undefined
  if (!r || typeof r !== 'object' || !('isAnswered' in r)) return `threw: ${String(result).slice(0, 120)} (${took})`
  if (r.isAnswered) {
    const u = r.usage
    const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
    const cached = input ? Math.round((u.cache_read_input_tokens / input) * 100) : 0
    return r.text.trim()
      ? `answered, ${u.output_tokens} out, ${cached}% cached (${took})`
      : `answered with blank text (${took})`
  }
  if (r.reason === 'api-error') return `api-error ${r.status ?? 'no response'} ${r.error} (${took})`
  return `${r.reason} (${took})`
}

/** Writes the handoff: quick by a fork with the built-in prompt, full by the person's own skill as a turn. Runs from the timer. */
async function writeHandoff($: EngineInterface) {
  if (!handoffQueued) return
  handoffQueued = false
  try {
    if (handoffFull) {
      // The person's skill, or the built-in full prompt as a turn: either way its reply is the handoff.
      if (config.handoffSkill) await $.command.run({ command: config.handoffSkill, args: '' })
      else await $.prompt.submit({ text: HANDOFF_FULL_PROMPT })
      return
    }
    // A cold cache: a fork would reread the whole chat at full price and write it to the cache again (one handoff took
    // 8% of a person's 5-hour limit). Haiku writes it from the transcript instead, at a fraction of the price.
    const now = await $.clock.now().catch(() => Date.now())
    if ((await read($, cacheLeft)) === 0 || (cacheExpires > 0 && now >= cacheExpires)) {
      const messages = await $.session.messages().catch(() => [])
      const got = messages.length ? await haikuHandoff($, messages).catch(() => null) : null
      await $.store
        .set('lastFork', {
          at: Date.now(),
          outcome: got ? 'cold cache: written by Haiku' : 'cold cache: Haiku failed, forked',
        })
        .catch(() => undefined)
      if (got) {
        handoffText = got
        return
      }
    }
    // The built-in handoff is written by a fork: the same model over this chat as it stands, its start read from the
    // prompt cache, no tools and no turn in the chat. Much quicker than a turn that may go exploring first.
    const startedAt = Date.now()
    const forked = await $.model.fork({ prompt: HANDOFF_PROMPT }).catch((error: unknown) => error)
    const outcome = forkOutcome(forked, Date.now() - startedAt)
    // Kept in the store: before a chat's first message the mod's session may start afresh, and its variables with it.
    await $.store.set('lastFork', { at: Date.now(), outcome }).catch(() => undefined)
    const answered = forked as ModelForkResult
    if (answered?.isAnswered && answered.text.trim()) {
      handoffText = answered.text
      return
    }
    // Nothing to fork (no reply yet) or the fork failed: write it as a turn instead, and say why.
    if (!outcome.startsWith('nothing-to-fork'))
      $.ui.toast(`context-lens: the fork wrote no handoff (${outcome}); writing it as a turn`)
    await $.prompt.submit({ text: HANDOFF_PROMPT })
  } catch (error) {
    await update($, handoffStage, () => null)
    $.ui.toast(
      `context-lens: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`,
    )
  }
}

/** Clears the chat and sends the written handoff into it. Runs from the session's timer, when nothing waits on it. */
export async function finishHandoff($: EngineInterface) {
  await writeHandoff($)
  if (handoffText === undefined || handoffDriving) return
  handoffDriving = true
  const text = handoffText
  handoffText = undefined
  try {
    if (handoffThen === 'copy') {
      // The chat stays: the handoff goes to the clipboard, ready to paste into another chat. Should the clipboard
      // refuse, it goes in the prompt box instead, to cut from there.
      const message = handoffMessage(text, 'continue', handoffFull ? config.handoffSkill : undefined)
      const copied = await $.ui.copy({ text: message }).catch(() => ({ isCopied: false as const }))
      // Under the reply already there, so the next reply takes it away.
      await setHandoffCard($, 'copied', handoffFull, true)
      if (copied.isCopied) $.ui.toast('context-lens: handoff copied. Paste it into a new chat.')
      else {
        await $.prompt.fill({ text: message, mode: 'replace' })
        $.ui.toast('context-lens: the clipboard refused, so the handoff is in the prompt box')
      }
      return
    }
    await update($, handoffStage, () => 'clearing')
    await $.command.run({ command: 'clear', args: '' })
    // Under the first reply of the cleared chat, gone with the one after it.
    await setHandoffCard($, 'done', handoffFull)
    await $.prompt.submit({ text: handoffMessage(text, handoffThen, handoffFull ? config.handoffSkill : undefined) })
  } catch (error) {
    await update($, handoffCard, () => null)
    $.ui.toast(
      `context-lens: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`,
    )
  } finally {
    handoffDriving = false
    await update($, handoffStage, () => null)
  }
}

/** The user and plugin skills, for the handoff picker in the settings and the setup guide. */
async function loadInstalledSkills($: EngineInterface) {
  // Read here, once, not while drawing: a slow or refused lookup must not cost the panel.
  const installed = await $.command.list().catch(() => [])
  // At most 25, handoff-like ones first: a picker with hundreds of options is more than the slot takes.
  const names = [...new Set(installed.filter(c => c.source === 'user' || c.source === 'plugin').map(c => c.name))]
    .filter(name => !name.startsWith('context-lens'))
    .sort((a, b) => Number(!/handoff/i.test(a)) - Number(!/handoff/i.test(b)) || a.localeCompare(b))
    .slice(0, 25)
  await update($, installedSkills, () => names)
}

/** Opens the context-lens settings panel above the prompt: the app does not let a plugin open its /plugin dialog. */
async function openPluginSettings($: EngineInterface) {
  await loadInstalledSkills($)
  await update($, settingsOpen, () => true)
  // Before a chat's first message the app may start the mod's session afresh for each command, and the state with
  // it: the request also goes to the store, which outlives that, and the next drawing picks it up.
  // The store is shared by every chat, so the request names this one: another chat must not open its panel too.
  await $.store.set('openSettingsAt', { at: Date.now(), session: await $.session.id().catch(() => '') })
  $.ui.invalidate('ui.render')
}

/** The settings rows the panel changes, by field: saved as the plugin's own setting and used at once. */
const SETTING_FIELDS = {
  bias: 'effortBias',
  floor: 'effortFloor',
  ceiling: 'effortCeiling',
  handoffAfter: 'handoffAfter',
  handoffSkill: 'handoffSkill',
  hide: 'hide',
  swampAt: 'swampAt',
  layout: 'layout',
  compactWith: 'compactWith',
  handoffButton: 'handoffButton',
  subagents: 'subagents',
  subagentModel: 'subagentModel',
  overrideDefinitions: 'overrideDefinitions',
  holdOffer: 'holdOffer',
  theme: 'theme',
  appearance: 'appearance',
} as const

async function saveSetting($: EngineInterface, field: keyof typeof SETTING_FIELDS, value: string) {
  const { deny } = await $.config
    .set({ key: `context-lens.${SETTING_FIELDS[field]}`, value })
    .catch((error: unknown) => ({ deny: error instanceof Error ? error.message : String(error) }))
  // Some Claude Code builds have no /config row for a plugin's settings and refuse the write: the choice is kept in
  // the mod's own store then, and read back at the next session start. A write that lands clears that copy.
  const kept = ((await $.store.get('savedSettings').catch(() => null)) ?? {}) as Record<string, string>
  const { [SETTING_FIELDS[field]]: _old, ...others } = kept
  const stored = await $.store
    .set('savedSettings', deny ? { ...kept, [SETTING_FIELDS[field]]: value } : others)
    .then(() => true)
    .catch(() => false)
  if (deny && !stored) $.ui.toast(`context-lens: could not save ${field}: ${String(deny).slice(0, 120)}`)
  const raw: Record<string, unknown> = {
    effortBias: String(config.bias),
    effortFloor: config.floor,
    effortCeiling: config.ceiling,
    handoffAfter: config.handoffAfter,
    handoffSkill: config.handoffSkill,
    hide: config.hide.join(','),
    swampAt: String(config.swampAt),
    layout: config.layout,
    compactWith: config.compactWith,
    handoffButton: config.handoffButton,
    subagents: config.subagents,
    subagentModel: config.subagentModel,
    overrideDefinitions: config.overrideDefinitions,
    holdOffer: config.holdOffer,
    theme: config.theme,
    appearance: config.appearance,
    [SETTING_FIELDS[field]]: value,
  }
  setConfig(readConfig(raw))
  applyTheme()
  $.ui.invalidate('ui.render')
}

/** How long the "Settings saved" card stays above the prompt. */
const SAVED_CARD_MS = 2500
/** The card after Save: the bar's own colours, one line, nothing moving. */
function savedCardTree($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  return (
    <Box
      key="saved"
      flexDirection="row"
      alignItems="center"
      gap={1}
      paddingX={1}
      backgroundColor={DASH_BG}
      borderStyle="round"
      borderColor={DASH_EDGE}
    >
      <Text color={ACCENT}>✓</Text>
      <Text bold>Settings saved</Text>
    </Box>
  )
}

/** The settings by their old names, and the names they have now. */
const RENAMED_SETTINGS = { helpers: 'subagents', helperModel: 'subagentModel' } as const

/** The settings in `saved` under an old name, keyed by the new one, for each that is not saved under its new name too. */
export function renamedSettings(saved: Record<string, unknown>): Record<string, string> {
  const carried: Record<string, string> = {}
  for (const [old, now] of Object.entries(RENAMED_SETTINGS))
    if (typeof saved[old] === 'string' && saved[now] === undefined) carried[now] = saved[old] as string
  return carried
}

/**
 * Carries settings saved under an old name to the new one: used at once, and queued to be saved under it. They are read
 * from the mod's own store copy and from settings.json directly, since the app passes the mod only the fields its
 * manifest declares.
 */
async function carryRenamedSettings(
  $: EngineInterface,
  kept: Record<string, unknown>,
): Promise<Record<string, string>> {
  const configs =
    (
      (await $.settings.read().catch(() => ({}))) as {
        pluginConfigs?: Record<string, { options?: Record<string, unknown> }>
      }
    ).pluginConfigs ?? {}
  // A --plugin-dir copy keeps its settings under context-lens@inline, an install under its marketplace's name.
  const stored =
    configs[pluginId($)]?.options ??
    Object.entries(configs).find(([id]) => id.startsWith('context-lens@'))?.[1]?.options ??
    {}
  // A new name saved in either place wins over an old one in the other, so a later change is never carried back.
  const carried = renamedSettings({ ...stored, ...kept })
  const oldInStore = Object.keys(RENAMED_SETTINGS).filter(old => old in kept)
  if (oldInStore.length)
    await $.store.set(
      'savedSettings',
      Object.fromEntries(Object.entries(kept).filter(([key]) => !oldInStore.includes(key))),
    )
  if (!Object.keys(carried).length) return carried

  const fields = Object.fromEntries(Object.entries(SETTING_FIELDS).map(([field, option]) => [option, field])) as Record<
    string,
    string
  >
  const queue = ((await $.store.get('setupSave').catch(() => null)) ?? {}) as Record<string, string>
  const queued = Object.fromEntries(Object.entries(carried).map(([option, value]) => [fields[option], value]))
  await $.store.set('setupSave', { ...queued, ...queue })
  void proof($, `settings renamed: ${Object.keys(carried).join(', ')} carried from their old names`)
  return carried
}

/** Saves every change in the panel's draft, then closes the panel. Nothing changed applies before this. */
async function saveDraft($: EngineInterface) {
  const draft = await read($, settingsDraft)
  // The settings go through the store queue, since each one reloads the plugin.
  const changes: Record<string, string> = {}
  for (const field of Object.keys(SETTING_FIELDS) as (keyof typeof SETTING_FIELDS)[]) {
    const value = draft[field]
    if (value !== undefined) changes[field] = value
  }
  await update($, settingsDraft, () => ({}))
  await update($, settingsOpen, () => false)
  // Said by a card above the prompt, not a toast. Kept in the store: each setting written reloads the plugin.
  await $.store.set('settingsSavedAt', await $.clock.now().catch(() => Date.now()))
  $.ui.invalidate('ui.render')
  await $.store.set('setupSave', changes)
  await drainSetupSave($)
}

export type SetupStep = 'lean' | 'handoff' | 'look' | 'done'

/** The lean's five stops, cheaper to smarter: a name, and what it does to the judge's pick (see tipped). */
export const LEAN_STOPS = [
  ['Cheapest', 'more picks go lower'],
  ['Cheaper', 'unsure picks go lower'],
  ['Balanced', 'the judge decides'],
  ['Smarter', 'unsure picks go higher'],
  ['Smartest', 'more picks go higher'],
] as const

/** The guide's step after this one: the lean, the handoff, the look, then done. */
export function setupNext(step: SetupStep): SetupStep | null {
  if (step === 'lean') return 'handoff'
  if (step === 'handoff') return 'look'
  if (step === 'look') return 'done'
  return null
}

/** The step Back goes to; the lean is the first. */
export function setupBack(step: SetupStep): SetupStep | null {
  if (step === 'handoff') return 'lean'
  if (step === 'look') return 'handoff'
  if (step === 'done') return 'look'
  return null
}

/** "2/3" for the step shown; the closing step has no number. */
export function setupCounter(step: SetupStep): string {
  const n = { lean: 1, handoff: 2, look: 3, done: 0 }[step]
  return n ? `${n}/3` : ''
}

/** Shows a step of the guide; the handoff step needs the installed skills to pick from. */
async function goSetup($: EngineInterface, step: SetupStep | null) {
  if (step === 'handoff') await loadInstalledSkills($)
  await update($, setupStep, () => step)
}

/** The guide's choices over the saved settings: what each step shows. */
export function setupShown(draft: SettingsDraft, saved: JudgeConfig) {
  return {
    bias: draft.bias !== undefined ? Number(draft.bias) : saved.bias,
    handoffSkill: draft.handoffSkill ?? saved.handoffSkill,
    hide: (draft.hide ?? saved.hide.join(',')).split(',').filter(Boolean) as Hideable[],
    appearance: (draft.appearance ?? saved.appearance) as JudgeConfig['appearance'],
  }
}

/** Saves what the guide changed, only the fields that differ, then empties its draft. */
async function flushSetup($: EngineInterface) {
  const draft = await read($, setupDraft)
  await update($, setupDraft, () => ({}))
  const saved: Record<string, string> = {
    bias: String(config.bias),
    handoffSkill: config.handoffSkill,
    hide: config.hide.join(','),
    appearance: config.appearance,
  }
  const changes: Record<string, string> = {}
  for (const field of ['hide', 'bias', 'handoffSkill', 'appearance'] as const) {
    const value = draft[field]
    if (value !== undefined && value.trim() !== saved[field]) changes[field] = value.trim()
  }
  await $.store.set('setupSave', changes)
  await drainSetupSave($)
}

let drainingSetup = false

/**
 * Saves the setup's changes one at a time from the store. Each saved setting reloads the plugin, which cuts off a loop
 * here, so a field leaves the store before it is saved and the reloaded plugin carries on with the rest.
 */
async function drainSetupSave($: EngineInterface) {
  if (drainingSetup) return
  drainingSetup = true
  try {
    for (;;) {
      const queue = ((await $.store.get('setupSave').catch(() => null)) ?? {}) as Record<string, string>
      const [field] = Object.keys(queue)
      if (!field) return
      const { [field]: value, ...rest } = queue
      await $.store.set('setupSave', Object.keys(rest).length ? rest : null)
      if (field in SETTING_FIELDS) await saveSetting($, field as keyof typeof SETTING_FIELDS, value)
    }
  } finally {
    drainingSetup = false
  }
}

/** The guide is settled (finished or closed): it does not open by itself again, and the footer shows ⚙. */
async function markSetupDone($: EngineInterface) {
  await Promise.all([update($, setupPending, () => false), $.store.set('setupDone', true)])
}

/** Closes the guide, at its last step or with the ✕, saving what was picked so far. */
async function closeSetup($: EngineInterface) {
  await markSetupDone($)
  await goSetup($, null)
  await flushSetup($)
}

/** 1234 -> "1.2k", 87 -> "87". */
function tokens(n: number): string {
  const v = Math.abs(n)
  const text = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
  return n < 0 ? `-${text}` : text
}

const share = (part: number, whole: number) => `${Math.round((part / whole) * 100)} %`

/**
 * What /context-lens stats answers: what the prompts Auto steered cost, measured, split by kind and by effort,
 * and what the judge took. No "saved" figure: what a prompt would have cost at another effort is not known,
 * since effort mostly changes how many tool calls it makes. Cost is in tokens weighted as priced (WEIGHT).
 */
export function savedText(raw: Spent): string {
  const t = asSpent(raw)
  const judged = t.judge.haiku
  const subagentRuns = EFFORTS.reduce((n, e) => n + (t.subagents.runs[e] ?? 0), 0)
  if (t.prompts === 0 && judged === 0 && subagentRuns === 0) return 'nothing measured yet'
  const input = t.input * WEIGHT.input
  const write = t.writeHour * WEIGHT.write1h + (t.write - t.writeHour) * WEIGHT.write
  const cached = t.read * WEIGHT.read
  const out = t.out * WEIGHT.out
  const total = input + write + cached + out
  const lines = [
    `${t.prompts} prompts, ${t.requests} requests, cost about ${tokens(Math.round(total))} tokens weighted by price` +
      (total > 0
        ? ` (cache reads ${share(cached, total)}, cache writes ${share(write, total)}, output ${share(out, total)})`
        : ''),
  ]
  const per = EFFORTS.filter(e => t.byEffort[e]?.prompts).map(e => {
    const b = t.byEffort[e]!
    return `${EFFORT_LABELS[e]} ${b.prompts}, average ${tokens(Math.round(b.cost / b.prompts))}`
  })
  if (per.length) lines.push(`Per prompt: ${per.join('; ')}`)
  if (subagentRuns) {
    const per = EFFORTS.filter(e => t.subagents.runs[e]).map(e => `${EFFORT_LABELS[e]} ${t.subagents.runs[e]}`)
    lines.push(
      `Subagents: ${subagentRuns} (${per.join(', ')}), ${t.subagents.requests} requests, cost about ${tokens(Math.round(t.subagents.cost))} tokens`,
    )
  }
  if (judged) {
    lines.push(
      `Judge: Haiku ${t.judge.haiku}, average ${Math.round(t.judge.ms / judged)} ms, ${tokens(t.judge.tokens)} tokens in all`,
    )
  }
  return lines.join('\n')
}

/**
 * You picked an effort (terminal rows): Auto for effort goes off and the requests carry the level for this session
 * only. The app's own effort control keeps its level, so a new chat starts from that one.
 */
async function pickEffort($: EngineInterface, level: Effort) {
  const t0 = Date.now()
  const inUse = (await read($, model)) ?? (await sessionModel($))
  const t1 = Date.now()
  // Together, so the app redraws once for the click and not once per write.
  await Promise.all([
    update($, isAuto, () => false),
    $.store.set('isAuto', false),
    choose($, { model: inUse, effort: level, why: 'your pick', by: 'manual' }),
  ])
  void proof($, `click ${level}: ${Date.now() - t0} ms (read ${t1 - t0}, state ${Date.now() - t1})`)
}

async function toggleAutoEffort($: EngineInterface) {
  const turnOn = !(await read($, isAuto))
  await update($, isAuto, () => turnOn)
  await $.store.set('isAuto', turnOn)
}

async function toggleAutoModel($: EngineInterface) {
  const turnOn = !(await read($, isAutoModel))
  await update($, isAutoModel, () => turnOn)
  await $.store.set('isAutoModel', turnOn)
  if (!turnOn) await update($, suggestion, () => null)
}

async function choose($: EngineInterface, next: Pick | null) {
  setPickCarried(false)
  const before = await read($, pick)
  await Promise.all([update($, pick, () => next), $.store.set('pick', next)])
  // A change Auto made is shown as "Low → High" for a moment, so the switch is seen.
  if (next && next.by !== 'manual' && before && before.effort !== next.effort) {
    const change = { from: before.effort, to: next.effort }
    await update($, switched, () => change)
    $.clock.after(SWITCHED_MS, () => void update($, switched, () => null))
  }
}

// The context figures from the last usage check, for the cache tooltip.
let lastContext: { tokens: number; window: number; percent: number } | null = null

/** k/M for token counts: 420000 -> "420k", 1000000 -> "1.0M". */
function kTokens(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
}

/** Everything a redraw needs, read together: the reads go out at once instead of one after the other. */
async function snap($: EngineInterface) {
  const [
    auto,
    autoModel,
    current,
    judging,
    wanted,
    shownByApp,
    modelNow,
    switchedNow,
    pausedNow,
    cacheNow,
    compacting,
  ] = await Promise.all([
    read($, isAuto),
    read($, isAutoModel),
    read($, pick),
    read($, isJudging),
    read($, suggestion),
    read($, appEffort),
    read($, model),
    read($, switched),
    read($, paused),
    read($, cacheLeft),
    read($, isCompacting),
  ])
  return {
    auto,
    autoModel,
    current,
    judging,
    wanted,
    shownByApp,
    modelNow,
    switchedNow,
    pausedNow,
    cacheNow,
    compacting,
  }
}
type Snap = Awaited<ReturnType<typeof snap>>

/** The hover cards' text: what Auto did and why, and what the cache countdown means with the context it guards. */
export function hoverTips(v: Snap): { effort: string; cache: string } {
  const effortTip = !v.auto
    ? 'Auto is off: the effort stays as you set it. The power button turns Auto on.'
    : v.pausedNow
      ? 'Auto waits on this model: an effort change would rewrite its prompt cache.'
      : !effortOf(v)
        ? 'This model runs without an effort level, so Auto has nothing to set.'
        : [
            v.current
              ? `Auto picked ${EFFORT_LABELS[v.current.effort]}${v.current.by !== 'manual' ? ` (${v.current.by})` : ''}`
              : 'Auto picks the effort for each message',
            v.current?.why ? `Why: ${v.current.why}` : '',
            `Lean: ${['much cheaper', 'cheaper', 'as the judge says', 'smarter', 'much smarter'][config.bias + 2]} · range ${config.floor} to ${config.ceiling}`,
          ]
            .filter(Boolean)
            .join(' · ')
  const ctx =
    lastContext && lastContext.window
      ? ` · Context ${Math.round(lastContext.percent)}% · ${kTokens(lastContext.tokens)}/${kTokens(lastContext.window)}`
      : ''
  const cacheTip =
    v.cacheNow === null
      ? `No prompt cache yet: the first message writes it.${ctx}`
      : v.cacheNow === 0
        ? `Prompt cache cold: the next message reads the whole chat again at full price. Compact first to save.${ctx}`
        : `Prompt cache warm for ${cacheLabel(v.cacheNow)} more: the next message reads the chat from cache, cheap and fast.${ctx}`
  return { effort: effortTip, cache: cacheTip }
}

/** The effort to show: yours or the judge's, else what the app itself runs with. */
function effortOf(v: Snap): Effort | undefined {
  if (v.current) return v.current.effort
  return EFFORTS.includes(v.shownByApp as Effort) ? (v.shownByApp as Effort) : undefined
}

/** "App: Opus 5.5 · Medium", the app's own model and effort, while either differs from what the band sends; else empty.
 * The app's status line, /model and /effort show its own, so this says why they disagree with the band. */
export function appHintText(
  app: { model?: ModelKey; effort?: unknown },
  sent: { model?: ModelKey; effort?: Effort },
): string {
  const appEffortKnown = EFFORTS.includes(app.effort as Effort) ? (app.effort as Effort) : undefined
  const modelDiffers = app.model && sent.model && app.model !== sent.model
  const effortDiffers = appEffortKnown && sent.effort && appEffortKnown !== sent.effort
  if (!modelDiffers && !effortDiffers) return ''
  const parts = [MODELS.find(m => m.key === app.model)?.long, appEffortKnown && EFFORT_LABELS[appEffortKnown]]
  return `App: ${parts.filter(Boolean).join(' · ')}`
}

/** A line with the app hint at the left and `words` at the right end. */
function hintLine(els: { Box: unknown; Text: unknown }, hint: string, words: string, key: string) {
  const { Box, Text } = els as unknown as {
    Box: (p: Record<string, unknown>) => unknown
    Text: (p: Record<string, unknown>) => unknown
  }
  return (
    <Box key={key} flexDirection="row" justifyContent="space-between" columnGap={2}>
      {hint ? (
        <Box flexShrink={0}>
          <Text dimColor>{hint}</Text>
        </Box>
      ) : null}
      <Box flexShrink={1} minWidth={0}>
        <Text dimColor wrap="truncate-end">
          {words}
        </Text>
      </Box>
    </Box>
  )
}

/** The chat's app hint: the model a taken offer or a click sends against the app's, and the pick's effort against the
 * app's when the pick goes out (the send path's rule: yours always, the judge's with Auto on where the cache allows). */
async function appHint($: EngineInterface, v: Snap): Promise<string> {
  const pickGoesOut = v.current && (v.current.by === 'manual' || (v.auto && !v.pausedNow))
  return appHintText(
    { model: keyOf(await $.session.model()), effort: v.shownByApp },
    { model: await sessionModel($), effort: pickGoesOut ? v.current!.effort : undefined },
  )
}
// /context-lens cold shows the band whatever the chat's size, until the next response (a test of the band itself).
let coldForced = false
let handoffTimer: { cancel: () => void } | undefined
const HANDOFF_POLL_MS = 1000
// When Haiku last wrote a compaction (for /context-lens debug).
let lastHaikuCompact = 0

// The moving art's timer: one at a time, blitting the next frame to the band that drew it. A blit the surface refuses
// (the band went away, another drew instead) ends it, so nothing has to stop it from outside.
let artTimer: { cancel(): void } | null = null
let artShown: { requestId: string; kind: ArtKind } | null = null
let artFrameCount = 0

/** A band's art on the terminal: a Raster on the right, moving for alert kinds; null where it has no room. */
function bandArt($: EngineInterface, e: RenderInput<'AbovePrompt'>, kind: ArtKind) {
  const els = themedEls($.ui.resolve(e))
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 0
  if (e.surface !== 'terminal' || !('Raster' in els) || columns < ART_MIN_WIDTH) return null
  // The still sparkles (the resting dashboard, the guide) are 16 by 4 pixels: in a terminal they read as noise, not
  // art. Only the art that says something stays: the alerts, compacting and the done tick.
  if (kind === 'calm' || kind === 'brand') return null
  const { Box, Raster } = els
  artShown = { requestId: e.requestId, kind }
  if (MOVING.has(kind) && !artTimer) {
    artTimer = $.clock.every(ART_FRAME_MS, () => {
      const shown = artShown
      if (!shown || !MOVING.has(shown.kind)) {
        artTimer?.cancel()
        artTimer = null
        return
      }
      artFrameCount++
      void $.ui
        .blit({ requestId: shown.requestId, key: 'art', cells: artFrame(shown.kind, artFrameCount) })
        .then(r => {
          if ('deny' in r && r.deny) {
            artTimer?.cancel()
            artTimer = null
          }
        })
        .catch(() => undefined)
    })
  }
  return (
    <Box key="art-box" flexShrink={0}>
      <Raster key="art" columns={ART_COLUMNS} rows={ART_ROWS} cells={artFrame(kind, artFrameCount)} />
    </Box>
  )
}

/** A bar on the terminal (setup, handoff): the title and words on the left with the brand's still art beside them,
 * the controls on a row of their own that wraps, so nothing is cut at 80 columns. */
function terminalPanel(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  key: string,
  title: string,
  words: unknown,
  controls: unknown[],
) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  return (
    <Box
      key={key}
      flexDirection="column"
      paddingX={1}
      backgroundColor={BRAND_BG}
      borderStyle="round"
      borderColor={BRAND_EDGE}
    >
      <Box flexDirection="row" gap={1} alignItems="center">
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text color={ACCENT} bold wrap="truncate">
            {title}
          </Text>
          {typeof words === 'string' ? (
            <Text key={`${key}-what`} dimColor wrap="truncate">
              {words}
            </Text>
          ) : (
            words
          )}
        </Box>
        {bandArt($, e, 'brand')}
      </Box>
      <Box
        key={`${key}-actions`}
        flexDirection="row"
        flexWrap="wrap"
        justifyContent="flex-end"
        columnGap={1}
        alignItems="center"
      >
        {controls}
      </Box>
    </Box>
  )
}

type TerminalBand = {
  key: string
  kind: ArtKind
  color: string
  bg: string
  edge: string
  title: string
  detail: string
  hint?: string
  buttons: unknown[]
  extra?: unknown
  word?: { text: string; color: string; rest: string }
}

/** What of the band fits in `maxRows` rows. The app scrolls a taller tree in a window and says "n more", so the band gives up,
 * in this order: an empty detail row (one with words is kept), the border and art, the effort row, the lens row. The effort line itself stays. */
export function bandFit(maxRows: number, parts: { detailText: boolean; lens: boolean; effort: number }) {
  const fit = { detail: true, border: true, effort: parts.effort > 0, lens: parts.lens }
  const rows = () =>
    1 + (fit.border ? 2 : 0) + (fit.detail ? 1 : 0) + (fit.lens ? 1 : 0) + (fit.effort ? parts.effort : 0)
  if (rows() > maxRows && !parts.detailText) fit.detail = false
  if (rows() > maxRows) fit.border = false
  if (rows() > maxRows) fit.effort = false
  if (rows() > maxRows) fit.lens = false
  return fit
}

/** An alert band on the terminal: title and buttons, the detail on a line of its own, art on the right, and the effort
 * row under it, so effort stays in sight while a band shows. */
async function terminalBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, b: TerminalBand) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  const { rows: effort, height } = await effortRows($, e)
  const maxRows = typeof e.props.maxRows === 'number' ? e.props.maxRows : 99
  // An empty detail row is kept (so a band does not move when an alert appears) until the room runs out.
  const fit = bandFit(maxRows, { detailText: Boolean(b.detail || b.hint), lens: b.extra !== null, effort: height })
  const art = fit.border ? bandArt($, e, b.kind) : null
  const rows = fit.effort ? effort : null
  // The lens row stays under every band: the dashboard passes its own; an alert gets one sized to what the art leaves.
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 100
  const extra = !fit.lens
    ? null
    : b.extra !== undefined
      ? b.extra
      : await lensRow($, e, Math.max(20, columns - 4 - (art ? ART_COLUMNS + 1 : 0))).catch(() => null)
  return (
    <Box key={`${b.key}-col`} flexDirection="column">
      <Box
        key={b.key}
        flexDirection="row"
        gap={1}
        alignItems="center"
        paddingX={1}
        backgroundColor={b.bg}
        borderStyle={fit.border ? 'round' : undefined}
        borderColor={b.edge}
      >
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Box flexDirection="row" gap={1} alignItems="center">
            <Box flexShrink={0}>
              {b.word ? (
                <Box flexDirection="row">
                  <Text color={b.color} bold>
                    {'✦ '}
                  </Text>
                  <Text key={`${b.key}-word`} color={b.word.color} bold>
                    {b.word.text}
                  </Text>
                  <Text color={b.color} bold>
                    {b.word.rest}
                  </Text>
                </Box>
              ) : (
                <Text color={b.color} bold>{`✦ ${b.title}`}</Text>
              )}
            </Box>
            <Box flexGrow={1} />
            {b.buttons}
          </Box>
          {/* An empty detail still takes its row (a no-break space), so the dashboard is as tall as an alert and nothing moves
              when one appears. */}
          {fit.detail ? hintLine({ Box, Text }, b.hint ?? '', b.detail || '\u00a0', `${b.key}-detail`) : null}
          {extra}
        </Box>
        {art}
      </Box>
      {rows}
    </Box>
  )
}

/** The dashboard's two lines: the effort with the cache and the context, then the judge's reason and the last reply. */
export function dashboardLines(d: {
  auto: boolean
  paused: boolean
  judging: boolean
  /** A subagent is in view: the word is its effort alone, none of the chat's Auto state. */
  agent?: boolean
  effort: Effort | undefined
  /** The model's long name ("Opus 5.5"), written before the effort; none when unknown. */
  model?: string
  cacheNow: number | null
  contextPercent: number | null
  reason: string
}): { head: string; what: string; pair: string; rest: string; detail: string } {
  const level = d.effort ? EFFORT_LABELS[d.effort] : 'Auto'
  // Auto on or off is the button's to say (and the terminal's effort row's), not the text's.
  const what = d.agent
    ? d.effort
      ? level
      : 'Subagent'
    : d.judging
      ? 'Deciding…'
      : !d.auto
        ? 'Off'
        : d.paused
          ? `${level} · Auto paused`
          : level
  // The model and the effort read as one pair, coloured together.
  const pair = d.model ? `${d.model} · ${what}` : what
  const head = [
    `✦ ${pair}`,
    d.cacheNow === null ? null : `cache ${cacheLabel(d.cacheNow)}`,
    d.contextPercent === null ? null : `${Math.round(d.contextPercent)}% context`,
  ]
  const shown = head.filter(Boolean) as string[]
  return {
    head: shown.join(' · '),
    what,
    pair,
    rest: shown
      .slice(1)
      .map(part => ` · ${part}`)
      .join(''),
    detail: d.reason,
  }
}

/** How long the effort word glows after it changes: held at full colour, then faded out; and the step of the fade. */
const FLASH_HOLD_MS = 1000
const FLASH_MS = 1800
/** The fade's steps, [ms, share of the way to white]: five, so it reads as a fade without a tick. Each step is a redraw,
 * and every redraw rebuilds the band (images restart, buttons under a pointer are swapped), so keep them few. */
const FLASH_STEPS: readonly (readonly [number, number])[] = [
  [1000, 0.15],
  [1160, 0.35],
  [1320, 0.55],
  [1480, 0.75],
  [1640, 0.9],
]
/** The effort word's colour `ms` after it changed: the glow, held, then easing out to the band's white. */
export function flashColor(ms: number | null): string {
  if (ms === null || ms >= FLASH_MS) return DASH_TEXT
  if (ms < FLASH_HOLD_MS) return FLASH_COLOR
  const k = [...FLASH_STEPS].reverse().find(([at]) => ms >= at)?.[1] ?? 0
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map(i =>
      Math.round(ch(FLASH_COLOR, i) + (ch(DASH_TEXT, i) - ch(FLASH_COLOR, i)) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}
// The word the dashboard last showed and when it last changed, so a new effort glows and fades. Not while the judge
// decides: the word it lands on is compared with the one before.
let flashWord: string | null = null
let flashAt: number | null = null

async function effortFlash($: EngineInterface, what: string, judging: boolean, entering = false): Promise<string> {
  const now = await $.clock.now()
  // The dashboard coming back (after Handoff, settings or an alert) takes the word as it is: a change made while it was
  // away is not a switch to point at.
  if (entering && !judging) {
    flashWord = what
    flashAt = null
  }
  if (!judging) {
    // Auto switched off or on is not a new verdict: the switch says it, so the word changes without the flash.
    if (flashWord !== null && flashWord !== what) flashAt = what === 'Off' || flashWord === 'Off' ? null : now
    flashWord = what
  }
  const since = flashAt === null ? null : now - flashAt
  if (since === 0) {
    // One redraw at each step of the fade and one at its end, not a tick: see FLASH_STEPS.
    for (const at of [...FLASH_STEPS.map(([t]) => t), FLASH_MS])
      $.clock.after(at + 20, () => $.ui.invalidate('ui.render'))
  }
  return flashColor(since)
}

// Uninstall's first press arms it; a second within UNINSTALL_ARM_MS uninstalls. Then the plugins reload and the mod is
// gone from this chat; its settings stay in settings.json, so a reinstall picks them up.
const UNINSTALL_ARM_MS = 4000
let uninstallArmedAt = 0
let uninstalling = false
/** A plain /reload-plugins holds back a change that would make the next message re-read the chat without the cache; --force reloads anyway. */
const RELOAD_ARGS = '--force'
function uninstallButton($: EngineInterface, els: ReturnType<EngineInterface['ui']['resolve']>) {
  const { Box, Text, Button, Svg } = els
  const armed = Date.now() - uninstallArmedAt < UNINSTALL_ARM_MS
  const press = async () => {
    if (uninstalling) return
    if (!armed) {
      uninstallArmedAt = Date.now()
      $.ui.invalidate('ui.render')
      $.clock.after(UNINSTALL_ARM_MS + 50, () => $.ui.invalidate('ui.render'))
      return
    }
    uninstalling = true
    $.ui.invalidate('ui.render')
    const r = await runClaude($, ['plugin', 'uninstall', pluginId($)], { timeoutMs: 120_000 }).catch(error => ({
      exitCode: 1,
      stdout: '',
      stderr: String(error),
    }))
    uninstalling = false
    if (r.exitCode !== 0) {
      const why = (r.stderr || r.stdout).trim().split('\n').pop() ?? ''
      $.ui.toast(`context-lens: uninstall failed: ${noClaudeHint(why, await homeDir($)) ?? why}`)
      $.ui.invalidate('ui.render')
      return
    }
    $.ui.toast('context-lens is uninstalled. Thanks for trying it.')
    const reloaded = await $.command.run({ command: 'reload-plugins', args: RELOAD_ARGS } as never).then(
      () => true,
      () => false,
    )
    if (!reloaded) await typeCommand($, `/reload-plugins ${RELOAD_ARGS}`)
  }
  const label = uninstalling ? 'Uninstalling…' : armed ? 'Press again to uninstall' : 'Uninstall'
  if (!Svg) return <Button key="settings-uninstall" plain dimColor={!armed} label={label} onPress={press} />
  // A bin and the word, grey; red under the pointer, and red while armed (the red bin is laid over the grey one, since
  // a hover can only reveal). A blank button over both takes the press.
  const red = armed || uninstalling
  return (
    <Box key="settings-uninstall-box" position="relative" flexDirection="row" alignItems="center" flexShrink={0}>
      <Box position="relative" width={2} height={1} alignItems="center">
        <Box position="absolute" top={0} left={0}>
          <Svg source={binSvg(DASH_DIM)} alt="bin" width={14} height={14} />
        </Box>
        <Box
          position="absolute"
          top={0}
          left={0}
          display={red ? 'flex' : 'none'}
          hover={red ? undefined : { scope: 'uninstall', display: 'flex' }}
        >
          <Svg source={binSvg(UNINSTALL_RED)} alt="bin" width={14} height={14} />
        </Box>
      </Box>
      <Text color={red ? UNINSTALL_RED : DASH_DIM} hover={{ scope: 'uninstall', color: UNINSTALL_RED }}>
        {label}
      </Text>
      <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
        <Button
          key="settings-uninstall"
          plain
          hover={{ scope: 'uninstall', backgroundColor: '#00000000' }}
          label={' '.repeat(label.length + 3)}
          onPress={press}
        />
      </Box>
    </Box>
  )
}

/** The handoff or compact card: words, the moving art while it runs, green with a check once it has landed. `above` is
 * what sits over it (the reply it hangs under), or nothing for the band above the prompt. */
function handoffCardTree(
  $: EngineInterface,
  e: RenderInput<'AssistantMessage'> | RenderInput<'AbovePrompt'>,
  fresh: HandoffCard,
  above: unknown,
  onDismiss?: () => unknown,
) {
  const { Box, Text, Svg, Button } = themedEls($.ui.resolve(e))
  const by = fresh.full ? 'Full' : 'Quick'
  const words = {
    writing: [
      '✦ Handing off…',
      `${by} handoff being written. ${fresh.full ? 'Your skill takes a little while.' : 'A few seconds.'}`,
    ],
    done: ['✦ Handoff complete', 'Carried on from the last chat. The old one is cleared.'],
    copied: ['✦ Handoff copied', 'Paste it into a new chat. This one stays.'],
    compacting: ['✦ Compacting…', 'The chat is being summed up. Takes a minute or so.'],
    compacted: ['✦ Compact complete', 'The chat is summed up; the next message reads far less.'],
  }[fresh.kind]
  // Compacting is a wait in the background, not a result: one quiet line over the band's calm art, not the loud glow.
  const quiet = fresh.kind === 'compacting'
  const card = (
    <Box
      key="reply-handoff"
      position="relative"
      flexDirection="row"
      alignItems="center"
      paddingX={1}
      overflow="hidden"
      backgroundColor={cardLanded(fresh.kind) ? DONE_BG : BRAND_BG}
      borderStyle="round"
      borderColor={cardLanded(fresh.kind) ? DONE_EDGE : BRAND_EDGE}
    >
      <Box key="reply-handoff-art" position="absolute" top={-1} right={0} bottom={-1}>
        {quiet ? (
          <Svg source={DASH_SVG} alt="compacting" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
        ) : cardRunning(fresh.kind) ? (
          <Svg source={HANDOFF_SVG} alt="handing off" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
        ) : (
          <Svg
            source={cardLanded(fresh.kind) ? DONE_SVG : BRAND_SVG}
            alt="context-lens"
            width={FROST_WIDTH * 2}
            height={FROST_HEIGHT * 2}
          />
        )}
      </Box>
      <Box
        key="reply-handoff-words"
        position="relative"
        flexDirection={quiet ? 'row' : 'column'}
        gap={quiet ? 1 : 0}
        flexShrink={1}
        minWidth={0}
      >
        {markTitle(
          { Box, Text, Svg },
          'reply-handoff-title',
          cardLanded(fresh.kind) ? DONE_ACCENT : ACCENT,
          words[0],
          cardLanded(fresh.kind) ? DONE_MARK_SVG : MARK_SVG,
        )}
        <Text wrap="truncate">{words[1]}</Text>
      </Box>
      {onDismiss ? (
        <Box key="reply-handoff-close" position="relative" flexGrow={1} flexDirection="row" justifyContent="flex-end">
          <Box position="absolute" top={0} left={0} />
          {/* A box just the ✕'s size, so its hover lights only the ✕, not the card's right half. */}
          <Box key="card-close-box" position="relative" flexShrink={0}>
            <Box position="absolute" top={0} left={0} />
            <Button
              key="card-close"
              plain
              role="dismiss"
              label="✕"
              hover={{ backgroundColor: CARD_CLOSE_HOVER }}
              onPress={onDismiss}
            />
          </Box>
        </Box>
      ) : null}
    </Box>
  )
  if (above === undefined) return card
  return (
    <Box key="reply" flexDirection="column" gap={1}>
      {above as never}
      {card}
    </Box>
  )
}

/** The session's timers. A reload loads the module again with no session start, so the band's first draw starts them
 * too; a session start restarts them, cancelling the ones the draw started. */
let timersFrom: 'start' | 'draw' | null = null
let tickers: { cancel: () => void }[] = []
let timersScheduled = false
function startTimers($: EngineInterface, from: 'start' | 'draw') {
  if (timersFrom === 'start' || (timersFrom === 'draw' && from === 'draw')) return
  timersFrom = from
  // A timer started inside a request ends with that request, so the clocks live here.
  tickers.forEach(ticker => ticker.cancel())
  tickers = [
    $.clock.every(CACHE_TICK_MS, () => void showCache($).catch(() => undefined)),
    $.clock.every(CACHE_TICK_MS, () => void checkSwamp($).catch(() => undefined)),
    $.clock.every(LENS_TICK_MS, () => void lensTick($).catch(() => undefined)),
  ]
  // Read the usage at once too, so the context ring is there from the start rather than a tick later.
  void checkSwamp($)
    .then(() => $.ui.invalidate('ui.render'))
    .catch(() => undefined)
  // A written handoff is cleared and resent from here: a hook the turn waits on may not run commands.
  handoffTimer?.cancel()
  handoffTimer = $.clock.every(HANDOFF_POLL_MS, () => {
    if (redrawsOwed > 0) {
      // Drawn since the ask: the band is up to date, so a redraw would only restart its animations.
      if (lastRenderAt > redrawAskedAt + REDRAW_SETTLE_MS) redrawsOwed = 0
      else {
        redrawsOwed--
        $.ui.invalidate('ui.render')
      }
    }
    // Right after a start the app may not have the usage yet: ask each second until it has, so the ring shows.
    if (!lastContext || !lastContext.window)
      void checkSwamp($)
        .then(() => lastContext?.window && $.ui.invalidate('ui.render'))
        .catch(() => undefined)
    // The dashboard's countdown ticks inside its own image; the band is redrawn once a minute to start the next one.
    if (cacheExpires > 0 && !config.hide.includes('timer'))
      void $.clock.now().then(now => {
        const minute = Math.floor((cacheExpires - now) / 60_000)
        if (now < cacheExpires + HANDOFF_POLL_MS && minute !== clockMinute) {
          clockMinute = minute
          $.ui.invalidate('ui.render')
        }
      })
    void writeRenderLog($).catch(() => undefined)
    void finishHandoff($).catch(() => undefined)
  })
}
/** How long "Compact complete" stays above the prompt when nothing else clears it. */
const COMPACT_CARD_MS = 20_000
/** A settings part's body on desktop is as tall as the overview's row of cards, so the panel keeps its height going in
 * and out of a part. In lines (a Box height is a number of lines or a percentage) at the app's 19 px line: 56 px makes
 * the band 121.5 px tall in every part, as with the cards. */
const SETTINGS_BODY_H = 56 / 19
/** A handoff's or compact's card for the band above the prompt: while it runs, and once landed until the next message
 * is sent, the ✕ is pressed or its time has passed (COMPACT_CARD_MS, HANDOFF_CARD_MS). */
async function compactCard($: EngineInterface, working = false) {
  const card = await read($, handoffCard)
  if (!card || cardRunning(card.kind)) return card
  const keep = card.kind === 'compacted' ? COMPACT_CARD_MS : HANDOFF_CARD_MS
  if (working || (card.kind === 'compacted' && card.seen) || (await $.clock.now()) - card.at >= keep) return null
  return card
}
// Handoff is calm until Haiku says a fresh chat would suit now (handoffAdvice); then it is the white box with a glow.
// What the band last read from handoffAdvice, so the drawing helpers need no await.
let adviceNow: string | null = null
const HANDOFF_ADVICE_LEVEL = 50
// "Always" (the Handoff button setting) keeps the slot as Handoff, calm in a grey box, and loud only once advised.
const handoffLevel = () => (adviceNow ? HANDOFF_ADVICE_LEVEL : config.handoffButton === 'always' ? HANDOFF_BOX_AT : 0)
const handoffLoud = () => adviceNow !== null
const handoffSlot = () => handoffLoud() || config.handoffButton === 'always'
/** Redraws the band every JUDGE_STEP_MS from `from` ms over `span` ms, so each piece of the rise or fade is drawn in turn. */
function drawGlowSteps($: EngineInterface, from: number, span: number) {
  for (let at = Math.max(0, from); at <= from + span + JUDGE_STEP_MS; at += JUDGE_STEP_MS)
    $.clock.after(at + 5, () => $.ui.invalidate('ui.render'))
}
// The glow's clock is read as late as the draw allows, and set ahead by how long the rest of a draw takes (measured,
// smoothed): a fade placed where it was when the draw began showed up that much behind, a little brighter at every
// redraw, which read as lag and as a second glow.
let glowReadAt: number | null = null
let drawLead = 20
// When the judge started, and when it gave its verdict (null while it decides).
let judgeStartedAt = 0
let judgeEndedAt: number | null = 0
/** The verdict is in: the rim starts fading now, together with the effort word's flash, not after the effort and model
 * are applied. Redraws when the fade swaps in and once it is over. */
async function endJudgeGlow($: EngineInterface, why: string) {
  if (judgeEndedAt !== null) return
  judgeEndedAt = await $.clock.now().catch(() => Date.now())
  const fadeAt = Math.max(judgeEndedAt, judgeStartedAt + JUDGE_RISE_MS) - judgeEndedAt
  renderLog.push(
    `${new Date().toISOString()} ${loadedSession} glow: ${why} ${judgeEndedAt - judgeStartedAt} ms after start, fade in ${fadeAt} ms`,
  )
  drawGlowSteps($, fadeAt, JUDGE_FADE_MS)
  $.ui.invalidate('ui.render')
}
// Auto as the bar last saw it, and when it last flipped, either way (for the edge glow and the switch's slide).
let autoSeen: boolean | undefined
let autoOnAt = -Infinity
let autoFlipAt = 0
let autoModelSeen: boolean | undefined
let autoModelFlipAt = 0
// The settings switches as last drawn, and when each flipped, by key (for the slide).
const settingSwitches = new Map<string, { on: boolean; at: number }>()

/** The dashboard: what context-lens is doing, and Auto, Handoff and settings. The slot above the prompt at rest. */
async function dashboardBand($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const els = themedEls($.ui.resolve(e))
  const { Box, Text, Button } = els
  const v = await snap($)
  adviceNow = (await read($, handoffAdvice)) ?? null
  await introShows($, 'dash')
  // The first draw since another band stood here.
  const entering = introFresh
  introFresh = false
  const nowMs = await $.clock.now()
  if (autoSeen !== undefined && autoSeen !== v.auto) {
    autoFlipAt = nowMs
    // No redraw to end the slide or the glow: both finish inside their images (the glow fades to nothing), and every
    // redraw rebuilds the buttons under a resting pointer, which flickers their hover.
    autoOnAt = nowMs
  }
  autoSeen = v.auto
  if (autoModelSeen !== undefined && autoModelSeen !== v.autoModel) autoModelFlipAt = nowMs
  autoModelSeen = v.autoModel
  // A subagent in view shows the model and effort it ran at; the chat's own come from the session.
  // One just spawned has not made a request yet: its effort is the subagent pick if there is one, else unknown, never the chat's.
  const inAgent = e.props.view.agentId !== undefined
  const viewed = inAgent ? (await read($, lensAgents)).find(a => a.id === e.props.view.agentId) : undefined
  const shownModel: ModelKey | undefined = inAgent ? viewed?.model : (v.modelNow ?? undefined)
  const effortNow = inAgent
    ? (viewed?.effort ?? (await subagentEffortOf($, e.props.view.agentId!).catch(() => undefined)))
    : effortOf(v)
  const by = v.current?.by
  const reason = v.current
    ? `${by === 'manual' || by === 'named' ? 'You' : 'Why'}: ${v.current.why}`
    : v.auto
      ? 'Auto picks the effort at the next prompt'
      : 'You pick the effort'
  // Desktop draws the cache after the context ring, grey, with a hover that explains both; the terminal says it inline.
  const drawn = e.surface !== 'terminal' && 'Svg' in els
  // A cold cache is the cold band's to say; the resting bar shows the countdown only while there is one.
  const cacheShown = config.hide.includes('timer') || (v.cacheNow !== null && v.cacheNow <= 0) ? null : v.cacheNow
  // The lens's row (cache timers, context bar, usage) sits under the detail line. Its width is the band's inside: the
  // border and the padding take four columns. The resting terminal band draws no art beside it.
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 100
  const lens = await lensRow($, e, Math.max(20, columns - 4)).catch(() => null)
  const judgingHere = !inAgent && Boolean(v.judging)
  const hint = inAgent ? '' : await appHint($, v)
  const modelName = MODELS.find(m => m.key === shownModel)?.long
  const { head, what, pair, rest, detail } = dashboardLines({
    auto: v.auto,
    paused: Boolean(v.pausedNow),
    judging: judgingHere,
    agent: inAgent,
    effort: effortNow,
    model: modelName,
    cacheNow: drawn || lens ? null : cacheShown,
    // Desktop draws the context as a ring and a figure (as the swamp band does); the terminal says it in words.
    contextPercent: !lens && e.surface === 'terminal' && lastContext && lastContext.window ? lastContext.percent : null,
    // The judge's reason and the handoff advice are about the chat's own prompt, not a subagent's work.
    // The terminal gives the hint a place of its own on the detail line; desktop's one row has none, so it leads the reason.
    reason: inAgent
      ? ''
      : [
          e.surface === 'terminal' ? '' : hint,
          adviceNow ? `Handoff would suit: ${adviceNow}` : config.hide.includes('reason') ? '' : reason,
        ]
          .filter(Boolean)
          .join(' — '),
  })
  const toggleSettings = async () => {
    if (await read($, settingsOpen)) {
      await update($, settingsDraft, () => ({}))
      await update($, settingsOpen, () => false)
      $.ui.invalidate('ui.render')
    } else await openPluginSettings($)
  }
  const buttons = [
    // Once the slot is Handoff (advised, or the setting says always), Compact stays beside it as quiet text, so both are
    // a press away. Desktop only, where there is room for it; the terminal compacts in one press from its own rows.
    ...(e.surface !== 'terminal' &&
    'Svg' in els &&
    !config.hide.includes('handoff') &&
    handoffSlot() &&
    (typeof e.props.bodyColumns !== 'number' || e.props.bodyColumns >= COMPACT_BUTTON_MIN_COLUMNS)
      ? [<Button key="dash-compact" plain dimColor label="Compact" onPress={() => openCompact($, e)} />]
      : []),
    ...(config.hide.includes('handoff')
      ? []
      : [
          // One button in one place: Compact until Haiku says a fresh chat would suit, then Handoff, loud. Pressing it opens
          // the matching card, which can switch to the other. Desktop draws it: no box on a fresh chat, then a
          // step a percent of context to a white box at HANDOFF_LOUD_AT (handoffLook), the label as Text over the box and
          // a blank button over both to take the click. The terminal keeps the plain buttons: grey, white from
          // HANDOFF_LOUD_AT.
          'Svg' in els && e.surface !== 'terminal' ? (
            <Box key="dash-handoff-wrap" flexShrink={0} flexDirection="row">
              {/* No glow while a reply runs: the band redraws then, and each redraw restarted the glow, so it flickered. */}
              {handoffLoud() && !e.props.isWorking ? (
                <Box
                  key="dash-glow"
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={-2}
                  right={-2}
                  alignItems="center"
                  justifyContent="center"
                >
                  <els.Svg
                    source={handoffGlowSvg(handoffGlowStep(handoffLevel()), nowMs)}
                    alt="handoff glow"
                    width={GLOW_W}
                    height={GLOW_H}
                  />
                </Box>
              ) : null}
              {/* The H key, once Handoff is loud: on a button of its own, clipped away, since a blank button with a
                  hotkey draws its letter over the label. */}
              {handoffLoud() ? (
                <Box key="dash-handoff-key" width={0} height={1} overflow="hidden">
                  <Button key="dash-handoff-h" plain hotkey="h" label="Handoff" onPress={() => openHandoffBar($)} />
                </Box>
              ) : null}
              {/* Its width is a spacer in the flow, not the image: the app can lay an image out at no width, and the
                  label (centred over it) would run into Auto. */}
              <Box key="dash-handoff-box" flexShrink={0} flexDirection="row" alignItems="center">
                <Box width={9} height={1} flexShrink={0} />
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <els.Svg
                    source={handoffPillSvg(handoffLevel())}
                    alt="Handoff box"
                    width={HANDOFF_PILL_W}
                    height={HANDOFF_PILL_H}
                  />
                </Box>
                {/* Its hover: a lighter pill shown over the box, not the app's ghost fill, which is sized to the blank
                    label and sat off the drawn box. */}
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                  display="none"
                  hover={{ scope: 'handoff', display: 'flex' }}
                >
                  <els.Svg
                    source={handoffPillSvg(handoffLevel(), true)}
                    alt="Handoff box"
                    width={HANDOFF_PILL_W}
                    height={HANDOFF_PILL_H}
                  />
                </Box>
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    color={handoffLook(handoffLevel()).label}
                    hover={{ scope: 'handoff', color: handoffLook(handoffLevel(), true).label }}
                  >
                    {handoffSlot() ? 'Handoff' : 'Compact'}
                  </Text>
                </Box>
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Button
                    key="dash-handoff"
                    plain
                    label={' '.repeat(14)}
                    hover={{ scope: 'handoff', backgroundColor: '#00000000' }}
                    onPress={() => (handoffSlot() ? openHandoffBar($) : openCompact($, e))}
                  />
                </Box>
              </Box>
            </Box>
          ) : handoffLoud() ? (
            <Button key="dash-handoff" variant="primary" hotkey="h" label="Handoff" onPress={() => openHandoffBar($)} />
          ) : (
            <Button key="dash-handoff" variant="secondary" label="Handoff" onPress={() => openHandoffBar($)} />
          ),
        ]),
    // The terminal says it in a word; the desktop draws an icon, with this button laid blank over it to take the click.
    // No-break spaces, not braille blanks: some fonts draw U+2800 as a dot.
    <Button
      key="dash-settings"
      plain
      label={'Svg' in els && e.surface !== 'terminal' ? '   ' : 'Settings'}
      onPress={toggleSettings}
    />,
  ].filter(Boolean)
  // The terminal switches both Autos on the Model and Effort pickers under the band; desktop has no pickers.
  const autoButtons = [
    <Button
      key="dash-auto-model"
      variant="secondary"
      dimColor={!v.autoModel}
      label={v.autoModel ? 'Auto model on' : 'Auto model off'}
      onPress={() => toggleAutoModel($)}
    />,
    <Button
      key="dash-auto"
      variant="secondary"
      dimColor={!v.auto}
      label={v.auto ? 'Auto effort on' : 'Auto effort off'}
      onPress={() => toggleAutoEffort($)}
    />,
  ]
  // The terminal flashes the effort word as the desktop does: in the accent on a change, fading back to white.
  if (e.surface === 'terminal')
    return terminalBand($, e, {
      key: 'dash',
      kind: 'calm',
      color: DASH_TEXT,
      bg: DASH_BG,
      edge: DASH_EDGE,
      title: head.replace(/^✦ /, ''),
      detail,
      hint,
      buttons,
      extra: lens,
      word: { text: pair, color: await effortFlash($, what, judgingHere, entering), rest },
    })
  const Svg = 'Svg' in els ? els.Svg : undefined
  const wordColor = await effortFlash($, what, judgingHere, entering)
  glowReadAt = Date.now()
  const glowNow = (await $.clock.now().catch(() => nowMs)) + drawLead
  const glowSource = Svg ? judgeGlowAt(judgeStartedAt, judgeEndedAt, glowNow) : null

  const autoGlowing = Svg && v.auto && nowMs - autoOnAt < AUTO_GLOW_MS
  if (autoGlowing) renderLog.push(`glow on at ${nowMs - autoOnAt} ms`)
  if (glowSource && judgeEndedAt !== null)
    renderLog.push(
      `${new Date().toISOString()} ${loadedSession} glow: fade drawn at +${Math.round(glowNow - Math.max(judgeEndedAt, judgeStartedAt + JUDGE_RISE_MS))} ms, lead ${Math.round(drawLead)} ms, ${Math.round(glowNow - drawLead - nowMs)} ms after the draw began`,
    )
  return (
    <Box
      key="dash"
      position="relative"
      flexDirection="row"
      alignItems="center"
      paddingX={1}
      overflow="hidden"
      backgroundColor={DASH_BG}
      borderStyle="round"
      borderColor={DASH_EDGE}
    >
      {Svg ? (
        // Auto off: the art goes, so the bar reads as resting, not working.
        v.auto ? (
          <Box key="dash-art" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={DASH_SVG} alt="context-lens" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
          </Box>
        ) : null
      ) : null}
      {autoGlowing ? (
        <Box key="dash-auto-glow" position="absolute" top={0} left={0} right={0} bottom={0}>
          <Svg
            source={inPhase(autoGlowSvg(v.auto), nowMs - autoOnAt)}
            alt="auto glow"
            width={AUTO_GLOW_W}
            height={AUTO_GLOW_H}
          />
        </Box>
      ) : null}
      {/* The judge decides: the rim lights up in the accent, holds, and fades from full once the verdict is in. */}
      {Svg && glowSource ? (
        <Box key="dash-judge-glow" position="absolute" top={0} left={0} right={0} bottom={0}>
          <Svg source={glowSource} alt="deciding glow" width={AUTO_GLOW_W} height={AUTO_GLOW_H} />
        </Box>
      ) : null}
      {/* One row: the effort word, the context ring, the cache, then the reason and the last reply, dim. The word never shrinks;
          when room runs out the reason goes first (it shrinks a hundred times faster), then the cache, and the row clips
          rather than run under the buttons. Siblings, not nested: a shrunk parent let the word spill under the ring. */}
      <Box
        key="dash-words"
        position="relative"
        flexDirection="row"
        flexGrow={1}
        flexShrink={1}
        minWidth={0}
        overflow="hidden"
      >
        <Box flexShrink={0} flexDirection="row">
          {Svg ? (
            // The mark, as it is, where the ✦ stood; faded while Auto is off.
            <Box key="dash-mark" flexShrink={0} marginRight={1} alignItems="center">
              <Svg
                source={v.auto ? MARK_SVG : DASH_MARK_OFF}
                alt="context-lens"
                width={DASH_MARK_SIZE}
                height={DASH_MARK_SIZE}
              />
            </Box>
          ) : (
            <Text color={v.auto ? ACCENT : DASH_DIM} bold>
              ✦{' '}
            </Text>
          )}
          {/* A new effort shows in the accent, then white (effortFlash): plain text in the app's font. An animated image
              of the word looked cheap: another font, a late start and a jump back to the text. */}
          <Text key="dash-level" color={wordColor} bold>
            {judgingHere && Svg ? (modelName ? `${modelName} · Deciding` : 'Deciding') : pair}
          </Text>
          {/* While the judge decides: thinking dots, as a plain image (its CSS still runs, and a
              redraw does not restart it the way an interactive frame does). */}
          {judgingHere && Svg ? (
            <Box key="dash-thinking" flexShrink={0} marginLeft={1} alignItems="center">
              <Svg source={thinkingSvg()} alt="deciding" width={THINK_W} height={PILL_H} />
            </Box>
          ) : null}
        </Box>
        {rest ? (
          <Box flexShrink={detail ? 0 : 1} minWidth={0}>
            <Text color={DASH_TEXT} bold wrap="truncate">
              {rest}
            </Text>
          </Box>
        ) : null}
        {/* What shows when room runs out, most needed first: the effort and the context never shrink; the cache shrinks
            next and goes; the reason (dim, after it) goes first of all. Hovering the ring or the cache swaps the reason
            for what they mean. */}
        {Svg && lastContext && lastContext.window ? (
          <Box
            key="dash-ring"
            flexShrink={0}
            marginLeft={2}
            flexDirection="row"
            gap={1}
            alignItems="center"
            hover={{ scope: 'dash-cache', backgroundColor: HOVER_BOX }}
          >
            <Svg
              source={ringSvg(lastContext.percent, DASH_TEXT)}
              alt={`${Math.round(lastContext.percent)}% of context`}
              width={16}
              height={16}
            />
            <Text color={DASH_TEXT}>{`${Math.round(lastContext.percent)}%`}</Text>
          </Box>
        ) : null}
        {/* The tail: the cache, then the judge's reason, on one wrapping row one line high. The reason has no width of
            its own (it only takes what is left, truncated), so it always fits the first row and goes first; the cache
            keeps its fixed width (the ticking seconds never shift the row) and, once it no longer fits, wraps to the
            hidden second row whole, taking the reason with it. */}
        {Svg && (cacheShown !== null || detail) ? (
          <Box
            key="dash-tail"
            flexGrow={1}
            flexShrink={1}
            minWidth={0}
            height={1}
            overflow="hidden"
            flexDirection="row"
            flexWrap="wrap"
            marginLeft={2}
          >
            <Box width={0} height={1} />
            {cacheShown !== null ? (
              <Box
                key="dash-cache-time"
                width={11}
                flexShrink={0}
                hover={{ scope: 'dash-cache', backgroundColor: HOVER_BOX }}
              >
                <Svg
                  source={cacheClockSvg(
                    cacheExpires - (await $.clock.now()),
                    cacheShown === 0 ? ICE : (cacheColor(cacheShown) ?? DASH_DIM),
                  )}
                  alt={`cache ${cacheClock(cacheExpires - (await $.clock.now()))}`}
                  width={84}
                  height={17}
                />
              </Box>
            ) : null}
            {detail ? (
              // Over the reason, shown only while the ring or cache is hovered, what they mean: a hover can only
              // reveal, so the tip is a layer on the band's colour that covers the reason.
              <Box
                key="dash-detail"
                position="relative"
                width={0}
                flexGrow={1}
                flexShrink={1}
                minWidth={10}
                marginLeft={cacheShown !== null ? 2 : 0}
              >
                <Text dimColor wrap="truncate">
                  {detail}
                </Text>
                <Box
                  key="dash-cache-tip"
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  backgroundColor={DASH_BG}
                  display="none"
                  hover={{ scope: 'dash-cache', display: 'flex' }}
                >
                  <Text dimColor wrap="truncate">
                    {hoverTips(v).cache.replace(/^Prompt cache/, 'Cache')}
                  </Text>
                </Box>
              </Box>
            ) : null}
          </Box>
        ) : detail ? (
          <Box key="dash-detail" flexShrink={1000} minWidth={0} marginLeft={2}>
            <Text dimColor wrap="truncate">
              {detail}
            </Text>
          </Box>
        ) : null}
      </Box>
      {/* The buttons in the flow, their real width and no more, so the words get all the rest. An empty absolute child
          makes the box positioned, which paints it over the art (a plain flow box sits under it and loses clicks). */}
      <Box minWidth={1} />
      <Box key="dash-actions" flexShrink={0} flexDirection="row" gap={1} alignItems="center" marginLeft={1}>
        <Box position="absolute" top={0} left={0} />
        {Svg
          ? // Each Auto as a switch, drawn, with a blank button laid over it to take the click (the cog's pattern).
            [
              {
                key: 'dash-auto-model',
                word: 'model',
                on: v.autoModel,
                flipAt: autoModelFlipAt,
                toggle: () => toggleAutoModel($),
              },
              { key: 'dash-auto', word: 'effort', on: v.auto, flipAt: autoFlipAt, toggle: () => toggleAutoEffort($) },
            ].map(autoSwitch => (
              <Box
                key={`${autoSwitch.key}-switch`}
                position="relative"
                flexDirection="row"
                alignItems="center"
                gap={1}
                paddingX={1}
              >
                <Svg
                  source={autoSwitchSvg(autoSwitch.on, nowMs - autoSwitch.flipAt)}
                  alt={`Auto ${autoSwitch.word} ${autoSwitch.on ? 'on' : 'off'}`}
                  width={26}
                  height={15}
                />
                <Text color={autoSwitch.on ? DASH_TEXT : DASH_DIM}>{`Auto ${autoSwitch.word}`}</Text>
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Button key={autoSwitch.key} plain label={' '.repeat(32)} onPress={autoSwitch.toggle} />
                </Box>
              </Box>
            ))
          : autoButtons}
        {Svg ? buttons.slice(0, -1) : buttons}
        {Svg ? (
          // The cog sits in the flow and the button in an absolute layer after it: an absolute layer paints over plain
          // ones, and the desktop ignores position="relative" on a Box without absolute children. A Button is at most as
          // wide as its box, so the box keeps a cell of padding each side of the cog for the hover box.
          <Box key="dash-settings-icon" position="relative" alignItems="center" justifyContent="center" paddingX={1}>
            <Svg source={settingsSvg(DASH_TEXT)} alt="Settings" width={14} height={14} />
            <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
              {buttons[buttons.length - 1]}
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

/** The terminal's pickers above the prompt (Model and Effort, each with its Auto) and, on any surface, the
 * judge's question when it suggests another model. The rows also sit under an alert band, so effort never goes away. */
async function effortRows($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e))
  const v = await snap($)
  const { auto, autoModel, wanted } = v
  // A subagent in view: its own effort and model are lit, and the chat's verdict and note are not about it.
  const agentId = e.props.view.agentId
  const viewed = agentId === undefined ? undefined : (await read($, lensAgents)).find(a => a.id === agentId)
  const inAgent = agentId !== undefined
  const current = inAgent ? null : v.current
  const judging = !inAgent && v.judging
  const inUse = inAgent ? viewed?.model : (v.modelNow ?? (await sessionModel($)))
  const effortNow = inAgent
    ? (viewed?.effort ?? (await subagentEffortOf($, agentId).catch(() => undefined)))
    : effortOf(v)

  const setEffort = (level: Effort) => () => pickEffort($, level)
  // Picking a model yourself turns off Auto for model alone; accepting a suggestion leaves it on. Either holds for this
  // session only, so the app's default model for later sessions stays as it is.
  const setModel = (model: ModelKey) => async () => {
    await update($, isAutoModel, () => false)
    await $.store.set('isAutoModel', false)
    await switchModel($, model)
  }
  // A prompt waiting for the answer takes the switch itself.
  const acceptSuggestion = (model: ModelKey) => async () => {
    if (offer) settleOffer(true)
    else await switchModel($, model)
  }
  const dismiss = async () => {
    declined = wanted
    await update($, suggestion, () => null)
    settleOffer(false)
  }
  const neverHold = async () => {
    await dismiss()
    await saveSetting($, 'holdOffer', 'off')
    $.ui.toast(
      'context-lens: prompts are not held for model offers now. /context-lens settings, Model, turns it back on.',
    )
  }

  // A bare digit in an empty composer presses a band Button, so a held prompt is answered with 1, 2 or 3 without focusing
  // the band. Only while it waits: otherwise a 1 typed to start a message would switch the model. Plain Buttons draw
  // the digit beside the label (`1: Switch`).
  const offerKeys = offer && e.surface === 'terminal'

  const question = wanted ? (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text>
          {suggestedAs === 'subagent'
            ? `Hand this to a ${MODELS.find(m => m.key === wanted)?.label} subagent?`
            : `Switch to ${MODELS.find(m => m.key === wanted)?.label}?`}{' '}
          {offer
            ? `Your prompt waits ${Math.max(1, Math.ceil((offer.until - (await $.clock.now())) / 1000))}s.`
            : 'The context reloads.'}
        </Text>
        <Button
          key="accept"
          variant="primary"
          hotkey={offerKeys ? '1' : undefined}
          plain={offerKeys ? true : undefined}
          label={suggestedAs === 'subagent' ? 'Hand off' : 'Switch'}
          onPress={acceptSuggestion(wanted)}
        />
        <Button
          key="decline"
          hotkey={offerKeys ? '2' : undefined}
          plain={offerKeys ? true : undefined}
          label="Keep"
          onPress={dismiss}
        />
        {offer ? (
          <Button
            key="never"
            hotkey={offerKeys ? '3' : undefined}
            plain={offerKeys ? true : undefined}
            label="Don't ask again"
            onPress={neverHold}
          />
        ) : null}
      </Box>
    </Box>
  ) : null
  if (e.surface !== 'terminal') return { question, rows: null }

  const reasonNote = judging
    ? 'Deciding…'
    : current
      ? `${current.by === 'manual' || current.by === 'named' ? 'You' : 'Why'}: ${current.why}`
      : auto
        ? 'Picks the effort at the next prompt'
        : 'Pick an effort'
  const hint = inAgent ? '' : await appHint($, v)
  // The note is drawn by the caller: a band's detail line says why, and the minimal look puts it on a line of its own
  // (noteLine). Each toggle says the mode in force; a press switches to the other.
  const modelPicker = (
    <Box key="model-picker" flexDirection="row" alignItems="center" gap={1} flexShrink={0}>
      <Text dimColor>Model</Text>
      {MODELS.map(m =>
        m.key === inUse ? (
          <Button key={`m-${m.key}`} variant="primary" label={m.label} onPress={setModel(m.key)} />
        ) : (
          <Button key={`m-${m.key}`} plain dimColor label={m.label} onPress={setModel(m.key)} />
        ),
      )}
      <Button
        key="auto-model"
        hotkey="m"
        variant={autoModel ? 'primary' : undefined}
        label={autoModel ? 'Auto' : 'Manual'}
        onPress={() => toggleAutoModel($)}
      />
    </Box>
  )
  const effortPicker = (
    <Box key="effort-picker" flexDirection="row" alignItems="center" gap={1} flexShrink={0}>
      <Text dimColor>Effort</Text>
      {EFFORTS.map(level =>
        level === effortNow ? (
          <Button key={`e-${level}`} variant="primary" label={level} onPress={setEffort(level)} />
        ) : (
          <Button key={`e-${level}`} plain dimColor label={level} onPress={setEffort(level)} />
        ),
      )}
      <Button
        key="auto"
        hotkey="a"
        variant={auto ? 'primary' : undefined}
        label={auto ? 'Auto' : 'Manual'}
        onPress={() => toggleAutoEffort($)}
      />
    </Box>
  )
  // Model at the left and Effort at the right; a terminal too narrow for both wraps Effort onto a line of its own.
  const rows = (
    <Box flexDirection="column">
      {question}
      <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap={2}>
        {modelPicker}
        {effortPicker}
      </Box>
    </Box>
  )

  // Rows it takes, for fitting the band into the room the app gives it. A button is its label and about three cells of
  // frame and hotkey; a toggle is counted at its wider word.
  const pickerWidth = (word: string, labels: string[]) =>
    word.length + [...labels, 'Manual'].reduce((sum, label) => sum + label.length + 4, 0)
  const bothWidth =
    pickerWidth(
      'Model',
      MODELS.map(m => m.label),
    ) +
    2 +
    pickerWidth('Effort', EFFORTS)
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 100
  const height = (bothWidth > columns ? 2 : 1) + (question ? 1 : 0)
  const noteLine = inAgent ? null : hintLine({ Box, Text }, hint, reasonNote, 'effort-note')
  return { question, rows, height, noteLine }
}

// Effort for subagents: the effort the judge picked for each subagent, by its id. A subagent's first request can come
// before its spawn resolves with the id (seen 2026-10-10), so a pick waits under the spawn's description and type
// until a request from an unknown subagent claims it through $.agent.list().
// With Cheaper model for subagents on it also holds the model the judge named, when it was sure; the step clamps it to the model the
// subagent was given (see subagentModelFor).
// Every spawn also leaves what its Agent call named (a model, an effort) and its parent's model, so its requests can
// tell what the subagent inherits from what was set for it (see subagentSteerable).
type SubagentPick = { effort: Effort; model?: ModelKey }
type SpawnCall = { model: boolean; effort: boolean; parentModel?: ModelKey }
type SubagentSpawn = { pick?: SubagentPick; call: SpawnCall }
const subagentSpawns = new Map<string, SubagentSpawn>()
let subagentWaiting: ({ description: string; type: string; parentId?: string } & SubagentSpawn)[] = []
// The Agent calls that named an effort, by tool_use_id, until their spawn reads them.
const callEfforts = new Set<string>()

/** How sure the judge must be of a task to give its subagent another model: the Smarter lean's own line for a close call. */
const SUBAGENT_MODEL_SURE = 0.65

/**
 * The model a subagent runs on when the judge named one: only a cheaper model than the one it was given (never Fable,
 * never a dearer one), else null and it keeps its own. A subagent starts with a small context and a cache of its own,
 * so the switch costs next to nothing there, unlike in the chat.
 */
export function subagentModelFor(wanted: ModelKey | undefined, given: ModelKey | undefined): ModelKey | null {
  if (!wanted || !given || wanted === 'fable') return null
  const rank = (k: ModelKey) => MODELS.findIndex(m => m.key === k)
  return rank(wanted) < rank(given) ? wanted : null
}

/** What the judge reads for a subagent: its task, said to be one, so it judges the subagent's work. */
export function subagentQuestion(prompt: string, type: string): string {
  return `${prompt.slice(0, 4000)}

[This is the task Claude gave a ${type} subagent, not a message from the person. Judge the effort that subagent needs to do it well.]`
}

/** The lowest effort a subagent gets: medium, or the person's Min when higher, never above their Max. A subagent's answer
 * goes back to the chat unchecked, and at low it miscounted where medium did not (bench/results/helpers-2026-10-10.md). */
export function subagentFloor(floor: Effort, ceiling: Effort): Effort {
  const i = Math.min(Math.max(EFFORTS.indexOf(floor), EFFORTS.indexOf('medium')), EFFORTS.indexOf(ceiling))
  return EFFORTS[i]
}

/** The judge's effort for a subagent's task, within the person's slider, Min and Max and save mode; null without a verdict. */
async function subagentEffort($: EngineInterface, prompt: string, type: string): Promise<Pick | null> {
  const { verdict } = await judge($, subagentQuestion(prompt, type), null)
  if (!verdict) return null
  const saving = (await read($, saveUntil)) !== null
  const leaned = tipped(verdict.effort, verdict.sure, config.bias)
  const effort = capped(bounded(leaned, subagentFloor(config.floor, config.ceiling), config.ceiling), saving)
  return {
    ...verdict,
    effort,
    why:
      effort !== leaned && EFFORTS.indexOf(leaned) < EFFORTS.indexOf(effort)
        ? `${verdict.why} (subagents start at medium)`
        : verdict.why,
  }
}

/** The effort (and model) picked for this subagent, claiming a waiting pick the first time its id is seen. */
async function subagentSpawnOf($: EngineInterface, id: string): Promise<SubagentSpawn | undefined> {
  const known = subagentSpawns.get(id)
  if (known || subagentWaiting.length === 0) return known
  const info = (await $.agent.list().catch(() => [])).find(a => a.id === id)
  if (!info) return undefined
  const match = subagentWaiting.find(
    w => w.description === info.description && w.type === info.type && w.parentId === info.parentId,
  )
  if (!match) return undefined
  subagentWaiting = subagentWaiting.filter(w => w !== match)
  const spawn: SubagentSpawn = { pick: match.pick, call: match.call }
  subagentSpawns.set(id, spawn)
  return spawn
}

const subagentPickOf = async ($: EngineInterface, id: string): Promise<SubagentPick | undefined> =>
  (await subagentSpawnOf($, id))?.pick

/**
 * What of a subagent's request the mod may change: the model and the effort it inherits from its parent, and with
 * Override definitions on also those its definition sets; never one its Agent call named. The definition is not
 * readable, so a model other than the parent's or an effort other than the chat's is taken as the definition's. A
 * definition that sets the parent's own looks inherited, which changes nothing it asked for.
 */
export function subagentSteerable(
  request: { model?: ModelKey; effort?: unknown },
  parent: { model?: ModelKey; effort?: unknown },
  call: SpawnCall | undefined,
  override: boolean,
): { model: boolean; effort: boolean } {
  const modelInherited = !parent.model || !request.model || request.model === parent.model
  const effortInherited = typeof parent.effort !== 'string' || request.effort === parent.effort
  return {
    model: !call?.model && (modelInherited || override),
    effort: !call?.effort && (effortInherited || override),
  }
}

/** The effort picked for this subagent. */
const subagentEffortOf = async ($: EngineInterface, id: string): Promise<Effort | undefined> =>
  (await subagentPickOf($, id))?.effort

/** Counts one request of a subagent the judge steered, for /context-lens stats. */
async function subagentTally($: EngineInterface, usage: Parameters<typeof weighted>[0]) {
  await update($, saved, old => {
    const t = asSpent(old)
    return {
      ...t,
      subagents: { ...t.subagents, requests: t.subagents.requests + 1, cost: t.subagents.cost + weighted(usage) },
    }
  })
}

// A compaction written by Haiku 5.5: Anthropic names compaction among the jobs it is built for, at a fraction of the
// chat model's price. Claude Code compacts with the chat's own model and has no setting for another, and the
// summarizer's request does not pass through turn.step, so the mod answers session.compact itself: the transcript as
// text, Haiku's summary back as the conversation. Anything that fails falls through to Claude Code's own compaction.
const COMPACT_MODEL = 'claude-haiku-5-5'
/** The transcript's most text sent to Haiku: about 600k tokens, inside its window with room for the summary. */
const COMPACT_MAX_CHARS = 2_400_000
const COMPACT_SYSTEM = `You compact a conversation between a user and Claude Code, an AI coding agent, so the work can continue
in a fresh context that holds only your summary. Whoever reads it next knows nothing else about the conversation.

Write a detailed summary with these sections:
1. Primary request and intent: everything the user asked for, in detail, including changes of mind.
2. Key technical concepts: technologies, frameworks, constraints and decisions.
3. Files and code: every file read, created or edited, why it matters, and the important snippets or signatures.
4. Errors and fixes: what went wrong, how it was fixed, and any feedback the user gave about it.
5. Problem solving: what was solved and what is still being worked out.
6. All user messages: every message the user wrote that is not a tool result, briefly and in order.
7. Pending tasks: what the user asked for that is not done.
8. Current work: exactly what was being done right before this summary, with file names and code. The last few
messages come nearly uncut: carry the code and errors from them over in full, since the next step builds on them.
9. Next step: the next step, only if it follows directly from the user's latest request, quoting that request.

Be precise: keep names, paths, numbers, commands and error messages exact. Leave out pleasantries.
Reply with the summary only.`

// The last messages go to Haiku nearly whole: the work in progress (the code just written, the error just seen) lives
// in their tool calls and results, which a short cut would lose mid-task.
export const COMPACT_TAIL = 6
const COMPACT_TAIL_CHARS = 20_000
/** The transcript as plain text for the summarizer: each message, its tool calls and their results, the long ones cut. */
export function compactTranscript(
  messages: readonly {
    role: string
    text: string
    toolUses?: readonly { tool: string; input: unknown; text?: string }[]
    toolResults?: readonly { text?: string }[]
  }[],
  toolChars = 2000,
  tailChars = COMPACT_TAIL_CHARS,
): string {
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)} …[${s.length - n} more characters]` : s)
  const tailFrom = messages.length - COMPACT_TAIL
  return messages
    .map((m, i) => {
      const inTail = i >= tailFrom
      const inputChars = inTail ? tailChars : 400
      const resultChars = inTail ? tailChars : toolChars
      const lines = [`${m.role === 'user' ? 'USER' : 'CLAUDE'}: ${m.text}`.trimEnd()]
      for (const t of m.toolUses ?? []) {
        lines.push(`  [${t.tool} ${cut(JSON.stringify(t.input ?? {}), inputChars)}]`)
        if (t.text) lines.push(`  → ${cut(t.text, resultChars)}`)
      }
      if (!m.toolUses?.length)
        for (const r of m.toolResults ?? []) if (r.text) lines.push(`  → ${cut(r.text, resultChars)}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

/** The transcript cut harder when it does not fit Haiku's window; null when it still does not. */
function fittingTranscript(messages: Parameters<typeof compactTranscript>[0]): string | null {
  const full = compactTranscript(messages)
  if (full.length <= COMPACT_MAX_CHARS) return full
  const shorter = compactTranscript(messages, 300, 4000)
  return shorter.length <= COMPACT_MAX_CHARS ? shorter : null
}

/** Haiku's summary of the transcript, or why there is none. */
async function haikuCompaction(
  $: EngineInterface,
  messages: Parameters<typeof compactTranscript>[0],
  instructions?: string,
): Promise<{ text: string } | { fail: string }> {
  const transcript = fittingTranscript(messages)
  if (transcript === null) return { fail: 'the chat is too long for Haiku' }
  const r = await $.model.complete({
    model: COMPACT_MODEL,
    system: COMPACT_SYSTEM,
    prompt: `${transcript}\n\n---\nWrite the summary now.${instructions?.trim() ? `\nThe user asked the summary to keep or stress: ${instructions.trim()}` : ''}`,
    maxTokens: 16000,
    effort: 'medium',
    timeoutMs: 240_000,
  })
  if (!r.isAnswered) return { fail: 'reason' in r ? String(r.reason) : 'no answer' }
  return r.text.trim().length > 200 ? { text: r.text.trim() } : { fail: 'the summary came back empty' }
}

/** The quick handoff written by Haiku from the transcript, for a chat whose cache went cold; null when it fails. */
async function haikuHandoff(
  $: EngineInterface,
  messages: Parameters<typeof compactTranscript>[0],
): Promise<string | null> {
  const transcript = fittingTranscript(messages)
  if (transcript === null) return null
  const r = await $.model.complete({
    model: COMPACT_MODEL,
    system:
      'You read a conversation between a user and Claude Code, an AI coding agent, and write the handoff the user asks for.',
    prompt: `${transcript}\n\n---\n${HANDOFF_PROMPT}`,
    maxTokens: 4000,
    effort: 'medium',
    timeoutMs: 120_000,
  })
  return r.isAnswered && r.text.trim().length > 100 ? r.text.trim() : null
}

// --- The lens: prompt-cache timers, the context window and rate-limit usage, one row in the band --------------------

const LENS_TICK_MS = 5_000

const LENS_WARMTH_COLOR: Record<Warmth, string> = {
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
    envCacheTtl($),
    envAgentCacheTtl($),
    envForce5m($),
    envEnable1h($),
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
  await update($, lensLiveTokens, () => usage.context.tokens ?? null)
  await update($, lensLimits, () => usage.rateLimits)
  const breakdown = usage.context.breakdown
  if (breakdown) await update($, lensContext, () => toContextView(breakdown))
}

async function recordRequest(
  $: EngineInterface,
  agentId: string | undefined,
  usage: ModelUsage,
  ran?: { model?: ModelKey; effort?: Effort },
): Promise<void> {
  const [at, ttls] = await Promise.all([$.clock.now(), cacheTtls($)])
  if (agentId === undefined) {
    const previous = await read($, lensMain)
    await update($, lensRewritten, () => isRecache(previous, usage) && warmth(previous, at) !== 'cold')
    await update($, lensMain, () => applyUsage(usage, at, ttls.main))
    return
  }
  const known = (await read($, lensAgents)).find(a => a.id === agentId)
  const info = known ? undefined : (await $.agent.list()).find(a => a.id === agentId)
  await update($, lensAgents, list => {
    const type = list.find(a => a.id === agentId)?.type ?? info?.type ?? 'agent'
    const next: AgentCache = {
      ...applyUsage(usage, at, ttls.agent),
      id: agentId,
      type,
      ...(ran?.model ? { model: ran.model } : {}),
      ...(ran?.effort ? { effort: ran.effort } : {}),
    }
    return [...list.filter(a => a.id !== agentId), next]
  })
}

/** A main-thread compaction's summary starts a new cache entry. */
async function afterCompaction($: EngineInterface): Promise<void> {
  await update($, lensMain, clock => emptyClock(clock.ttl))
  await update($, lensRewritten, () => false)
  await refreshUsage($)
}

async function lensTick($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, lensNow, () => at)
}

/** The session started: the first read of the usage. Called from the dashboard's own session.start hook: one plugin
 * may hook an event once. */
async function lensStarted($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, lensNow, () => at)
  void refreshUsage($).catch(() => undefined)
}

function lensCacheTime(state: Warmth, left: number | null): string {
  if (state === 'uncached') return '—'
  if (state === 'cold') return 'cold'
  return formatRemaining(left ?? 0)
}

/** The lens's row, `columns` wide: the cache timer, the context bar and the usage windows; null when there is
 * nothing to show yet. A subagent in view shows its own clock. */
async function lensRow($: EngineInterface, e: RenderInput<'AbovePrompt'>, columns: number) {
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

export const register: Register = (on, options) => {
  // The lens's own hooks, on events the rest of the module does not hook.
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (e.changed.includes('rateLimits')) await update($, lensLimits, () => e.rateLimits)
    if (e.changed.includes('context')) await refreshUsage($)
    return result
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      modelCaches.clear()
      await update($, lensMain, clock => emptyClock(clock.ttl))
      await update($, lensLiveTokens, () => null)
      await update($, lensRewritten, () => false)
      void refreshUsage($).catch(() => undefined)
    }
    return next(e)
  })
  setLoadedAt(Date.now())
  timersFrom = null
  timersScheduled = false
  setFirstDrawLogged(false)
  setDrawsTimed(0)
  setConfig(readConfig(options))
  applyTheme()
  setPluginOptions(options)
  on('session.compact', async ($, e, next) => {
    const result = await (async () => {
      // A subagent's own compaction, the session's model by choice: Claude Code's own.
      if (e.agentId !== undefined || config.compactWith !== 'haiku') return next(e)
      // Ahead-of-time summaries would be written by the chat's model and then not used: none.
      if (e.trigger === 'precompute') return { skip: 'context-lens compacts with Haiku when it is time' }
      // The transcript comes with the event; read it if not (a test's engine hands none).
      const messages =
        Array.isArray(e.messages) && e.messages.length ? e.messages : await $.session.messages().catch(() => [])
      const got = await haikuCompaction($, messages, e.instructions).catch((error: unknown) => ({
        fail: String(error).slice(0, 80),
      }))
      if ('fail' in got) {
        $.ui.toast(`context-lens: Haiku could not compact (${got.fail}). The chat's own model does it.`)
        return next(e)
      }
      lastHaikuCompact = Date.now()
      return {
        messages: [
          {
            role: 'user' as const,
            text: `This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation, written by Haiku 5.5 for context-lens.\n\n${got.text}\n\nContinue the conversation from where it left off without asking the user any further questions.`,
            toolUses: [],
          },
        ],
      }
    })()
    if (e.agentId === undefined && e.trigger !== 'precompute' && !('skip' in result && result.skip))
      await afterCompaction($).catch(() => undefined)
    return result
  })
  on('session.start', async ($, e, next) => {
    setSessionStarted(Date.now())
    await lensStarted($).catch(() => undefined)
    // Everything the first draw needs, asked for at once: one after the other they held the start (and with it the
    // band) for a second or more. What the draw does not need runs after, unawaited.
    const [sid, kept, storedAuto, storedAutoModel, storedPick, setupDone] = await Promise.all([
      $.session.id().catch(() => '?'),
      $.store.get('savedSettings').catch(() => null),
      $.store.get('isAuto').catch(() => null),
      $.store.get('isAutoModel').catch(() => null),
      $.store.get('pick').catch(() => null) as Promise<Pick | null>,
      $.store.get('setupDone').catch(() => null),
    ])
    // Which chat this load serves, and when it started: each chat has its own render log.
    setLoadedSession(String(sid).slice(0, 8))
    // Settings saved under an old name, then the ones the app had no /config row for (see saveSetting), over the ones it
    // passed in. The carried ones are saved under their new names by the save queue below.
    const keptSettings = kept && typeof kept === 'object' ? (kept as Record<string, unknown>) : {}
    const carried = await carryRenamedSettings($, keptSettings).catch(() => ({}))
    if (Object.keys(keptSettings).length || Object.keys(carried).length) {
      setConfig(readConfig({ ...pluginOptions, ...carried, ...keptSettings }))
      applyTheme()
    }
    await Promise.all([
      typeof storedAuto === 'boolean' ? update($, isAuto, () => storedAuto) : null,
      typeof storedAutoModel === 'boolean' ? update($, isAutoModel, () => storedAutoModel) : null,
      // Auto off means the effort you chose should still be the one in force.
      storedAuto === false && storedPick && EFFORTS.includes(storedPick.effort)
        ? update($, pick, () => storedPick).then(() => {
            setPickCarried(true)
          })
        : null,
      // The first time the mod runs, the setup guide opens above the prompt.
      setupDone !== true ? update($, setupStep, () => 'lean').then(() => update($, setupPending, () => true)) : null,
    ])
    // The command file lists /context-lens before the session starts; registering it here makes plain /context-lens the
    // mod's own command afterwards, instead of the file run as a skill.
    void $.command
      .register({
        name: 'context-lens',
        description: 'context-lens: settings, debug, handoff, setup, bench, auto, stats.',
      })
      .catch(() => undefined)
    readOwnVersion($)
    void drainSetupSave($).catch(() => undefined)
    startTimers($, 'start')
    // Clear the status entry older versions set.
    $.ui.status(undefined)
    void $.session
      .model()
      .then(m => modelIs($, m))
      .catch(() => undefined)
    renderLog.push(
      `${new Date().toISOString()} ${loadedSession} session.start (${e.surface ?? '?'}), ready in ${Date.now() - sessionStarted} ms`,
    )
    void writeRenderLog($).catch(() => undefined)
    return next(e)
  })

  // A chat opened again later (resume, fork): the mod starts afresh and has seen no response, so the countdown would
  // stay blank on a cache long cold. The app says how long ago the last response was, and whether the cache has
  // likely lapsed: the countdown starts from there.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    const r = e as { source?: string; seconds_since_last_response?: number; prompt_cache_likely_expired?: boolean }
    setClassicStart({
      at: Date.now(),
      said: `${r.source ?? '?'}, ${r.seconds_since_last_response ?? '?'}s since reply, expired ${r.prompt_cache_likely_expired ?? '?'}`,
    })
    if (
      (r.source === 'resume' || r.source === 'fork') &&
      typeof r.seconds_since_last_response === 'number' &&
      cacheExpires === 0
    ) {
      const now = await $.clock.now()
      lastResponseAt = now - r.seconds_since_last_response * 1000
      const left = lastResponseAt + CACHE_TTL[cacheTtl]
      cacheExpires = r.prompt_cache_likely_expired || left <= now ? now - 1 : left
      await rememberCache($)
      await checkSwamp($).catch(() => undefined)
      await showCache($).catch(() => undefined)
      // The app opens the chat and draws its band while this runs; a redraw asked now can land before the band is
      // there, and the next came only with the 15 s cache tick. Ask again over the next seconds.
      $.ui.invalidate('ui.render')
      redrawSoon()
    }
    return result
  })

  // The handoff turn ended: keep its text; the session's timer clears the chat and sends it.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await setTurnBusy($, false)
    // A lower verdict for a message typed during the turn takes over now, if Auto is still on.
    if (!e.agentId && heldPick) {
      const held = heldPick
      heldPick = null
      if (await read($, isAuto)) await choose($, held)
    }
    // The newest reply's text: its last block carries the warning card (see AssistantMessage).
    if (!e.agentId && e.reason === 'answer') await update($, lastAnswer, () => e.answer.trim())
    // The footer of this reply keeps what it ran on and what it cost. Taken from its own requests: the pick above may already
    // be the next message's.
    if (!e.agentId && e.durationMs) {
      const key = String(e.durationMs)
      const cost = Math.round(turnCost)
      const line = { ...ranThisTurn, ...(cost > 0 ? { cost } : {}) }

      await update($, turnLines, lines => withTurnLine(lines, key, line))
      await storeTurnLine($, key, line).catch(() => undefined)

      // Saved: an older reply's footer drawn during the next turn must not take that turn's model.
      ranThisTurn = null
    }
    // A landed handoff card stays under the first reply after it, and goes with the next.
    if (!e.agentId) {
      await update($, handoffCard, card =>
        !card || cardRunning(card.kind) ? card : card.seen ? null : { ...card, seen: true },
      )
    }
    if (!e.agentId && (await read($, handoffStage)) === 'writing') {
      if (e.reason === 'answer' && e.answer.trim()) handoffText = e.answer
      else {
        await update($, handoffStage, () => null)
        $.ui.toast('context-lens: the handoff was not written, nothing was cleared')
      }
    }
    return result
  })

  // /context-lens is a command file in the plugin (commands/context-lens.md), so the app lists it before the session has
  // started; this hook answers it, and the file's text never reaches the model. Both spellings the app may use.
  on('command.run', async ($, e, next) => {
    if (e.command !== 'context-lens' && e.command !== 'context-lens:context-lens') return next(e)
    const wanted = await read($, suggestion)
    const arg = e.args.trim().toLowerCase()
    if (arg === 'auto') {
      await toggleAutoEffort($)
      return {
        text: (await read($, isAuto))
          ? 'Auto on: effort is picked for every prompt.'
          : 'Auto off: the effort is yours.',
      }
    }
    if (arg === 'hot') {
      // Shows the running-hot band now, to try it: the next check puts back the real figures.
      await update($, hotHidden, () => null)
      await $.store.set('hotClosed', null).catch(() => undefined)
      await update($, hot, () => ({
        kind: 'five_hour',
        percent: 82,
        resetsAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
      }))
      $.ui.invalidate('ui.render')
      return {
        text: 'The running-hot band is showing now (a test). It goes away at the next check unless a limit really is close.',
      }
    }
    if (arg === 'down') {
      await update($, judgeDownHidden, () => null)
      await update($, judgeDown, () => 'Haiku is out of credits (402)')
      $.ui.invalidate('ui.render')
      return { text: 'The judge-down band is showing now (a test). It goes away once the judge answers again.' }
    }
    if (arg === 'swamp') {
      // Shows the swamp band now, to try it: the next check puts back the real figure.
      await update($, swampHiddenAt, () => null)
      await update($, swamped, () => SWAMP_TOKENS)
      $.ui.invalidate('ui.render')
      return {
        text: 'The swamp band is showing now (a test). It goes away at the next check unless the chat really is swamped.',
      }
    }
    if (arg === 'save') return { text: await toggleSave($) }
    if (arg === 'handoff' || arg === 'handoff full') {
      const full = arg === 'handoff full'
      const { after } = await lastHandoffChoice($)
      await startHandoff($, full, after)
      const what = handoffWhat({ kind: full ? 'full' : 'quick', after }, config.handoffSkill)
      return { text: `Writing the ${full ? 'full' : 'quick'} handoff. ${what.by}. ${what.then}` }
    }
    if (arg.startsWith('probe')) {
      setProbeLevel(Number(arg.slice(5).trim()) || 0)
      await update($, settingsOpen, () => true)
      $.ui.invalidate('ui.render')
      return { text: `Probe ${probeLevel} drawn above the prompt (0 is the real panel). Tell me if you see it.` }
    }
    if (arg === 'debug') {
      const ago = (t: number) => (t ? `${Math.round((Date.now() - t) / 1000)}s ago` : 'never')
      const debugNow = await $.clock.now().catch(() => Date.now())
      const lastFork = (await $.store.get('lastFork').catch(() => null)) as { at: number; outcome: string } | null
      return {
        text:
          [
            // A copy outside the plugin cache (--plugin-dir) has no marketplace; name its folder instead.
            `plugin: ${ownVersion || '?'}, ${/cache[\\/][^\\/]+[\\/]/.test($.plugin.root) ? pluginId($) : `local copy at ${$.plugin.root}`}`,
            `session.start ${ago(sessionStarted)}`,
            `app SessionStart: ${classicStart ? `${ago(classicStart.at)} (${classicStart.said})` : 'never'}`,
            `cache: ${cacheExpires === 0 ? 'not started' : `${await cacheMinutes($)} min left`}, shown ${await read($, cacheLeft)}, ttl ${cacheTtl}, last reply ${lastResponseAt ? ago(lastResponseAt) : 'none seen'}, replies seen ${repliesSeen}, forced ${coldForced}`,
            `model caches: ${[...modelCaches].map(([k, c]) => `${k} ${kTokens(c.tokens)} ${Math.max(0, Math.ceil((c.expires - debugNow) / 60_000))} min`).join(', ') || 'none'}${sessionPick ? `, session on ${sessionPick}` : ''}`,
            `band asked for ${renderCalls} times, last ${ago(lastRenderAt)}`,
            `band error: ${lastRenderError || 'none'}`,
            `last draw: ${lastRenderBranch || 'none'}`,
            `app sent: ${lastRenderProps || 'nothing'}`,
            `settings open: ${await read($, settingsOpen)}`,
            `setup step: ${await read($, setupStep)}`,
            `handoff: ${await read($, handoffStage)}`,
            `last fork: ${lastFork ? `${lastFork.outcome}, ${ago(lastFork.at)}` : 'none'}`,
            `hidden: ${config.hide.join(',') || 'nothing'}`,
            lastRequest
              ? `last request: app asked ${lastRequest.appModel} at ${lastRequest.appEffort ?? 'none'}, sent ${lastRequest.model} at ${lastRequest.effort ?? 'none'}${lastRequest.model === lastRequest.appModel && lastRequest.effort === lastRequest.appEffort ? ' (unchanged)' : ' (changed by context-lens)'}, ${ago(lastRequest.at)}`
              : 'last request: none yet',
            `compact with: ${config.compactWith}${lastHaikuCompact ? `, last by Haiku ${ago(lastHaikuCompact)}` : ''}`,
          ].join(' | ') +
          // On its own line, easy to find: the model and effort the last request actually ran on.
          `
model used: ${lastRequest ? `${lastRequest.model} at ${lastRequest.effort ?? 'none'}` : 'none yet'}`,
      }
    }
    if (arg === 'settings') {
      await openPluginSettings($)
      return { text: 'The context-lens settings are open above the prompt.' }
    }
    if (arg === 'setup') {
      await update($, setupStep, () => 'lean')
      $.ui.invalidate('ui.render')
      return { text: 'The context-lens setup is open above the prompt.' }
    }
    if (arg === 'bench') {
      const cases = (JSON.parse(await $.fs.read(`${$.plugin.root}/bench/judge-cases.json`)) as { cases: BenchCase[] })
        .cases
      const answers = await runBench($, cases)
      const report = benchReport(cases, answers)
      const stamp = new Date(await $.clock.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-')
      const out = `context-lens-bench-${stamp}`
      await $.fs.write(`${out}.json`, JSON.stringify({ cases: cases.length, answers }, null, 2))
      await $.fs.write(`${out}.md`, report)
      return {
        text: `${report}

Saved to ${out}.md and .json`,
      }
    }
    // A test aid: marks the cache cold now, so the Compact button can be tried without waiting out the hour.
    if (arg === 'cold') {
      coldForced = true
      cacheExpires = await $.clock.now()
      await update($, cacheLeft, () => 0)
      $.ui.invalidate('ui.render')
      return {
        text: 'The cache shows as cold now (a test). Compact is in the footer. The next response restarts the countdown.',
      }
    }
    if (arg === 'stats' || arg === 'saved') return { text: `Auto, this session:\n${savedText(await read($, saved))}` }
    if (!wanted) return { text: 'No model suggestion right now.' }
    if (arg === 'switch') {
      if (offer && suggestedAs === 'subagent') {
        settleOffer(true)
        return { text: `Handing the prompt to a ${wanted} subagent. The chat stays on its model.` }
      }
      if (offer) settleOffer(true)
      else await switchModel($, wanted)
      return { text: `Switching to ${wanted} for this session. The context reloads.` }
    }
    declined = wanted
    await update($, suggestion, () => null)
    settleOffer(false)
    return { text: `Keeping the current model.` }
  })

  on('prompt.submit', async ($, e, next) => {
    await setTurnBusy($, true)
    // A message typed while a reply runs belongs to that reply: its cost goes on.
    if (e.turnId === undefined) {
      turnCost = 0
      ranThisTurn = null
    }
    // A landed handoff's card goes once the next message is sent.
    const card = await read($, handoffCard)
    if (card && (card.kind === 'done' || card.kind === 'copied')) await update($, handoffCard, () => null)
    const byPerson = e.origin.kind === 'composer' || e.origin.kind === 'bridge' || e.origin.kind === 'sdk'
    // An agent's report (a subagent or background task finishing, another session's message) or a scheduled firing (/loop, a
    // routine) starts a reply nobody typed: with Auto on for effort it is judged like a prompt, so it does not run on the
    // effort picked for the last typed one. The model is left alone.
    // A relayed channel message (Slack, Telegram) and a follow-up to the person's click are theirs, but not typed here: same.
    const byAgent = [
      'task-notification',
      'peer',
      'peer-send-message',
      'scheduled-trigger',
      'channel',
      'auto-continuation',
    ].includes(e.origin.kind)
    // The handoff check runs for every message the person types, whatever the effort judge is doing (or whether Auto is on).
    if (byPerson && !e.text.trim().startsWith('/') && !isFollowUp(e.text))
      void checkHandoff($, e.text).catch(() => undefined)
    const wantsEffort = await read($, isAuto)
    const wantsModel = await read($, isAutoModel)
    settleOffer(false)
    // A typed slash command is judged only when it is a skill or a custom command (what the person added); the app's own
    // (/compact, /clear, /model) and context-lens's never are. The judge is told what the command is, since its name alone says little.
    const slash = e.text.trim().startsWith('/')
    const skill = slash && byPerson ? await typedSkill($, e.text) : undefined
    if (byAgent && !wantsEffort) return next(e)
    if ((!byPerson && !byAgent) || (slash && !skill) || (!wantsEffort && !wantsModel)) return next(e)
    // On a model where an effort change rewrites the cache, Auto waits instead of judging.
    const modelId = await sessionModelId($)
    await modelIs($, modelId)
    if (!cacheSafe(modelId) && takesEffort(modelId)) return next(e)
    // "go", "ok", "yes" between two steps of work keep the effort Auto already chose; no judge is asked.
    const before = await read($, pick)
    // A message with an image is never a bare follow-up: "fix this" plus a screenshot is new work.
    // Typed while a turn ran (e.turnId), it often steers that task: the judge is told, so it can keep the effort.
    const midTurn = e.turnId !== undefined && before !== null
    const said = byAgent
      ? e.text.slice(0, 1500)
      : skill
        ? `${e.text}

[This is a slash command that runs a skill: ${skill.description || skill.name}. Judge the work the skill will do.]`
        : e.text
    const shown = midTurn
      ? withMidTurn(withAttachments(said, e.attachments), before.effort)
      : withAttachments(said, e.attachments)
    if (
      wantsEffort &&
      before &&
      before.by !== 'manual' &&
      !e.attachments?.length &&
      !slash &&
      isFollowUp(e.text) &&
      keepsEffort(e.text, await recentContext($).catch(() => ''))
    ) {
      await countPrompt($, before.effort, undefined, 0, 0)
      void proof($, `follow-up "${e.text.trim()}": keeping ${before.effort}`)
      return next(e)
    }
    // "max effort", "effort: low": the person said the level, so it runs, past Min, Max and save mode, and no judge is asked.
    const named = wantsEffort && !slash && !byAgent ? namedEffort(e.text) : undefined
    if (named) {
      const inUse = await sessionModel($)
      const applied: Pick = { model: inUse, effort: named, why: 'you asked for it', by: 'named' }
      const running = await read($, pick)
      if (midTurn && running && EFFORTS.indexOf(named) < EFFORTS.indexOf(running.effort)) heldPick = applied
      else {
        heldPick = null
        await choose($, applied)
      }
      await countPrompt($, takesEffort(modelId) ? named : undefined, 'named', 0, 0)
      void proof($, `named level ${named} in "${e.text.slice(0, 50)}": no judge`)
      $.ui.invalidate('ui.render')
      return next(e)
    }

    judgeStartedAt = await $.clock.now().catch(() => Date.now())
    judgeEndedAt = null
    renderLog.push(`${new Date().toISOString()} ${loadedSession} glow: start`)
    drawGlowSteps($, 0, JUDGE_RISE_MS)
    // The band is drawn again as the judge starts, so the rise is placed by the clock from the first frame.
    $.ui.invalidate('ui.render')
    await update($, isJudging, () => true)
    // The model offered to a prompt that waits for the answer, once the judge is done.
    let held: ModelKey | null = null
    // The model Auto for model hands this prompt to, as a subagent.
    let handTo: ModelKey | null = null
    try {
      const inUse = await sessionModel($)
      const startedAt = Date.now()
      const { verdict, tokens: judgeTokens } = await judge($, shown, {
        model: inUse,
        effort: (await read($, pick))?.effort ?? 'medium',
        why: '',
        by: 'manual',
      })
      await endJudgeGlow($, 'verdict')
      const ms = Date.now() - startedAt
      await countPrompt(
        $,
        wantsEffort && takesEffort(modelId) ? verdict?.effort : undefined,
        verdict?.by,
        ms,
        judgeTokens,
      )
      void proof(
        $,
        verdict
          ? `judged by ${verdict.by} in ${ms} ms: ${verdict.model}/${verdict.effort} (${verdict.why}) for "${e.text.slice(0, 50)}"`
          : `no verdict after ${ms} ms for "${e.text.slice(0, 50)}"`,
      )
      $.ui.invalidate('ui.render')
      if (verdict) {
        // Effort follows the verdict at once, when Auto is on for effort.
        if (wantsEffort) {
          const saving = (await read($, saveUntil)) !== null
          const leaned = bounded(tipped(verdict.effort, verdict.sure, config.bias), config.floor, config.ceiling)
          const effort = capped(leaned, saving)
          const why = effort !== leaned ? 'save mode' : leaned !== verdict.effort ? 'your settings' : verdict.why
          const applied: Pick = { ...verdict, model: inUse, effort, why }
          // Mid-turn, a lower verdict would cut the running task's effort for its remaining steps: it waits for the
          // turn to end (the queued message may run as a turn of its own). A higher one helps the task, so it applies.
          const running = await read($, pick)
          if (midTurn && running && EFFORTS.indexOf(effort) < EFFORTS.indexOf(running.effort)) {
            heldPick = applied
            void proof($, `typed mid-turn: ${effort} waits, the running turn keeps ${running.effort}`)
          } else {
            heldPick = null
            await choose($, applied)
          }
        }
        // Only another model than the chat's: a switch where it pays for the cache it rewrites, else a subagent (see switchWorth).
        const cold = (await read($, cacheLeft)) === 0 || coldForced
        const now = await $.clock.now().catch(() => Date.now())
        const tokens = lastContext?.tokens ?? modelCaches.get(inUse)?.tokens
        const offered =
          verdict.model === declined
            ? null
            : switchWorth(verdict.model, inUse, {
                cold,
                tokens,
                ttl: cacheTtl,
                warm: warmTokens(verdict.model, now),
              })
        const worth =
          offered === 'subagent' && !subagentPays(verdict.model, inUse, { ...verdict, tokens: tokens ?? 0 })
            ? null
            : offered
        // A subagent takes a prompt the person typed, before it is sent: a note, an agent's report or a prompt already on
        // its way has nothing left to hand off.
        const typedNow = byPerson && !midTurn && !slash
        const offerable = worth === 'switch' || (worth === 'subagent' && typedNow)
        const label = MODELS.find(m => m.key === verdict.model)!.label
        if (worth && offerable && wantsModel) {
          // Auto for model acts on the verdict without asking.
          await update($, suggestion, () => null)
          if (worth === 'subagent') handTo = verdict.model
          else await switchModel($, verdict.model)
          $.ui.toast(
            worth === 'subagent'
              ? `Handed to a subagent on ${label}: ${verdict.why}`
              : `Switched to ${label} for this session: ${verdict.why}`,
          )
        } else if (worth && offerable && typedNow && config.holdOffer === 'on') {
          suggestedAs = worth
          await update($, suggestion, () => verdict.model)
          held = verdict.model
        } else if (worth === 'switch') {
          suggestedAs = worth
          await update($, suggestion, () => verdict.model)
          $.ui.toast(`Suggestion: switch to ${label}? /context-lens switch or /context-lens keep`)
        } else {
          await update($, suggestion, () => null)
        }
      }
    } finally {
      // A judge that failed or threw ends the glow here.
      await endJudgeGlow($, 'end')
      await update($, isJudging, () => false)
    }
    if (handTo) {
      void proof($, `auto hand-off: a subagent on ${handTo} for "${e.text.slice(0, 50)}"`)
      return next({ ...e, text: e.text + subagentNote(handTo) })
    }
    if (held) {
      const as = suggestedAs
      void proof($, `offer (${as}): ${held} for "${e.text.slice(0, 50)}", the prompt waits`)
      const accepted = await holdForOffer($, held)
      await update($, suggestion, () => null)
      $.ui.invalidate('ui.render')
      void proof(
        $,
        accepted
          ? `offer taken: ${as === 'subagent' ? 'a subagent on' : 'switching to'} ${held}`
          : 'offer not taken: the prompt goes on as it is',
      )
      // A subagent: the chat's model and its warm cache stay, and the prompt asks for a subagent on the other model.
      if (accepted && as === 'subagent') return next({ ...e, text: e.text + subagentNote(held) })
      // The switch only changes what the requests carry, so the prompt goes straight on, on the new model.
      if (accepted) await switchModel($, held)
    }
    return next(e)
  })

  // /model ends a taken offer even when it names the model the app already runs, which the app does not count as a switch
  // and so sends no PostModelSwitch. A bare /model closed with Esc ends it too: that cannot be told from picking the same model.
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const result = await next(e)
    if (!sessionPick) return result

    sessionPick = null
    await modelIs($, await $.session.model())
    $.ui.invalidate('ui.render')
    return result
  })

  // A switch from anywhere (the app's picker, /model, a fallback) moves the pick at once.
  on('classic.PostModelSwitch', async ($, e, next) => {
    const result = await next(e)
    sessionPick = null
    await modelIs($, e.to_model)
    return result
  })

  on('turn.step', async function* ($, e, next) {
    const asked = { model: e.model, effort: e.effort }
    // A taken offer's model goes out instead of the app's, and everything below decides by it.
    if (e.agentId === undefined && sessionPick && keyOf(e.model) !== sessionPick) {
      e = { ...e, model: MODELS.find(m => m.key === sessionPick)!.id }
    }
    // Every main-conversation response, whatever its effort, keeps the cache warm for its lifetime from now.
    const send = async function* (request: typeof e) {
      if (e.agentId === undefined)
        ranThisTurn = {
          model: typeof request.model === 'string' ? keyOf(request.model) : undefined,
          effort: EFFORTS.find(x => x === request.effort),
        }
      if (e.agentId === undefined)
        setLastRequest({
          index: e.index,
          appModel: asked.model,
          appEffort: asked.effort,
          model: request.model,
          effort: request.effort,
          at: Date.now(),
        })
      const answer = yield* next(request)
      if (answer?.usage)
        await recordRequest($, e.agentId, answer.usage, {
          model: typeof request.model === 'string' ? keyOf(request.model) : undefined,
          effort: EFFORTS.find(x => x === request.effort),
        }).catch(() => undefined)
      // Inside the hook ($ calls after it returns are refused), and never allowed to break the request.
      if (e.agentId === undefined && answer?.usage) await cacheTouched($, answer.usage).catch(() => undefined)
      const sentModel = typeof request.model === 'string' ? keyOf(request.model) : undefined
      if (e.agentId === undefined && answer?.usage && sentModel) {
        const u = answer.usage
        const held = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
        // cacheTouched has just set the chat's expiry from this response.
        modelCaches.set(sentModel, { expires: cacheExpires, tokens: held })
      }
      if (answer?.usage) turnCost += weighted(answer.usage)
      return answer
    }
    if (e.agentId === undefined) await setTurnBusy($, true)
    if (e.agentId === undefined) await modelIs($, e.model)
    if (e.agentId === undefined && typeof e.effort === 'string') {
      const seen = e.effort
      const isFirst = engineEffort === undefined
      const isByPerson = !isFirst && seen !== engineEffort
      setEngineEffort(seen)
      // The first effort seen is the app's setting; a change the mod did not make is the person's.
      if (isFirst || isByPerson) await update($, appEffort, () => seen)
      // A new chat with Auto off starts from the pick kept from the last chat; the effort the app is on now is the
      // person's (they may have set it before this first prompt), so it wins. A pick made in this chat stays.
      const takesApp = isFirst && pickCarried && !(await read($, isAuto)) && (await read($, pick))?.effort !== seen
      if (isByPerson || takesApp) {
        await update($, isAuto, () => false)
        await $.store.set('isAuto', false)
        await choose($, { model: await sessionModel($), effort: seen, why: 'your pick in the app', by: 'manual' })
        void proof($, `request ${e.index}: you set effort ${seen} yourself, Auto off`)
        // The app has no event for its effort picker: this is the first request after the pick, so say it plainly.
        $.ui.toast(
          `context-lens: Auto is off. You picked ${EFFORT_LABELS[seen as Effort] ?? seen}; turn Auto on to hand it back.`,
        )
        return yield* send(e)
      }
    }
    // What of a subagent's model and effort is its to keep: what its Agent call named, and its definition's unless
    // Override definitions is on.
    const spawned = e.agentId === undefined ? undefined : await subagentSpawnOf($, e.agentId)
    const steer =
      e.agentId === undefined
        ? null
        : subagentSteerable(
            { model: keyOf(e.model), effort: e.effort },
            { model: spawned?.call.parentModel ?? keyOf(await $.session.model()), effort: engineEffort },
            spawned?.call,
            config.overrideDefinitions === 'on',
          )
    if (steer && e.index === 0 && (!steer.model || !steer.effort))
      void proof(
        $,
        `subagent ${e.agentId} keeps its own ${[!steer.model && `model ${e.model}`, !steer.effort && `effort ${e.effort}`].filter(Boolean).join(' and ')}`,
      )

    // A subagent the judge picked an effort for at its spawn runs every request at it.
    if (steer && config.subagents === 'on' && takesEffort(e.model)) {
      const picked = spawned?.pick
      // With Cheaper model for subagents on, a cheaper model than the one it was given, when the judge named one.
      const cheaper =
        config.subagentModel === 'on' && steer.model ? subagentModelFor(picked?.model, keyOf(e.model)) : null
      const effort = steer.effort ? picked?.effort : undefined
      if ((effort && typeof e.effort === 'string') || cheaper) {
        const model = cheaper ? MODELS.find(m => m.key === cheaper)!.id : e.model
        if (e.index === 0)
          void proof(
            $,
            `subagent ${e.agentId} request 0 (${e.model}): ${cheaper ? `model -> ${model}, ` : ''}effort ${e.effort} -> ${effort ?? e.effort}`,
          )
        const result = yield* send({ ...e, model, ...(effort ? { effort } : {}) })
        if (result.usage) await subagentTally($, result.usage).catch(() => undefined)
        return result
      }
    }
    const p = await read($, pick)
    // Decided by the model this request names, never by a stored pick. Where an effort change rewrites the cache, only a
    // level you picked goes out: the rewrite is your choice there, never Auto's.
    if (!p || !takesEffort(e.model) || (!cacheSafe(e.model) && p.by !== 'manual')) return yield* send(e)
    // Auto off: the app's own effort goes out. A pick the judge made while Auto was on is not the person's choice, and
    // with the app already on the effort they want, the mod would never see a change to give way to.
    if (p.by !== 'manual' && !(await read($, isAuto))) return yield* send(e)
    // A subagent of a turn Auto picked for (Subagents off, or no verdict for it) runs at that turn's effort, no extra
    // judge call, but never below medium: a subagent's answer goes back unchecked (see subagentFloor). An effort the
    // subagent keeps (see subagentSteerable) goes out as it is.
    if (e.agentId !== undefined) {
      if (p.by === 'manual' || !steer?.effort) return yield* send(e)
      const floor = subagentFloor(config.floor, config.ceiling)
      const effort = EFFORTS.indexOf(p.effort) < EFFORTS.indexOf(floor) ? floor : p.effort
      if (e.index === 0)
        void proof($, `subagent ${e.agentId} (${e.model}): effort ${e.effort ?? 'none'} -> ${effort}, the turn's`)
      return yield* send({ ...e, effort })
    }
    if (e.agentId === undefined)
      void proof($, `request ${e.index} (${e.model}): effort ${e.effort ?? 'none'} -> ${p.effort}`)
    const result = yield* send({ ...e, effort: p.effort })
    // Only requests Auto steered count.
    if (e.agentId === undefined && p.by !== 'manual' && result.usage) {
      await tally($, p.effort, result.usage)
      void proof(
        $,
        `response ${e.index} at ${p.effort}: ${result.usage.output_tokens} out, ${result.usage.cache_read_input_tokens ?? 0} cache read, ${result.usage.cache_creation_input_tokens ?? 0} cache write`,
      )
    }
    return result
  })

  // The desktop footer in the minimal look: the effort in use, as text in the accent in the prompt footer, under the chat
  // box, and a small button that switches Auto off and on. A Button cannot be coloured and the footer draws no outline
  // or tint, so plain Text is what takes the accent. While the judge decides it says "Deciding…", for a moment after Auto switches the level it says
  // "Low → High", and while Auto is off it says "Off" in the dim colour. Auto is switched with /context-lens auto.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    // The dashboard look keeps all of this in the band above the prompt; the app's own footer shows.
    if (e.surface !== 'desktop' || config.layout === 'default') return next(e)
    const { Box, Text, Button } = themedEls($.ui.resolve(e))
    const v = await snap($)
    const handoffNow = (await read($, handoffStage)) !== null
    const needsSetup = await read($, setupPending)
    const effortNow = effortOf(v)
    // Save mode paints the level in the running-hot band's ember until the limit resets.
    const saving = (await read($, saveUntil)) !== null
    const label = v.judging
      ? 'Deciding…'
      : v.switchedNow
        ? `${EFFORT_LABELS[v.switchedNow.from]} → ${EFFORT_LABELS[v.switchedNow.to]}`
        : effortNow
          ? EFFORT_LABELS[effortNow]
          : 'Auto'
    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        {e.props.modes.length > 0 ? <Text dimColor>{e.props.modes.join(' & ')}</Text> : null}
        {/* Hovering the level puts a box behind it, like the app's own effort pill. The spaces are its padding:
            Text has no padding of its own. */}
        {v.auto && v.pausedNow ? (
          // Fable and older models: an effort change rewrites the cache there, so Auto waits.
          <Text dimColor hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {' Paused '}
          </Text>
        ) : v.auto ? (
          <Text color={saving ? EMBER : ACCENT} bold hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {` ${label} `}
          </Text>
        ) : (
          <Text dimColor hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {' Off '}
          </Text>
        )}
        {/* The one thing to click: it switches Auto off and on. Text cannot be clicked, so it is a small button. */}
        <Button
          key="auto"
          plain
          dimColor
          label=" ⏻ "
          hover={{ scope: 'power', backgroundColor: HOVER_BOX }}
          onPress={() => toggleAutoEffort($)}
        />
        {/* Until the setup is done the footer offers it; after that the same place opens the settings panel. */}
        {needsSetup ? (
          <Button
            key="setup"
            plain
            label=" Setup "
            hover={{ scope: 'setup', backgroundColor: HOVER_BOX }}
            onPress={async () => {
              await update($, setupStep, () => 'lean')
              $.ui.invalidate('ui.render')
            }}
          />
        ) : (
          <Button
            key="settings"
            plain
            dimColor
            label=" ⚙︎ "
            hover={{ scope: 'settings', backgroundColor: HOVER_BOX }}
            onPress={async () => {
              if (await read($, settingsOpen)) {
                await update($, settingsDraft, () => ({}))
                await update($, settingsOpen, () => false)
                $.ui.invalidate('ui.render')
              } else await openPluginSettings($)
            }}
          />
        )}
        {/* Hand off: opens the handoff bar above the prompt (quick or full, then what follows). One symbol, so it takes
            little room; pressed again it closes the bar. */}
        {config.hide.includes('handoff') ? null : (
          <Button
            key="handoff"
            plain
            dimColor
            label={handoffNow ? ' … ' : ' ⇥ '}
            hover={{ scope: 'handoff', backgroundColor: HOVER_BOX }}
            onPress={async () => ((await read($, handoffPick)) ? closeHandoffBar($) : openHandoffBar($))}
          />
        )}
        {/* How long the prompt cache stays warm: grey, yellow from 20 minutes, red from 5, then "cold" (the next message
            writes the whole context again). Nothing before the first response. */}
        {/* Cold: the band above the prompt says it and holds Compact; the footer only shows the state, in ice blue. */}
        {/* Hovering it reveals a card above the prompt (the cache scope); see the hover cards in AbovePrompt. */}
        {config.hide.includes('timer') ? null : v.cacheNow === 0 ? (
          <Text color={ICE} hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>
            {cacheLabel(0)}
          </Text>
        ) : v.cacheNow === null ? null : cacheColor(v.cacheNow) ? (
          <Text color={cacheColor(v.cacheNow)} hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>
            {cacheLabel(v.cacheNow)}
          </Text>
        ) : (
          <Text dimColor hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>
            {cacheLabel(v.cacheNow)}
          </Text>
        )}
      </Box>
    )
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (e.tool_use_id && typeof (e as { effort?: unknown }).effort === 'string') callEfforts.add(e.tool_use_id)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    // Effort for subagents: the judge reads the subagent's task before it starts (a fork shares the chat's context and
    // keeps its effort). Without a verdict it runs at the chat's effort, as with the setting off.
    const verdict =
      config.subagents === 'on' && !e.fork && !e.isTeammate && !e.workflow
        ? await subagentEffort($, e.prompt, e.subagentType).catch(() => null)
        : null
    // The model the judge named counts when Cheaper model for subagents is on and it was sure of the task.
    const named =
      verdict && config.subagentModel === 'on' && (verdict.sure === undefined || verdict.sure >= SUBAGENT_MODEL_SURE)
        ? verdict.model
        : undefined
    const pick: SubagentPick | undefined = verdict
      ? { effort: verdict.effort, ...(named ? { model: named } : {}) }
      : undefined
    const call: SpawnCall = {
      model: e.model !== undefined,
      effort: callEfforts.delete(e.tool_use_id),
      parentModel: e.parentModel ? keyOf(e.parentModel) : undefined,
    }
    const waiting = { description: e.description, type: e.subagentType, parentId: e.parentAgentId, pick, call }
    subagentWaiting = [...subagentWaiting, waiting].slice(-20)
    const result = await next(e)
    subagentWaiting = subagentWaiting.filter(w => w !== waiting)
    const agentId = 'agentId' in result ? result.agentId : undefined
    if (agentId && !subagentSpawns.has(agentId)) subagentSpawns.set(agentId, { pick, call })
    if (agentId && pick) {
      await update($, saved, old => {
        const t = asSpent(old)
        return {
          ...t,
          subagents: {
            ...t.subagents,
            runs: { ...t.subagents.runs, [pick.effort]: (t.subagents.runs[pick.effort] ?? 0) + 1 },
          },
        }
      }).catch(() => undefined)
      void proof(
        $,
        `subagent ${e.subagentType} "${e.description}": ${pick.effort}${pick.model ? ` on ${pick.model} if cheaper` : ''} (${verdict?.why})`,
      )
    }
    return result
  })

  // A line drawn before turn.complete saved it keeps what it first drew, should the turn end without a save.
  const firstDrawn = new Map<string, TurnLine>()

  // The terminal's line under each reply ("Baked 3s") in the brand's colours, with the effort and the cache. The
  // desktop draws no such line; the bands above the prompt warn there.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const { Box, Text } = themedEls($.ui.resolve(e))
    const key = String(e.props.durationMs)
    let ran =
      turnLineFor(await read($, turnLines), e.props.durationMs) ??
      turnLineFor(await storedLinesOf($), e.props.durationMs) ??
      firstDrawn.get(key)

    // Drawn before turn.complete saved its line: the reply's own last request says what it ran on. With none in this process
    // nothing is known, and the line shows no effort or model rather than the current setting's.
    if (!ran && ranThisTurn) {
      ran = { ...ranThisTurn }
      firstDrawn.set(key, ran)
    }

    const model = MODELS.find(m => m.key === ran?.model)?.long
    const took = Math.max(1, Math.round(e.props.durationMs / 1000))
    return (
      <Box key="turn-line" flexDirection="row" gap={1}>
        <Text dimColor>{`${e.props.word} ${took < 60 ? `${took}s` : `${Math.floor(took / 60)}m ${took % 60}s`}`}</Text>
        {ran ? (
          <Text
            color={ACCENT}
          >{`✦ ${model ? `${model} · ` : ''}${ran.effort ? EFFORT_LABELS[ran.effort] : 'Auto'}`}</Text>
        ) : null}
        {ran?.cost ? <Text dimColor>{`· ≈${tokens(ran.cost)} tokens`}</Text> : null}
      </Box>
    )
  })

  // Above the prompt: the terminal's Model and Effort pickers.
  // On desktop nothing is drawn here, except the question when the judge suggests another model.
  // Draws the bands and the settings panel. Counted and guarded so /context-lens debug can say whether the app asks
  // for it at all and whether drawing failed: an error here otherwise only leaves the slot empty.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Setup changes a reload cut off are saved from here: the reloaded plugin draws before anything else runs.
    void drainSetupSave($).catch(() => undefined)
    await restoreCache($).catch(() => undefined)
    setRenderCalls(renderCalls + 1)
    setLastRenderAt(Date.now())
    void refreshAppearance($).catch(() => undefined)
    setLastRenderProps(JSON.stringify(e.props).slice(0, 200))
    renderLog.push(`${new Date(lastRenderAt).toISOString()} ${loadedSession} ${lastRenderProps}`)
    if (!firstDrawLogged) {
      setFirstDrawLogged(true)
      renderLog.push(
        `${new Date().toISOString()} ${loadedSession} first draw asked ${lastRenderAt - loadedAt} ms after load`,
      )
      void writeRenderLog($).catch(() => undefined)
    }
    try {
      // A timer start is no state write, but the checks it starts are: a timer runs them once the draw is over. A burst
      // of draws schedules it once; a host that refuses the timer is asked again by the next draw.
      if (timersFrom === null && !timersScheduled) {
        try {
          timersScheduled = Boolean(
            $.clock.after(0, () => {
              readOwnVersion($)
              startTimers($, 'draw')
            }),
          )
        } catch {}
      }
      if (e.props.hasSurvey) {
        setLastRenderBranch('stepped aside: the app has a survey in this spot')
        return next(e)
      }
      const asked = await $.store.get('openSettingsAt')
      const askedHere =
        asked &&
        typeof asked === 'object' &&
        (asked as { session?: string }).session === (await $.session.id().catch(() => ''))
          ? (asked as { at: number }).at
          : null
      // The app denies a state write made while the band is being drawn, so an open asked for here is drawn now and
      // written from a timer.
      let open = Boolean(await read($, settingsOpen))
      if (typeof askedHere === 'number') {
        await $.store.set('openSettingsAt', null)
        if (Date.now() - askedHere < 60_000 && !open) {
          open = true
          $.clock.after(0, () => void update($, settingsOpen, () => true))
        }
      }
      setLastRenderBranch(open ? 'drew the settings panel' : 'drew a band or nothing')
      const { Box, Text, Button, Svg, Link } = themedEls($.ui.resolve(e))
      // The settings panel: a branded header bar, then one compact row per setting, a dim hint at the end of each row.
      if (open) {
        // The app gives this slot maxRows rows and drops a taller tree whole, without a word. With gaps the panel is 12
        // rows (2 border, 2 header, 4 settings, 4 gaps); without, 7.
        const roomy = (typeof e.props.maxRows === 'number' ? e.props.maxRows : 12) >= 12
        const { Select } = themedEls($.ui.resolve(e))
        const opts = (values: readonly string[]) => values.map(value => ({ value, label: value }))
        // The skills and commands installed here, to pick the handoff writer from: no typing, no file paths. A plugin
        // cannot open a file dialog, and a skill is run by its name anyway.
        const skillNames = await read($, installedSkills)
        // A plain button with its own handler: a dismiss-role button may be taken by the app before onPress runs.
        const close = async () => {
          await update($, settingsDraft, () => ({}))
          await update($, settingsCard, () => null)
          await update($, settingsOpen, () => false)
          $.ui.invalidate('ui.render')
        }
        // The panel shows the draft over the saved settings; every control writes to the draft only.
        const draft = await read($, settingsDraft)
        const card = await read($, settingsCard)
        const openCard = (to: SettingsCard | null) => async () => {
          await update($, settingsCard, () => to)
          $.ui.invalidate('ui.render')
        }
        const set = (field: keyof SettingsDraft) => async (value: string) => {
          await update($, settingsDraft, d => ({ ...d, [field]: value }))
          $.ui.invalidate('ui.render')
        }
        const shown = {
          bias: draft.bias !== undefined ? Number(draft.bias) : config.bias,
          floor: (draft.floor ?? config.floor) as Effort,
          ceiling: (draft.ceiling ?? config.ceiling) as Effort,
          handoffAfter: draft.handoffAfter ?? config.handoffAfter,
          handoffSkill: draft.handoffSkill ?? config.handoffSkill,
          swampAt: draft.swampAt ?? String(config.swampAt),
          layout: draft.layout ?? config.layout,
          compactWith: draft.compactWith ?? config.compactWith,
          handoffButton: draft.handoffButton ?? config.handoffButton,
          subagents: draft.subagents ?? config.subagents,
          subagentModel: draft.subagentModel ?? config.subagentModel,
          overrideDefinitions: draft.overrideDefinitions ?? config.overrideDefinitions,
          holdOffer: draft.holdOffer ?? config.holdOffer,
          theme: draft.theme ?? config.theme,
          appearance: draft.appearance ?? config.appearance,
        }
        const panelNow = await $.clock.now()
        // Dirty only while the draft differs from what is saved: a control set back to its saved value is no change.
        const sameSet = (a: string, b: string) =>
          a.split(',').filter(Boolean).sort().join() === b.split(',').filter(Boolean).sort().join()
        const dirty = Object.entries(draft).some(([field, value]) =>
          value === undefined
            ? false
            : field === 'hide'
              ? !sameSet(value, config.hide.join(','))
              : value !== String(config[field as Exclude<keyof SettingsDraft, 'hide'>] ?? ''),
        )
        const hidden = (draft.hide ?? config.hide.join(',')).split(',').filter(Boolean)
        const withPart = (part: Hideable, off: boolean) =>
          (off ? [...new Set([...hidden, part])] : hidden.filter(h => h !== part)).join(',')
        const contextAlert = hidden.includes('swamp') ? 'off' : shown.swampAt
        const handoffButton = hidden.includes('handoff') ? 'hidden' : shown.handoffButton
        const showParts = [
          ['timer', 'Cache timer'],
          ['reason', 'Judge line'],
          ['hot', 'Running-low alert'],
          ['cold', 'Cold-cache alert'],
        ] as const
        const summaries: Record<SettingsCard, string> = {
          auto: `${BIAS_WORDS[shown.bias + 2]} · ${shown.floor} to ${shown.ceiling}${shown.holdOffer === 'on' ? ' · held offers' : ''}`,
          subagents: `${shown.subagents !== 'on' ? 'Off' : shown.subagentModel === 'on' ? 'Effort and cheaper model' : 'Effort picked'} · definitions ${shown.overrideDefinitions === 'on' ? 'overridden' : 'kept'}`,
          context: `${contextAlert === 'off' ? 'Alert off' : `Alert at ${contextAlert}%`} · ${shown.compactWith === 'session' ? "Chat's model" : 'Haiku'} · ${shown.handoffSkill ? `/${shown.handoffSkill}` : 'built-in handoff'}`,
          look: `${shown.layout === 'minimal' ? 'Minimal' : 'Dashboard'} · ${THEME_LABELS[shown.theme as ThemeName] ?? shown.theme} · ${showParts.filter(([part]) => !hidden.includes(part)).length} of ${showParts.length} shown`,
        }
        // The parts the Look card can switch off for good (an alert's ✕ only closes it for now). A ticked box in plain
        // text, dim when off: lighter than a row of white buttons.
        const box = ([part, label]: readonly [Hideable, string]) => {
          const off = hidden.includes(part)
          return (
            <Button
              key={`show-box-${part}`}
              plain
              dimColor={off}
              label={`${off ? '☐' : '☑'}︎ ${label}`}
              onPress={() => set('hide')(withPart(part, !off))}
            />
          )
        }
        // An on/off setting on a row of its own, then what it does now. Desktop draws the dashboard's Auto switch (switch,
        // word, slide, one blank button laid over both); the terminal a ◉ or ○ before the word. `dim` greys a switch whose
        // setting waits on another.
        const settingSwitch = (p: {
          key: string
          label: string
          on: boolean
          dim?: boolean
          about: string
          onPress: () => unknown
        }) => {
          const last = settingSwitches.get(p.key)
          const flipAt = last && last.on !== p.on ? panelNow : (last?.at ?? 0)
          settingSwitches.set(p.key, { on: p.on, at: flipAt })
          return (
            <Box key={`${p.key}-row`} width="100%" flexDirection="row" alignItems="center" gap={1}>
              {Svg && !term ? (
                <Box
                  key={p.key}
                  position="relative"
                  flexDirection="row"
                  alignItems="center"
                  gap={1}
                  paddingX={1}
                  flexShrink={0}
                >
                  <Svg
                    source={autoSwitchSvg(p.on, panelNow - flipAt)}
                    alt={`${p.label} ${p.on ? 'on' : 'off'}`}
                    width={26}
                    height={15}
                  />
                  <Text color={p.on && !p.dim ? DASH_TEXT : DASH_DIM}>{p.label}</Text>
                  {/* The cards' cover: no-break spaces (plain ones collapse to a dot), wider than the switch and its
                      word, clipped to them, so the click reaches both edges. */}
                  <Box
                    position="absolute"
                    top={0}
                    bottom={0}
                    left={0}
                    right={0}
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="center"
                    overflow="hidden"
                  >
                    <Box flexShrink={0}>
                      <Button
                        key={`${p.key}-switch`}
                        plain
                        hover={{ backgroundColor: '#00000000' }}
                        label={'\u00a0'.repeat(60)}
                        onPress={p.onPress}
                      />
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Button
                  key={`${p.key}-switch`}
                  plain
                  dimColor={p.dim}
                  label={`${p.on ? '◉' : '○'} ${p.label}`}
                  onPress={p.onPress}
                />
              )}
              <Text dimColor wrap="truncate">
                {p.about}
              </Text>
            </Box>
          )
        }
        // What a subagent keeps, by the Override definitions switch (see subagentSteerable).
        const unlessSet =
          shown.overrideDefinitions === 'on'
            ? ', unless its Agent call names one'
            : ', unless its definition or Agent call sets one'
        const flip = (field: 'subagents' | 'subagentModel' | 'overrideDefinitions' | 'holdOffer') => () =>
          set(field)(shown[field] === 'on' ? 'off' : 'on')
        // The slider: five stops, the marker on the one in force. No animation, a click moves it.
        const track: unknown[] = []
        for (const n of [-2, -1, 0, 1, 2]) {
          if (n > -2)
            track.push(
              <Text key={`t${n}`} dimColor>
                ─
              </Text>,
            )
          track.push(
            <Button
              key={`bias${n + 2}`}
              plain
              label={n === shown.bias ? '◉' : '○'}
              onPress={() => set('bias')(String(n))}
            />,
          )
        }
        // The terminal has no art and few rows: no gaps, one row under the title.
        const term = e.surface === 'terminal'
        // The terminal's dropdown opens its list inside the wrapping row, which jumps the layout and is hard to click.
        // There a short list is a row of buttons, the picked one boxed; a long one (the skills) stays a dropdown.
        type SettingRow = {
          key: string
          label?: string
          value: string
          options: { value: string; label: string }[]
          onSelect: (v: string) => unknown
        }
        const settingRow = (p: SettingRow) =>
          term && p.options.length <= 5 ? (
            <Box key={p.key} width="100%" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
              {p.label ? (
                <Text key={`${p.key}-label`} dimColor>
                  {p.label}
                </Text>
              ) : null}
              {p.options.map(o =>
                o.value === p.value ? (
                  <Button
                    key={`${p.key}-${o.value}`}
                    variant="secondary"
                    label={o.label}
                    onPress={() => p.onSelect(o.value)}
                  />
                ) : (
                  <Button
                    key={`${p.key}-${o.value}`}
                    plain
                    dimColor
                    label={o.label}
                    onPress={() => p.onSelect(o.value)}
                  />
                ),
              )}
            </Box>
          ) : (
            <Select key={p.key} label={p.label} value={p.value} options={p.options} onSelect={p.onSelect} />
          )
        // One column, a row per setting, its hint at the end. The header is three absolute layers, drawn in order (bar and
        // art, then the title, then the buttons): an absolute layer covers whatever is in the flow, so nothing of the
        // header is in the flow but a spacer that keeps its row free.
        if (probeLevel === 1) {
          return (
            <Box key="probe" borderStyle="round" borderColor={BRAND_EDGE} paddingX={1}>
              <Text>context-lens probe 1: a bare box</Text>
            </Box>
          )
        }
        // Probe 2 keeps only the frame and header; probe 3 keeps the rows of buttons and text, no pickers or fields.
        const frameOnly = probeLevel === 2
        const bare = probeLevel === 3
        // Desktop keeps title and buttons as absolute layers straight under the panel; the terminal gets a wrapping row.
        const headRow = (kids: unknown[]) =>
          term ? (
            <Box key="settings-head" flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap={2}>
              {kids}
            </Box>
          ) : (
            kids
          )
        return (
          // The dashboard's look: the neutral band and its quiet edge, purple only on the star, no art behind the rows (it
          // made them busy). The entrance
          // sweep plays once, behind everything, as the panel opens.
          <Box
            key="settings"
            position="relative"
            flexDirection="column"
            gap={roomy && !term ? 1 : 0}
            paddingX={term ? 1 : 2}
            overflow="hidden"
            backgroundColor={DASH_BG}
            borderStyle="round"
            borderColor={DASH_EDGE}
          >
            {term ? null : introLayer({ Box, Svg }, 'settings', await introShows($, 'settings'))}
            {/* The top bar: barely a shade lighter than the band, holding the title, Save and the cross. */}
            {!term ? (
              <Box
                key="settings-bar"
                position="absolute"
                top={-1}
                left={0}
                right={0}
                height={3.5}
                overflow="hidden"
                backgroundColor={DASH_HEAD}
              >
                {/* The mark, big, tilted and cut off by the bar's edges, behind the title and the buttons. */}
                <Box key="settings-bar-mark" position="absolute" top={-2} right={20} marginTop={1}>
                  <Svg source={SETTINGS_MARK} alt="context-lens mark" width={140} height={140} />
                </Box>
                {/* A hairline along the bar's bottom: a one-pixel image stretched across (a Box cannot draw one pixel). */}
                <Box
                  key="settings-rule"
                  position="absolute"
                  bottom={0}
                  left={0}
                  right={0}
                  height={1}
                  alignItems="flex-end"
                >
                  <Svg
                    source={`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1" viewBox="0 0 1600 1" preserveAspectRatio="none"><rect width="1600" height="1" fill="${DASH_EDGE}"/></svg>`}
                    alt="rule"
                    width={1600}
                    height={1}
                  />
                </Box>
              </Box>
            ) : null}
            {/* Title and buttons are centred in the whole bar (it reaches from the border to the line under it), so the
                space above them equals the space below. The terminal has no bar: both sit in the flow on one row that
                wraps, since two absolute layers would draw over each other in a narrow window. */}
            {headRow([
              <Box
                key="settings-title"
                {...(term ? { flexShrink: 0 } : { position: 'absolute', top: 0, left: 2, height: 2.5 })}
                flexDirection="row"
                alignItems="center"
                gap={1}
              >
                {term ? (
                  <Text color={ACCENT} bold>
                    ✦
                  </Text>
                ) : null}
                {Svg && !term ? (
                  <Svg source={SETTINGS_TITLE} alt="context-lens" width={112} height={28} />
                ) : (
                  <Text color={DASH_TEXT} bold>
                    context-lens
                  </Text>
                )}
                {ownVersion ? <Text color="#6b6b73">v{ownVersion}</Text> : null}
                {/* Inside a part: Back to the cards, then the part's name. */}
                {card === null ? (
                  <Text dimColor>Settings</Text>
                ) : (
                  <Box key="settings-trail" flexDirection="row" alignItems="center" gap={1}>
                    {/* A real button: a dim "Settings" in a trail did not read as a way back. */}
                    <Button key="settings-back" variant="secondary" label="← Back" onPress={openCard(null)} />
                    <Text color={DASH_TEXT} bold>
                      {CARDS.find(c => c.id === card)?.title}
                    </Text>
                  </Box>
                )}
                {dirty ? <Text dimColor> · unsaved changes</Text> : null}
              </Box>,
              <Box
                key="settings-actions"
                {...(term
                  ? { flexShrink: 1, flexWrap: 'wrap', columnGap: 2 }
                  : { position: 'absolute', top: 0, right: 2, height: 2.5, gap: 2 })}
                flexDirection="row"
                alignItems="center"
              >
                {/* Grey and inert until something changed: there is nothing to save. */}
                {dirty ? (
                  <Button key="settings-save" variant="primary" hotkey="s" label="Save" onPress={() => saveDraft($)} />
                ) : (
                  <Button key="settings-save" variant="secondary" dimColor label="Save" onPress={() => {}} />
                )}
                <Button key="settings-close" plain label="✕" onPress={close} />
              </Box>,
            ])}
            {term ? null : <Box key="settings-spacer" height={roomy ? 2 : 1} />}
            {frameOnly ? null : card === null ? (
              // The overview: a card per part, what it is set to in a few words. A card opens that part alone.
              <Box key="settings-cards" flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={term ? 0 : 1}>
                <Box position="absolute" top={0} left={0} />
                {CARDS.map(c => (
                  <Box
                    key={`card-${c.id}`}
                    position="relative"
                    flexDirection="column"
                    flexGrow={1}
                    width={0}
                    minWidth={18}
                    paddingX={1}
                    borderStyle="round"
                    borderColor={DASH_EDGE}
                    hover={{ backgroundColor: CARD_HOVER, borderColor: CARD_HOVER_EDGE }}
                  >
                    <Box flexDirection="row" gap={1} alignItems="center">
                      {Svg && !term ? (
                        <Svg source={rowIconSvg(c.id, DASH_TEXT)} alt={c.title} width={14} height={14} />
                      ) : null}
                      {/* The terminal draws the blank buttons below as real spaces over the card's text, so there the
                          title itself is the button. (Full-width padded buttons per row looked worse: a big lit block.) */}
                      {term ? (
                        <Button key={`settings-card-${c.id}`} plain label={`${c.title} ›`} onPress={openCard(c.id)} />
                      ) : (
                        <Text color={DASH_TEXT} bold hover={{ color: '#ffffff' }}>
                          {c.title}
                        </Text>
                      )}
                    </Box>
                    <Text dimColor wrap="truncate" hover={{ dimColor: false, color: DASH_TEXT }}>
                      {summaries[c.id]}
                    </Text>
                    {/* The click takes the whole card: a button is one line high and centred in its box, whatever the box,
                        so three blank ones are spread from the top edge to the bottom one and overlap. The card lights as a
                        whole (its own hover); two, spaced around, left its edges and a stripe between the lines dead. */}
                    {term ? null : (
                      <Box
                        position="absolute"
                        top={0}
                        bottom={0}
                        left={0}
                        right={0}
                        flexDirection="column"
                        justifyContent="space-between"
                      >
                        {/* Each button sits in a clipping box and does not shrink: in a narrow card a shrunk button cut its
                          blank label to "\u2026", three stacked dots on the card. 800 no-break spaces (about 2,000 px: one is ~2.6 px) cover a card alone on its row edge to edge; the box clips the rest. */}
                        {['', '-2', '-3'].map(n => (
                          <Box
                            key={`settings-card-box-${c.id}${n}`}
                            flexDirection="row"
                            justifyContent="center"
                            overflow="hidden"
                          >
                            <Box flexShrink={0}>
                              <Button
                                key={`settings-card-${c.id}${n}`}
                                plain
                                hover={{ backgroundColor: '#00000000' }}
                                label={'\u00a0'.repeat(800)}
                                onPress={openCard(c.id)}
                              />
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              // One part: Back, its name and what it does, then its controls.
              <Box
                key={`settings-${card}`}
                flexDirection="column"
                gap={roomy && !term ? 1 : 0}
                minHeight={term ? undefined : SETTINGS_BODY_H}
              >
                {/* An empty absolute child makes the box positioned, so its rows paint, and take clicks, over the
                    entrance sweep and the art (absolute layers cover every plain box, and the sweep stays until the next
                    redraw). */}
                <Box position="absolute" top={0} left={0} />
                {/* What the part does; Back and its name are in the top bar's trail. */}
                <Text dimColor wrap="truncate">
                  {CARDS.find(c => c.id === card)?.about}
                </Text>
                <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
                  {card === 'auto'
                    ? [
                        <Text key="cheap" dimColor>
                          Cheaper
                        </Text>,
                        <Box key="track" flexDirection="row" alignItems="center">
                          {track}
                        </Box>,
                        <Text key="smart" dimColor>
                          Smarter
                        </Text>,
                        ...(bare
                          ? []
                          : [
                              <Box key="gap" width={2} />,
                              settingRow({
                                key: 'settings-floor',
                                label: 'Never below',
                                value: shown.floor,
                                options: opts(EFFORTS),
                                onSelect: set('floor'),
                              }),
                              settingRow({
                                key: 'settings-ceiling',
                                label: 'Never above',
                                value: shown.ceiling,
                                options: opts(EFFORTS),
                                onSelect: set('ceiling'),
                              }),
                              settingSwitch({
                                key: 'settings-hold-offer',
                                label: 'Hold the prompt for a model offer',
                                on: shown.holdOffer === 'on',
                                onPress: flip('holdOffer'),
                                about:
                                  shown.holdOffer === 'on'
                                    ? 'With model on Manual, a typed prompt waits for Switch or Keep'
                                    : 'With model on Manual, a toast suggests the model and the prompt goes on',
                              }),
                            ]),
                      ]
                    : card === 'subagents'
                      ? bare
                        ? []
                        : [
                            settingSwitch({
                              key: 'settings-subagents',
                              label: 'Effort for subagents',
                              on: shown.subagents === 'on',
                              onPress: flip('subagents'),
                              about: `${shown.subagents === 'on' ? "The judge picks each subagent's effort, medium or more" : "Subagents run at the chat's effort"}${unlessSet}`,
                            }),
                            settingSwitch({
                              key: 'settings-subagent-model',
                              label: 'Cheaper model for subagents',
                              on: shown.subagentModel === 'on',
                              dim: shown.subagents !== 'on',
                              onPress: flip('subagentModel'),
                              about:
                                shown.subagents !== 'on'
                                  ? 'Needs Effort for subagents'
                                  : shown.subagentModel === 'on'
                                    ? `A subagent the judge calls simple runs on a cheaper model, never a dearer one${unlessSet}`
                                    : 'A subagent keeps the model it was given',
                            }),
                            settingSwitch({
                              key: 'settings-override-definitions',
                              label: 'Override definitions',
                              on: shown.overrideDefinitions === 'on',
                              onPress: flip('overrideDefinitions'),
                              about:
                                shown.overrideDefinitions === 'on'
                                  ? "The judge's picks replace a definition's model and effort; an Agent call's own stay"
                                  : 'A subagent keeps the model and effort its definition sets',
                            }),
                          ]
                      : card === 'context'
                        ? bare
                          ? []
                          : [
                              settingRow({
                                key: 'settings-swamp',
                                label: 'Context alert',
                                value: contextAlert,
                                options: [
                                  { value: 'off', label: 'Off' },
                                  ...SWAMP_STEPS.map(n => ({ value: String(n), label: `At ${n}%` })),
                                ],
                                onSelect: async v => {
                                  await set('hide')(withPart('swamp', v === 'off'))
                                  if (v !== 'off') await set('swampAt')(v)
                                },
                              }),
                              settingRow({
                                key: 'settings-compact-with',
                                label: 'Compact with',
                                value: shown.compactWith,
                                options: [
                                  { value: 'haiku', label: 'Haiku 5.5' },
                                  { value: 'session', label: "Chat's model" },
                                ],
                                onSelect: set('compactWith'),
                              }),
                              settingRow({
                                key: 'settings-skill',
                                label: 'Handoff skill',
                                value: shown.handoffSkill || '-',
                                options: [
                                  { value: '-', label: 'Built in' },
                                  ...[
                                    ...new Set([...(shown.handoffSkill ? [shown.handoffSkill] : []), ...skillNames]),
                                  ].map(name => ({ value: name, label: `/${name}` })),
                                ],
                                onSelect: v => set('handoffSkill')(v === '-' ? '' : v),
                              }),
                              settingRow({
                                key: 'settings-handoff-button',
                                label: 'Handoff button',
                                value: handoffButton,
                                options: [
                                  { value: 'hidden', label: 'Hidden' },
                                  { value: 'advised', label: 'When advised' },
                                  { value: 'always', label: 'Always' },
                                ],
                                onSelect: async v => {
                                  await set('hide')(withPart('handoff', v === 'hidden'))
                                  if (v !== 'hidden') await set('handoffButton')(v)
                                },
                              }),
                            ]
                        : [
                            ...(bare
                              ? []
                              : [
                                  settingRow({
                                    key: 'settings-layout',
                                    label: 'Look',
                                    value: shown.layout,
                                    options: [
                                      { value: 'default', label: 'Dashboard' },
                                      { value: 'minimal', label: 'Minimal' },
                                    ],
                                    onSelect: set('layout'),
                                  }),
                                  settingRow({
                                    key: 'settings-appearance',
                                    label: 'Appearance',
                                    value: shown.appearance,
                                    options: [
                                      { value: 'auto', label: 'Match Claude Code' },
                                      { value: 'dark', label: 'Dark' },
                                      { value: 'light', label: 'Light' },
                                    ],
                                    onSelect: set('appearance'),
                                  }),
                                  settingRow({
                                    key: 'settings-theme',
                                    label: 'Theme',
                                    value: shown.theme,
                                    options: THEMES.map(theme => ({ value: theme, label: THEME_LABELS[theme] })),
                                    onSelect: set('theme'),
                                  }),
                                ]),
                            <Box
                              key="settings-show"
                              width="100%"
                              flexDirection="row"
                              flexWrap="wrap"
                              columnGap={1}
                              alignItems="center"
                            >
                              <Text dimColor>Show</Text>
                              {showParts.map(box)}
                            </Box>,
                            ...(bare
                              ? []
                              : [
                                  <Box key="settings-uninstall-row" width="100%" flexDirection="row">
                                    {uninstallButton($, themedEls($.ui.resolve(e)))}
                                  </Box>,
                                ]),
                          ]}
                </Box>
              </Box>
            )}
          </Box>
        )
      }
      // The compact bar: an optional note for the summary, then Compact (or Enter).
      if (e.surface !== 'terminal' && (await read($, compactAsk))) {
        const { Input } = themedEls($.ui.resolve(e))
        const go = () => compactCold($, compactNote)
        const nowCompact = await $.clock.now()
        // One redraw once the fade is over, to drop its layer.
        if (nowCompact - compactOpenedAt < COMPACT_FADE_MS)
          $.clock.after(COMPACT_FADE_MS + 150 - (nowCompact - compactOpenedAt), () => $.ui.invalidate('ui.render'))
        return (
          <Box
            key="compact-bar"
            position="relative"
            flexDirection="row"
            alignItems="center"
            paddingX={1}
            overflow="hidden"
            backgroundColor={BRAND_BG}
            borderStyle="round"
            borderColor={BRAND_EDGE}
          >
            <Box key="compact-art" position="absolute" top={-1} right={0} bottom={-1}>
              <Svg source={BRAND_SVG} alt="context-lens" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
            </Box>
            {/* Opening from the swamped band: its green fades out over the violet, then the entrance sweep. */}
            {nowCompact - compactOpenedAt < COMPACT_FADE_MS + 100 ? (
              <Box key="compact-fade" position="absolute" top={-1} left={0} right={0} bottom={-1}>
                <Svg source={compactFadeSvg(nowCompact - compactOpenedAt)} alt="" width={1600} height={240} />
              </Box>
            ) : null}
            {introLayer({ Box, Svg }, 'compact', await introShows($, 'compact'))}
            {/* One line, as tall as the bands: the name, then the field and the buttons on the right. */}
            <Box key="compact-words" position="relative" flexShrink={0}>
              {markTitle({ Box, Text, Svg }, 'compact-title', ACCENT, '✦ Compact')}
              <Box key="compact-switch-box" position="relative" flexShrink={0} marginLeft={1}>
                <Box position="absolute" top={0} left={0} />
                <Button
                  key="compact-to-handoff"
                  plain
                  dimColor
                  label="Handoff instead"
                  onPress={async () => {
                    await update($, compactAsk, () => false)
                    await openHandoffBar($)
                  }}
                />
              </Box>
            </Box>
            <Box
              key="compact-controls"
              position="relative"
              flexGrow={1}
              flexShrink={1}
              minWidth={0}
              flexDirection="row"
              justifyContent="flex-end"
              alignItems="center"
              gap={1}
            >
              <Box position="absolute" top={0} left={0} />
              {/* The field shows through a window anchored right: its own Enter hint (a submit button 12 px wide, 6 px
                  after the field) is pushed past the window's right edge and clipped, whatever width the app gives the
                  field. Three cells out, one cell of padding back: the field ends 2 px inside, the hint starts 4 px out. */}
              {/* The window reaches a row above and below the field (absolutely, so the bar stays one line): one line tall,
                  it cut the field's focus ring off at the top and bottom. */}
              {/* It gives way before the Compact button does: in a narrow pane the field shrinks, the button stays. */}
              <Box key="compact-field" position="relative" width={48} minWidth={6} height={1} flexShrink={1}>
                <Box position="absolute" top={-1} bottom={-1} left={0} right={0} overflow="hidden">
                  <Box
                    position="absolute"
                    top={0}
                    bottom={0}
                    right={-3}
                    width={60}
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="flex-end"
                    paddingRight={1}
                  >
                    <Input
                      key="compact-note"
                      placeholder="Summary (optional)"
                      submitLabel={'​'}
                      onInput={v => {
                        compactNote = v
                      }}
                      onSubmit={v => {
                        compactNote = v
                        void go()
                      }}
                    />
                  </Box>
                </Box>
              </Box>
              {/* Compact with the Enter mark in it: a white pill drawn, the word in the app's font, the mark as Claude's prompt
                  box draws its own, and a blank button over all three. A Button's label is text only, and ↵ there was a
                  hairline. */}
              <Box key="compact-go-box" position="relative" flexShrink={0} flexDirection="row" alignItems="center">
                <Box width={GO_CELLS} height={1} flexShrink={0} />
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Svg source={goPillSvg()} alt="Compact" width={GO_W} height={20} />
                </Box>
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="center"
                  gap={1}
                >
                  <Text color="#141416">Compact</Text>
                  <Svg source={enterSvg('#141416')} alt="Enter" width={14} height={14} />
                </Box>
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Button
                    key="compact-go"
                    plain
                    hover={{ backgroundColor: '#00000000' }}
                    label={' '.repeat(GO_CELLS)}
                    onPress={go}
                  />
                </Box>
              </Box>
              <Box key="compact-close-box" position="relative" flexShrink={0}>
                <Box position="absolute" top={0} left={0} />
                <Button
                  key="compact-close"
                  plain
                  label="✕"
                  hover={{ backgroundColor: CARD_CLOSE_HOVER }}
                  onPress={() => update($, compactAsk, () => false)}
                />
              </Box>
            </Box>
          </Box>
        )
      }
      // The handoff bar: quick or full, then what follows, and a line saying what that does. Opened by ⇥ or the swamp
      // band's Handoff; Go keeps the choice for next time. Enter presses Go once the bar holds the keyboard.
      const choice = await read($, handoffPick)
      if (choice) {
        const setBar = (change: Partial<HandoffChoice>) => async () => {
          if (change.kind && change.kind !== choice.kind) setKindFlipAt(await $.clock.now())
          await update($, handoffPick, () => ({ ...choice, ...change }))
          // The write alone redraws the bar; a full invalidate redraws the art too, which flickers.
        }
        const { Select } = themedEls($.ui.resolve(e))
        const what = handoffWhat(choice, config.handoffSkill)
        // Go is the one lit button: the picked kind is a quiet box, the other plain text. The app draws a hotkey's
        // letter faint on a grey button, so only the terminal gets letters there.
        const term = e.surface === 'terminal'
        const kindNow = await $.clock.now()
        const controls = [
          // Desktop: one switch with both words, the knob under the picked one (like Auto), each half a blank button.
          !term && Svg ? (
            <Box key="handoff-kind" position="relative" flexShrink={0} flexDirection="row" alignItems="center">
              <Box width={KIND_CELLS * 2} height={1} flexShrink={0} />
              <Box
                position="absolute"
                top={0}
                bottom={0}
                left={0}
                right={0}
                alignItems="center"
                justifyContent="center"
              >
                <Svg
                  source={kindSwitchSvg(choice.kind, kindNow - kindFlipAt)}
                  alt={choice.kind === 'full' ? 'Full handoff' : 'Quick handoff'}
                  width={KIND_W}
                  height={KIND_H}
                />
              </Box>
              <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="center">
                {(['quick', 'full'] as const).map(k => (
                  <Box
                    key={`handoff-kind-${k}`}
                    flexGrow={1}
                    width={0}
                    flexDirection="row"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Box flexShrink={0} width={2} alignItems="center">
                      <Svg
                        source={rowIconSvg(k, choice.kind === k ? '#141416' : DASH_DIM)}
                        alt={k === 'quick' ? 'bolt' : 'pen'}
                        width={14}
                        height={14}
                      />
                    </Box>
                    <Text color={choice.kind === k ? '#141416' : DASH_DIM}>{k === 'quick' ? 'Quick' : 'Full'}</Text>
                  </Box>
                ))}
              </Box>
              <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="center">
                {(['quick', 'full'] as const).map(k => (
                  <Box key={`handoff-kind-hit-${k}`} flexGrow={1} width={0} justifyContent="center">
                    <Button
                      key={`handoff-${k}`}
                      plain
                      hover={{ backgroundColor: '#00000000' }}
                      label={' '.repeat(KIND_CELLS)}
                      onPress={setBar({ kind: k })}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null,
          term || !Svg ? (
            choice.kind === 'quick' ? (
              <Button
                key="handoff-quick"
                hotkey={term ? 'q' : undefined}
                variant="secondary"
                label="Quick"
                onPress={setBar({ kind: 'quick' })}
              />
            ) : (
              <Button
                key="handoff-quick"
                hotkey={term ? 'q' : undefined}
                plain
                dimColor
                label="Quick"
                onPress={setBar({ kind: 'quick' })}
              />
            )
          ) : null,
          term || !Svg ? (
            choice.kind === 'full' ? (
              <Button
                key="handoff-full"
                hotkey={term ? 'f' : undefined}
                variant="secondary"
                label="Full"
                onPress={setBar({ kind: 'full' })}
              />
            ) : (
              <Button
                key="handoff-full"
                hotkey={term ? 'f' : undefined}
                plain
                dimColor
                label="Full"
                onPress={setBar({ kind: 'full' })}
              />
            )
          ) : null,
          <Select
            key="handoff-after"
            value={choice.after}
            options={[
              { value: 'continue', label: 'Clear & carry on' },
              { value: 'confirm', label: 'Clear & wait' },
              { value: 'copy', label: 'Keep chat & copy' },
            ]}
            onSelect={v => setBar({ after: v as HandoffAfter })()}
          />,
          <Button key="handoff-go" variant="primary" autoFocus label="Go" onPress={() => goHandoff($, choice)} />,
          <Button key="handoff-close" plain role="dismiss" label="✕" onPress={() => closeHandoffBar($)} />,
        ]
        // The terminal says all of it; the desktop bar only what the picked kind does: the dropdown beside it already
        // says what happens after.
        const line =
          e.surface === 'terminal'
            ? `${what.by}. ${what.then}`
            : choice.kind === 'full'
              ? config.handoffSkill
                ? `/${config.handoffSkill}`
                : 'Saves HANDOFF.md'
              : 'A few seconds'
        if (e.surface === 'terminal') return terminalPanel($, e, 'handoff-bar', '⇥ Handoff', line, controls)
        return (
          // The art is a still image here: an animated one sits in a frame the app rebuilds on every redraw, and the bar
          // redraws on every choice. The title over the line on what happens, on the left; the controls on the right in
          // their own absolute layer, drawn last: the app draws anything in the flow under the absolute art, where it takes
          // no clicks.
          <Box
            key="handoff-bar"
            position="relative"
            flexDirection="row"
            alignItems="center"
            paddingX={1}
            overflow="hidden"
            backgroundColor={BRAND_BG}
            borderStyle="round"
            borderColor={BRAND_EDGE}
          >
            <Box key="handoff-art" position="absolute" top={-1} right={0} bottom={-1}>
              <Svg source={BRAND_SVG} alt="context-lens" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
            </Box>
            {/* The entrance as the bar opens, only then: a choice redraws the bar. */}
            {introLayer({ Box, Svg }, 'handoff', await introShows($, 'handoff'))}
            {/* One line: the name, then what the picked kind does, dim. */}
            <Box key="handoff-words" position="relative" flexDirection="row" gap={1} flexShrink={1} minWidth={0}>
              <Text color={ACCENT} bold wrap="truncate">
                ⇥ Handoff
              </Text>
              <Text key="handoff-what" dimColor wrap="truncate">
                {line}
              </Text>
            </Box>
            <Box flexGrow={1} minWidth={48} />
            <Box
              key="handoff-actions"
              position="absolute"
              top={0}
              right={1}
              bottom={0}
              flexDirection="row"
              gap={1}
              alignItems="center"
            >
              {!term ? (
                <Button
                  key="handoff-to-compact"
                  plain
                  dimColor
                  label="Compact instead"
                  onPress={async () => {
                    await closeHandoffBar($)
                    await openCompact($, e)
                  }}
                />
              ) : null}
              {controls}
            </Box>
          </Box>
        )
      }
      // The setup guide, one step at a time: the lean, the handoff, the look, then a word on what else is there. The
      // choices are saved together at Done or ✕ (see setupDraft). A stored step the guide does not know starts it at the lean.
      const storedStep = await read($, setupStep)
      const step =
        storedStep && !(['lean', 'handoff', 'look', 'done'] as const).includes(storedStep) ? 'lean' : storedStep
      if (step) {
        const { Input, Select } = themedEls($.ui.resolve(e))
        const draft = await read($, setupDraft)
        const shown = setupShown(draft, config)
        const setDraft = (field: keyof SettingsDraft, value: string) =>
          update($, setupDraft, d => ({ ...d, [field]: value }))
        const go = (to: SetupStep | null) => () => goSetup($, to)
        const back = setupBack(step)
        const counter = setupCounter(step)
        const nav = (forward: unknown) => [
          ...(back ? [<Button key="setup-back" plain dimColor label="Back" onPress={go(back)} />] : []),
          forward,
          <Button key="setup-close" plain role="dismiss" label="✕" onPress={() => closeSetup($)} />,
        ]
        const nextButton = <Button key="setup-next" variant="primary" label="Next" onPress={go(setupNext(step))} />
        // The title over one line of words on the left, the controls on the right. The controls are their own absolute
        // layer, drawn last: the app draws anything in the flow under the absolute art, where it takes no clicks
        // (position="relative" does not lift it). The spacer keeps the words clear of them; room is their width in
        // columns. The art is still: every click redraws the band.
        const band = (words: unknown, room: number, controls: unknown[]) =>
          e.surface === 'terminal' ? (
            terminalPanel(
              $,
              e,
              'setup',
              counter ? `✦ context-lens setup  ${counter}` : '✦ context-lens setup',
              words,
              controls,
            )
          ) : (
            <Box
              key="setup"
              position="relative"
              flexDirection="row"
              alignItems="center"
              paddingX={1}
              overflow="hidden"
              backgroundColor={BRAND_BG}
              borderStyle="round"
              borderColor={BRAND_EDGE}
            >
              <Box key="setup-art" position="absolute" top={-1} right={0} bottom={-1}>
                <Svg source={BRAND_SVG} alt="context-lens" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
              </Box>
              <Box key="setup-words" position="relative" flexDirection="column" flexShrink={1} minWidth={0}>
                <Text color={ACCENT} bold wrap="truncate">
                  {counter ? `✦ context-lens setup  ${counter}` : '✦ context-lens setup'}
                </Text>
                {typeof words === 'string' ? (
                  <Text key="setup-what" wrap="truncate">
                    {words}
                  </Text>
                ) : (
                  words
                )}
              </Box>
              <Box flexGrow={1} minWidth={room} />
              <Box
                key="setup-actions"
                position="absolute"
                top={0}
                right={1}
                bottom={0}
                flexDirection="row"
                gap={1}
                alignItems="center"
              >
                {controls}
              </Box>
            </Box>
          )
        if (step === 'lean') {
          // Five stops, the marker on the one picked. The track is lit in the accent from the middle out to the marker, so it
          // shows which way it leans, and the words name the stop and say what it does.
          const lean = shown.bias
          const track: unknown[] = []
          for (const n of [-2, -1, 0, 1, 2]) {
            if (n > -2) {
              const lit = lean > 0 ? n > 0 && n <= lean : lean < 0 ? n <= 0 && n > lean : false
              track.push(
                lit ? (
                  <Text key={`t${n}`} color={ACCENT}>
                    ──
                  </Text>
                ) : (
                  <Text key={`t${n}`} dimColor>
                    ──
                  </Text>
                ),
              )
            }
            track.push(
              <Button
                key={`setup-bias${n + 2}`}
                plain
                label={n === lean ? '◉' : '○'}
                onPress={() => setDraft('bias', String(n))}
              />,
            )
          }
          const [name, does] = LEAN_STOPS[lean + 2]
          const side = (label: string, lit: boolean) =>
            lit ? (
              <Text key={label} color={ACCENT}>
                {label}
              </Text>
            ) : (
              <Text key={label} dimColor>
                {label}
              </Text>
            )
          return band(
            <Box key="setup-what" flexDirection="row" flexShrink={1} minWidth={0}>
              <Text color={ACCENT} bold wrap="truncate">{`${name}: `}</Text>
              <Text wrap="truncate">{does}</Text>
            </Box>,
            62,
            [
              side('Cheaper', lean < 0),
              <Box key="track" flexDirection="row" alignItems="center">
                {track}
              </Box>,
              side('Smarter', lean > 0),
              ...nav(nextButton),
            ],
          )
        }
        if (step === 'handoff') {
          const skillNames = await read($, installedSkills)
          return band('Who writes a Full ⇥ handoff?', 48, [
            <Select
              key="setup-skill"
              value={shown.handoffSkill || '-'}
              options={[
                { value: '-', label: 'Built in' },
                ...[...new Set([...(shown.handoffSkill ? [shown.handoffSkill] : []), ...skillNames])].map(name => ({
                  value: name,
                  label: `/${name}`,
                })),
              ]}
              onSelect={(v: string) => setDraft('handoffSkill', v === '-' ? '' : v)}
            />,
            ...nav(nextButton),
          ])
        }
        if (step === 'look') {
          // Match Claude Code is the default; the other two fix it. The choice shows at once.
          const mode = shown.appearance
          return band('Dark or light panels?', 56, [
            ...(['auto', 'dark', 'light'] as const).map(value => (
              <Button
                key={`setup-look-${value}`}
                plain
                label={`${mode === value ? '◉' : '○'} ${{ auto: 'Match Claude Code', dark: 'Dark', light: 'Light' }[value]}`}
                onPress={() => setDraft('appearance', value)}
              />
            )),
            ...nav(nextButton),
          ])
        }
        return band('⏻ Auto on or off. ⚙ all settings. Auto pauses on Fable.', 24, [
          ...nav(<Button key="setup-done" variant="primary" autoFocus label="Done" onPress={() => closeSetup($)} />),
        ])
      }
      // The judge is failing: the effort stays as it is until it answers again.
      const downReason = await read($, judgeDown)
      if (downReason && downReason !== (await read($, judgeDownHidden))) {
        if (e.surface === 'terminal')
          return terminalBand($, e, {
            key: 'down',
            kind: 'down',
            color: SLATE,
            bg: SLATE_BG,
            edge: SLATE_EDGE,
            title: 'Judge down',
            detail: `${downReason}. The effort stays as it is.`,
            buttons: [
              <Button
                key="down-close"
                plain
                role="dismiss"
                label="✕"
                onPress={() => update($, judgeDownHidden, () => downReason)}
              />,
            ],
          })
        return (
          <Box
            key="down"
            position="relative"
            flexDirection="row"
            gap={1}
            alignItems="center"
            paddingX={1}
            overflow="hidden"
            backgroundColor={SLATE_BG}
            borderStyle="round"
            borderColor={SLATE_EDGE}
          >
            <Box key="down-art" position="absolute" top={-1} right={0} bottom={-1}>
              <Svg source={DOWN_SVG} alt="judge down" width={FROST_WIDTH} height={FROST_HEIGHT} />
            </Box>
            {introLayer({ Box, Svg }, 'down', await introShows($, 'down'), '#7d8aa8', '#e6ecf8')}
            <Box flexShrink={0}>
              <Text color={SLATE} bold wrap="truncate">
                ✦ Judge down
              </Text>
            </Box>
            <Text wrap="truncate">{`${downReason}. The effort stays as it is.`}</Text>
            <Box flexGrow={1} minWidth={30} />
            <Box
              key="down-actions"
              position="absolute"
              top={0}
              right={1}
              bottom={0}
              flexDirection="row"
              gap={1}
              alignItems="center"
            >
              <Button
                key="down-close"
                plain
                role="dismiss"
                label="✕"
                onPress={() => update($, judgeDownHidden, () => downReason)}
              />
            </Box>
          </Box>
        )
      }
      // A usage limit is close: Save mode keeps Auto at medium or below until it resets.
      const heat = await read($, hot)
      if (heat && !config.hide.includes('hot') && hotVisible(heat, await hotClosedNow($))) {
        const saving = (await read($, saveUntil)) !== null
        const window = heat.kind === 'five_hour' ? '5h' : 'weekly'
        const resets = resetLabel(heat.resetsAt, await $.clock.now())
        if (e.surface === 'terminal')
          return terminalBand($, e, {
            key: 'hot',
            kind: 'hot',
            color: EMBER,
            bg: EMBER_BG,
            edge: EMBER_EDGE,
            title: 'Running hot',
            detail: `${Math.round(heat.percent)}% of your ${window} limit used${resets ? ` · resets ${resets}` : ''}`,
            buttons: [
              <Button
                key="hot-save"
                variant="primary"
                hotkey="s"
                label={saving ? 'Save mode on' : 'Save mode'}
                onPress={async () => {
                  $.ui.toast(`context-lens: ${await toggleSave($)}`)
                }}
              />,
              <Button key="hot-close" plain role="dismiss" label="✕" onPress={() => closeHot($, heat)} />,
            ],
          })
        return (
          <Box
            key="hot"
            position="relative"
            flexDirection="row"
            gap={1}
            alignItems="center"
            paddingX={1}
            overflow="hidden"
            backgroundColor={EMBER_BG}
            borderStyle="round"
            borderColor={EMBER_EDGE}
          >
            <Box key="ember" position="absolute" top={-1} right={0} bottom={-1}>
              <Svg source={EMBER_SVG} alt="embers" width={FROST_WIDTH} height={FROST_HEIGHT} />
            </Box>
            {introLayer({ Box, Svg }, 'hot', await introShows($, 'hot'), EMBER, '#ffd2a8')}
            <Box flexShrink={0}>
              <Text color={EMBER} bold wrap="truncate">
                ✦ Running hot
              </Text>
            </Box>
            <Text wrap="truncate">{`${Math.round(heat.percent)}% of your ${window} limit used${resets ? ` · resets ${resets}` : ''}`}</Text>
            <Box flexGrow={1} minWidth={30} />
            <Box
              key="hot-actions"
              position="absolute"
              top={0}
              right={1}
              bottom={0}
              flexDirection="row"
              gap={1}
              alignItems="center"
            >
              <Button
                key="hot-save"
                variant="primary"
                label={saving ? 'Save mode on' : 'Save mode'}
                onPress={async () => {
                  $.ui.toast(`context-lens: ${await toggleSave($)}`)
                }}
              />
              <Button key="hot-close" plain role="dismiss" label="✕" onPress={() => closeHot($, heat)} />
            </Box>
          </Box>
        )
      }
      const savedAt = (await $.store.get('settingsSavedAt').catch(() => null)) as number | null
      if (typeof savedAt === 'number') {
        const since = (await $.clock.now().catch(() => Date.now())) - savedAt
        if (since >= 0 && since < SAVED_CARD_MS) {
          $.clock.after(SAVED_CARD_MS - since + 50, () => $.ui.invalidate('ui.render'))
          return savedCardTree($, e)
        }
      }
      // A handoff or compact running or just done: said above the prompt, where it is seen at once.
      const compactNow = e.surface === 'terminal' ? null : await compactCard($, !!e.props.isWorking)
      if (compactNow)
        return handoffCardTree(
          $,
          e,
          compactNow,
          undefined,
          !cardRunning(compactNow.kind)
            ? () => update($, handoffCard, card => (card && !cardRunning(card.kind) ? null : card))
            : undefined,
        )
      // The cache went cold: the next message rereads the whole chat at full price. Only worth a band on a big chat.
      const compacting = await read($, isCompacting)
      const coldTokens = compacting ? null : await coldWorth($)
      if (coldTokens !== null) {
        const line = `Next message rereads ${kTokens(coldTokens)} tokens at full price.`
        if (e.surface === 'terminal')
          return terminalBand($, e, {
            key: 'cold',
            kind: 'cold',
            color: ICE,
            bg: ICE_BG,
            edge: ICE_EDGE,
            title: 'Chat went cold',
            detail: `${line} Hand off or compact first.`,
            buttons: [
              <Button
                key="cold-hide"
                plain
                hotkey="n"
                label="Not now"
                onPress={() => update($, isColdHidden, () => true)}
              />,
              <Button key="cold-compact" hotkey="c" label="Compact" onPress={() => openCompact($, e)} />,
              <Button
                key="cold-handoff"
                variant="primary"
                hotkey="h"
                label="Handoff"
                onPress={() => openHandoffBar($)}
              />,
            ],
          })
        // The art is a backdrop: an absolutely placed layer behind the right side, so the words and buttons sit on it.
        return (
          <Box
            key="cold"
            position="relative"
            flexDirection="row"
            gap={1}
            alignItems="center"
            paddingX={1}
            overflow="hidden"
            backgroundColor={ICE_BG}
            borderStyle="round"
            borderColor={ICE_EDGE}
          >
            {/* Taller than the band and clipped by it, so the frost reaches every edge on the right. */}
            <Box key="frost" position="absolute" top={-1} right={0} bottom={-1}>
              <Svg source={FROST_SVG} alt="frost" width={FROST_WIDTH} height={FROST_HEIGHT} />
            </Box>
            <Box key="cold-glow" position="absolute" top={0} left={0} right={0} bottom={0}>
              <Svg
                source={inPhase(coldGlowSvg(), (await $.clock.now()) % COLD_GLOW_MS)}
                alt="cold glow"
                width={AUTO_GLOW_W}
                height={AUTO_GLOW_H}
              />
            </Box>
            {introLayer({ Box, Svg }, 'cold', await introShows($, 'cold'), ICE, '#cfeeff')}
            <Box flexShrink={0}>
              <Text color={ICE} bold wrap="truncate">
                ✦ Chat went cold
              </Text>
            </Box>
            <Text wrap="truncate">{line}</Text>
            {/* Room for the buttons, which sit in their own layer after the frost so they are drawn on top of it. */}
            <Box flexGrow={1} minWidth={34} />
            <Box
              key="cold-actions"
              position="absolute"
              top={0}
              right={1}
              bottom={0}
              flexDirection="row"
              gap={1}
              alignItems="center"
            >
              <Button key="cold-hide" plain label="Not now" onPress={() => update($, isColdHidden, () => true)} />
              <Button key="cold-compact" variant="secondary" label="Compact" onPress={() => openCompact($, e)} />
              <Button key="cold-handoff" variant="primary" label="Handoff" onPress={() => openHandoffBar($)} />
            </Box>
          </Box>
        )
      }
      // The context is swamped: every message re-reads all of it. Compact or hand off, right here.
      const swampTokens = await read($, swamped)
      const hiddenAt = await read($, swampHiddenAt)
      if (
        swampTokens !== null &&
        !config.hide.includes('swamp') &&
        !turnBusy() &&
        !compacting &&
        (hiddenAt === null || swampTokens >= hiddenAt + SWAMP_REGROW)
      ) {
        const handing = (await read($, handoffStage)) !== null
        if (e.surface === 'terminal')
          return terminalBand($, e, {
            key: 'swamp',
            kind: 'swamp',
            color: BOG,
            bg: BOG_BG,
            edge: BOG_EDGE,
            title: 'Chat is getting swamped',
            detail: `${Math.round(swampTokens / 1000)}k tokens${lastContext && lastContext.window ? ` (${Math.round(lastContext.percent)}% of context)` : ''} re-read every message.`,
            buttons: [
              <Button key="swamp-compact" variant="primary" label="Compact" onPress={() => openCompact($, e)} />,
              <Button
                key="swamp-handoff"
                label={handing ? 'Handing off…' : 'Handoff'}
                onPress={() => openHandoffBar($)}
              />,
              <Button
                key="swamp-close"
                plain
                role="dismiss"
                label="✕"
                onPress={() => update($, swampHiddenAt, () => swampTokens)}
              />,
            ],
          })
        return (
          <Box
            key="swamp"
            position="relative"
            flexDirection="row"
            gap={1}
            alignItems="center"
            paddingX={1}
            overflow="hidden"
            backgroundColor={BOG_BG}
            borderStyle="round"
            borderColor={BOG_EDGE}
          >
            <Box key="bog" position="absolute" top={-1} right={0} bottom={-1}>
              <Svg source={SWAMP_SVG} alt="swamp" width={FROST_WIDTH} height={FROST_HEIGHT} />
            </Box>
            {introLayer({ Box, Svg }, 'swamp', await introShows($, 'swamp'), '#6f9a4f', '#d6ecc2')}
            <Box flexShrink={0}>
              <Text color={BOG} bold wrap="truncate">
                ✦ Chat is getting swamped
              </Text>
            </Box>
            {/* How full the context is, as a ring and a figure: the tokens alone do not say how close the limit is. */}
            {lastContext && lastContext.window ? (
              <Box key="swamp-ring" flexShrink={0} flexDirection="row" gap={1} alignItems="center">
                <Svg
                  source={ringSvg(lastContext.percent, BOG)}
                  alt={`${Math.round(lastContext.percent)}% of context`}
                  width={16}
                  height={16}
                />
                <Text color={BOG}>{`${Math.round(lastContext.percent)}%`}</Text>
              </Box>
            ) : null}
            <Text wrap="truncate">{`${Math.round(swampTokens / 1000)}k tokens re-read every message.`}</Text>
            <Box flexGrow={1} minWidth={34} />
            <Box
              key="swamp-actions"
              position="absolute"
              top={0}
              right={1}
              bottom={0}
              flexDirection="row"
              gap={1}
              alignItems="center"
            >
              <Button key="swamp-compact" variant="primary" label="Compact" onPress={() => openCompact($, e)} />
              <Button
                key="swamp-handoff"
                label={handing ? 'Handing off…' : 'Handoff'}
                onPress={() => openHandoffBar($)}
              />
              <Button
                key="swamp-close"
                plain
                role="dismiss"
                label="✕"
                onPress={() => update($, swampHiddenAt, () => swampTokens)}
              />
            </Box>
          </Box>
        )
      }
      // At rest: the dashboard, unless the person picked the minimal look (the footer's buttons, no band).
      if (config.layout === 'default') {
        if (e.surface === 'terminal') return dashboardBand($, e)
        const { question } = await effortRows($, e)
        const dash = await dashboardBand($, e)
        const lensBelow = await lensRow(
          $,
          e,
          typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 100,
        ).catch(() => null)
        return question || lensBelow ? (
          <Box key="dash-col" flexDirection="column">
            {question}
            {dash}
            {lensBelow}
          </Box>
        ) : (
          dash
        )
      }
      // The minimal look draws no dashboard: mark the rest here, so the next band plays its entrance.
      introKind = 'rest'
      const { question, rows, noteLine } = await effortRows($, e)
      if (e.surface !== 'terminal') return question ?? next(e)
      return (
        <Box key="rows-col" flexDirection="column">
          {rows}
          {noteLine}
        </Box>
      )
    } catch (error) {
      setLastRenderError((error instanceof Error ? error.message : String(error)).slice(0, 300))
      return next(e)
    } finally {
      if (glowReadAt !== null) {
        drawLead = drawLead * 0.7 + Math.min(150, Date.now() - glowReadAt + 16) * 0.3
        glowReadAt = null
      }
      // How long the draws take, for the first few after a load: the render log says where a slow start goes.
      if (drawsTimed < 5) {
        setDrawsTimed(drawsTimed + 1)
        renderLog.push(`${new Date().toISOString()} ${loadedSession} draw took ${Date.now() - lastRenderAt} ms`)
      }
    }
  })
}
