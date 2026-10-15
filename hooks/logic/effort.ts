import { atom, type EngineInterface, read, update } from 'claude-code'

import type { Effort, Pick } from '../../types'
import { EFFORTS } from '../core/constants'
import { proof } from '../core/env'
import { pickCarried, setPickCarried } from '../core/session'
import { sessionModel } from './switching'

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
// True while the session runs a model where Auto must not change effort (see cacheSafe).
const paused = atom({ plugin: 'context-lens', key: 'paused' } as const, false)
const cacheLeft = atom({ plugin: 'context-lens', key: 'cacheLeft' } as const, null)
const isCompacting = atom({ plugin: 'context-lens', key: 'isCompacting' } as const, false)

const SWITCHED_MS = 2500

/**
 * You picked an effort (terminal rows): Auto for effort goes off and the requests carry the level for this session
 * only. The app's own effort control keeps its level, so a new chat starts from that one.
 */
export async function pickEffort($: EngineInterface, level: Effort) {
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

/** What Auto does at the next prompt, from its two switches: the note under the pickers before anything is decided. */
export const autoNote = (autoModel: boolean, autoEffort: boolean) =>
  autoModel && autoEffort
    ? 'Auto picks the model and effort at the next prompt'
    : autoEffort
      ? 'Auto picks the effort at the next prompt; the model is yours'
      : autoModel
        ? 'Auto picks the model at the next prompt; the effort is yours'
        : 'You pick the model and effort'

export async function toggleAutoEffort($: EngineInterface) {
  const turnOn = !(await read($, isAuto))
  await update($, isAuto, () => turnOn)
  await $.store.set('isAuto', turnOn)
}

export async function toggleAutoModel($: EngineInterface) {
  const turnOn = !(await read($, isAutoModel))
  await update($, isAutoModel, () => turnOn)
  await $.store.set('isAutoModel', turnOn)
  if (!turnOn) await update($, suggestion, () => null)
}

export async function choose($: EngineInterface, next: Pick | null) {
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

/** Everything a redraw needs, read together: the reads go out at once instead of one after the other. */
export async function snap($: EngineInterface) {
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
export type Snap = Awaited<ReturnType<typeof snap>>

/** The effort to show: yours or the judge's, else what the app itself runs with. */
export function effortOf(v: Snap): Effort | undefined {
  if (v.current) return v.current.effort
  return EFFORTS.includes(v.shownByApp as Effort) ? (v.shownByApp as Effort) : undefined
}
