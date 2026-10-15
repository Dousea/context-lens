import type { Register } from 'claude-code'

import { readConfig, setConfig, setPluginOptions } from './core/config'
import { setDrawsTimed, setFirstDrawLogged, setLoadedAt } from './core/debug'
import { applyTheme } from './core/palette'
import { registerAbovePromptHooks } from './handlers/above-prompt'
import { registerAgentHooks } from './handlers/agents'
import { registerCommandHooks } from './handlers/commands'
import { registerFooterHooks } from './handlers/footer'
import { registerPromptHooks } from './handlers/prompt'
import { registerSessionHooks } from './handlers/session'
import { registerTurnHooks } from './handlers/turn'
import { setTimersFrom, setTimersScheduled } from './logic/timers'

export const register: Register = (on, options) => {
  setLoadedAt(Date.now())
  setTimersFrom(null)
  setTimersScheduled(false)
  setFirstDrawLogged(false)
  setDrawsTimed(0)

  setConfig(readConfig(options))
  applyTheme()
  setPluginOptions(options)

  registerSessionHooks(on)
  registerTurnHooks(on)
  registerCommandHooks(on)
  registerPromptHooks(on)
  registerFooterHooks(on)
  registerAgentHooks(on)
  registerAbovePromptHooks(on)
}
