import { atom, type On, read, update } from 'claude-code'

import type { ModelKey, Pick } from '../../types'
import { config } from '../core/config'
import { cacheSafe, EFFORTS, MODELS, takesEffort } from '../core/constants'
import { loadedSession, renderLog } from '../core/debug'
import { proof } from '../core/env'
import { setTurnBusy } from '../core/session'
import { cacheTtl, coldForced } from '../logic/cache'
import { choose } from '../logic/effort'
import { checkHandoff } from '../logic/handoff'
import {
  bounded,
  capped,
  drawGlowSteps,
  endJudgeGlow,
  isFollowUp,
  judge,
  keepsEffort,
  namedEffort,
  recentContext,
  setHeldPick,
  setJudgeEndedAt,
  setJudgeStartedAt,
  tipped,
  typedSkill,
  withAttachments,
  withMidTurn,
} from '../logic/judge'
import { lastContext } from '../logic/lens'
import { countPrompt, setRanThisTurn, setTurnCost } from '../logic/spend'
import {
  declined,
  holdForOffer,
  modelCaches,
  modelIs,
  sessionModel,
  sessionModelId,
  setSuggestedAs,
  settleOffer,
  subagentNote,
  subagentPays,
  suggestedAs,
  switchModel,
  switchWorth,
  warmTokens,
} from '../logic/switching'
import { JUDGE_RISE_MS } from '../svg/glows'

const isAuto = atom({ plugin: 'context-lens', key: 'isAuto' } as const, true)
const isAutoModel = atom({ plugin: 'context-lens', key: 'isAutoModel' } as const, false)
const pick = atom({ plugin: 'context-lens', key: 'pick' } as const, null)
const isJudging = atom({ plugin: 'context-lens', key: 'isJudging' } as const, false)
const suggestion = atom({ plugin: 'context-lens', key: 'suggestion' } as const, null)
const cacheLeft = atom({ plugin: 'context-lens', key: 'cacheLeft' } as const, null)
const handoffCard = atom({ plugin: 'context-lens', key: 'handoffCard' } as const, null)
const saveUntil = atom({ plugin: 'context-lens', key: 'saveUntil' } as const, null)

export function registerPromptHooks(on: On) {
  on('prompt.submit', async ($, e, next) => {
    await setTurnBusy($, true)
    // A message typed while a reply runs belongs to that reply: its cost goes on.
    if (e.turnId === undefined) {
      setTurnCost(0)
      setRanThisTurn(null)
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
      if (midTurn && running && EFFORTS.indexOf(named) < EFFORTS.indexOf(running.effort)) setHeldPick(applied)
      else {
        setHeldPick(null)
        await choose($, applied)
      }
      await countPrompt($, takesEffort(modelId) ? named : undefined, 'named', 0, 0)
      void proof($, `named level ${named} in "${e.text.slice(0, 50)}": no judge`)
      $.ui.invalidate('ui.render')
      return next(e)
    }

    setJudgeStartedAt(await $.clock.now().catch(() => Date.now()))
    setJudgeEndedAt(null)
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
            setHeldPick(applied)
            void proof($, `typed mid-turn: ${effort} waits, the running turn keeps ${running.effort}`)
          } else {
            setHeldPick(null)
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
        } else if (config.holdOffer === 'never') {
          await update($, suggestion, () => null)
        } else if (worth && offerable && typedNow && config.holdOffer === 'on') {
          setSuggestedAs(worth)
          await update($, suggestion, () => verdict.model)
          held = verdict.model
        } else if (worth === 'switch') {
          setSuggestedAs(worth)
          await update($, suggestion, () => verdict.model)
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
}
