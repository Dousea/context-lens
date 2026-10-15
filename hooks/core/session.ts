import type { EngineInterface } from 'claude-code'

// The effort the engine itself last asked for on the main loop (the app's setting; this mod only
// rewrites the request, never the setting). It changing means the person set it (the app's Effort
// control, their own /effort): that wins and Auto goes off.
export let engineEffort: string | undefined
export const setEngineEffort = (value: typeof engineEffort) => {
  engineEffort = value
}
// The pick was carried over from the last chat (the store), not made in this one: the app's effort may overrule it.
export let pickCarried = false
export const setPickCarried = (value: typeof pickCarried) => {
  pickCarried = value
}
// The last main-chat request, for /context-lens debug: what the app asked for and what the mod sent instead, if anything.
export let lastRequest: {
  index: number
  appModel: string
  appEffort: unknown
  model: string
  effort: unknown
  at: number
} | null = null
export const setLastRequest = (value: typeof lastRequest) => {
  lastRequest = value
}
// The slash command this mod last typed into the prompt box.
export let lastTyped = ''
export const setLastTyped = (value: typeof lastTyped) => {
  lastTyped = value
}
// The toast about pressing Enter is shown once; on every click it is only noise.
export let toldAboutEnter = false
export const setToldAboutEnter = (value: typeof toldAboutEnter) => {
  toldAboutEnter = value
}

// A main-conversation turn is running: set when a prompt is sent and at each request, cleared when the turn ends (an
// aborted one too). The swamp band and card wait for it: Compact or Handoff mid-turn would cut the reply off. A turn
// with no request for TURN_STALE_MS counts as over, so a missed end never hides the band for good.
let turnBusyAt: number | undefined
const TURN_STALE_MS = 10 * 60_000
export function turnBusy(): boolean {
  return turnBusyAt !== undefined && Date.now() - turnBusyAt < TURN_STALE_MS
}
export async function setTurnBusy($: EngineInterface, busy: boolean) {
  const was = turnBusyAt !== undefined
  turnBusyAt = busy ? Date.now() : undefined
  if (was !== busy) $.ui.invalidate('ui.render')
}
// When the app's SessionStart came and what it said, for /context-lens debug: a cold band that shows late is either a
// late signal or a redraw the app did not take.
export let classicStart: { at: number; said: string } | null = null
export const setClassicStart = (value: typeof classicStart) => {
  classicStart = value
}
