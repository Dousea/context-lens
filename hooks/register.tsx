import type { Register } from 'claude-code'

import { readConfig, setConfig, setPluginOptions } from './core/config'
import { setDrawsTimed, setFirstDrawLogged, setLoadedAt } from './core/debug'
import { applyTheme } from './core/palette'
import { registerAbovePromptHooks } from './handlers/above-prompt'
import { registerAgentHooks } from './handlers/agents'
import { registerCommandHooks } from './handlers/commands'
import { registerFooterHooks } from './handlers/footer'
import { registerPromptHooks } from './handlers/prompt'
import { registerSessionHooks } from './handlers/session'
import { registerTurnHooks } from './handlers/turn'
import { setTimersFrom, setTimersScheduled } from './logic/timers'

export { HIDEABLE, type Hideable, type JudgeConfig, readConfig, SWAMP_STEPS } from './core/config'
export { cacheSafe, EFFORTS, MODELS, takesEffort } from './core/constants'
export { claudeCandidates, noClaudeHint } from './core/env'
export { HOT_FINAL, hotVisible, resetLabel } from './logic/alerts'
export { type BenchAnswer, type BenchCase, benchGrade, benchReport, stepsGrade } from './logic/bench'
export { cacheClock, cacheColor, cacheLabel, cacheTtlOf, mostlyCached } from './logic/cache'
export { COMPACT_TAIL, compactTranscript } from './logic/compact'
export { hoverTips } from './logic/effort'
export {
  finishHandoff,
  forkOutcome,
  HANDOFF_FULL_PROMPT,
  HANDOFF_PROMPT,
  handoffEvidence,
  handoffMessage,
  handoffWhat,
  parseHandoffAnswer,
} from './logic/handoff'
export {
  bounded,
  capped,
  contextFrom,
  endsOnQuestion,
  isFollowUp,
  judgeFailure,
  keepsEffort,
  namedEffort,
  parseVerdict,
  tipped,
  withAttachments,
  withMidTurn,
} from './logic/judge'
export { renamedSettings } from './logic/settings'
export { LEAN_STOPS, setupBack, setupCounter, setupNext, setupShown, type SetupStep } from './logic/setup'
export { asSpent, savedText, turnLineFor, weighted } from './logic/spend'
export { subagentFloor, subagentModelFor, subagentQuestion, subagentSteerable } from './logic/subagents'
export { priceOf, subagentNote, subagentPays, switchWorth } from './logic/switching'
export { appHintText, bandFit } from './render/band'
export { dashboardLines, flashColor } from './render/dashboard'
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

export const register: Register = (on, options) => {
  setLoadedAt(Date.now())
  setTimersFrom(null)
  setTimersScheduled(false)
  setFirstDrawLogged(false)
  setDrawsTimed(0)

  setConfig(readConfig(options))
  applyTheme()
  setPluginOptions(options)

  registerSessionHooks(on)
  registerTurnHooks(on)
  registerCommandHooks(on)
  registerPromptHooks(on)
  registerFooterHooks(on)
  registerAgentHooks(on)
  registerAbovePromptHooks(on)
}
