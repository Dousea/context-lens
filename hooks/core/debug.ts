import type { EngineInterface } from 'claude-code'

import { envHome, envUserProfile } from './env'

// For /context-lens debug: how often the app asked for the band, when, and the last error drawing it.
// /context-lens probe N: 1 a bare box, 2 the panel's frame and header only, 3 the panel without pickers or fields.
export let probeLevel = 0
export const setProbeLevel = (value: typeof probeLevel) => {
  probeLevel = value
}
export let renderCalls = 0
export const setRenderCalls = (value: typeof renderCalls) => {
  renderCalls = value
}
export let lastRenderProps = ''
export const setLastRenderProps = (value: typeof lastRenderProps) => {
  lastRenderProps = value
}
export let lastRenderBranch = ''
export const setLastRenderBranch = (value: typeof lastRenderBranch) => {
  lastRenderBranch = value
}
// Every time the app asked for the band, with what it sent, written to ~/.claude/context-lens-render-<chat>.log each second
// (the last 300): how often the band is really redrawn in the app, which the render rig cannot see (hover flicker).
export const renderLog: string[] = []
let renderLogWritten = 0
export async function writeRenderLog($: EngineInterface) {
  if (renderLog.length === renderLogWritten) return
  if (renderLog.length > 600) renderLog.splice(0, renderLog.length - 300)
  renderLogWritten = renderLog.length
  const home = (await envUserProfile($)) ?? (await envHome($))
  // One file per chat: a shared file was overwritten whole by whichever chat drew last.
  if (home)
    await $.fs
      .write(`${home}/.claude/context-lens-render-${loadedSession}.log`, renderLog.slice(-300).join('\n') + '\n')
      .catch(() => undefined)
}
export let lastRenderAt = 0
export const setLastRenderAt = (value: typeof lastRenderAt) => {
  lastRenderAt = value
}
export let loadedSession = '-'
export const setLoadedSession = (value: typeof loadedSession) => {
  loadedSession = value
}
// When the mod loaded, for the render log's "first draw" line.
export let loadedAt = Date.now()
export const setLoadedAt = (value: typeof loadedAt) => {
  loadedAt = value
}
export let firstDrawLogged = false
export const setFirstDrawLogged = (value: typeof firstDrawLogged) => {
  firstDrawLogged = value
}
export let drawsTimed = 0
export const setDrawsTimed = (value: typeof drawsTimed) => {
  drawsTimed = value
}
// The last draw that failed and when: kept through the draws after it, so /context-lens debug can still name it.
export let lastRenderError = ''
export let lastRenderErrorAt = 0
export const setLastRenderError = (value: typeof lastRenderError) => {
  lastRenderError = value
  lastRenderErrorAt = Date.now()
}
export let sessionStarted = 0
export const setSessionStarted = (value: typeof sessionStarted) => {
  sessionStarted = value
}
