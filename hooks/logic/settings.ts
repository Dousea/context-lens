import { atom, type EngineInterface, read, update } from 'claude-code'

import { config, readConfig, setConfig } from '../core/config'
import { pluginId, proof } from '../core/env'
import { applyTheme } from '../core/palette'
import { drainSetupSave } from './setup'

// The context-lens settings panel is open above the prompt.
const settingsOpen = atom({ plugin: 'context-lens', key: 'settingsOpen' } as const, false)
// The user and plugin skills, read when the settings panel opens.
const installedSkills = atom({ plugin: 'context-lens', key: 'installedSkills' } as const, [])
// What was changed in the panel and not saved yet, by field; Save applies it all, the cross drops it.
const settingsDraft = atom({ plugin: 'context-lens', key: 'settingsDraft' } as const, {})

/** The user and plugin skills, for the handoff picker in the settings and the setup guide. */
export async function loadInstalledSkills($: EngineInterface) {
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
export async function openPluginSettings($: EngineInterface) {
  await loadInstalledSkills($)
  await update($, settingsOpen, () => true)
  // Before a chat's first message the app may start the mod's session afresh for each command, and the state with
  // it: the request also goes to the store, which outlives that, and the next drawing picks it up.
  // The store is shared by every chat, so the request names this one: another chat must not open its panel too.
  await $.store.set('openSettingsAt', { at: Date.now(), session: await $.session.id().catch(() => '') })
  $.ui.invalidate('ui.render')
}

/** The settings rows the panel changes, by field: saved as the plugin's own setting and used at once. */
export const SETTING_FIELDS = {
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

export async function saveSetting($: EngineInterface, field: keyof typeof SETTING_FIELDS, value: string) {
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
export const SAVED_CARD_MS = 2500

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
export async function carryRenamedSettings(
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
export async function saveDraft($: EngineInterface) {
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
