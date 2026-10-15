import { atom, type On, update } from 'claude-code'

import type { Pick } from '../../types'
import { config, pluginOptions, readConfig, setConfig } from '../core/config'
import { CACHE_TTL, EFFORTS } from '../core/constants'
import {
  loadedSession,
  renderLog,
  sessionStarted,
  setLoadedSession,
  setSessionStarted,
  writeRenderLog,
} from '../core/debug'
import { readOwnVersion } from '../core/env'
import { applyTheme } from '../core/palette'
import { setClassicStart, setPickCarried } from '../core/session'
import { checkSwamp } from '../logic/alerts'
import {
  cacheExpires,
  cacheTtl,
  lastResponseAt,
  rememberCache,
  setCacheExpires,
  setLastResponseAt,
  showCache,
} from '../logic/cache'
import { haikuCompaction, setLastHaikuCompact } from '../logic/compact'
import { afterCompaction, lensStarted, refreshUsage } from '../logic/lens'
import { carryRenamedSettings } from '../logic/settings'
import { drainSetupSave } from '../logic/setup'
import { modelCaches, modelIs } from '../logic/switching'
import { redrawSoon, startTimers } from '../logic/timers'
import { emptyClock } from '../model'

const isAuto = atom({ plugin: 'context-lens', key: 'isAuto' } as const, true)
const isAutoModel = atom({ plugin: 'context-lens', key: 'isAutoModel' } as const, false)
const pick = atom({ plugin: 'context-lens', key: 'pick' } as const, null)
const setupPending = atom({ plugin: 'context-lens', key: 'setupPending' } as const, false)
const setupStep = atom({ plugin: 'context-lens', key: 'setupStep' } as const, null)
const lensMain = atom({ plugin: 'context-lens', key: 'lensMain' } as const, emptyClock('1h'))
const lensLiveTokens = atom({ plugin: 'context-lens', key: 'lensLive' } as const, null)
const lensRewritten = atom({ plugin: 'context-lens', key: 'lensRewritten' } as const, false)
const lensLimits = atom({ plugin: 'context-lens', key: 'lensLimits' } as const, [])

export function registerSessionHooks(on: On) {
  // The lens's own hooks, on events no other hook of context-lens takes.
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
      setLastHaikuCompact(Date.now())
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
    // passed in. The carried ones are saved under their new names by the save queue (see drainSetupSave).
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
      setLastResponseAt(now - r.seconds_since_last_response * 1000)
      const left = lastResponseAt! + CACHE_TTL[cacheTtl]
      setCacheExpires(r.prompt_cache_likely_expired || left <= now ? now - 1 : left)
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
}
