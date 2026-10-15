import { atom, type EngineInterface, type RenderInput, update } from 'claude-code'

import { COMPACT_FADE_MS, FROST_HEIGHT, FROST_WIDTH } from '../core/constants'
import { ACCENT, BRAND_BG, BRAND_EDGE, CARD_CLOSE_HOVER } from '../core/palette'
import { compactCold } from '../logic/cache'
import { compactNote, compactOpenedAt, setCompactNote } from '../logic/compact'
import { openHandoffBar } from '../logic/handoff'
import { enterSvg, GO_CELLS, GO_W, goPillSvg } from '../svg/controls'
import { compactFadeSvg } from '../svg/glows'
import { BRAND_SVG } from '../svg/scenes'
import { themedEls } from '../theme'
import { introLayer, introShows, markTitle } from './band'

const compactAsk = atom({ plugin: 'context-lens', key: 'compactAsk' } as const, false)

export async function compactBar($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const { Box, Text, Button, Svg } = themedEls($.ui.resolve(e))

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
          <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
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
          <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
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
