import { atom, type EngineInterface, read, update } from 'claude-code'

import type { SettingsDraft } from '../../types'
import { config, type Hideable, type JudgeConfig } from '../core/config'
import { loadInstalledSkills, saveSetting, SETTING_FIELDS } from './settings'

// The first-run setup is not done: the footer offers "Setup".
const setupPending = atom({ plugin: 'context-lens', key: 'setupPending' } as const, false)
// The setup guide above the prompt: which step it shows, or null when it is closed.
const setupStep = atom({ plugin: 'context-lens', key: 'setupStep' } as const, null)
// What was picked in the setup guide and not saved yet: it is saved in one go at Done or ✕. Each saved setting reloads
// the plugin, and the app says so in the chat, so a save per click filled the chat with notices.
const setupDraft = atom({ plugin: 'context-lens', key: 'setupDraft' } as const, {})

export type SetupStep = 'lean' | 'handoff' | 'done'

/** The lean's five stops, cheaper to smarter: a name, and what it does to the judge's pick (see tipped). */
export const LEAN_STOPS = [
  ['Cheapest', 'more picks go lower'],
  ['Cheaper', 'unsure picks go lower'],
  ['Balanced', 'the judge decides'],
  ['Smarter', 'unsure picks go higher'],
  ['Smartest', 'more picks go higher'],
] as const

/** The guide's step after this one: the lean, the handoff, then done. */
export function setupNext(step: SetupStep): SetupStep | null {
  if (step === 'lean') return 'handoff'
  if (step === 'handoff') return 'done'
  return null
}

/** The step Back goes to; the lean is the first. */
export function setupBack(step: SetupStep): SetupStep | null {
  if (step === 'handoff') return 'lean'
  if (step === 'done') return 'handoff'
  return null
}

/** "1/2" for the step shown; the closing step has no number. */
export function setupCounter(step: SetupStep): string {
  const n = { lean: 1, handoff: 2, done: 0 }[step]
  return n ? `${n}/2` : ''
}

/** Shows a step of the guide; the handoff step needs the installed skills to pick from. */
export async function goSetup($: EngineInterface, step: SetupStep | null) {
  if (step === 'handoff') await loadInstalledSkills($)
  await update($, setupStep, () => step)
}

/** The guide's choices over the saved settings: what each step shows. */
export function setupShown(draft: SettingsDraft, saved: JudgeConfig) {
  return {
    bias: draft.bias !== undefined ? Number(draft.bias) : saved.bias,
    handoffSkill: draft.handoffSkill ?? saved.handoffSkill,
    hide: (draft.hide ?? saved.hide.join(',')).split(',').filter(Boolean) as Hideable[],
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
  }
  const changes: Record<string, string> = {}
  for (const field of ['hide', 'bias', 'handoffSkill'] as const) {
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
export async function drainSetupSave($: EngineInterface) {
  if (drainingSetup) return
  drainingSetup = true
  try {
    for (;;) {
      const queue = ((await $.store.get('setupSave').catch(() => null)) ?? {}) as Record<string, string>
      const [field] = Object.keys(queue)
      if (!field) return
      const { [field]: value, ...rest } = queue
      await $.store.set('setupSave', Object.keys(rest).length ? rest : null)
      if (field in SETTING_FIELDS && value !== undefined)
        await saveSetting($, field as keyof typeof SETTING_FIELDS, value)
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
export async function closeSetup($: EngineInterface) {
  await markSetupDone($)
  await goSetup($, null)
  await flushSetup($)
}
