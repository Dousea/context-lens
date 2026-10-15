import { atom, type EngineInterface, read, type RenderChildren, type RenderInput, update } from 'claude-code'

import type { Effort, SettingsCard, SettingsDraft } from '../../types'
import { config, type Hideable, SWAMP_STEPS } from '../core/config'
import { EFFORTS } from '../core/constants'
import { probeLevel } from '../core/debug'
import { homeDir, noClaudeHint, ownVersion, pluginId, runClaude } from '../core/env'
import {
  ACCENT,
  BRAND_EDGE,
  CARD_HOVER,
  CARD_HOVER_EDGE,
  DASH_BG,
  DASH_DIM,
  DASH_EDGE,
  DASH_HEAD,
  DASH_TEXT,
  UNINSTALL_RED,
} from '../core/palette'
import { SETTINGS_BODY_H } from '../logic/compact'
import { saveDraft } from '../logic/settings'
import { typeCommand } from '../logic/switching'
import { autoSwitchSvg, binSvg, rowIconSvg } from '../svg/controls'
import { SETTINGS_MARK, SETTINGS_TITLE } from '../svg/scenes'
import { themedEls, type ThemeName, THEMES } from '../theme'
import { introLayer, introShows, optionButtons } from './band'

const settingsOpen = atom({ plugin: 'context-lens', key: 'settingsOpen' } as const, false)
const installedSkills = atom({ plugin: 'context-lens', key: 'installedSkills' } as const, [])
const settingsDraft = atom({ plugin: 'context-lens', key: 'settingsDraft' } as const, {})
const settingsCard = atom({ plugin: 'context-lens', key: 'settingsCard' } as const, null)

// Uninstall's first press arms it; a second within UNINSTALL_ARM_MS uninstalls. Then the plugins reload and the mod is
// gone from this chat; its settings stay in settings.json, so a reinstall picks them up.
const UNINSTALL_ARM_MS = 4000
let uninstallArmedAt = 0
let uninstalling = false
/** A plain /reload-plugins holds back a change that would make the next message re-read the chat without the cache; --force reloads anyway. */
const RELOAD_ARGS = '--force'
export function uninstallButton($: EngineInterface, els: ReturnType<EngineInterface['ui']['resolve']>) {
  const { Box, Text, Button } = els
  const Svg = 'Svg' in els ? els.Svg : undefined
  const armed = Date.now() - uninstallArmedAt < UNINSTALL_ARM_MS
  const press = async () => {
    if (uninstalling) return
    if (!armed) {
      uninstallArmedAt = Date.now()
      $.ui.invalidate('ui.render')
      $.clock.after(UNINSTALL_ARM_MS + 50, () => $.ui.invalidate('ui.render'))
      return
    }
    uninstalling = true
    $.ui.invalidate('ui.render')
    const r = await runClaude($, ['plugin', 'uninstall', pluginId($)], { timeoutMs: 120_000 }).catch(error => ({
      exitCode: 1,
      stdout: '',
      stderr: String(error),
    }))
    uninstalling = false
    if (r.exitCode !== 0) {
      const why = (r.stderr || r.stdout).trim().split('\n').pop() ?? ''
      $.ui.toast(`context-lens: uninstall failed: ${noClaudeHint(why, await homeDir($)) ?? why}`)
      $.ui.invalidate('ui.render')
      return
    }
    $.ui.toast('context-lens is uninstalled. Thanks for trying it.')
    const reloaded = await $.command.run({ command: 'reload-plugins', args: RELOAD_ARGS } as never).then(
      () => true,
      () => false,
    )
    if (!reloaded) await typeCommand($, `/reload-plugins ${RELOAD_ARGS}`)
  }
  const label = uninstalling ? 'Uninstalling…' : armed ? 'Press again to uninstall' : 'Uninstall'
  if (!Svg) return <Button key="settings-uninstall" plain dimColor={!armed} label={label} onPress={press} />
  // A bin and the word, grey; red under the pointer, and red while armed (the red bin is laid over the grey one, since
  // a hover can only reveal). A blank button over both takes the press.
  const red = armed || uninstalling
  return (
    <Box key="settings-uninstall-box" position="relative" flexDirection="row" alignItems="center" flexShrink={0}>
      <Box position="relative" width={2} height={1} alignItems="center">
        <Box position="absolute" top={0} left={0}>
          <Svg source={binSvg(DASH_DIM)} alt="bin" width={14} height={14} />
        </Box>
        <Box
          position="absolute"
          top={0}
          left={0}
          display={red ? 'flex' : 'none'}
          hover={red ? undefined : { scope: 'uninstall', display: 'flex' }}
        >
          <Svg source={binSvg(UNINSTALL_RED)} alt="bin" width={14} height={14} />
        </Box>
      </Box>
      <Text color={red ? UNINSTALL_RED : DASH_DIM} hover={{ scope: 'uninstall', color: UNINSTALL_RED }}>
        {label}
      </Text>
      <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
        <Button
          key="settings-uninstall"
          plain
          hover={{ scope: 'uninstall', backgroundColor: '#00000000' }}
          label={' '.repeat(label.length + 3)}
          onPress={press}
        />
      </Box>
    </Box>
  )
}
// The settings switches as last drawn, and when each flipped, by key (for the slide).
export const settingSwitches = new Map<string, { on: boolean; at: number }>()

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

export async function settingsPanel($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const elements = themedEls($.ui.resolve(e))
  const { Box, Text, Button } = elements
  const Svg = 'Svg' in elements ? elements.Svg : undefined
  const Select = e.surface !== 'mobile' && 'Select' in elements ? elements.Select : undefined

  // The app gives this slot maxRows rows and drops a taller tree whole, without a word. With gaps the panel is 12
  // rows (2 border, 2 header, 4 settings, 4 gaps); without, 7.
  const roomy = (typeof e.props.maxRows === 'number' ? e.props.maxRows : 12) >= 12
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
  const track: RenderChildren[] = []
  for (const n of [-2, -1, 0, 1, 2]) {
    if (n > -2)
      track.push(
        <Text key={`t${n}`} dimColor>
          ─
        </Text>,
      )
    track.push(
      <Button key={`bias${n + 2}`} plain label={n === shown.bias ? '◉' : '○'} onPress={() => set('bias')(String(n))} />,
    )
  }
  // The terminal has no art and few rows: no gaps, one row under the title.
  const term = e.surface === 'terminal'
  // The terminal's dropdown opens its list inside the wrapping row, which jumps the layout and is hard to click.
  // There a short list is a row of buttons, the picked one boxed; a long one (the skills) stays a dropdown. A surface
  // with no dropdown (mobile, where the app's stand-in for one draws nothing) gets the buttons for any list.
  type SettingRow = {
    key: string
    label?: string
    value: string
    options: { value: string; label: string }[]
    onSelect: (v: string) => unknown
  }
  const settingRow = (p: SettingRow) =>
    (term && p.options.length <= 5) || !Select ? (
      <Box key={p.key} width="100%" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
        {p.label ? (
          <Text key={`${p.key}-label`} dimColor>
            {p.label}
          </Text>
        ) : null}
        {optionButtons(Button, p.key, p.value, p.options, p.onSelect)}
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
  const headRow = (kids: RenderChildren[]) =>
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
      {Svg && !term ? (
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
          <Box key="settings-rule" position="absolute" bottom={0} left={0} right={0} height={1} alignItems="flex-end">
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
                            ...[...new Set([...(shown.handoffSkill ? [shown.handoffSkill] : []), ...skillNames])].map(
                              name => ({ value: name, label: `/${name}` }),
                            ),
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
