import { atom, type EngineInterface, type RenderInput, update } from 'claude-code'

import type { HandoffAfter, HandoffChoice } from '../../types'
import { config } from '../core/config'
import { FROST_HEIGHT, FROST_WIDTH } from '../core/constants'
import { ACCENT, BRAND_BG, BRAND_EDGE, DASH_DIM } from '../core/palette'
import { openCompact } from '../logic/compact'
import { closeHandoffBar, goHandoff, handoffWhat } from '../logic/handoff'
import { KIND_CELLS, KIND_H, KIND_W, kindFlipAt, kindSwitchSvg, rowIconSvg, setKindFlipAt } from '../svg/controls'
import { BRAND_SVG } from '../svg/scenes'
import { themedEls } from '../theme'
import { introLayer, introShows, optionButtons, terminalPanel } from './band'

const handoffPick = atom({ plugin: 'context-lens', key: 'handoffPick' } as const, null)

export async function handoffBar($: EngineInterface, e: RenderInput<'AbovePrompt'>, choice: HandoffChoice) {
  const elements = themedEls($.ui.resolve(e))
  const { Box, Text, Button } = elements
  const Svg = 'Svg' in elements ? elements.Svg : undefined
  // Mobile has no dropdown (the app's stand-in for one draws nothing): there the choice is a button each.
  const Select = e.surface !== 'mobile' && 'Select' in elements ? elements.Select : undefined
  const afterOptions = [
    { value: 'continue', label: 'Clear & carry on' },
    { value: 'confirm', label: 'Clear & wait' },
    { value: 'copy', label: 'Keep chat & copy' },
  ]

  const setBar = (change: Partial<HandoffChoice>) => async () => {
    if (change.kind && change.kind !== choice.kind) setKindFlipAt(await $.clock.now())
    await update($, handoffPick, () => ({ ...choice, ...change }))
    // The write alone redraws the bar; a full invalidate redraws the art too, which flickers.
  }
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
        <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
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
    ...(Select
      ? [
          <Select
            key="handoff-after"
            value={choice.after}
            options={afterOptions}
            onSelect={v => setBar({ after: v as HandoffAfter })()}
          />,
        ]
      : optionButtons(Button, 'handoff-after', choice.after, afterOptions, v =>
          setBar({ after: v as HandoffAfter })(),
        )),
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
      {Svg ? (
        <Box key="handoff-art" position="absolute" top={-1} right={0} bottom={-1}>
          <Svg source={BRAND_SVG} alt="Context Lens" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
        </Box>
      ) : null}
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
