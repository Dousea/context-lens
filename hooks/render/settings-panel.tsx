import type { EngineInterface } from 'claude-code'

import { homeDir, noClaudeHint, pluginId, runClaude } from '../core/env'
import { DASH_DIM, UNINSTALL_RED } from '../core/palette'
import { typeCommand } from '../logic/switching'
import { binSvg } from '../svg/controls'

// Uninstall's first press arms it; a second within UNINSTALL_ARM_MS uninstalls. Then the plugins reload and the mod is
// gone from this chat; its settings stay in settings.json, so a reinstall picks them up.
const UNINSTALL_ARM_MS = 4000
let uninstallArmedAt = 0
let uninstalling = false
/** A plain /reload-plugins holds back a change that would make the next message re-read the chat without the cache; --force reloads anyway. */
const RELOAD_ARGS = '--force'
export function uninstallButton($: EngineInterface, els: ReturnType<EngineInterface['ui']['resolve']>) {
  const { Box, Text, Button, Svg } = els
  const armed = Date.now() - uninstallArmedAt < UNINSTALL_ARM_MS
  const press = async () => {
    if (uninstalling) return
    if (!armed) {
      uninstallArmedAt = Date.now()
      $.ui.invalidate('ui.render')
      $.clock.after(UNINSTALL_ARM_MS + 50, () => $.ui.invalidate('ui.render'))
      return
    }
    uninstalling = true
    $.ui.invalidate('ui.render')
    const r = await runClaude($, ['plugin', 'uninstall', pluginId($)], { timeoutMs: 120_000 }).catch(error => ({
      exitCode: 1,
      stdout: '',
      stderr: String(error),
    }))
    uninstalling = false
    if (r.exitCode !== 0) {
      const why = (r.stderr || r.stdout).trim().split('\n').pop() ?? ''
      $.ui.toast(`context-lens: uninstall failed: ${noClaudeHint(why, await homeDir($)) ?? why}`)
      $.ui.invalidate('ui.render')
      return
    }
    $.ui.toast('context-lens is uninstalled. Thanks for trying it.')
    const reloaded = await $.command.run({ command: 'reload-plugins', args: RELOAD_ARGS } as never).then(
      () => true,
      () => false,
    )
    if (!reloaded) await typeCommand($, `/reload-plugins ${RELOAD_ARGS}`)
  }
  const label = uninstalling ? 'Uninstalling…' : armed ? 'Press again to uninstall' : 'Uninstall'
  if (!Svg) return <Button key="settings-uninstall" plain dimColor={!armed} label={label} onPress={press} />
  // A bin and the word, grey; red under the pointer, and red while armed (the red bin is laid over the grey one, since
  // a hover can only reveal). A blank button over both takes the press.
  const red = armed || uninstalling
  return (
    <Box key="settings-uninstall-box" position="relative" flexDirection="row" alignItems="center" flexShrink={0}>
      <Box position="relative" width={2} height={1} alignItems="center">
        <Box position="absolute" top={0} left={0}>
          <Svg source={binSvg(DASH_DIM)} alt="bin" width={14} height={14} />
        </Box>
        <Box
          position="absolute"
          top={0}
          left={0}
          display={red ? 'flex' : 'none'}
          hover={red ? undefined : { scope: 'uninstall', display: 'flex' }}
        >
          <Svg source={binSvg(UNINSTALL_RED)} alt="bin" width={14} height={14} />
        </Box>
      </Box>
      <Text color={red ? UNINSTALL_RED : DASH_DIM} hover={{ scope: 'uninstall', color: UNINSTALL_RED }}>
        {label}
      </Text>
      <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
        <Button
          key="settings-uninstall"
          plain
          hover={{ scope: 'uninstall', backgroundColor: '#00000000' }}
          label={' '.repeat(label.length + 3)}
          onPress={press}
        />
      </Box>
    </Box>
  )
}
// The settings switches as last drawn, and when each flipped, by key (for the slide).
export const settingSwitches = new Map<string, { on: boolean; at: number }>()
