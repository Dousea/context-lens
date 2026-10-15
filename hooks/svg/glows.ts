import { COMPACT_FADE_MS, HANDOFF_LOUD_AT } from '../core/constants'
import { ACCENT, BOG_BG, ICE } from '../core/palette'

/** The swamped band's colours over the compact bar, fading to nothing: the band seems to turn from green to violet. */
export function compactFadeSvg(elapsedMs: number): string {
  return inPhase(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="240" viewBox="0 0 1600 240" preserveAspectRatio="none"><style>.f{animation:f ${COMPACT_FADE_MS / 1000}s ease-out forwards}@keyframes f{from{opacity:1}to{opacity:0}}</style><rect class="f" width="1600" height="240" fill="${BOG_BG}"/></svg>`,
    elapsedMs,
  )
}
/** An animated Svg drawn `elapsedMs` into its animations. Every redraw rebuilds the band and starts its images' CSS
 * animations over; with this, a redraw mid-animation picks it up where it was instead of jumping back. */
export function inPhase(svg: string, elapsedMs: number): string {
  return svg.replace(
    '</svg>',
    `<style>svg *{animation-delay:${(-Math.max(0, elapsedMs) / 1000).toFixed(3)}s !important}</style></svg>`,
  )
}
/** Handoff's box: it fades in, grey, up to HANDOFF_BOX_AT, then lightens to white by HANDOFF_LOUD_AT, where the glow
 * takes over (it grows to 80%). A glow only ever sits around the white box. */
export const HANDOFF_BOX_AT = 15
export const HANDOFF_PILL_W = 66
export const HANDOFF_PILL_H = 19
/** How hard the glow behind Handoff pulls: 0 below HANDOFF_LOUD_AT, then 1 to 5, one step per 10% of context. */
export function handoffGlowStep(percent: number): number {
  return percent < HANDOFF_LOUD_AT ? 0 : Math.min(5, 1 + Math.floor((percent - HANDOFF_LOUD_AT) / 10))
}
/** The glow behind the Handoff button, one design per step, drawn on a screenshot of the real bar: a tight violet rim
 * just past the button (about 121 by 32 px there), wider, softer and brighter each step, pulsing between a low and a
 * peak. Centred on the button by the layer the dashboard puts it in. A preview draws it tighter than the app does, so
 * judge a change in the app. */
const GLOW_LEVELS: ReadonlyArray<{ spread: number; blur: number; peak: number; low: number; period: number }> = [
  { spread: 0, blur: 0, peak: 0, low: 0, period: 0 },
  { spread: 1.5, blur: 1.2, peak: 0.55, low: 0.2, period: 3.4 },
  { spread: 2, blur: 1.5, peak: 0.65, low: 0.25, period: 2.8 },
  { spread: 2.5, blur: 1.8, peak: 0.75, low: 0.3, period: 2.3 },
  { spread: 3, blur: 2.1, peak: 0.85, low: 0.35, period: 1.9 },
  { spread: 3.5, blur: 2.4, peak: 0.95, low: 0.4, period: 1.5 },
]
/** The glow's drawing in CSS px, measured on the desktop band: the primary
 * Handoff button is 77 by 20 with a 6 px radius, and the band leaves 8 px above and below it. The drawing is no wider
 * than the layer it sits in, so the app never scales it (a Svg is at most as wide as its box). */
export const GLOW_W = HANDOFF_PILL_W + 16
export const GLOW_H = HANDOFF_PILL_H + 16
const GLOW_BUTTON = { w: HANDOFF_PILL_W, h: HANDOFF_PILL_H, r: 6 }
export function handoffGlowSvg(step: number, nowMs = 0): string {
  const { spread: e, blur, peak, low, period } = GLOW_LEVELS[step]!
  // The pulse's place from the clock, so a redraw does not restart it from the low point.
  const lock = (svg: string) => inPhase(svg, nowMs % (period * 1000))
  const x = (GLOW_W - GLOW_BUTTON.w) / 2 - e
  const y = (GLOW_H - GLOW_BUTTON.h) / 2 - e
  return lock(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${GLOW_W}" height="${GLOW_H}" viewBox="0 0 ${GLOW_W} ${GLOW_H}"><style>.g{animation:p ${period}s ease-in-out infinite}@keyframes p{0%,100%{opacity:${low}}50%{opacity:${peak}}}</style><defs><filter id="b" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g class="g" filter="url(#b)"><rect x="${x}" y="${y}" width="${GLOW_BUTTON.w + 2 * e}" height="${GLOW_BUTTON.h + 2 * e}" rx="${GLOW_BUTTON.r + e}" fill="${ACCENT}"/></g></svg>`,
  )
}
/** How long the bar's edges glow after Auto is switched on. */
export const AUTO_GLOW_MS = 2600
export const AUTO_GLOW_W = 760
export const AUTO_GLOW_H = 37
export const COLD_GLOW_MS = 4200

/** The rim in the brand's violet while the judge decides: it lights up and stays at full while it thinks, then fades from
 * full once the verdict is in. Two images, each placed by the clock on every draw (inPhase): the app swaps the whole
 * band on every redraw and a new image starts its animation over, so nothing here may depend on an image surviving.
 * The rise ends at full and holds there (forwards); the fade starts at full. The fade waits for the rise to finish, so
 * a quick verdict never fades from half-way. */
export const JUDGE_RISE_MS = 500
export const JUDGE_FADE_MS = 450
const JUDGE_GLOW_MAX = 0.85
/** CSS's ease-in-out, cubic-bezier(.42,0,.58,1): the progress at time t (0 to 1), by bisection on the curve's x. */
export function easeInOut(t: number): number {
  const at = (a: number, b: number, u: number) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (at(0.42, 0.58, mid) < t) lo = mid
    else hi = mid
  }
  return at(0, 1, (lo + hi) / 2)
}
/** The rim's brightness `elapsedMs` into its rise or fade, read off the same curve the browser draws. */
export function judgeBrightnessAt(kind: 'rise' | 'fade', elapsedMs: number): number {
  const p = Math.min(1, Math.max(0, elapsedMs / (kind === 'rise' ? JUDGE_RISE_MS : JUDGE_FADE_MS)))
  return kind === 'rise' ? JUDGE_GLOW_MAX * easeInOut(p) : JUDGE_GLOW_MAX * (1 - easeInOut(p))
}
/** The rim as one short piece: from its brightness now to its brightness JUDGE_STEP_MS later, in a straight line, then held.
 * The app draws old copies of the band again at moments the mod does not see (measured on a screen recording: a copy
 * from 130 ms into a fade came back 570 ms in, and the fade started over from full). A long animation replayed from a
 * stale copy jumps far; a piece this short is wrong for at most one step, and the schedule draws the next one. The rim
 * at full is a still image with no animation, so a replay changes nothing. */
export const JUDGE_STEP_MS = 50
/** How far each piece runs: longer than the gap between the app's redraws (measured 100 to 120 ms, however often the mod
 * asks), so a piece never ends and stands still before the next one is drawn. A piece of 50 ms did, in visible steps. */
export const JUDGE_PIECE_MS = 150
export function judgeGlowSvg(kind: 'rise' | 'fade', elapsedMs = 0): string {
  const W = AUTO_GLOW_W
  const H = AUTO_GLOW_H
  const dur = kind === 'rise' ? JUDGE_RISE_MS : JUDGE_FADE_MS
  const from = judgeBrightnessAt(kind, elapsedMs)
  // Five points along the true curve, so the piece is where the curve is at every moment and the next one starts on it.
  const span = Math.max(1, Math.min(JUDGE_PIECE_MS, dur - elapsedMs))
  const points = [0, 0.25, 0.5, 0.75, 1]
    .map(k => `${(k * 100).toFixed(0)}%{opacity:${judgeBrightnessAt(kind, elapsedMs + k * span).toFixed(3)}}`)
    .join('')
  const still = kind === 'rise' && elapsedMs >= dur
  const css = still
    ? `.r{opacity:${JUDGE_GLOW_MAX}}`
    : `.r{opacity:${from.toFixed(3)};animation:r ${(span / 1000).toFixed(3)}s linear forwards}@keyframes r{${points}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>${css}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter></defs><g class="r"><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="none" stroke="${ACCENT}" stroke-width="4" opacity=".16" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="#b9a7ff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`
}
/** What the glow is at `now`: nothing, rising or holding, or fading. `endedAt` is null while the judge decides. */
export function judgeGlowAt(startedAt: number, endedAt: number | null, now: number): string | null {
  if (now < startedAt) return null
  const fadeFrom = endedAt === null ? Infinity : Math.max(endedAt, startedAt + JUDGE_RISE_MS)
  if (now < fadeFrom) return judgeGlowSvg('rise', now - startedAt)
  if (now < fadeFrom + JUDGE_FADE_MS) return judgeGlowSvg('fade', now - fadeFrom)
  return null
}

/** The cold band's rim: the Auto glow's light in ice, breathing slowly for as long as the band shows, so a cold chat
 * looks alive rather than parked. Placed by the clock (inPhase), so a redraw picks up where the breath was. */
export function coldGlowSvg(): string {
  const W = AUTO_GLOW_W
  const H = AUTO_GLOW_H
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>.r{opacity:.15;animation:r ${COLD_GLOW_MS / 1000}s ease-in-out infinite}@keyframes r{0%,100%{opacity:.15}50%{opacity:.6}}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter></defs><g class="r"><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="none" stroke="${ICE}" stroke-width="4" opacity=".16" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="#cfeeff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`
}
/** The image starts inside the band's side borders but over its top and bottom ones (the layer's top and bottom are the
 * band's outer edge, its sides the inner), so the line is inset 0.75 px at the sides and 1.75 px at top and bottom: 1 px
 * inside the border all round.
 * The glow inside the bar's edges as Auto comes on: a violet light that rises along the rim, holds, and fades once. Drawn
 * for AUTO_GLOW_MS only (every redraw would replay it). Stretched across the band's width (preserveAspectRatio none: the
 * app scales a Svg to its box's width and keeps its height); drawn at about the band's real width so the sides stay
 * as thick as the top and bottom. Clipped to the bar's inside, so the light falls inward. */
export function autoGlowSvg(on: boolean): string {
  const W = AUTO_GLOW_W
  const H = AUTO_GLOW_H
  const rim = `x="0" y="0" width="${W}" height="${H}" rx="8"`
  const [wash, line, strength] = on ? [ACCENT, '#b9a7ff', 0.9] : ['#8b8b93', '#c8c8d0', 0.6]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>.r{opacity:0;animation:r ${AUTO_GLOW_MS / 1000}s ease-in-out}@keyframes r{0%{opacity:0}15%{opacity:${strength}}45%{opacity:${(strength * 0.85).toFixed(2)}}100%{opacity:0}}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter><filter id="s" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation=".8"/></filter></defs><g class="r"><rect ${rim} fill="none" stroke="${wash}" stroke-width="4" opacity=".14" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="${line}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`
}
