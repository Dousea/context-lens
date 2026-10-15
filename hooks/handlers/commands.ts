import { atom, type On, read, update } from 'claude-code'

import type { HotClosed } from '../../types'
import { config } from '../core/config'
import { EMPTY_SPENT } from '../core/constants'
import {
  lastRenderAt,
  lastRenderBranch,
  lastRenderError,
  lastRenderProps,
  probeLevel,
  renderCalls,
  sessionStarted,
  setProbeLevel,
} from '../core/debug'
import { ownVersion, pluginId } from '../core/env'
import { classicStart, lastRequest } from '../core/session'
import { SWAMP_TOKENS, toggleSave } from '../logic/alerts'
import { type BenchCase, benchReport, runBench } from '../logic/bench'
import {
  cacheExpires,
  cacheMinutes,
  cacheTtl,
  coldForced,
  lastResponseAt,
  repliesSeen,
  setCacheExpires,
  setColdForced,
} from '../logic/cache'
import { lastHaikuCompact } from '../logic/compact'
import { toggleAutoEffort } from '../logic/effort'
import { handoffWhat, lastHandoffChoice, startHandoff } from '../logic/handoff'
import { openPluginSettings } from '../logic/settings'
import { kTokens, savedText } from '../logic/spend'
import {
  modelCaches,
  modelIs,
  offer,
  sessionPick,
  setDeclined,
  setSessionPick,
  settleOffer,
  suggestedAs,
  switchModel,
} from '../logic/switching'

const isAuto = atom({ plugin: 'context-lens', key: 'isAuto' } as const, true)
const suggestion = atom({ plugin: 'context-lens', key: 'suggestion' } as const, null)
const saved = atom({ plugin: 'context-lens', key: 'saved' } as const, EMPTY_SPENT)
const cacheLeft = atom({ plugin: 'context-lens', key: 'cacheLeft' } as const, null)
const handoffStage = atom({ plugin: 'context-lens', key: 'handoffStage' } as const, null)
const swamped = atom({ plugin: 'context-lens', key: 'swamped' } as const, null)
const swampHiddenAt = atom({ plugin: 'context-lens', key: 'swampHiddenAt' } as const, null)
const settingsOpen = atom({ plugin: 'context-lens', key: 'settingsOpen' } as const, false)
const judgeDown = atom({ plugin: 'context-lens', key: 'judgeDown' } as const, null)
const judgeDownHidden = atom({ plugin: 'context-lens', key: 'judgeDownHidden' } as const, null)
const hot = atom({ plugin: 'context-lens', key: 'hot' } as const, null)
const hotHidden = atom({ plugin: 'context-lens', key: 'hotHidden' } as const, null as HotClosed | null)
const setupStep = atom({ plugin: 'context-lens', key: 'setupStep' } as const, null)
const lensLimits = atom({ plugin: 'context-lens', key: 'lensLimits' } as const, [])

export function registerCommandHooks(on: On) {
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
      // Both sides, so missing usage windows show whether the app has none or the band never took them.
      const limitsText = (limits: readonly { kind: string; percentUsed: number }[]) =>
        limits.map(limit => `${limit.kind} ${Math.round(limit.percentUsed)}%`).join(', ') || 'none'
      const appLimits = (await $.session.usage().catch(() => null))?.rateLimits
      return {
        text:
          [
            // A copy outside the plugin cache (--plugin-dir) has no marketplace; name its folder instead.
            `plugin: ${ownVersion || '?'}, ${/cache[\\/][^\\/]+[\\/]/.test($.plugin.root) ? pluginId($) : `local copy at ${$.plugin.root}`}`,
            `session.start ${ago(sessionStarted)}`,
            `app SessionStart: ${classicStart ? `${ago(classicStart.at)} (${classicStart.said})` : 'never'}`,
            `cache: ${cacheExpires === 0 ? 'not started' : `${await cacheMinutes($)} min left`}, shown ${await read($, cacheLeft)}, ttl ${cacheTtl}, last reply ${lastResponseAt ? ago(lastResponseAt) : 'none seen'}, replies seen ${repliesSeen}, forced ${coldForced}`,
            `rate limits: app ${appLimits ? limitsText(appLimits) : 'unreadable'}, band ${limitsText(await read($, lensLimits))}`,
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
      setColdForced(true)
      setCacheExpires(await $.clock.now())
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
    setDeclined(wanted)
    await update($, suggestion, () => null)
    settleOffer(false)
    return { text: `Keeping the current model.` }
  })

  // /model ends a taken offer even when it names the model the app already runs, which the app does not count as a switch
  // and so sends no PostModelSwitch. A bare /model closed with Esc ends it too: that cannot be told from picking the same model.
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const result = await next(e)
    if (!sessionPick) return result

    setSessionPick(null)
    await modelIs($, await $.session.model())
    $.ui.invalidate('ui.render')
    return result
  })

  // A switch from anywhere (the app's picker, /model, a fallback) moves the pick at once.
  on('classic.PostModelSwitch', async ($, e, next) => {
    const result = await next(e)
    setSessionPick(null)
    await modelIs($, e.to_model)
    return result
  })
}
