import { atom, type EngineInterface, read, type RenderInput, update } from 'claude-code'

import { FROST_HEIGHT, FROST_WIDTH } from '../core/constants'
import {
  ACCENT,
  BOG,
  BOG_BG,
  BOG_EDGE,
  BOG_LIGHT,
  BOG_WASH,
  DASH_BG,
  DASH_EDGE,
  EMBER,
  EMBER_BG,
  EMBER_EDGE,
  EMBER_LIGHT,
  ICE,
  ICE_BG,
  ICE_EDGE,
  ICE_LIGHT,
  SLATE,
  SLATE_BG,
  SLATE_EDGE,
  SLATE_LIGHT,
  SLATE_WASH,
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
      {introLayer({ Box, Svg }, 'down', await introShows($, 'down'), SLATE_WASH, SLATE_LIGHT)}
      <Box flexShrink={0}>
        <Text color={SLATE} bold wrap="truncate">
          ◉ Judge down
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
          label={saving ? 'End save mode' : 'Save mode'}
          onPress={async () => {
            $.ui.toast(`Context Lens: ${await toggleSave($)}`)
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
      {introLayer({ Box, Svg }, 'hot', await introShows($, 'hot'), EMBER, EMBER_LIGHT)}
      <Box flexShrink={0}>
        <Text color={EMBER} bold wrap="truncate">
          ◉ Running hot
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
          label={saving ? 'End save mode' : 'Save mode'}
          onPress={async () => {
            $.ui.toast(`Context Lens: ${await toggleSave($)}`)
          }}
        />
        <Button key="hot-close" plain role="dismiss" label="✕" onPress={() => closeHot($, heat)} />
      </Box>
    </Box>
  )
}

export async function coldBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, coldTokens: number) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e))

  const handing = (await read($, handoffStage)) !== null
  const line = `Next message rereads ${kTokens(coldTokens)} tokens at full price. Hand off or compact first.`
  if (e.surface === 'terminal')
    return terminalBand($, e, {
      key: 'cold',
      kind: 'cold',
      color: ICE,
      bg: ICE_BG,
      edge: ICE_EDGE,
      title: 'Cache went cold',
      detail: line,
      buttons: [
        <Button key="cold-compact" variant="secondary" hotkey="c" label="Compact" onPress={() => openCompact($, e)} />,
        <Button
          key="cold-handoff"
          variant="primary"
          hotkey="h"
          label={handing ? 'Handing off…' : 'Hand off'}
          onPress={() => openHandoffBar($)}
        />,
        <Button key="cold-hide" plain hotkey="n" label="Not now" onPress={() => update($, isColdHidden, () => true)} />,
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
      {introLayer({ Box, Svg }, 'cold', await introShows($, 'cold'), ICE, ICE_LIGHT)}
      <Box flexShrink={0}>
        <Text color={ICE} bold wrap="truncate">
          ◉ Cache went cold
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
        <Button key="cold-compact" variant="secondary" label="Compact" onPress={() => openCompact($, e)} />
        <Button
          key="cold-handoff"
          variant="primary"
          label={handing ? 'Handing off…' : 'Hand off'}
          onPress={() => openHandoffBar($)}
        />
        <Button key="cold-hide" plain label="Not now" onPress={() => update($, isColdHidden, () => true)} />
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
      title: 'Context swamped',
      detail: `${kTokens(swampTokens)} tokens${lastContext && lastContext.window ? ` (${Math.round(lastContext.percent)}% of context)` : ''} re-read every message.`,
      buttons: [
        <Button key="swamp-compact" variant="secondary" hotkey="c" label="Compact" onPress={() => openCompact($, e)} />,
        <Button
          key="swamp-handoff"
          variant="primary"
          hotkey="h"
          label={handing ? 'Handing off…' : 'Hand off'}
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
      {introLayer({ Box, Svg }, 'swamp', await introShows($, 'swamp'), BOG_WASH, BOG_LIGHT)}
      <Box flexShrink={0}>
        <Text color={BOG} bold wrap="truncate">
          ◉ Context swamped
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
      <Text wrap="truncate">{`${kTokens(swampTokens)} tokens re-read every message.`}</Text>
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
        <Button key="swamp-compact" variant="secondary" label="Compact" onPress={() => openCompact($, e)} />
        <Button
          key="swamp-handoff"
          variant="primary"
          label={handing ? 'Handing off…' : 'Hand off'}
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
