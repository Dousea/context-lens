import { atom, type EngineInterface, read, type RenderInput, update } from 'claude-code'

import { FROST_HEIGHT, FROST_WIDTH } from '../core/constants'
import {
  ACCENT,
  BOG,
  BOG_BG,
  BOG_EDGE,
  DASH_BG,
  DASH_EDGE,
  EMBER,
  EMBER_BG,
  EMBER_EDGE,
  ICE,
  ICE_BG,
  ICE_EDGE,
  SLATE,
  SLATE_BG,
  SLATE_EDGE,
} from '../core/palette'
import { closeHot, resetLabel, toggleSave } from '../logic/alerts'
import { openCompact } from '../logic/compact'
import { openHandoffBar } from '../logic/handoff'
import { lastContext } from '../logic/lens'
import { kTokens } from '../logic/spend'
import { ringSvg } from '../svg/controls'
import { AUTO_GLOW_H, AUTO_GLOW_W, COLD_GLOW_MS, coldGlowSvg, inPhase } from '../svg/glows'
import { DOWN_SVG, EMBER_SVG, FROST_SVG, SWAMP_SVG } from '../svg/scenes'
import { themedEls } from '../theme'
import { introLayer, introShows, terminalBand } from './band'

const handoffStage = atom({ plugin: 'context-lens', key: 'handoffStage' } as const, null)
// The swamp band was closed at this many tokens; it comes back once the context has grown well past it.
const swampHiddenAt = atom({ plugin: 'context-lens', key: 'swampHiddenAt' } as const, null)
// The judge-down band was closed for this reason; a new reason shows it again.
const judgeDownHidden = atom({ plugin: 'context-lens', key: 'judgeDownHidden' } as const, null)
const saveUntil = atom({ plugin: 'context-lens', key: 'saveUntil' } as const, null)
const isColdHidden = atom({ plugin: 'context-lens', key: 'isColdHidden' } as const, false)

/** The card after Save: the bar's own colours, one line, nothing moving. */
export function savedCardTree($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  return (
    <Box
      key="saved"
      flexDirection="row"
      alignItems="center"
      gap={1}
      paddingX={1}
      backgroundColor={DASH_BG}
      borderStyle="round"
      borderColor={DASH_EDGE}
    >
      <Text color={ACCENT}>✓</Text>
      <Text bold>Settings saved</Text>
    </Box>
  )
}

export async function judgeDownBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, downReason: string) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e))

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
  const { Svg } = themedEls($.ui.resolve(e))
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

export async function hotBand(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  heat: { kind: string; percent: number; resetsAt: string | null },
) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e))

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
  const { Svg } = themedEls($.ui.resolve(e))
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

export async function coldBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, coldTokens: number) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e))

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
        <Button key="cold-hide" plain hotkey="n" label="Not now" onPress={() => update($, isColdHidden, () => true)} />,
        <Button key="cold-compact" hotkey="c" label="Compact" onPress={() => openCompact($, e)} />,
        <Button key="cold-handoff" variant="primary" hotkey="h" label="Handoff" onPress={() => openHandoffBar($)} />,
      ],
    })
  const { Svg } = themedEls($.ui.resolve(e))
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

export async function swampBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, swampTokens: number) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e))

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
        <Button key="swamp-handoff" label={handing ? 'Handing off…' : 'Handoff'} onPress={() => openHandoffBar($)} />,
        <Button
          key="swamp-close"
          plain
          role="dismiss"
          label="✕"
          onPress={() => update($, swampHiddenAt, () => swampTokens)}
        />,
      ],
    })
  const { Svg } = themedEls($.ui.resolve(e))
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
        <Button key="swamp-handoff" label={handing ? 'Handing off…' : 'Handoff'} onPress={() => openHandoffBar($)} />
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
