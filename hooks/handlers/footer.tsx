import { atom, type On, read, update } from 'claude-code'

import { config } from '../core/config'
import { EFFORT_LABELS, MODELS } from '../core/constants'
import { ACCENT, EMBER, HOVER_BOX, ICE } from '../core/palette'
import { cacheColor, cacheLabel } from '../logic/cache'
import { effortOf, snap, toggleAutoEffort } from '../logic/effort'
import { closeHandoffBar, openHandoffBar } from '../logic/handoff'
import { openPluginSettings } from '../logic/settings'
import { ranThisTurn, storedLinesOf, tokens, type TurnLine, turnLineFor } from '../logic/spend'
import { themedEls } from '../theme'

const handoffStage = atom({ plugin: 'context-lens', key: 'handoffStage' } as const, null)
const handoffPick = atom({ plugin: 'context-lens', key: 'handoffPick' } as const, null)
// What each reply's footer says (effort, model, cost), by the reply's duration in ms: written when the turn ends, so a later
// effort or model change leaves the older footers as they were.
const turnLines = atom({ plugin: 'context-lens', key: 'turnLines' } as const, {})
const setupPending = atom({ plugin: 'context-lens', key: 'setupPending' } as const, false)
const settingsOpen = atom({ plugin: 'context-lens', key: 'settingsOpen' } as const, false)
const settingsDraft = atom({ plugin: 'context-lens', key: 'settingsDraft' } as const, {})
const saveUntil = atom({ plugin: 'context-lens', key: 'saveUntil' } as const, null)
const setupStep = atom({ plugin: 'context-lens', key: 'setupStep' } as const, null)

export function registerFooterHooks(on: On) {
  // The desktop footer in the minimal look: the effort in use, as text in the accent in the prompt footer, under the chat
  // box, and a small button that switches Auto off and on. A Button cannot be coloured and the footer draws no outline
  // or tint, so plain Text is what takes the accent. While the judge decides it says "Deciding…", for a moment after Auto switches the level it says
  // "Low → High", and while Auto is off it says "Off" in the dim colour. Auto is switched with /context-lens auto.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    // The dashboard look keeps all of this in the band above the prompt; the app's own footer shows.
    if (e.surface !== 'desktop' || config.layout === 'default') return next(e)
    const { Box, Text, Button } = themedEls($.ui.resolve(e))
    const v = await snap($)
    const handoffNow = (await read($, handoffStage)) !== null
    const needsSetup = await read($, setupPending)
    const effortNow = effortOf(v)
    // Save mode paints the level in the running-hot band's ember until the limit resets.
    const saving = (await read($, saveUntil)) !== null
    const label = v.judging
      ? 'Deciding…'
      : v.switchedNow
        ? `${EFFORT_LABELS[v.switchedNow.from]} → ${EFFORT_LABELS[v.switchedNow.to]}`
        : effortNow
          ? EFFORT_LABELS[effortNow]
          : 'Auto'
    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        {e.props.modes.length > 0 ? <Text dimColor>{e.props.modes.join(' & ')}</Text> : null}
        {/* Hovering the level puts a box behind it, like the app's own effort pill. The spaces are its padding:
            Text has no padding of its own. */}
        {v.auto && v.pausedNow ? (
          // Fable and older models: an effort change rewrites the cache there, so Auto waits.
          <Text dimColor hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {' Paused '}
          </Text>
        ) : v.auto ? (
          <Text color={saving ? EMBER : ACCENT} bold hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {` ${label} `}
          </Text>
        ) : (
          <Text dimColor hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {' Off '}
          </Text>
        )}
        {/* The one thing to click: it switches Auto off and on. Text cannot be clicked, so it is a small button. */}
        <Button
          key="auto"
          plain
          dimColor
          label=" ⏻ "
          hover={{ scope: 'power', backgroundColor: HOVER_BOX }}
          onPress={() => toggleAutoEffort($)}
        />
        {/* Until the setup is done the footer offers it; after that the same place opens the settings panel. */}
        {needsSetup ? (
          <Button
            key="setup"
            plain
            label=" Setup "
            hover={{ scope: 'setup', backgroundColor: HOVER_BOX }}
            onPress={async () => {
              await update($, setupStep, () => 'lean')
              $.ui.invalidate('ui.render')
            }}
          />
        ) : (
          <Button
            key="settings"
            plain
            dimColor
            label=" ⚙︎ "
            hover={{ scope: 'settings', backgroundColor: HOVER_BOX }}
            onPress={async () => {
              if (await read($, settingsOpen)) {
                await update($, settingsDraft, () => ({}))
                await update($, settingsOpen, () => false)
                $.ui.invalidate('ui.render')
              } else await openPluginSettings($)
            }}
          />
        )}
        {/* Hand off: opens the handoff bar above the prompt (quick or full, then what follows). One symbol, so it takes
            little room; pressed again it closes the bar. */}
        {config.hide.includes('handoff') ? null : (
          <Button
            key="handoff"
            plain
            dimColor
            label={handoffNow ? ' … ' : ' ⇥ '}
            hover={{ scope: 'handoff', backgroundColor: HOVER_BOX }}
            onPress={async () => ((await read($, handoffPick)) ? closeHandoffBar($) : openHandoffBar($))}
          />
        )}
        {/* How long the prompt cache stays warm: grey, yellow from 20 minutes, red from 5, then "cold" (the next message
            writes the whole context again). Nothing before the first response. */}
        {/* Cold: the band above the prompt says it and holds Compact and Hand off; the footer only shows the state, in ice blue. */}
        {/* Hovering it reveals a card above the prompt (the cache scope); see the hover cards in AbovePrompt. */}
        {config.hide.includes('timer') ? null : v.cacheNow === 0 ? (
          <Text color={ICE} hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>
            {cacheLabel(0)}
          </Text>
        ) : v.cacheNow === null ? null : cacheColor(v.cacheNow) ? (
          <Text color={cacheColor(v.cacheNow)} hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>
            {cacheLabel(v.cacheNow)}
          </Text>
        ) : (
          <Text dimColor hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>
            {cacheLabel(v.cacheNow)}
          </Text>
        )}
      </Box>
    )
  })

  // A line drawn before turn.complete saved it keeps what it first drew, should the turn end without a save.
  const firstDrawn = new Map<string, TurnLine>()

  // The terminal's line under each reply ("Baked 3s") in the brand's colours, with the effort and the cache. The
  // desktop draws no such line; the bands above the prompt warn there.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const { Box, Text } = themedEls($.ui.resolve(e))
    const key = String(e.props.durationMs)
    let ran =
      turnLineFor(await read($, turnLines), e.props.durationMs) ??
      turnLineFor(await storedLinesOf($), e.props.durationMs) ??
      firstDrawn.get(key)

    // Drawn before turn.complete saved its line: the reply's own last request says what it ran on. With none in this process
    // nothing is known, and the line shows no effort or model rather than the current setting's.
    if (!ran && ranThisTurn) {
      ran = { ...ranThisTurn }
      firstDrawn.set(key, ran)
    }

    const model = MODELS.find(m => m.key === ran?.model)?.long
    const took = Math.max(1, Math.round(e.props.durationMs / 1000))
    return (
      <Box key="turn-line" flexDirection="row" gap={1}>
        <Text dimColor>{`${e.props.word} ${took < 60 ? `${took}s` : `${Math.floor(took / 60)}m ${took % 60}s`}`}</Text>
        {ran ? (
          <Text
            color={ACCENT}
          >{`◉ ${model ? `${model} · ` : ''}${ran.effort ? EFFORT_LABELS[ran.effort] : 'Auto'}`}</Text>
        ) : null}
        {ran?.cost ? <Text dimColor>{`· ≈${tokens(ran.cost)} tokens`}</Text> : null}
      </Box>
    )
  })
}
