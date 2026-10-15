import { atom, type EngineInterface, read, type RenderInput, update } from 'claude-code'

import type { Effort, ModelKey } from '../../types'
import { MARK_SVG } from '../svg/brand-mark'
import { config } from '../core/config'
import { EFFORT_LABELS, FROST_HEIGHT, FROST_WIDTH, MODELS } from '../core/constants'
import { loadedSession, renderLog } from '../core/debug'
import { ACCENT, DASH_BG, DASH_DIM, DASH_EDGE, DASH_TEXT, FLASH_COLOR, themeHex } from '../core/palette'
import { cacheLabel } from '../logic/cache'
import { openCompact } from '../logic/compact'
import { effortOf, snap, toggleAutoEffort, toggleAutoModel } from '../logic/effort'
import {
  adviceNow,
  COMPACT_BUTTON_MIN_COLUMNS,
  handoffLevel,
  handoffLoud,
  handoffSlot,
  openHandoffBar,
  setAdviceNow,
} from '../logic/handoff'
import { judgeEndedAt, judgeStartedAt } from '../logic/judge'
import { LENS_WARMTH_COLOR, lastContext } from '../logic/lens'
import { openPluginSettings } from '../logic/settings'
import { subagentEffortOf } from '../logic/subagents'
import { CACHE_LABEL } from '../model'
import { autoSwitchSvg, handoffLook, handoffPillSvg, ringSvg, settingsSvg } from '../svg/controls'
import {
  AUTO_GLOW_H,
  AUTO_GLOW_MS,
  AUTO_GLOW_W,
  autoGlowSvg,
  GLOW_H,
  GLOW_W,
  HANDOFF_PILL_H,
  HANDOFF_PILL_W,
  handoffGlowStep,
  handoffGlowSvg,
  inPhase,
  JUDGE_RISE_MS,
  judgeGlowAt,
} from '../svg/glows'
import { DASH_MARK_OFF, DASH_SVG } from '../svg/scenes'
import { themedEls } from '../theme'
import { PILL_H, THINK_W, thinkingSvg } from '../svg/thinking'
import { detailLine, introFresh, introShows, setIntroFresh, terminalBand } from './band'
import { cacheDetails, lensClock, lensRow } from './lens-row'

const handoffAdvice = atom({ plugin: 'context-lens', key: 'handoffAdvice' } as const, null)
const settingsOpen = atom({ plugin: 'context-lens', key: 'settingsOpen' } as const, false)
const settingsDraft = atom({ plugin: 'context-lens', key: 'settingsDraft' } as const, {})
const lensAgents = atom({ plugin: 'context-lens', key: 'lensAgents' } as const, [])

// The dashboard's mark: its size, and its look with Auto off.
const DASH_MARK_SIZE = 18

/** The dashboard's two lines: the effort with the cache and the context, then the judge's reason and the last reply. */
export function dashboardLines(d: {
  auto: boolean
  paused: boolean
  judging: boolean
  /** A subagent is in view: the word is its effort alone, none of the chat's Auto state. */
  agent?: boolean
  effort: Effort | undefined
  /** The model's long name ("Opus 5.5"), written before the effort; none when unknown. */
  model?: string
  cacheNow: number | null
  contextPercent: number | null
  reason: string
}): { head: string; what: string; pair: string; rest: string; detail: string } {
  const level = d.effort ? EFFORT_LABELS[d.effort] : 'Auto'
  // Auto on or off is the button's to say (and the terminal's effort row's), not the text's.
  const what = d.agent
    ? d.effort
      ? level
      : 'Subagent'
    : d.judging
      ? 'Deciding…'
      : !d.auto
        ? 'Off'
        : d.paused
          ? `${level} · Auto paused`
          : level
  // The model and the effort read as one pair, coloured together.
  const pair = d.model ? `${d.model} · ${what}` : what
  const head = [
    `✦ ${pair}`,
    d.cacheNow === null ? null : `cache ${cacheLabel(d.cacheNow)}`,
    d.contextPercent === null ? null : `${Math.round(d.contextPercent)}% context`,
  ]
  const shown = head.filter(Boolean) as string[]
  return {
    head: shown.join(' · '),
    what,
    pair,
    rest: shown
      .slice(1)
      .map(part => ` · ${part}`)
      .join(''),
    detail: d.reason,
  }
}

/** How long the effort word glows after it changes: held at full colour, then faded out; and the step of the fade. */
const FLASH_HOLD_MS = 1000
const FLASH_MS = 1800
/** The fade's steps, [ms, share of the way to white]: five, so it reads as a fade without a tick. Each step is a redraw,
 * and every redraw rebuilds the band (images restart, buttons under a pointer are swapped), so keep them few. */
const FLASH_STEPS: readonly (readonly [number, number])[] = [
  [1000, 0.15],
  [1160, 0.35],
  [1320, 0.55],
  [1480, 0.75],
  [1640, 0.9],
]
/** The effort word's colour `ms` after it changed: the glow, held, then easing out to the band's white. */
export function flashColor(ms: number | null): string {
  if (ms === null || ms >= FLASH_MS) return DASH_TEXT
  if (ms < FLASH_HOLD_MS) return FLASH_COLOR
  const k = [...FLASH_STEPS].reverse().find(([at]) => ms >= at)?.[1] ?? 0
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map(i =>
      Math.round(ch(FLASH_COLOR, i) + (ch(DASH_TEXT, i) - ch(FLASH_COLOR, i)) * k)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}
// The word the dashboard last showed and when it last changed, so a new effort glows and fades. Not while the judge
// decides: the word it lands on is compared with the one before.
let flashWord: string | null = null
let flashAt: number | null = null

async function effortFlash($: EngineInterface, what: string, judging: boolean, entering = false): Promise<string> {
  const now = await $.clock.now()
  // The dashboard coming back (after Handoff, settings or an alert) takes the word as it is: a change made while it was
  // away is not a switch to point at.
  if (entering && !judging) {
    flashWord = what
    flashAt = null
  }
  if (!judging) {
    // Auto switched off or on is not a new verdict: the switch says it, so the word changes without the flash.
    if (flashWord !== null && flashWord !== what) flashAt = what === 'Off' || flashWord === 'Off' ? null : now
    flashWord = what
  }
  const since = flashAt === null ? null : now - flashAt
  if (since === 0) {
    // One redraw at each step of the fade and one at its end, not a tick: see FLASH_STEPS.
    for (const at of [...FLASH_STEPS.map(([t]) => t), FLASH_MS])
      $.clock.after(at + 20, () => $.ui.invalidate('ui.render'))
  }
  return flashColor(since)
}
// The glow's clock is read as late as the draw allows, and set ahead by how long the rest of a draw takes (measured,
// smoothed): a fade placed where it was when the draw began showed up that much behind, a little brighter at every
// redraw, which read as lag and as a second glow.
export let glowReadAt: number | null = null
export const setGlowReadAt = (value: typeof glowReadAt) => {
  glowReadAt = value
}
export let drawLead = 20
export const setDrawLead = (value: typeof drawLead) => {
  drawLead = value
}
// Auto as the bar last saw it, and when it last flipped, either way (for the edge glow and the switch's slide).
let autoSeen: boolean | undefined
let autoOnAt = -Infinity
let autoFlipAt = 0
let autoModelSeen: boolean | undefined
let autoModelFlipAt = 0

/** The dashboard: what context-lens is doing, and Auto, Handoff and settings. The slot above the prompt at rest. */
export async function dashboardBand($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const els = themedEls($.ui.resolve(e))
  const { Box, Text, Button } = els
  const v = await snap($)
  setAdviceNow((await read($, handoffAdvice)) ?? null)
  await introShows($, 'dash')
  // The first draw since another band stood here.
  const entering = introFresh
  setIntroFresh(false)
  const nowMs = await $.clock.now()
  if (autoSeen !== undefined && autoSeen !== v.auto) {
    autoFlipAt = nowMs
    // No redraw to end the slide or the glow: both finish inside their images (the glow fades to nothing), and every
    // redraw rebuilds the buttons under a resting pointer, which flickers their hover.
    autoOnAt = nowMs
  }
  autoSeen = v.auto
  if (autoModelSeen !== undefined && autoModelSeen !== v.autoModel) autoModelFlipAt = nowMs
  autoModelSeen = v.autoModel
  // A subagent in view shows the model and effort it ran at; the chat's own come from the session.
  // One just spawned has not made a request yet: its effort is the subagent pick if there is one, else unknown, never the chat's.
  const inAgent = e.props.view.agentId !== undefined
  const viewed = inAgent ? (await read($, lensAgents)).find(a => a.id === e.props.view.agentId) : undefined
  const shownModel: ModelKey | undefined = inAgent ? viewed?.model : (v.modelNow ?? undefined)
  const effortNow = inAgent
    ? (viewed?.effort ?? (await subagentEffortOf($, e.props.view.agentId!).catch(() => undefined)))
    : effortOf(v)
  const by = v.current?.by
  const reason = v.current
    ? `${by === 'manual' || by === 'named' ? 'You' : 'Why'}: ${v.current.why}`
    : v.auto
      ? 'Auto picks the effort at the next prompt'
      : 'You pick the effort'
  // A cold cache is the cold band's to say; the resting bar shows the countdown only while there is one.
  const cacheShown = config.hide.includes('timer') || (v.cacheNow !== null && v.cacheNow <= 0) ? null : v.cacheNow
  // The lens's row (cache timers, context bar, usage) sits under the detail line. Its width is the band's inside: the
  // border and the padding take four columns. The resting band draws no art beside it.
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 100
  // Claude Desktop shows the context and the usage itself, so there the lens is its cache clock alone, in the title.
  const desktop = e.surface === 'desktop'
  const lens = desktop ? null : await lensRow($, e, Math.max(20, columns - 4)).catch(() => null)
  const clock = desktop ? await lensClock($, e).catch(() => null) : null
  const judgingHere = !inAgent && Boolean(v.judging)
  const modelName = MODELS.find(m => m.key === shownModel)?.long
  // The lens row carries the cache and the context; the title says them in words until it has anything to show.
  const { head, what, pair, rest, detail } = dashboardLines({
    auto: v.auto,
    paused: Boolean(v.pausedNow),
    judging: judgingHere,
    agent: inAgent,
    effort: effortNow,
    model: modelName,
    cacheNow: lens || desktop ? null : cacheShown,
    contextPercent: !lens && !desktop && lastContext && lastContext.window ? lastContext.percent : null,
    // The judge's reason and the handoff advice are about the chat's own prompt, not a subagent's work.
    reason: inAgent
      ? ''
      : adviceNow
        ? `Handoff would suit: ${adviceNow}`
        : config.hide.includes('reason')
          ? ''
          : reason,
  })
  // With the reason hidden the row goes unless there is advice in it; else an empty one keeps the band's height.
  const detailRow = detail || (config.hide.includes('reason') ? null : '')
  const toggleSettings = async () => {
    if (await read($, settingsOpen)) {
      await update($, settingsDraft, () => ({}))
      await update($, settingsOpen, () => false)
      $.ui.invalidate('ui.render')
    } else await openPluginSettings($)
  }
  const buttons = [
    // Once the slot is Handoff (advised, or the setting says always), Compact stays beside it as quiet text, so both are
    // a press away. Desktop only, where there is room for it; the terminal compacts in one press from its own rows.
    ...(e.surface !== 'terminal' &&
    'Svg' in els &&
    !config.hide.includes('handoff') &&
    handoffSlot() &&
    (typeof e.props.bodyColumns !== 'number' || e.props.bodyColumns >= COMPACT_BUTTON_MIN_COLUMNS)
      ? [<Button key="dash-compact" plain dimColor label="Compact" onPress={() => openCompact($, e)} />]
      : []),
    ...(config.hide.includes('handoff')
      ? []
      : [
          // One button in one place: Compact until Haiku says a fresh chat would suit, then Handoff, loud. Pressing it opens
          // the matching card, which can switch to the other. Desktop draws it: no box on a fresh chat, then a
          // step a percent of context to a white box at HANDOFF_LOUD_AT (handoffLook), the label as Text over the box and
          // a blank button over both to take the click. The terminal keeps the plain buttons: grey, white from
          // HANDOFF_LOUD_AT.
          'Svg' in els && e.surface !== 'terminal' ? (
            <Box key="dash-handoff-wrap" flexShrink={0} flexDirection="row">
              {/* No glow while a reply runs: the band redraws then, and each redraw restarted the glow, so it flickered. */}
              {handoffLoud() && !e.props.isWorking ? (
                <Box
                  key="dash-glow"
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={-2}
                  right={-2}
                  alignItems="center"
                  justifyContent="center"
                >
                  <els.Svg
                    source={handoffGlowSvg(handoffGlowStep(handoffLevel()), nowMs)}
                    alt="handoff glow"
                    width={GLOW_W}
                    height={GLOW_H}
                  />
                </Box>
              ) : null}
              {/* The H key, once Handoff is loud: on a button of its own, clipped away, since a blank button with a
                  hotkey draws its letter over the label. */}
              {handoffLoud() ? (
                <Box key="dash-handoff-key" width={0} height={1} overflow="hidden">
                  <Button key="dash-handoff-h" plain hotkey="h" label="Handoff" onPress={() => openHandoffBar($)} />
                </Box>
              ) : null}
              {/* Its width is a spacer in the flow, not the image: the app can lay an image out at no width, and the
                  label (centred over it) would run into Auto. */}
              <Box key="dash-handoff-box" flexShrink={0} flexDirection="row" alignItems="center">
                <Box width={9} height={1} flexShrink={0} />
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <els.Svg
                    source={handoffPillSvg(handoffLevel())}
                    alt="Handoff box"
                    width={HANDOFF_PILL_W}
                    height={HANDOFF_PILL_H}
                  />
                </Box>
                {/* Its hover: a lighter pill shown over the box, not the app's ghost fill, which is sized to the blank
                    label and sat off the drawn box. */}
                <Box
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={0}
                  right={0}
                  alignItems="center"
                  justifyContent="center"
                  display="none"
                  hover={{ scope: 'handoff', display: 'flex' }}
                >
                  <els.Svg
                    source={handoffPillSvg(handoffLevel(), true)}
                    alt="Handoff box"
                    width={HANDOFF_PILL_W}
                    height={HANDOFF_PILL_H}
                  />
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
                  <Text
                    color={handoffLook(handoffLevel()).label}
                    hover={{ scope: 'handoff', color: handoffLook(handoffLevel(), true).label }}
                  >
                    {handoffSlot() ? 'Handoff' : 'Compact'}
                  </Text>
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
                    key="dash-handoff"
                    plain
                    label={' '.repeat(14)}
                    hover={{ scope: 'handoff', backgroundColor: '#00000000' }}
                    onPress={() => (handoffSlot() ? openHandoffBar($) : openCompact($, e))}
                  />
                </Box>
              </Box>
            </Box>
          ) : handoffLoud() ? (
            <Button key="dash-handoff" variant="primary" hotkey="h" label="Handoff" onPress={() => openHandoffBar($)} />
          ) : (
            <Button key="dash-handoff" variant="secondary" label="Handoff" onPress={() => openHandoffBar($)} />
          ),
        ]),
    // The terminal says it in a word; the desktop draws an icon, with this button laid blank over it to take the click.
    // No-break spaces, not braille blanks: some fonts draw U+2800 as a dot.
    <Button
      key="dash-settings"
      plain
      label={'Svg' in els && e.surface !== 'terminal' ? '   ' : 'Settings'}
      onPress={toggleSettings}
    />,
  ].filter(Boolean)
  // The terminal switches both Autos on the Model and Effort pickers under the band; desktop has no pickers.
  const autoButtons = [
    <Button
      key="dash-auto-model"
      variant="secondary"
      dimColor={!v.autoModel}
      label={v.autoModel ? 'Auto model on' : 'Auto model off'}
      onPress={() => toggleAutoModel($)}
    />,
    <Button
      key="dash-auto"
      variant="secondary"
      dimColor={!v.auto}
      label={v.auto ? 'Auto effort on' : 'Auto effort off'}
      onPress={() => toggleAutoEffort($)}
    />,
  ]
  // The terminal flashes the effort word as the desktop does: in the accent on a change, fading back to white.
  if (e.surface === 'terminal')
    return terminalBand($, e, {
      key: 'dash',
      kind: 'calm',
      color: DASH_TEXT,
      bg: DASH_BG,
      edge: DASH_EDGE,
      title: head.replace(/^✦ /, ''),
      detail: detailRow,
      buttons,
      extra: lens,
      word: { text: pair, color: await effortFlash($, what, judgingHere, entering), rest },
    })
  const Svg = 'Svg' in els ? els.Svg : undefined
  const wordColor = await effortFlash($, what, judgingHere, entering)
  glowReadAt = Date.now()
  const glowNow = (await $.clock.now().catch(() => nowMs)) + drawLead
  const glowSource = Svg ? judgeGlowAt(judgeStartedAt, judgeEndedAt, glowNow) : null

  const autoGlowing = Svg && v.auto && nowMs - autoOnAt < AUTO_GLOW_MS
  if (autoGlowing) renderLog.push(`glow on at ${nowMs - autoOnAt} ms`)
  if (glowSource && judgeEndedAt !== null)
    renderLog.push(
      `${new Date().toISOString()} ${loadedSession} glow: fade drawn at +${Math.round(glowNow - Math.max(judgeEndedAt, judgeStartedAt + JUDGE_RISE_MS))} ms, lead ${Math.round(drawLead)} ms, ${Math.round(glowNow - drawLead - nowMs)} ms after the draw began`,
    )
  return (
    <Box
      key="dash"
      position="relative"
      flexDirection="column"
      paddingX={1}
      overflow="hidden"
      backgroundColor={DASH_BG}
      borderStyle="round"
      borderColor={DASH_EDGE}
    >
      {Svg ? (
        // Auto off: the art goes, so the bar reads as resting, not working.
        v.auto ? (
          <Box key="dash-art" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={DASH_SVG} alt="context-lens" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
          </Box>
        ) : null
      ) : null}
      {autoGlowing ? (
        <Box key="dash-auto-glow" position="absolute" top={0} left={0} right={0} bottom={0}>
          <Svg
            source={inPhase(autoGlowSvg(v.auto), nowMs - autoOnAt)}
            alt="auto glow"
            width={AUTO_GLOW_W}
            height={AUTO_GLOW_H}
          />
        </Box>
      ) : null}
      {/* The judge decides: the rim lights up in the accent, holds, and fades from full once the verdict is in. */}
      {Svg && glowSource ? (
        <Box key="dash-judge-glow" position="absolute" top={0} left={0} right={0} bottom={0}>
          <Svg source={glowSource} alt="deciding glow" width={AUTO_GLOW_W} height={AUTO_GLOW_H} />
        </Box>
      ) : null}
      {/* Three rows: the title with the controls, the reason, then the lens. */}
      <Box key="dash-title" flexDirection="row" alignItems="center">
        {/* The effort word never shrinks; the row clips rather than run under the buttons. */}
        <Box
          key="dash-words"
          position="relative"
          flexDirection="row"
          flexGrow={clock ? 0 : 1}
          flexShrink={1}
          minWidth={0}
          overflow="hidden"
        >
          <Box flexShrink={0} flexDirection="row">
            {Svg ? (
              // The mark, as it is, where the ✦ stood; faded while Auto is off.
              <Box key="dash-mark" flexShrink={0} marginRight={1} alignItems="center">
                <Svg
                  source={v.auto ? MARK_SVG : DASH_MARK_OFF}
                  alt="context-lens"
                  width={DASH_MARK_SIZE}
                  height={DASH_MARK_SIZE}
                />
              </Box>
            ) : (
              <Text color={v.auto ? ACCENT : DASH_DIM} bold>
                ✦{' '}
              </Text>
            )}
            {/* A new effort shows in the accent, then white (effortFlash): plain text in the app's font. An animated image
              of the word looked cheap: another font, a late start and a jump back to the text. */}
            <Text key="dash-level" color={wordColor} bold>
              {judgingHere && Svg ? (modelName ? `${modelName} · Deciding` : 'Deciding') : pair}
            </Text>
            {/* While the judge decides: thinking dots, as a plain image (its CSS still runs, and a
              redraw does not restart it the way an interactive frame does). */}
            {judgingHere && Svg ? (
              <Box key="dash-thinking" flexShrink={0} marginLeft={1} alignItems="center">
                <Svg source={thinkingSvg()} alt="deciding" width={THINK_W} height={PILL_H} />
              </Box>
            ) : null}
          </Box>
          {rest ? (
            <Box flexShrink={1} minWidth={0}>
              <Text color={DASH_TEXT} bold wrap="truncate">
                {rest}
              </Text>
            </Box>
          ) : null}
        </Box>
        {/* The cache clock sits apart from the title, centred in the room between it and the buttons. A hover scope: the
            pointer on the ring or the time reveals the cache in words, which the app draws as a card by it. */}
        {clock ? <Box flexGrow={1} /> : null}
        {clock ? (
          <Box key="dash-cache" position="relative" flexShrink={0} flexDirection="row" alignItems="center">
            <Text color={DASH_DIM} bold>
              {`${CACHE_LABEL} `}
            </Text>
            {Svg ? (
              <Box flexShrink={0} marginRight={1}>
                <Svg
                  source={ringSvg(clock.left * 100, themeHex(LENS_WARMTH_COLOR[clock.state]))}
                  alt={`prompt cache: ${clock.time} left`}
                  width={14}
                  height={14}
                />
              </Box>
            ) : null}
            <Text color={LENS_WARMTH_COLOR[clock.state]} bold>
              {clock.time}
            </Text>
            <Box position="absolute" left={0} display="none" hover={{ display: 'flex' }} flexDirection="column">
              {cacheDetails(clock).map((line, n) => (
                <Text key={`dash-cache-${n}`} wrap="truncate">
                  {line}
                </Text>
              ))}
            </Box>
          </Box>
        ) : null}
        {clock ? <Box flexGrow={1} /> : null}
        {/* The buttons in the flow, their real width and no more, so the words get all the rest. An empty absolute child
          makes the box positioned, which paints it over the art (a plain flow box sits under it and loses clicks). */}
        <Box minWidth={1} />
        <Box key="dash-actions" flexShrink={0} flexDirection="row" gap={1} alignItems="center" marginLeft={1}>
          <Box position="absolute" top={0} left={0} />
          {Svg
            ? // Each Auto as a switch, drawn, with a blank button laid over it to take the click (the cog's pattern).
              [
                {
                  key: 'dash-auto-model',
                  word: 'model',
                  on: v.autoModel,
                  flipAt: autoModelFlipAt,
                  toggle: () => toggleAutoModel($),
                },
                { key: 'dash-auto', word: 'effort', on: v.auto, flipAt: autoFlipAt, toggle: () => toggleAutoEffort($) },
              ].map(autoSwitch => (
                <Box
                  key={`${autoSwitch.key}-switch`}
                  position="relative"
                  flexDirection="row"
                  alignItems="center"
                  gap={1}
                  paddingX={1}
                >
                  <Svg
                    source={autoSwitchSvg(autoSwitch.on, nowMs - autoSwitch.flipAt)}
                    alt={`Auto ${autoSwitch.word} ${autoSwitch.on ? 'on' : 'off'}`}
                    width={26}
                    height={15}
                  />
                  <Text color={autoSwitch.on ? DASH_TEXT : DASH_DIM}>{`Auto ${autoSwitch.word}`}</Text>
                  <Box
                    position="absolute"
                    top={0}
                    bottom={0}
                    left={0}
                    right={0}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Button key={autoSwitch.key} plain label={' '.repeat(32)} onPress={autoSwitch.toggle} />
                  </Box>
                </Box>
              ))
            : autoButtons}
          {Svg ? buttons.slice(0, -1) : buttons}
          {Svg ? (
            // The cog sits in the flow and the button in an absolute layer after it: an absolute layer paints over plain
            // ones, and the desktop ignores position="relative" on a Box without absolute children. A Button is at most as
            // wide as its box, so the box keeps a cell of padding each side of the cog for the hover box.
            <Box key="dash-settings-icon" position="relative" alignItems="center" justifyContent="center" paddingX={1}>
              <Svg source={settingsSvg(DASH_TEXT)} alt="Settings" width={14} height={14} />
              <Box
                position="absolute"
                top={0}
                bottom={0}
                left={0}
                right={0}
                alignItems="center"
                justifyContent="center"
              >
                {buttons[buttons.length - 1]}
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>
      {/* An empty detail still takes its row, so the band keeps its height when a reason arrives. */}
      {detailRow === null ? null : detailLine({ Box, Text }, detailRow || '\u00a0', 'dash-detail')}
      {lens}
    </Box>
  )
}
