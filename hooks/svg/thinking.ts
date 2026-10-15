import { tintHex } from '../theme'

/** The thinking dots' size in pixels. */
export const THINK_W = 34
/** The thinking pill's height in pixels. */
export const PILL_H = 16

/** While the judge decides: three dots pulsing one after another, like thinking. Fixed size, so a frame fits it. */
export function thinkingSvg(w = THINK_W, h = PILL_H): string {
  const color = tintHex('#a79cf7')
  const r = h / 2
  const dots = [0, 1, 2]
    .map(
      i =>
        `<circle class="dot" style="animation-delay:${(i * 0.18).toFixed(2)}s" cx="${6 + i * 11}" cy="${r}" r="3" fill="${color}"/>`,
    )
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    '<style>:root{color-scheme:light dark}html,body{margin:0;overflow:hidden}svg{background:transparent;display:block}' +
    '.dot{transform-box:fill-box;transform-origin:center;opacity:.3;animation:dot 1.1s ease-in-out infinite}' +
    '@keyframes dot{30%{opacity:1;transform:translateY(-2.5px) scale(1.15)}60%{opacity:.3;transform:none}}</style>' +
    dots +
    '</svg>'
  )
}
