import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  EngineInterface,
  RenderChildren,
  RenderInput,
  SvgProps,
  TextProps,
} from 'claude-code'

import type { Effort, ModelKey } from '../../types'
import { EFFORT_LABELS, EFFORTS, MODELS } from '../core/constants'
import { ACCENT, BRAND_BG, BRAND_EDGE } from '../core/palette'
import type { Snap } from '../logic/effort'
import { keyOf, sessionModel } from '../logic/switching'
import { ART_COLUMNS, ART_FRAME_MS, ART_MIN_WIDTH, ART_ROWS, artFrame, type ArtKind, MOVING } from '../svg/art'
import { MARK_SVG } from '../svg/brand-mark'
import { inPhase } from '../svg/glows'
import { INTRO_SVG } from '../svg/scenes'
import { themedEls } from '../theme'
import { effortRows } from './effort-rows'
import { lensRow } from './lens-row'

/** How long a band's entrance runs: it is drawn only this long after the band appears, since every redraw of the band
 * (a choice, the minute tick) would replay it. */
const INTRO_MS = 1300
// The band last drawn above the prompt, and when it appeared (see introShows).
export let introKind = ''
export const setIntroKind = (value: typeof introKind) => {
  introKind = value
}
let introAt = 0
// How far the entrance on screen is, for introLayer.
let introElapsed = 0
// Set when a band replaces another, taken by the first draw of the new one.
export let introFresh = false
export const setIntroFresh = (value: typeof introFresh) => {
  introFresh = value
}
/** Whether the band of `kind` is still in its entrance: true for INTRO_MS after it replaced another band. */
export async function introShows($: EngineInterface, kind: string): Promise<boolean> {
  const now = await $.clock.now()
  if (kind !== introKind) {
    introKind = kind
    introAt = now
    introFresh = true
    $.clock.after(INTRO_MS + 100, () => $.ui.invalidate('ui.render'))
  }
  introElapsed = now - introAt
  return introElapsed < INTRO_MS
}
/** The elements a band draws with: Box, Text and Button on every surface, Svg on those that draw images. */
export type BandElements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Svg?: ElementConstructor<SvgProps>
}

// The mark beside a card's title, sized to one line of text.
const TITLE_MARK_SIZE = 16

/** A card's title with the context-lens mark where the ✦ stood; the ✦ stays where the surface draws no images. */
export function markTitle(
  { Box, Text, Svg }: Pick<BandElements, 'Box' | 'Text' | 'Svg'>,
  key: string,
  color: string,
  title: string,
  mark = MARK_SVG,
) {
  if (!Svg)
    return (
      <Text key={key} color={color} bold wrap="truncate">
        {title}
      </Text>
    )
  return (
    <Box key={key} flexDirection="row" alignItems="center" flexShrink={1} minWidth={0}>
      <Box flexShrink={0} marginRight={1} alignItems="center">
        <Svg source={mark} alt="context-lens" width={TITLE_MARK_SIZE} height={TITLE_MARK_SIZE} />
      </Box>
      <Text color={color} bold wrap="truncate">
        {title.replace(/^✦ /, '')}
      </Text>
    </Box>
  )
}

/** A choice as a button per option, the picked one boxed: where a dropdown would jump the layout, or the surface
 * draws none. */
export function optionButtons(
  Button: BandElements['Button'],
  key: string,
  value: string,
  options: readonly { value: string; label: string }[],
  onSelect: (value: string) => unknown,
) {
  return options.map(option =>
    option.value === value ? (
      <Button
        key={`${key}-${option.value}`}
        variant="secondary"
        label={option.label}
        onPress={() => onSelect(option.value)}
      />
    ) : (
      <Button
        key={`${key}-${option.value}`}
        plain
        dimColor
        label={option.label}
        onPress={() => onSelect(option.value)}
      />
    ),
  )
}

/** The entrance layer (INTRO_SVG) in a band's own colours, or nothing once the entrance is over. */
export function introLayer(
  { Box, Svg }: Pick<BandElements, 'Box' | 'Svg'>,
  key: string,
  show: boolean,
  wash = '#8b6cff',
  light = '#b9a7ff',
) {
  if (!Svg || !show) return null
  return (
    <Box key={`${key}-intro`} position="absolute" top={-1} left={0} right={0} bottom={-1}>
      <Svg
        source={inPhase(INTRO_SVG.replace('#8b6cff', wash).replace('#b9a7ff', light), introElapsed)}
        alt=""
        width={1600}
        height={240}
      />
    </Box>
  )
}

/** "App: Opus 5.5 · Medium", the app's own model and effort, while either differs from what the band sends; else empty.
 * The app's status line, /model and /effort show its own, so this says why they disagree with the band. */
export function appHintText(
  app: { model?: ModelKey; effort?: unknown },
  sent: { model?: ModelKey; effort?: Effort },
): string {
  const appEffortKnown = EFFORTS.includes(app.effort as Effort) ? (app.effort as Effort) : undefined
  const modelDiffers = app.model && sent.model && app.model !== sent.model
  const effortDiffers = appEffortKnown && sent.effort && appEffortKnown !== sent.effort
  if (!modelDiffers && !effortDiffers) return ''
  const parts = [MODELS.find(m => m.key === app.model)?.long, appEffortKnown && EFFORT_LABELS[appEffortKnown]]
  return `App: ${parts.filter(Boolean).join(' · ')}`
}

/** A line with the app hint at the left and `words` at the right end. */
export function hintLine({ Box, Text }: Pick<BandElements, 'Box' | 'Text'>, hint: string, words: string, key: string) {
  return (
    <Box key={key} flexDirection="row" justifyContent="space-between" columnGap={2}>
      {hint ? (
        <Box flexShrink={0}>
          <Text dimColor>{hint}</Text>
        </Box>
      ) : null}
      <Box flexShrink={1} minWidth={0}>
        <Text dimColor wrap="truncate-end">
          {words}
        </Text>
      </Box>
    </Box>
  )
}

/** The chat's app hint: the model a taken offer or a click sends against the app's, and the pick's effort against the
 * app's when the pick goes out (the send path's rule: yours always, the judge's with Auto on where the cache allows). */
export async function appHint($: EngineInterface, v: Snap): Promise<string> {
  const pickGoesOut = v.current && (v.current.by === 'manual' || (v.auto && !v.pausedNow))
  return appHintText(
    { model: keyOf(await $.session.model()), effort: v.shownByApp },
    { model: await sessionModel($), effort: pickGoesOut ? v.current!.effort : undefined },
  )
}

// The moving art's timer: one at a time, blitting the next frame to the band that drew it. A blit the surface refuses
// (the band went away, another drew instead) ends it, so nothing has to stop it from outside.
let artTimer: { cancel(): void } | null = null
let artShown: { requestId: string; kind: ArtKind } | null = null
let artFrameCount = 0

/** A band's art on the terminal: a Raster on the right, moving for alert kinds; null where it has no room. */
function bandArt($: EngineInterface, e: RenderInput<'AbovePrompt'>, kind: ArtKind) {
  const els = themedEls($.ui.resolve(e))
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 0
  if (e.surface !== 'terminal' || !('Raster' in els) || columns < ART_MIN_WIDTH) return null
  // The still sparkles (the resting dashboard, the guide) are 16 by 4 pixels: in a terminal they read as noise, not
  // art. Only the art that says something stays: the alerts, compacting and the done tick.
  if (kind === 'calm' || kind === 'brand') return null
  const { Box, Raster } = els
  artShown = { requestId: e.requestId, kind }
  if (MOVING.has(kind) && !artTimer) {
    artTimer = $.clock.every(ART_FRAME_MS, () => {
      const shown = artShown
      if (!shown || !MOVING.has(shown.kind)) {
        artTimer?.cancel()
        artTimer = null
        return
      }
      artFrameCount++
      void $.ui
        .blit({ requestId: shown.requestId, key: 'art', cells: artFrame(shown.kind, artFrameCount) })
        .then(r => {
          if ('deny' in r && r.deny) {
            artTimer?.cancel()
            artTimer = null
          }
        })
        .catch(() => undefined)
    })
  }
  return (
    <Box key="art-box" flexShrink={0}>
      <Raster key="art" columns={ART_COLUMNS} rows={ART_ROWS} cells={artFrame(kind, artFrameCount)} />
    </Box>
  )
}

/** A bar on the terminal (setup, handoff): the title and words on the left with the brand's still art beside them,
 * the controls on a row of their own that wraps, so nothing is cut at 80 columns. */
export function terminalPanel(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  key: string,
  title: string,
  words: RenderChildren,
  controls: RenderChildren[],
) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  return (
    <Box
      key={key}
      flexDirection="column"
      paddingX={1}
      backgroundColor={BRAND_BG}
      borderStyle="round"
      borderColor={BRAND_EDGE}
    >
      <Box flexDirection="row" gap={1} alignItems="center">
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text color={ACCENT} bold wrap="truncate">
            {title}
          </Text>
          {typeof words === 'string' ? (
            <Text key={`${key}-what`} dimColor wrap="truncate">
              {words}
            </Text>
          ) : (
            words
          )}
        </Box>
        {bandArt($, e, 'brand')}
      </Box>
      <Box
        key={`${key}-actions`}
        flexDirection="row"
        flexWrap="wrap"
        justifyContent="flex-end"
        columnGap={1}
        alignItems="center"
      >
        {controls}
      </Box>
    </Box>
  )
}

type TerminalBand = {
  key: string
  kind: ArtKind
  color: string
  bg: string
  edge: string
  title: string
  detail: string
  hint?: string
  buttons: RenderChildren[]
  extra?: RenderChildren
  word?: { text: string; color: string; rest: string }
}

/** What of the band fits in `maxRows` rows. The app scrolls a taller tree in a window and says "n more", so the band gives up,
 * in this order: an empty detail row (one with words is kept), the border and art, the effort row, the lens row. The effort line itself stays. */
export function bandFit(maxRows: number, parts: { detailText: boolean; lens: boolean; effort: number }) {
  const fit = { detail: true, border: true, effort: parts.effort > 0, lens: parts.lens }
  const rows = () =>
    1 + (fit.border ? 2 : 0) + (fit.detail ? 1 : 0) + (fit.lens ? 1 : 0) + (fit.effort ? parts.effort : 0)
  if (rows() > maxRows && !parts.detailText) fit.detail = false
  if (rows() > maxRows) fit.border = false
  if (rows() > maxRows) fit.effort = false
  if (rows() > maxRows) fit.lens = false
  return fit
}

/** An alert band on the terminal: title and buttons, the detail on a line of its own, art on the right, and the effort
 * row under it, so effort stays in sight while a band shows. */
export async function terminalBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, b: TerminalBand) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  const { rows: effort, height } = await effortRows($, e)
  const maxRows = typeof e.props.maxRows === 'number' ? e.props.maxRows : 99
  // An empty detail row is kept (so a band does not move when an alert appears) until the room runs out.
  const fit = bandFit(maxRows, { detailText: Boolean(b.detail || b.hint), lens: b.extra !== null, effort: height ?? 0 })
  const art = fit.border ? bandArt($, e, b.kind) : null
  const rows = fit.effort ? effort : null
  // The lens row stays under every band: the dashboard passes its own; an alert gets one sized to what the art leaves.
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 100
  const extra = !fit.lens
    ? null
    : b.extra !== undefined
      ? b.extra
      : await lensRow($, e, Math.max(20, columns - 4 - (art ? ART_COLUMNS + 1 : 0))).catch(() => null)
  return (
    <Box key={`${b.key}-col`} flexDirection="column">
      <Box
        key={b.key}
        flexDirection="row"
        gap={1}
        alignItems="center"
        paddingX={1}
        backgroundColor={b.bg}
        borderStyle={fit.border ? 'round' : undefined}
        borderColor={b.edge}
      >
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Box flexDirection="row" gap={1} alignItems="center">
            <Box flexShrink={0}>
              {b.word ? (
                <Box flexDirection="row">
                  <Text color={b.color} bold>
                    {'✦ '}
                  </Text>
                  <Text key={`${b.key}-word`} color={b.word.color} bold>
                    {b.word.text}
                  </Text>
                  <Text color={b.color} bold>
                    {b.word.rest}
                  </Text>
                </Box>
              ) : (
                <Text color={b.color} bold>{`✦ ${b.title}`}</Text>
              )}
            </Box>
            <Box flexGrow={1} />
            {b.buttons}
          </Box>
          {/* An empty detail still takes its row (a no-break space), so the dashboard is as tall as an alert and nothing moves
              when one appears. */}
          {fit.detail ? hintLine({ Box, Text }, b.hint ?? '', b.detail || '\u00a0', `${b.key}-detail`) : null}
          {extra}
        </Box>
        {art}
      </Box>
      {rows}
    </Box>
  )
}
