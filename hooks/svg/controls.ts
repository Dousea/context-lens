import type { SettingsCard } from '../../types'
import { HANDOFF_LOUD_AT } from '../core/constants'
import { ACCENT, DASH_BG, DASH_DIM, HOVER_BOX } from '../core/palette'
import { HANDOFF_BOX_AT, HANDOFF_PILL_H, HANDOFF_PILL_W, inPhase } from './glows'

/** The Enter mark as Claude's prompt box draws it: a return arrow, down the right side and back left. */
export function enterSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5V7.2A1.8 1.8 0 0 1 9.7 9H2.8"/><path d="M5.3 6.4 2.7 9l2.6 2.6"/></g></svg>`
}
export const GO_CELLS = 12
export const GO_W = Math.round(GO_CELLS * 7.9)
/** The compact bar's Compact: a white pill like the app's primary buttons, GO_CELLS wide. */
export function goPillSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GO_W}" height="20" viewBox="0 0 ${GO_W} 20"><rect width="${GO_W}" height="20" rx="5" fill="#ffffff"/></svg>`
}

/** A small ring filled to `percent`, for the context in the swamp band. */
export function ringSvg(percent: number, color: string): string {
  const p = Math.max(0, Math.min(100, percent))
  const c = 2 * Math.PI * 6
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="2.2"/><circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${((c * p) / 100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 8 8)"/></svg>`
}

/** The dashboard's settings icon: an outlined cog of eight teeth, drawn rather than a glyph, since the gear character
 * is a different shape in every font. */
export function settingsSvg(color: string): string {
  const step = (2 * Math.PI) / 8
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const a = i * step
    const at = (f: number, r: number) =>
      `${(7 + r * Math.cos(a + f * step)).toFixed(2)},${(7 + r * Math.sin(a + f * step)).toFixed(2)}`
    pts.push(at(-0.42, 4.6), at(-0.27, 4.6), at(-0.2, 6.1), at(0.2, 6.1), at(0.27, 4.6), at(0.42, 4.6))
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round" shape-rendering="geometricPrecision"><path d="M${pts.join('L')}Z"/><circle cx="7" cy="7" r="2"/></g></svg>`
}

/** The settings rows' icons, drawn in the cog's outline style (14 px, 1.3 stroke) rather than font glyphs, which
 * differ per font. */
export function rowIconSvg(kind: SettingsCard | 'quick' | 'full', color: string): string {
  const shapes = {
    // A gauge: an open arc with a needle.
    auto: '<path d="M2.6 10.4A5 5 0 1 1 11.4 10.4"/><path d="M7 8.2L9.6 5.2"/><circle cx="7" cy="8.6" r=".9"/>',
    // Layers: the subagents, stacked.
    subagents:
      '<path d="M7 2 12.2 4.7 7 7.4 1.8 4.7Z"/><path d="M1.8 7.3 7 10 12.2 7.3"/><path d="M1.8 9.9 7 12.6 12.2 9.9"/>',
    // An arrow into a bar: hand off.
    context: '<path d="M1.8 7H9.4M6.6 4.2L9.4 7L6.6 9.8"/><path d="M11.8 2.6V11.4"/>',
    // A pencil: the look. The tip down left, a line across the ferrule.
    look: '<path d="M9.6 2.1 11.9 4.4 4.9 11.4 2.1 11.9 2.6 9.1Z"/><path d="M8.1 3.6 10.4 5.9"/>',
    // Quick and Full are drawn solid below: an outline at 14 px was too thin to read.
    quick: '',
    full: '',
  }[kind]
  if (kind === 'quick' || kind === 'full') {
    const solid =
      kind === 'quick'
        ? // A bolt: the quick handoff, done in seconds.
          'M8.6 1 2.8 8.2H6.6L5.4 13 11.2 5.8H7.4Z'
        : // A pen: the full handoff, written out by your skill.
          'M10.2 1.5 12.5 3.8 5.3 11 2.3 11.7 3 8.7ZM9 2.7 11.3 5'
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><path d="${solid}" fill="${color}" stroke="${color}" stroke-width="0.6" stroke-linejoin="round"/></svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision">${shapes}</g></svg>`
}
/** A bin: the lid and its handle, the can with two ribs. */
export function binSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 3.8H11.8M5.4 3.8V2.4H8.6V3.8M3.4 3.8L4 12H10L10.6 3.8M5.9 6V9.8M8.1 6V9.8"/></g></svg>`
}
/** Handoff's look at `percent` of context, a step each percent: no box at 0, the grey box by HANDOFF_BOX_AT, white by
 * HANDOFF_LOUD_AT. The label goes from dim to white, and dark once the box is light enough to need it. */
export function handoffLook(
  percent: number,
  hovered = false,
): { fill: string; opacity: number; edge: string; label: string } {
  // Hovered, the box is there even on a fresh chat and a few steps lighter.
  const p = Math.max(hovered ? HANDOFF_BOX_AT : 0, Math.min(HANDOFF_LOUD_AT, Math.round(percent) + (hovered ? 5 : 0)))
  const mix = (a: string, b: string, k: number) => {
    const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
    return `#${[0, 1, 2]
      .map(i =>
        Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`
  }
  if (p <= HANDOFF_BOX_AT) {
    const k = p / HANDOFF_BOX_AT
    return { fill: HOVER_BOX, opacity: k, edge: mix(DASH_BG, '#3a3a40', k), label: mix(DASH_DIM, '#ececf0', k) }
  }
  const k = (p - HANDOFF_BOX_AT) / (HANDOFF_LOUD_AT - HANDOFF_BOX_AT)
  return {
    fill: mix(HOVER_BOX, '#ececf0', k),
    opacity: 1,
    edge: mix('#3a3a40', '#ffffff', k),
    label: k > 0.45 ? '#141416' : '#ececf0',
  }
}
/** Handoff's box as drawn (see handoffLook). */
export function handoffPillSvg(percent: number, hovered = false): string {
  const l = handoffLook(percent, hovered)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HANDOFF_PILL_W}" height="${HANDOFF_PILL_H}" viewBox="0 0 ${HANDOFF_PILL_W} ${HANDOFF_PILL_H}"><rect x=".5" y=".5" width="${HANDOFF_PILL_W - 1}" height="${HANDOFF_PILL_H - 1}" rx="6" fill="${l.fill}" fill-opacity="${l.opacity.toFixed(3)}" stroke="${l.edge}" stroke-opacity="${l.opacity.toFixed(3)}"/></svg>`
}

/** How long the switch's knob takes to slide after a click. */
const AUTO_SLIDE_MS = 260
/** Auto as a switch: a pill with its knob right and violet when on, left and grey when off. `slide` draws the move from
 * the other side, for the redraw right after a click only (every redraw replays an image's animation). */
export function autoSwitchSvg(on: boolean, slideMs: number | null = null): string {
  const slide = slideMs !== null && slideMs < AUTO_SLIDE_MS
  const t = `${AUTO_SLIDE_MS / 1000}s cubic-bezier(.3,.7,.2,1)`
  const css = slide
    ? `<style>.k{animation:k ${t}}.p{animation:p ${t}}@keyframes k{from{transform:translateX(${on ? -11 : 11}px);fill:${on ? '#8b8b93' : '#ffffff'}}}@keyframes p{from{fill:${on ? '#2c2c31' : ACCENT};stroke:${on ? '#4a4a52' : ACCENT}}}</style>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="15" viewBox="0 0 26 15">${css}<rect class="p" x=".5" y=".5" width="25" height="14" rx="7" fill="${on ? ACCENT : '#2c2c31'}" stroke="${on ? ACCENT : '#4a4a52'}"/><circle class="k" data-keep="1" cx="${on ? 18.5 : 7.5}" cy="7.5" r="5" fill="${on ? '#ffffff' : '#8b8b93'}"/></svg>`
  return slide ? inPhase(svg, slideMs) : svg
}
/** The handoff bar's Quick | Full switch: a dark track with both words in it and a light knob under the picked one,
 * as tall as Go (20 px, 5 px radius) so the row's controls line up,
 * KIND_CELLS wide each half (the words are app Text laid over it; an image would draw them in another font). */
export const KIND_CELLS = 9
/** One cell of the desktop band in CSS px (`1ch` of its font, measured). */
const CELL_PX = 7.9
export const KIND_W = Math.round(KIND_CELLS * 2 * CELL_PX)
export const KIND_H = 20
/** The track and the knob under `kind`; `slideMs` slides the knob over from the other half, for the redraw right
 * after a click only (every redraw replays an image's animation). */
export function kindSwitchSvg(kind: 'quick' | 'full', slideMs: number | null = null): string {
  const half = KIND_W / 2
  const at = (k: 'quick' | 'full') => (k === 'full' ? half + 0.5 : 2)
  const slide = slideMs !== null && slideMs < KIND_SLIDE_DELAY_MS + KIND_SLIDE_MS
  // It starts a beat after the click: the click redraws the whole bar, its large art included, and a slide in those
  // same frames stuttered. SMIL, not CSS: it moves the knob's own x, held at the old side until it begins.
  const from = at(kind === 'full' ? 'quick' : 'full')
  const begin = slideMs === null ? 0 : KIND_SLIDE_DELAY_MS - slideMs
  const move = slide
    ? `<animate attributeName="x" from="${from}" to="${at(kind)}" begin="${(begin / 1000).toFixed(3)}s" dur="${KIND_SLIDE_MS / 1000}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 .7 .2 1"/>`
    : ''
  // The track is the app's Select (white at 5%, a 1 px inset edge of white at 10%, 6 px corners), so the row reads as
  // one set; the knob sits 2 px inside it.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${KIND_W}" height="${KIND_H}" viewBox="0 0 ${KIND_W} ${KIND_H}"><rect x=".5" y=".5" width="${KIND_W - 1}" height="${KIND_H - 1}" rx="5.5" fill="#ffffff" fill-opacity=".05" stroke="#ffffff" stroke-opacity=".1"/><rect x="${slide ? from : at(kind)}" y="2" width="${half - 2.5}" height="${KIND_H - 4}" rx="4" data-keep="1" fill="#ececf0">${move}</rect>${slide ? `<!--${kindFlipAt}-->` : ''}</svg>`
}
const KIND_SLIDE_MS = 300
const KIND_SLIDE_DELAY_MS = 70
// When the handoff bar's Quick | Full last changed, for the knob's slide. Stamped into the slide's image too: going
// back and forth drew the same image twice, and the app reused it without playing the slide again.
export let kindFlipAt = 0
export const setKindFlipAt = (value: typeof kindFlipAt) => {
  kindFlipAt = value
}
