import { atom, type EngineInterface, read, type RenderInput, update } from 'claude-code'

import type { SettingsDraft } from '../../types'
import { config } from '../core/config'
import { FROST_HEIGHT, FROST_WIDTH } from '../core/constants'
import { ACCENT, BRAND_BG, BRAND_EDGE } from '../core/palette'
import {
  closeSetup,
  goSetup,
  LEAN_STOPS,
  setupBack,
  setupCounter,
  setupNext,
  setupShown,
  type SetupStep,
} from '../logic/setup'
import { BRAND_SVG } from '../svg/scenes'
import { themedEls } from '../theme'
import { terminalPanel } from './band'

const installedSkills = atom({ plugin: 'context-lens', key: 'installedSkills' } as const, [])
const setupDraft = atom({ plugin: 'context-lens', key: 'setupDraft' } as const, {})

export async function setupGuide($: EngineInterface, e: RenderInput<'AbovePrompt'>, step: SetupStep) {
  const { Box, Text, Button, Svg } = themedEls($.ui.resolve(e))

  const { Input, Select } = themedEls($.ui.resolve(e))
  const draft = await read($, setupDraft)
  const shown = setupShown(draft, config)
  const setDraft = (field: keyof SettingsDraft, value: string) => update($, setupDraft, d => ({ ...d, [field]: value }))
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
