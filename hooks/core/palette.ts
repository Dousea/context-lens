import type { EngineInterface } from 'claude-code'

import { accent, setLight, setTheme, tintHex } from '../theme'
import { config } from './config'

// The accent the effort in the footer is written in: the brand violet, or what the theme turns it to.
export let ACCENT = accent()
/** Takes the theme the settings name; the accent and every drawing follow it. */
export function applyTheme() {
  setTheme(config.theme)
  ACCENT = accent()
  BRAND_BG = tintHex('#15121f')
  BRAND_EDGE = tintHex('#4a3f80')
  BRAND_HEAD = tintHex('#221c3a')
  FLASH_COLOR = tintHex('#9b7bff')
  // The panel greys lean blue beside the violet; with the other themes they are the app's own neutral greys.
  const neutral = config.theme !== 'violet'
  DASH_BG = neutral ? '#151515' : '#141416'
  DASH_EDGE = neutral ? '#2a2a2a' : '#2a2a2f'
  DASH_HEAD = neutral ? '#191919' : '#18181b'
  CARD_HOVER = neutral ? '#1c1c1c' : '#1c1c20'
  CARD_HOVER_EDGE = neutral ? '#3b3b3b' : '#3b3b42'
  HOVER_BOX = neutral ? '#2b2b2b' : '#2b2b2f'
  setLight(claudeIsLight)
}

// Claude Code's own theme, read from its /config row: a light one turns everything light.
let claudeIsLight = false
let appearanceCheckedAt = -Infinity
/** Reads Claude Code's theme row (at most every few seconds) and redraws when light or dark changed. */
export async function refreshAppearance($: EngineInterface) {
  const now = await $.clock.now().catch(() => Date.now())
  if (now - appearanceCheckedAt < 4000) return
  appearanceCheckedAt = now
  const rows = await $.config.list().catch(() => [])
  const value = rows.find(row => row.key === 'theme')?.value
  const lightNow = typeof value === 'string' && value.startsWith('light')
  if (lightNow === claudeIsLight) return
  claudeIsLight = lightNow
  setLight(claudeIsLight)
  $.ui.invalidate('ui.render')
}
export let BRAND_BG = '#15121f'
export let BRAND_EDGE = '#4a3f80'
// The settings panel's header bar: a shade lighter than the panel, so it reads as a title bar.
let BRAND_HEAD = '#221c3a'
// The box behind the level while it is hovered: the grey of the app's own pills.
export let HOVER_BOX = '#2b2b2f'
export const ICE = '#7cc4ff'
export const ICE_BG = '#0e1820'
export const ICE_EDGE = '#2f5c80'
export const BOG = '#a7c98f'
export const BOG_BG = '#111710'
export const BOG_EDGE = '#3e5a33'
export const EMBER = '#f08a3c'
export const EMBER_BG = '#1a110c'
export const EMBER_EDGE = '#6a3418'
export const SLATE = '#b4b8c4'
export const SLATE_BG = '#12141b'
export const SLATE_EDGE = '#39415a'
export const YELLOW = '#e0a33a'
export const RED = '#e5534b'
export let DASH_BG = '#141416'
export let DASH_EDGE = '#2a2a2f'
/** The settings panel's top bar: a shade above the band. */
export let DASH_HEAD = '#18181b'
export const DASH_TEXT = '#d4d4d8'
/** The dashboard's quieter figures: the cache countdown while it has time left. */
export const DASH_DIM = '#8b8b93'
// A settings card under the pointer: a shade up from the band, its edge a shade up from that.
export let CARD_HOVER = '#1c1c20'
export let CARD_HOVER_EDGE = '#3b3b42'
export const DONE_ACCENT = '#7fe0a4'
export const DONE_BG = '#0f1c15'
export const DONE_EDGE = '#2f7a4c'
/** The glow: a stronger shade than the accent, so a switch is seen at a glance. */
export let FLASH_COLOR = '#9b7bff'
export const UNINSTALL_RED = '#ff6b6b'
/** The card ✕'s hover: the app's ghost fill is lost on the green and violet cards, so a darker wash of the card itself. */
export const CARD_CLOSE_HOVER = '#00000040'

/** Claude Code's theme keys as hex, for an Svg, which takes no theme key: the signals and greys in the mod's own
 * shades, the rest as the app's dark theme draws them. The light look turns them as it turns every drawing. */
const THEME_KEY_HEX: Record<string, string> = {
  text: DASH_TEXT,
  inactive: DASH_DIM,
  subtle: CARD_HOVER_EDGE,
  success: DONE_ACCENT,
  warning: YELLOW,
  error: RED,
  claude: '#d77757',
  permission: '#b1b9f9',
  suggestion: '#b1b9f9',
  remember: '#b1b9f9',
  planMode: '#48968c',
  autoAccept: '#af87ff',
  merged: '#af87ff',
  promptBorder: '#888888',
  bashBorder: '#fd5db1',
  ide: '#4782c8',
}

/** A theme key, or a hex as it is, as hex; a key it does not know draws in the dim grey. */
export const themeHex = (color: string): string =>
  THEME_KEY_HEX[color] ?? (/^#[0-9a-fA-F]{6}$/.test(color) ? color : DASH_DIM)
