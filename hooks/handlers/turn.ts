import { atom, type On, read, update } from 'claude-code'

import type { Effort } from '../../types'
import { config } from '../core/config'
import { cacheSafe, EFFORT_LABELS, EFFORTS, MODELS, takesEffort } from '../core/constants'
import { proof } from '../core/env'
import { engineEffort, pickCarried, setEngineEffort, setLastRequest, setTurnBusy } from '../core/session'
import { cacheExpires, cacheTouched } from '../logic/cache'
import { choose } from '../logic/effort'
import { cardRunning, setHandoffText } from '../logic/handoff'
import { heldPick, setHeldPick } from '../logic/judge'
import { recordRequest } from '../logic/lens'
import {
  ranThisTurn,
  setRanThisTurn,
  setTurnCost,
  storeTurnLine,
  tally,
  turnCost,
  weighted,
  withTurnLine,
} from '../logic/spend'
import { subagentFloor, subagentModelFor, subagentSpawnOf, subagentSteerable, subagentTally } from '../logic/subagents'
import { keyOf, modelCaches, modelIs, sessionModel, sessionPick } from '../logic/switching'

const isAuto = atom({ plugin: 'context-lens', key: 'isAuto' } as const, true)
const pick = atom({ plugin: 'context-lens', key: 'pick' } as const, null)
const appEffort = atom({ plugin: 'context-lens', key: 'appEffort' } as const, null)
const handoffStage = atom({ plugin: 'context-lens', key: 'handoffStage' } as const, null)
const handoffCard = atom({ plugin: 'context-lens', key: 'handoffCard' } as const, null)

// The newest reply's text, so the warning card goes under its last block and nowhere else.
const lastAnswer = atom({ plugin: 'context-lens', key: 'lastAnswer' } as const, '')
const turnLines = atom({ plugin: 'context-lens', key: 'turnLines' } as const, {})

export function registerTurnHooks(on: On) {
  // The handoff turn ended: keep its text; the session's timer clears the chat and sends it.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await setTurnBusy($, false)
    // A lower verdict for a message typed during the turn takes over now, if Auto is still on.
    if (!e.agentId && heldPick) {
      const held = heldPick
      setHeldPick(null)
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
      setRanThisTurn(null)
    }
    // A landed handoff card stays under the first reply after it, and goes with the next.
    if (!e.agentId) {
      await update($, handoffCard, card =>
        !card || cardRunning(card.kind) ? card : card.seen ? null : { ...card, seen: true },
      )
    }
    if (!e.agentId && (await read($, handoffStage)) === 'writing') {
      if (e.reason === 'answer' && e.answer.trim()) setHandoffText(e.answer)
      else {
        await update($, handoffStage, () => null)
        $.ui.toast('context-lens: the handoff was not written, nothing was cleared')
      }
    }
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
        setRanThisTurn({
          model: typeof request.model === 'string' ? keyOf(request.model) : undefined,
          effort: EFFORTS.find(x => x === request.effort),
        })
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
      if (answer?.usage) setTurnCost(turnCost + weighted(answer.usage))
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
}
