import { atom, type On, read, update } from 'claude-code'

import type { Effort, HandoffAfter, HandoffChoice, SettingsDraft } from '../../types'
import { config, type Hideable, type SettingsCard, SWAMP_STEPS } from '../core/config'
import { COMPACT_FADE_MS, EFFORTS, FROST_HEIGHT, FROST_WIDTH } from '../core/constants'
import {
  drawsTimed,
  firstDrawLogged,
  lastRenderAt,
  lastRenderProps,
  loadedAt,
  loadedSession,
  probeLevel,
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
import { ownVersion, readOwnVersion } from '../core/env'
import {
  ACCENT,
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
  EMBER,
  EMBER_BG,
  EMBER_EDGE,
  ICE,
  ICE_BG,
  ICE_EDGE,
  refreshAppearance,
  SLATE,
  SLATE_BG,
  SLATE_EDGE,
} from '../core/palette'
import { turnBusy } from '../core/session'
import { closeHot, hotClosedNow, hotVisible, resetLabel, SWAMP_REGROW, toggleSave } from '../logic/alerts'
import { coldWorth, compactCold, restoreCache } from '../logic/cache'
import {
  compactCard,
  compactNote,
  compactOpenedAt,
  openCompact,
  setCompactNote,
  SETTINGS_BODY_H,
} from '../logic/compact'
import { cardRunning, closeHandoffBar, goHandoff, handoffWhat, openHandoffBar } from '../logic/handoff'
import { lastContext } from '../logic/lens'
import { SAVED_CARD_MS, saveDraft } from '../logic/settings'
import {
  closeSetup,
  drainSetupSave,
  goSetup,
  LEAN_STOPS,
  setupBack,
  setupCounter,
  setupNext,
  setupShown,
  type SetupStep,
} from '../logic/setup'
import { kTokens } from '../logic/spend'
import { setTimersScheduled, startTimers, timersFrom, timersScheduled } from '../logic/timers'
import { savedCardTree } from '../render/alert-bands'
import { introLayer, introShows, markTitle, setIntroKind, terminalBand, terminalPanel } from '../render/band'
import { dashboardBand, drawLead, glowReadAt, setDrawLead, setGlowReadAt } from '../render/dashboard'
import { effortRows } from '../render/effort-rows'
import { handoffCardTree } from '../render/handoff-card'
import { lensRow } from '../render/lens-row'
import { settingSwitches, uninstallButton } from '../render/settings-panel'
import {
  autoSwitchSvg,
  enterSvg,
  GO_CELLS,
  GO_W,
  goPillSvg,
  KIND_CELLS,
  KIND_H,
  KIND_W,
  kindFlipAt,
  kindSwitchSvg,
  ringSvg,
  rowIconSvg,
  setKindFlipAt,
} from '../svg/controls'
import { AUTO_GLOW_H, AUTO_GLOW_W, COLD_GLOW_MS, coldGlowSvg, compactFadeSvg, inPhase } from '../svg/glows'
import { BRAND_SVG, DOWN_SVG, EMBER_SVG, FROST_SVG, SETTINGS_MARK, SETTINGS_TITLE, SWAMP_SVG } from '../svg/scenes'
import { themedEls, type ThemeName, THEMES } from '../theme'

const isCompacting = atom({ plugin: 'context-lens', key: 'isCompacting' } as const, false)
const compactAsk = atom({ plugin: 'context-lens', key: 'compactAsk' } as const, false)
const handoffStage = atom({ plugin: 'context-lens', key: 'handoffStage' } as const, null)
const handoffPick = atom({ plugin: 'context-lens', key: 'handoffPick' } as const, null)
const swamped = atom({ plugin: 'context-lens', key: 'swamped' } as const, null)
const handoffCard = atom({ plugin: 'context-lens', key: 'handoffCard' } as const, null)
// The swamp band was closed at this many tokens; it comes back once the context has grown well past it.
const swampHiddenAt = atom({ plugin: 'context-lens', key: 'swampHiddenAt' } as const, null)
const settingsOpen = atom({ plugin: 'context-lens', key: 'settingsOpen' } as const, false)
const installedSkills = atom({ plugin: 'context-lens', key: 'installedSkills' } as const, [])
const settingsDraft = atom({ plugin: 'context-lens', key: 'settingsDraft' } as const, {})
const judgeDown = atom({ plugin: 'context-lens', key: 'judgeDown' } as const, null)
const settingsCard = atom({ plugin: 'context-lens', key: 'settingsCard' } as const, null)
// The judge-down band was closed for this reason; a new reason shows it again.
const judgeDownHidden = atom({ plugin: 'context-lens', key: 'judgeDownHidden' } as const, null)
const hot = atom({ plugin: 'context-lens', key: 'hot' } as const, null)
const saveUntil = atom({ plugin: 'context-lens', key: 'saveUntil' } as const, null)
const isColdHidden = atom({ plugin: 'context-lens', key: 'isColdHidden' } as const, false)
const setupStep = atom({ plugin: 'context-lens', key: 'setupStep' } as const, null)
const setupDraft = atom({ plugin: 'context-lens', key: 'setupDraft' } as const, {})

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
                        setCompactNote(v)
                      }}
                      onSubmit={v => {
                        setCompactNote(v)
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
