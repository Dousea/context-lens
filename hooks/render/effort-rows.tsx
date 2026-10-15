import { atom, type EngineInterface, read, type RenderInput, update } from 'claude-code'

import type { Effort, ModelKey } from '../../types'
import { config } from '../core/config'
import { EFFORTS, MODELS } from '../core/constants'
import { autoNote, effortOf, pickEffort, snap, toggleAutoEffort, toggleAutoModel } from '../logic/effort'
import { saveSetting } from '../logic/settings'
import { subagentEffortOf } from '../logic/subagents'
import {
  declined,
  keyOf,
  offer,
  sessionModel,
  setDeclined,
  settleOffer,
  suggestedAs,
  switchModel,
} from '../logic/switching'
import { themedEls } from '../theme'
import { detailLine } from './band'

const isAutoModel = atom({ plugin: 'context-lens', key: 'isAutoModel' } as const, false)
const suggestion = atom({ plugin: 'context-lens', key: 'suggestion' } as const, null)
const lensAgents = atom({ plugin: 'context-lens', key: 'lensAgents' } as const, [])

/** The terminal's pickers above the prompt (Model and Effort, each with its Auto) and, on any surface, the
 * judge's question when it suggests another model. The rows also sit under an alert band, so effort never goes away. */
export async function effortRows($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e))
  const v = await snap($)
  const { auto, autoModel, wanted } = v
  // A subagent in view: its own effort and model are lit, and the chat's verdict and note are not about it.
  const agentId = e.props.view.agentId
  const viewed = agentId === undefined ? undefined : (await read($, lensAgents)).find(a => a.id === agentId)
  const inAgent = agentId !== undefined
  const current = inAgent ? null : v.current
  const judging = !inAgent && v.judging
  const inUse = inAgent ? viewed?.model : (v.modelNow ?? (await sessionModel($)))
  const effortNow = inAgent
    ? (viewed?.effort ?? (await subagentEffortOf($, agentId).catch(() => undefined)))
    : effortOf(v)

  const setEffort = (level: Effort) => () => pickEffort($, level)
  // Picking a model yourself turns off Auto for model alone; accepting a suggestion leaves it on. Either holds for this
  // session only, so the app's default model for later sessions stays as it is.
  const setModel = (model: ModelKey) => async () => {
    await update($, isAutoModel, () => false)
    await $.store.set('isAutoModel', false)
    await switchModel($, model)
  }
  // A prompt waiting for the answer takes the switch itself.
  const acceptSuggestion = (model: ModelKey) => async () => {
    if (offer) settleOffer(true)
    else await switchModel($, model)
  }
  const dismiss = async () => {
    setDeclined(wanted)
    await update($, suggestion, () => null)
    settleOffer(false)
  }
  const neverHold = async () => {
    await dismiss()
    await saveSetting($, 'holdOffer', 'off')
    $.ui.toast(
      'Context Lens: prompts are not held for model offers now. /context-lens settings, Model, turns it back on.',
    )
  }
  const neverOffer = async () => {
    await dismiss()
    await saveSetting($, 'holdOffer', 'never')
    $.ui.toast('Context Lens: no more model offers. /context-lens settings, Model, turns them back on.')
  }

  // A bare digit in an empty composer presses a band Button, so a held prompt is answered with 1, 2 or 3 without focusing
  // the band. Only while it waits: otherwise a 1 typed to start a message would switch the model. Plain Buttons draw
  // the digit beside the label (`1: Switch`). An offer the sent prompt left behind takes letters, which need the band
  // focused, so a message starting with a digit goes on as typed; c, h, n and s belong to the bands above it.
  const offerKeys = offer && e.surface === 'terminal'
  const offerKey = (digit: string, letter: string) =>
    offerKeys ? digit : e.surface === 'terminal' ? letter : undefined

  const question = wanted ? (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text>
          {suggestedAs === 'subagent'
            ? `Hand this to a ${MODELS.find(m => m.key === wanted)?.label} subagent?`
            : `Switch to ${MODELS.find(m => m.key === wanted)?.label}?`}{' '}
          {offer
            ? `Your prompt waits ${Math.max(1, Math.ceil((offer.until - (await $.clock.now())) / 1000))}s.`
            : 'The context reloads.'}
        </Text>
        <Button
          key="accept"
          variant="primary"
          hotkey={offerKey('1', 'w')}
          plain={offerKeys ? true : undefined}
          label={suggestedAs === 'subagent' ? 'Hand off' : 'Switch'}
          onPress={acceptSuggestion(wanted)}
        />
        <Button
          key="decline"
          hotkey={offerKey('2', 'k')}
          plain={offerKeys ? true : undefined}
          label="Keep"
          onPress={dismiss}
        />
        <Button
          key="never"
          hotkey={offerKey('3', 'd')}
          plain={offerKeys ? true : undefined}
          label={offer ? "Don't ask again" : "Don't show again"}
          onPress={offer ? neverHold : neverOffer}
        />
      </Box>
    </Box>
  ) : null
  if (e.surface !== 'terminal') return { question, rows: null }

  const reasonNote = judging
    ? 'Deciding…'
    : current
      ? `${current.by === 'manual' || current.by === 'named' ? 'You' : 'Why'}: ${current.why}`
      : autoNote(autoModel, auto)
  // The app's own model and effort, which its status line, /model and /effort show, are marked ( ) in the pickers. A
  // subagent in view has none of its own.
  const appModel = inAgent ? undefined : keyOf(await $.session.model())
  const appEffort = inAgent || !EFFORTS.includes(v.shownByApp as Effort) ? undefined : (v.shownByApp as Effort)
  const marked = (label: string, isApp: boolean) => (isApp ? `( ${label} )` : label)
  // The note is drawn by the caller: a band's detail line says why, and the minimal look puts it on a line of its own
  // (noteLine). Each toggle says the mode in force; a press switches to the other.
  const modelPicker = (
    <Box key="model-picker" flexDirection="row" alignItems="center" gap={1} flexShrink={0}>
      <Text dimColor>Model</Text>
      {MODELS.map(m =>
        m.key === inUse ? (
          <Button
            key={`m-${m.key}`}
            variant="primary"
            label={marked(m.label, m.key === appModel)}
            onPress={setModel(m.key)}
          />
        ) : (
          <Button
            key={`m-${m.key}`}
            plain
            dimColor
            label={marked(m.label, m.key === appModel)}
            onPress={setModel(m.key)}
          />
        ),
      )}
      <Button
        key="auto-model"
        hotkey="m"
        variant={autoModel ? 'primary' : undefined}
        label={autoModel ? 'Auto' : 'Manual'}
        onPress={() => toggleAutoModel($)}
      />
    </Box>
  )
  const effortPicker = (
    <Box key="effort-picker" flexDirection="row" alignItems="center" gap={1} flexShrink={0}>
      <Text dimColor>Effort</Text>
      {EFFORTS.map(level =>
        level === effortNow ? (
          <Button
            key={`e-${level}`}
            variant="primary"
            label={marked(level, level === appEffort)}
            onPress={setEffort(level)}
          />
        ) : (
          <Button
            key={`e-${level}`}
            plain
            dimColor
            label={marked(level, level === appEffort)}
            onPress={setEffort(level)}
          />
        ),
      )}
      <Button
        key="auto"
        hotkey="a"
        variant={auto ? 'primary' : undefined}
        label={auto ? 'Auto' : 'Manual'}
        onPress={() => toggleAutoEffort($)}
      />
    </Box>
  )
  // Model at the left and Effort at the right; a terminal too narrow for both wraps Effort onto a line of its own.
  const rows = (
    <Box flexDirection="column">
      {question}
      <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap={2}>
        {modelPicker}
        {effortPicker}
      </Box>
    </Box>
  )

  // Rows it takes, for fitting the band into the room the app gives it. A button is its label and about three cells of
  // frame and hotkey; a toggle is counted at its wider word, and the app's mark at its four cells.
  const pickerWidth = (word: string, labels: string[]) =>
    word.length + 4 + [...labels, 'Manual'].reduce((sum, label) => sum + label.length + 4, 0)
  const bothWidth =
    pickerWidth(
      'Model',
      MODELS.map(m => m.label),
    ) +
    2 +
    pickerWidth('Effort', EFFORTS)
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 100
  const height = (bothWidth > columns ? 2 : 1) + (question ? 1 : 0)
  const noteLine =
    inAgent || config.hide.includes('reason') ? null : detailLine({ Box, Text }, reasonNote, 'effort-note')
  return { question, rows, height, noteLine }
}
