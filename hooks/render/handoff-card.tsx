import type { EngineInterface, RenderInput } from 'claude-code'

import { MARK_SVG } from '../brand-mark'
import { FROST_HEIGHT, FROST_WIDTH } from '../core/constants'
import { ACCENT, BRAND_BG, BRAND_EDGE, CARD_CLOSE_HOVER, DONE_ACCENT, DONE_BG, DONE_EDGE } from '../core/palette'
import { cardLanded, cardRunning, type HandoffCard } from '../logic/handoff'
import { BRAND_SVG, DASH_SVG, DONE_MARK_SVG, DONE_SVG, HANDOFF_SVG } from '../svg/scenes'
import { themedEls } from '../theme'
import { markTitle } from './band'

/** The handoff or compact card: words, the moving art while it runs, green with a check once it has landed. `above` is
 * what sits over it (the reply it hangs under), or nothing for the band above the prompt. */
export function handoffCardTree(
  $: EngineInterface,
  e: RenderInput<'AssistantMessage'> | RenderInput<'AbovePrompt'>,
  fresh: HandoffCard,
  above: unknown,
  onDismiss?: () => unknown,
) {
  const { Box, Text, Svg, Button } = themedEls($.ui.resolve(e))
  const by = fresh.full ? 'Full' : 'Quick'
  const words = {
    writing: [
      '✦ Handing off…',
      `${by} handoff being written. ${fresh.full ? 'Your skill takes a little while.' : 'A few seconds.'}`,
    ],
    done: ['✦ Handoff complete', 'Carried on from the last chat. The old one is cleared.'],
    copied: ['✦ Handoff copied', 'Paste it into a new chat. This one stays.'],
    compacting: ['✦ Compacting…', 'The chat is being summed up. Takes a minute or so.'],
    compacted: ['✦ Compact complete', 'The chat is summed up; the next message reads far less.'],
  }[fresh.kind]
  // Compacting is a wait in the background, not a result: one quiet line over the band's calm art, not the loud glow.
  const quiet = fresh.kind === 'compacting'
  const card = (
    <Box
      key="reply-handoff"
      position="relative"
      flexDirection="row"
      alignItems="center"
      paddingX={1}
      overflow="hidden"
      backgroundColor={cardLanded(fresh.kind) ? DONE_BG : BRAND_BG}
      borderStyle="round"
      borderColor={cardLanded(fresh.kind) ? DONE_EDGE : BRAND_EDGE}
    >
      <Box key="reply-handoff-art" position="absolute" top={-1} right={0} bottom={-1}>
        {quiet ? (
          <Svg source={DASH_SVG} alt="compacting" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
        ) : cardRunning(fresh.kind) ? (
          <Svg source={HANDOFF_SVG} alt="handing off" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
        ) : (
          <Svg
            source={cardLanded(fresh.kind) ? DONE_SVG : BRAND_SVG}
            alt="context-lens"
            width={FROST_WIDTH * 2}
            height={FROST_HEIGHT * 2}
          />
        )}
      </Box>
      <Box
        key="reply-handoff-words"
        position="relative"
        flexDirection={quiet ? 'row' : 'column'}
        gap={quiet ? 1 : 0}
        flexShrink={1}
        minWidth={0}
      >
        {markTitle(
          { Box, Text, Svg },
          'reply-handoff-title',
          cardLanded(fresh.kind) ? DONE_ACCENT : ACCENT,
          words[0],
          cardLanded(fresh.kind) ? DONE_MARK_SVG : MARK_SVG,
        )}
        <Text wrap="truncate">{words[1]}</Text>
      </Box>
      {onDismiss ? (
        <Box key="reply-handoff-close" position="relative" flexGrow={1} flexDirection="row" justifyContent="flex-end">
          <Box position="absolute" top={0} left={0} />
          {/* A box just the ✕'s size, so its hover lights only the ✕, not the card's right half. */}
          <Box key="card-close-box" position="relative" flexShrink={0}>
            <Box position="absolute" top={0} left={0} />
            <Button
              key="card-close"
              plain
              role="dismiss"
              label="✕"
              hover={{ backgroundColor: CARD_CLOSE_HOVER }}
              onPress={onDismiss}
            />
          </Box>
        </Box>
      ) : null}
    </Box>
  )
  if (above === undefined) return card
  return (
    <Box key="reply" flexDirection="column" gap={1}>
      {above as never}
      {card}
    </Box>
  )
}
