import { atom, type On, read, update } from 'claude-code'

import { config } from '../core/config'
import {
  drawsTimed,
  firstDrawLogged,
  lastRenderAt,
  lastRenderProps,
  loadedAt,
  loadedSession,
  renderCalls,
  renderLog,
  setDrawsTimed,
  setFirstDrawLogged,
  setLastRenderAt,
  setLastRenderBranch,
  setLastRenderError,
  setLastRenderProps,
  setRenderCalls,
  writeRenderLog,
} from '../core/debug'
import { readOwnVersion } from '../core/env'
import { refreshAppearance } from '../core/palette'
import { turnBusy } from '../core/session'
import { hotClosedNow, hotVisible, SWAMP_REGROW } from '../logic/alerts'
import { coldWorth, restoreCache } from '../logic/cache'
import { compactCard } from '../logic/compact'
import { cardRunning } from '../logic/handoff'
import { SAVED_CARD_MS } from '../logic/settings'
import { drainSetupSave } from '../logic/setup'
import { setTimersScheduled, startTimers, timersFrom, timersScheduled } from '../logic/timers'
import { coldBand, hotBand, judgeDownBand, swampBand } from '../render/alert-bands'
import { savedCardTree } from '../render/alert-bands'
import { setIntroKind } from '../render/band'
import { compactBar } from '../render/compact-bar'
import { dashboardBand, drawLead, glowReadAt, setDrawLead, setGlowReadAt } from '../render/dashboard'
import { effortRows } from '../render/effort-rows'
import { handoffBar } from '../render/handoff-bar'
import { handoffCardTree } from '../render/handoff-card'
import { settingsPanel } from '../render/settings-panel'
import { setupGuide } from '../render/setup-guide'
import { themedEls } from '../theme'

const isCompacting = atom({ plugin: 'context-lens', key: 'isCompacting' } as const, false)
const compactAsk = atom({ plugin: 'context-lens', key: 'compactAsk' } as const, false)
const handoffPick = atom({ plugin: 'context-lens', key: 'handoffPick' } as const, null)
const swamped = atom({ plugin: 'context-lens', key: 'swamped' } as const, null)
const handoffCard = atom({ plugin: 'context-lens', key: 'handoffCard' } as const, null)
const swampHiddenAt = atom({ plugin: 'context-lens', key: 'swampHiddenAt' } as const, null)
const settingsOpen = atom({ plugin: 'context-lens', key: 'settingsOpen' } as const, false)
const judgeDown = atom({ plugin: 'context-lens', key: 'judgeDown' } as const, null)
const judgeDownHidden = atom({ plugin: 'context-lens', key: 'judgeDownHidden' } as const, null)
const hot = atom({ plugin: 'context-lens', key: 'hot' } as const, null)
const setupStep = atom({ plugin: 'context-lens', key: 'setupStep' } as const, null)

export function registerAbovePromptHooks(on: On) {
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
          setTimersScheduled(
            Boolean(
              $.clock.after(0, () => {
                readOwnVersion($)
                startTimers($, 'draw')
              }),
            ),
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
      const { Box } = themedEls($.ui.resolve(e))
      // The settings panel: a branded header bar, then one compact row per setting, a dim hint at the end of each row.
      if (open) return await settingsPanel($, e)
      // The compact bar: an optional note for the summary, then Compact (or Enter).
      if (e.surface !== 'terminal' && (await read($, compactAsk))) return await compactBar($, e)
      // The handoff bar: quick or full, then what follows, and a line saying what that does. Opened by ⇥ or the swamp
      // band's Handoff; Go keeps the choice for next time. Enter presses Go once the bar holds the keyboard.
      const choice = await read($, handoffPick)
      if (choice) return await handoffBar($, e, choice)
      // The setup guide, one step at a time: the lean, the handoff, then a word on what else is there. The
      // choices are saved together at Done or ✕ (see setupDraft). A stored step the guide does not know starts it at the lean.
      const storedStep = await read($, setupStep)
      const step = storedStep && !(['lean', 'handoff', 'done'] as const).includes(storedStep) ? 'lean' : storedStep
      if (step) return await setupGuide($, e, step)
      // The judge is failing: the effort stays as it is until it answers again.
      const downReason = await read($, judgeDown)
      if (downReason && downReason !== (await read($, judgeDownHidden))) return await judgeDownBand($, e, downReason)
      // A usage limit is close: Save mode keeps Auto at medium or below until it resets.
      const heat = await read($, hot)
      if (heat && !config.hide.includes('hot') && hotVisible(heat, await hotClosedNow($)))
        return await hotBand($, e, heat)
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
      if (coldTokens !== null) return await coldBand($, e, coldTokens)
      // The context is swamped: every message re-reads all of it. Compact or hand off, right here.
      const swampTokens = await read($, swamped)
      const hiddenAt = await read($, swampHiddenAt)
      if (
        swampTokens !== null &&
        !config.hide.includes('swamp') &&
        !turnBusy() &&
        !compacting &&
        (hiddenAt === null || swampTokens >= hiddenAt + SWAMP_REGROW)
      )
        return await swampBand($, e, swampTokens)
      // At rest: the dashboard, unless the person picked the minimal look (the footer's buttons, no band).
      if (config.layout === 'default') {
        if (e.surface === 'terminal') return dashboardBand($, e)
        const { question } = await effortRows($, e)
        const dash = await dashboardBand($, e)
        return question ? (
          <Box key="dash-col" flexDirection="column">
            {question}
            {dash}
          </Box>
        ) : (
          dash
        )
      }
      // The minimal look draws no dashboard: mark the rest here, so the next band plays its entrance.
      setIntroKind('rest')
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
        setDrawLead(drawLead * 0.7 + Math.min(150, Date.now() - glowReadAt + 16) * 0.3)
        setGlowReadAt(null)
      }
      // How long the draws take, for the first few after a load: the render log says where a slow start goes.
      if (drawsTimed < 5) {
        setDrawsTimed(drawsTimed + 1)
        renderLog.push(`${new Date().toISOString()} ${loadedSession} draw took ${Date.now() - lastRenderAt} ms`)
      }
    }
  })
}
