// @ts-nocheck
// Built by `npm run build` from hooks/register.tsx and what it imports. Do not edit.

// hooks/theme.ts
var THEMES = ["violet", "orange", "rose"];
var HUES = { orange: 15, rose: 340 };
var current = "violet";
var light = false;
var setLight = (on) => {
  if (on !== light) lmemo.clear();
  light = on;
};
var setTheme = (name) => {
  if (name !== current) memo.clear();
  current = name;
};
var getTheme = () => current;
var VIOLET = "#a79cf7";
var hexRe = /#[0-9a-fA-F]{6}\b/g;
var memo = /* @__PURE__ */ new Map();
var lmemo = /* @__PURE__ */ new Map();
function toHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h2 = 0;
  if (d !== 0) {
    h2 = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h2 = (h2 * 60 + 360) % 360;
  }
  return [h2, s, l, d];
}
function fromHsl(h2, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(h2 / 60 % 2 - 1));
  const m = l - c / 2;
  const [r, g, b] = h2 < 60 ? [c, x, 0] : h2 < 120 ? [x, c, 0] : h2 < 180 ? [0, c, x] : h2 < 240 ? [0, x, c] : h2 < 300 ? [x, 0, c] : [c, 0, x];
  const byte = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255))).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}
function tintHex(hex2) {
  if (current === "violet") return hex2;
  const key = hex2.toLowerCase();
  const hit = memo.get(key);
  if (hit) return hit;
  const n = parseInt(key.slice(1), 16);
  const [h2, s, l, chroma] = toHsl((n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
  const out = h2 >= 235 && h2 <= 300 && chroma >= 0.03 && s >= 0.15 ? fromHsl(
    HUES[current],
    Math.min(1, s * (current === "rose" ? 0.9 : 0.75)),
    l > 0.5 ? Math.max(0.5, l - (current === "rose" ? 0.08 : 0.19)) : l
  ) : hex2;
  memo.set(key, out);
  return out;
}
var PETAL = "M0 -2.2C1.7 -1.7 1.9 0.9 0 2.2C-1.9 0.9 -1.7 -1.7 0 -2.2Z";
var PETAL_CSS = ".pt{fill:#ffb3cf;opacity:0;animation-name:fall;animation-timing-function:linear;animation-iteration-count:infinite}@keyframes fall{0%{opacity:0;transform:translate(0,-4px) rotate(0deg)}12%{opacity:.6}85%{opacity:.5}100%{opacity:0;transform:translate(-16px,34px) rotate(280deg)}}";
function petals(text) {
  if (!text.includes('class="sp"')) return text;
  return text.replace(
    /<path class="sp" style="transform-origin:([\d.]+)px [\d.]+px;animation-duration:([\d.]+)s;animation-delay:([\d.]+)s" d="[^"]*"\/>/g,
    (_m, x, dur, delay) => `<g transform="translate(${x} 0)"><path class="pt" style="animation-duration:${(Number(dur) * 2.2).toFixed(1)}s;animation-delay:${delay}s" d="${PETAL}"/></g>`
  ).replace("</style>", `${PETAL_CSS}</style>`);
}
var luminance = (hex2) => {
  const n = parseInt(hex2.slice(1, 7), 16);
  const f = (v) => (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * f(n >> 16) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255);
};
var PALE_REF = luminance("#e3e0ed");
function lightHex(hex2, role = "art") {
  const key = hex2.toLowerCase();
  const memoKey = role + key;
  const hit = lmemo.get(memoKey);
  if (hit) return hit;
  const n = parseInt(key.slice(1, 7), 16);
  const [h2, s, l] = toHsl((n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
  const asText = role === "text" || role === "art" && l >= 0.5;
  let out;
  if (asText) {
    const sat = Math.min(s, 0.72);
    let at = l >= 0.5 ? Math.max(0.12, Math.min(0.5, 1 - l + (s >= 0.35 ? 0.2 : 0))) : l;
    out = fromHsl(h2, sat, at);
    while (at > 0.12 && (PALE_REF + 0.05) / (luminance(out) + 0.05) < 4.6) {
      at -= 0.01;
      out = fromHsl(h2, sat, at);
    }
  } else {
    const top = s >= 0.2 ? 0.955 : 0.99;
    out = l >= 0.5 ? key.slice(0, 7) : fromHsl(h2, Math.min(s, s >= 0.2 ? 0.6 : 0.35), Math.max(0.8, Math.min(top, top - (l - 0.07) * 0.9)));
  }
  const result = key.length === 9 ? out + key.slice(7) : out;
  lmemo.set(memoKey, result);
  return result;
}
var lightRe = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F])/g;
function tint(text) {
  if (current === "violet" && !light) return text;
  const turned = current === "violet" ? text : text.replace(hexRe, tintHex);
  const drawn = current === "rose" && turned !== text ? petals(turned) : turned;
  if (!light) return drawn;
  return drawn.replace(
    /(<[^>]*>)|([^<]+)/g,
    (part, tag) => tag && tag.includes("data-keep") ? part : part.replace(lightRe, (hex2) => lightHex(hex2))
  );
}
var accent = () => tintHex(VIOLET);
var wrapped = /* @__PURE__ */ new WeakMap();
function themedSvg(Svg) {
  if (current === "violet" && !light || typeof Svg !== "function") return Svg;
  let wrap = wrapped.get(Svg);
  if (!wrap) {
    const inner = Svg;
    wrap = (props) => inner(typeof props.source === "string" ? { ...props, source: tint(props.source) } : props);
    wrapped.set(Svg, wrap);
  }
  return wrap;
}
var PAINT = [
  "color",
  "backgroundColor",
  "borderColor",
  "borderTopColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderRightColor"
];
var paint = (v, role) => typeof v === "string" && /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(v) ? lightHex(v, role) : v;
function lightProps(props) {
  let out = props;
  for (const k of PAINT) {
    const turned = paint(props[k], k === "color" ? "text" : "surface");
    if (turned !== props[k]) out = { ...out, [k]: turned };
  }
  const hover = props.hover;
  if (hover && typeof hover === "object") out = { ...out, hover: lightProps(hover) };
  return out;
}
var lightWrapped = /* @__PURE__ */ new WeakMap();
var lit = (Part) => {
  if (typeof Part !== "function") return Part;
  let wrap = lightWrapped.get(Part);
  if (!wrap) {
    const inner = Part;
    wrap = (props) => inner(props && typeof props === "object" ? lightProps(props) : props);
    lightWrapped.set(Part, wrap);
  }
  return wrap;
};
function themedEls(els) {
  const out = { ...els };
  if ("Svg" in els) out.Svg = themedSvg(els.Svg);
  if (light) {
    for (const part of ["Box", "Text", "Button"])
      if (part in els) out[part] = lit(els[part]);
  }
  return out;
}

// hooks/core/constants.ts
var MODELS = [
  { key: "haiku", label: "Haiku", long: "Haiku 5.5", id: "claude-haiku-5-5" },
  { key: "sonnet", label: "Sonnet", long: "Sonnet 5.5", id: "claude-sonnet-5-5" },
  { key: "opus", label: "Opus", long: "Opus 5.5", id: "claude-opus-5-5" },
  { key: "fable", label: "Fable", long: "Fable 5.1", id: "claude-fable-5-1" }
];
var EFFORTS = ["low", "medium", "high", "xhigh", "max"];
var STEPS = ["one", "few", "many"];
var WEIGHT = { input: 1, write: 1.25, write1h: 2, read: 0.1, out: 5 };
var cacheSafe = (modelId) => /(opus|sonnet|haiku)-5-5/.test(modelId);
var takesEffort = (modelId) => !/haiku-[1-4]|3-(5-)?haiku/.test(modelId);
var EFFORT_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max"
};
var EMPTY_SPENT = {
  prompts: 0,
  requests: 0,
  input: 0,
  write: 0,
  writeHour: 0,
  read: 0,
  out: 0,
  byEffort: {},
  judge: { haiku: 0, ms: 0, tokens: 0 },
  subagents: { runs: {}, requests: 0, cost: 0 }
};
var CACHE_TTL = { "5m": 5 * 6e4, "1h": 60 * 6e4 };
var COMPACT_FADE_MS = 450;
var FROST_WIDTH = 440;
var FROST_HEIGHT = 64;
var HANDOFF_LOUD_AT = 30;

// hooks/core/config.ts
var SWAMP_STEPS = [10, 20, 30, 40, 50, 60, 70, 80];
var HIDEABLE = ["handoff", "timer", "reason", "swamp", "hot", "cold"];
var pluginOptions = {};
var setPluginOptions = (value) => {
  pluginOptions = value;
};
var config = {
  handoffSkill: "",
  handoffAfter: "continue",
  bias: 0,
  floor: "low",
  ceiling: "max",
  hide: [],
  swampAt: 70,
  layout: "default",
  compactWith: "haiku",
  handoffButton: "advised",
  subagents: "off",
  subagentModel: "off",
  overrideDefinitions: "off",
  holdOffer: "on",
  theme: "violet",
  appearance: "auto"
};
var setConfig = (value) => {
  config = value;
};
function readConfig(options) {
  const o = options ?? {};
  const str = (v) => typeof v === "string" ? v.trim() : "";
  return {
    handoffSkill: str(o.handoffSkill).replace(/^\//, ""),
    handoffAfter: ["confirm", "copy"].find((a) => a === str(o.handoffAfter)) ?? "continue",
    bias: Math.max(-2, Math.min(2, Math.round(Number(str(o.effortBias)) || 0))),
    floor: EFFORTS.includes(str(o.effortFloor)) ? str(o.effortFloor) : "low",
    ceiling: EFFORTS.includes(str(o.effortCeiling)) ? str(o.effortCeiling) : "max",
    swampAt: SWAMP_STEPS.includes(Number(str(o.swampAt))) ? Number(str(o.swampAt)) : 70,
    layout: str(o.layout) === "minimal" ? "minimal" : "default",
    compactWith: str(o.compactWith) === "session" ? "session" : "haiku",
    handoffButton: str(o.handoffButton) === "always" ? "always" : "advised",
    subagents: str(o.subagents) === "on" ? "on" : "off",
    subagentModel: str(o.subagentModel) === "on" ? "on" : "off",
    overrideDefinitions: str(o.overrideDefinitions) === "on" ? "on" : "off",
    holdOffer: str(o.holdOffer) === "off" ? "off" : "on",
    theme: THEMES.find((t) => t === str(o.theme)) ?? "violet",
    appearance: ["dark", "light"].find((a) => a === str(o.appearance)) ?? "auto",
    // Everything shows unless switched off; the judge's line too.
    hide: (o.hide === void 0 ? "" : str(o.hide)).split(",").map((part) => part.trim()).filter((part) => HIDEABLE.includes(part))
  };
}

// hooks/core/env.ts
var proofLines = [];
var askLog;
var askTemp;
var askTmpdir;
var askUserProfile;
var askHome;
var askCacheTtl;
var askAgentCacheTtl;
var askForce5m;
var askEnable1h;
function envLog($) {
  return askLog = askLog ?? $.env.get("CONTEXT_LENS_LOG");
}
function envTemp($) {
  return askTemp = askTemp ?? $.env.get("TEMP");
}
function envTmpdir($) {
  return askTmpdir = askTmpdir ?? $.env.get("TMPDIR");
}
function envUserProfile($) {
  return askUserProfile = askUserProfile ?? $.env.get("USERPROFILE");
}
function envHome($) {
  return askHome = askHome ?? $.env.get("HOME");
}
function envCacheTtl($) {
  return askCacheTtl = askCacheTtl ?? $.env.get("CLAUDE_CODE_PROMPT_CACHE_TTL");
}
function envAgentCacheTtl($) {
  return askAgentCacheTtl = askAgentCacheTtl ?? $.env.get("CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL");
}
function envForce5m($) {
  return askForce5m = askForce5m ?? $.env.get("FORCE_PROMPT_CACHING_5M");
}
function envEnable1h($) {
  return askEnable1h = askEnable1h ?? $.env.get("ENABLE_PROMPT_CACHING_1H");
}
async function proofPath($) {
  const named = await envLog($);
  if (named) return named;
  if (!$.plugin.root.replace(/\\/g, "/").includes("/dev-mods/")) return void 0;
  const tmp = await envTemp($) ?? await envTmpdir($) ?? "/tmp";
  return `${tmp}/context-lens-proof.log`;
}
async function proof($, line) {
  const path = await proofPath($).catch(() => void 0);
  if (!path) return;
  proofLines.push(`${(/* @__PURE__ */ new Date()).toISOString()} ${line}`);
  await $.fs.write(path, proofLines.slice(-200).join("\n") + "\n").catch(() => void 0);
}
var ownVersion = "";
function readOwnVersion($) {
  void $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`).then((text) => {
    ownVersion = String(JSON.parse(String(text)).version ?? "");
  }).catch(() => void 0);
}
function claudeCandidates(home) {
  if (!home) return ["claude"];
  const win = /^[A-Za-z]:/.test(home);
  const sep = home.includes("\\") ? "\\" : "/";
  return ["claude", [home.replace(/[\\/]+$/, ""), ".local", "bin", win ? "claude.exe" : "claude"].join(sep)];
}
var NOT_STARTED = /ENOENT|not found or is in an unsafe location|failed to start/i;
function noClaudeHint(error, home) {
  if (!NOT_STARTED.test(error)) return void 0;
  const install = home && /^[A-Za-z]:/.test(home) ? "irm https://claude.ai/install.ps1 | iex" : "curl -fsSL https://claude.ai/install.sh | bash";
  return `This needs the Claude Code CLI. Install it with ${install}, then reopen the app.`;
}
async function homeDir($) {
  return (await envUserProfile($) ?? await envHome($)) || void 0;
}
async function runClaude($, args, opts) {
  let last;
  for (const bin of claudeCandidates(await homeDir($))) {
    try {
      return await $.process.run([bin, ...args], opts);
    } catch (error) {
      last = error;
      if (!NOT_STARTED.test(String(error))) throw error;
    }
  }
  throw last;
}
function pluginId($) {
  return `context-lens@${$.plugin.root.match(/cache[\\/]([^\\/]+)[\\/]/)?.[1] ?? "context-lens"}`;
}

// hooks/core/debug.ts
var probeLevel = 0;
var setProbeLevel = (value) => {
  probeLevel = value;
};
var renderCalls = 0;
var setRenderCalls = (value) => {
  renderCalls = value;
};
var lastRenderProps = "";
var setLastRenderProps = (value) => {
  lastRenderProps = value;
};
var lastRenderBranch = "";
var setLastRenderBranch = (value) => {
  lastRenderBranch = value;
};
var renderLog = [];
var renderLogWritten = 0;
async function writeRenderLog($) {
  if (renderLog.length === renderLogWritten) return;
  if (renderLog.length > 600) renderLog.splice(0, renderLog.length - 300);
  renderLogWritten = renderLog.length;
  const home = await envUserProfile($) ?? await envHome($);
  if (home)
    await $.fs.write(`${home}/.claude/context-lens-render-${loadedSession}.log`, renderLog.slice(-300).join("\n") + "\n").catch(() => void 0);
}
var lastRenderAt = 0;
var setLastRenderAt = (value) => {
  lastRenderAt = value;
};
var loadedSession = "-";
var setLoadedSession = (value) => {
  loadedSession = value;
};
var loadedAt = Date.now();
var setLoadedAt = (value) => {
  loadedAt = value;
};
var firstDrawLogged = false;
var setFirstDrawLogged = (value) => {
  firstDrawLogged = value;
};
var drawsTimed = 0;
var setDrawsTimed = (value) => {
  drawsTimed = value;
};
var lastRenderError = "";
var setLastRenderError = (value) => {
  lastRenderError = value;
};
var sessionStarted = 0;
var setSessionStarted = (value) => {
  sessionStarted = value;
};

// hooks/core/palette.ts
var ACCENT = accent();
function applyTheme() {
  setTheme(config.theme);
  ACCENT = accent();
  BRAND_BG = tintHex("#15121f");
  BRAND_EDGE = tintHex("#4a3f80");
  BRAND_HEAD = tintHex("#221c3a");
  FLASH_COLOR = tintHex("#9b7bff");
  const neutral = config.theme !== "violet";
  DASH_BG = neutral ? "#151515" : "#141416";
  DASH_EDGE = neutral ? "#2a2a2a" : "#2a2a2f";
  DASH_HEAD = neutral ? "#191919" : "#18181b";
  CARD_HOVER = neutral ? "#1c1c1c" : "#1c1c20";
  CARD_HOVER_EDGE = neutral ? "#3b3b3b" : "#3b3b42";
  HOVER_BOX = neutral ? "#2b2b2b" : "#2b2b2f";
  applyAppearance();
}
var claudeIsLight = false;
var appearanceCheckedAt = -Infinity;
function applyAppearance() {
  setLight(config.appearance === "light" || config.appearance === "auto" && claudeIsLight);
}
async function refreshAppearance($) {
  const now = await $.clock.now().catch(() => Date.now());
  if (now - appearanceCheckedAt < 4e3) return;
  appearanceCheckedAt = now;
  const rows = await $.config.list().catch(() => []);
  const value = rows.find((row) => row.key === "theme")?.value;
  const lightNow = typeof value === "string" && value.startsWith("light");
  if (lightNow === claudeIsLight) return;
  claudeIsLight = lightNow;
  applyAppearance();
  $.ui.invalidate("ui.render");
}
var BRAND_BG = "#15121f";
var BRAND_EDGE = "#4a3f80";
var BRAND_HEAD = "#221c3a";
var HOVER_BOX = "#2b2b2f";
var ICE = "#7cc4ff";
var ICE_BG = "#0e1820";
var ICE_EDGE = "#2f5c80";
var BOG = "#a7c98f";
var BOG_BG = "#111710";
var BOG_EDGE = "#3e5a33";
var EMBER = "#f08a3c";
var EMBER_BG = "#1a110c";
var EMBER_EDGE = "#6a3418";
var SLATE = "#b4b8c4";
var SLATE_BG = "#12141b";
var SLATE_EDGE = "#39415a";
var YELLOW = "#e0a33a";
var RED = "#e5534b";
var DASH_BG = "#141416";
var DASH_EDGE = "#2a2a2f";
var DASH_HEAD = "#18181b";
var DASH_TEXT = "#d4d4d8";
var DASH_DIM = "#8b8b93";
var CARD_HOVER = "#1c1c20";
var CARD_HOVER_EDGE = "#3b3b42";
var DONE_ACCENT = "#7fe0a4";
var DONE_BG = "#0f1c15";
var DONE_EDGE = "#2f7a4c";
var FLASH_COLOR = "#9b7bff";
var UNINSTALL_RED = "#ff6b6b";
var CARD_CLOSE_HOVER = "#00000040";

// hooks/handlers/above-prompt.tsx
import { atom as atom21, read as read18, update as update20 } from "claude-code";

// hooks/core/session.ts
var engineEffort;
var setEngineEffort = (value) => {
  engineEffort = value;
};
var pickCarried = false;
var setPickCarried = (value) => {
  pickCarried = value;
};
var lastRequest = null;
var setLastRequest = (value) => {
  lastRequest = value;
};
var lastTyped = "";
var setLastTyped = (value) => {
  lastTyped = value;
};
var toldAboutEnter = false;
var setToldAboutEnter = (value) => {
  toldAboutEnter = value;
};
var turnBusyAt;
var TURN_STALE_MS = 10 * 6e4;
function turnBusy() {
  return turnBusyAt !== void 0 && Date.now() - turnBusyAt < TURN_STALE_MS;
}
async function setTurnBusy($, busy) {
  const was = turnBusyAt !== void 0;
  turnBusyAt = busy ? Date.now() : void 0;
  if (was !== busy) $.ui.invalidate("ui.render");
}
var classicStart = null;
var setClassicStart = (value) => {
  classicStart = value;
};

// hooks/logic/alerts.ts
import { atom as atom2, read as read2, update as update2 } from "claude-code";

// hooks/svg/glows.ts
function compactFadeSvg(elapsedMs) {
  return inPhase(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="240" viewBox="0 0 1600 240" preserveAspectRatio="none"><style>.f{animation:f ${COMPACT_FADE_MS / 1e3}s ease-out forwards}@keyframes f{from{opacity:1}to{opacity:0}}</style><rect class="f" width="1600" height="240" fill="${BOG_BG}"/></svg>`,
    elapsedMs
  );
}
function inPhase(svg, elapsedMs) {
  return svg.replace(
    "</svg>",
    `<style>svg *{animation-delay:${(-Math.max(0, elapsedMs) / 1e3).toFixed(3)}s !important}</style></svg>`
  );
}
var HANDOFF_BOX_AT = 15;
var HANDOFF_PILL_W = 66;
var HANDOFF_PILL_H = 19;
function handoffGlowStep(percent) {
  return percent < HANDOFF_LOUD_AT ? 0 : Math.min(5, 1 + Math.floor((percent - HANDOFF_LOUD_AT) / 10));
}
var GLOW_LEVELS = [
  { spread: 0, blur: 0, peak: 0, low: 0, period: 0 },
  { spread: 1.5, blur: 1.2, peak: 0.55, low: 0.2, period: 3.4 },
  { spread: 2, blur: 1.5, peak: 0.65, low: 0.25, period: 2.8 },
  { spread: 2.5, blur: 1.8, peak: 0.75, low: 0.3, period: 2.3 },
  { spread: 3, blur: 2.1, peak: 0.85, low: 0.35, period: 1.9 },
  { spread: 3.5, blur: 2.4, peak: 0.95, low: 0.4, period: 1.5 }
];
var GLOW_W = HANDOFF_PILL_W + 16;
var GLOW_H = HANDOFF_PILL_H + 16;
var GLOW_BUTTON = { w: HANDOFF_PILL_W, h: HANDOFF_PILL_H, r: 6 };
function handoffGlowSvg(step, nowMs = 0) {
  const { spread: e, blur, peak, low, period } = GLOW_LEVELS[step];
  const lock = (svg) => inPhase(svg, nowMs % (period * 1e3));
  const x = (GLOW_W - GLOW_BUTTON.w) / 2 - e;
  const y = (GLOW_H - GLOW_BUTTON.h) / 2 - e;
  return lock(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${GLOW_W}" height="${GLOW_H}" viewBox="0 0 ${GLOW_W} ${GLOW_H}"><style>.g{animation:p ${period}s ease-in-out infinite}@keyframes p{0%,100%{opacity:${low}}50%{opacity:${peak}}}</style><defs><filter id="b" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g class="g" filter="url(#b)"><rect x="${x}" y="${y}" width="${GLOW_BUTTON.w + 2 * e}" height="${GLOW_BUTTON.h + 2 * e}" rx="${GLOW_BUTTON.r + e}" fill="${ACCENT}"/></g></svg>`
  );
}
var AUTO_GLOW_MS = 2600;
var AUTO_GLOW_W = 760;
var AUTO_GLOW_H = 37;
var COLD_GLOW_MS = 4200;
var JUDGE_RISE_MS = 500;
var JUDGE_FADE_MS = 450;
var JUDGE_GLOW_MAX = 0.85;
function easeInOut(t) {
  const at = (a, b, u) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(0.42, 0.58, mid) < t) lo = mid;
    else hi = mid;
  }
  return at(0, 1, (lo + hi) / 2);
}
function judgeBrightnessAt(kind, elapsedMs) {
  const p = Math.min(1, Math.max(0, elapsedMs / (kind === "rise" ? JUDGE_RISE_MS : JUDGE_FADE_MS)));
  return kind === "rise" ? JUDGE_GLOW_MAX * easeInOut(p) : JUDGE_GLOW_MAX * (1 - easeInOut(p));
}
var JUDGE_STEP_MS = 50;
var JUDGE_PIECE_MS = 150;
function judgeGlowSvg(kind, elapsedMs = 0) {
  const W = AUTO_GLOW_W;
  const H = AUTO_GLOW_H;
  const dur = kind === "rise" ? JUDGE_RISE_MS : JUDGE_FADE_MS;
  const from = judgeBrightnessAt(kind, elapsedMs);
  const span = Math.max(1, Math.min(JUDGE_PIECE_MS, dur - elapsedMs));
  const points = [0, 0.25, 0.5, 0.75, 1].map((k) => `${(k * 100).toFixed(0)}%{opacity:${judgeBrightnessAt(kind, elapsedMs + k * span).toFixed(3)}}`).join("");
  const still = kind === "rise" && elapsedMs >= dur;
  const css = still ? `.r{opacity:${JUDGE_GLOW_MAX}}` : `.r{opacity:${from.toFixed(3)};animation:r ${(span / 1e3).toFixed(3)}s linear forwards}@keyframes r{${points}}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>${css}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter></defs><g class="r"><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="none" stroke="${ACCENT}" stroke-width="4" opacity=".16" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="#b9a7ff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`;
}
function judgeGlowAt(startedAt, endedAt, now) {
  if (now < startedAt) return null;
  const fadeFrom = endedAt === null ? Infinity : Math.max(endedAt, startedAt + JUDGE_RISE_MS);
  if (now < fadeFrom) return judgeGlowSvg("rise", now - startedAt);
  if (now < fadeFrom + JUDGE_FADE_MS) return judgeGlowSvg("fade", now - fadeFrom);
  return null;
}
function coldGlowSvg() {
  const W = AUTO_GLOW_W;
  const H = AUTO_GLOW_H;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>.r{opacity:.15;animation:r ${COLD_GLOW_MS / 1e3}s ease-in-out infinite}@keyframes r{0%,100%{opacity:.15}50%{opacity:.6}}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter></defs><g class="r"><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="none" stroke="${ICE}" stroke-width="4" opacity=".16" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="#cfeeff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`;
}
function autoGlowSvg(on) {
  const W = AUTO_GLOW_W;
  const H = AUTO_GLOW_H;
  const rim = `x="0" y="0" width="${W}" height="${H}" rx="8"`;
  const [wash, line, strength] = on ? [ACCENT, "#b9a7ff", 0.9] : ["#8b8b93", "#c8c8d0", 0.6];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>.r{opacity:0;animation:r ${AUTO_GLOW_MS / 1e3}s ease-in-out}@keyframes r{0%{opacity:0}15%{opacity:${strength}}45%{opacity:${(strength * 0.85).toFixed(2)}}100%{opacity:0}}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter><filter id="s" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation=".8"/></filter></defs><g class="r"><rect ${rim} fill="none" stroke="${wash}" stroke-width="4" opacity=".14" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="${line}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`;
}

// hooks/logic/lens.ts
import { atom, read, update } from "claude-code";

// hooks/model.ts
var MINUTE_MS = 6e4;
var HOUR_MS = 60 * MINUTE_MS;
var DAY_MS = 24 * HOUR_MS;
var RECACHE_MIN_TOKENS = 2e4;
var ttlMs = (ttl) => (ttl === "1h" ? 60 : 5) * MINUTE_MS;
var warnMs = (ttl) => ttlMs(ttl) / 6;
var emptyClock = (ttl) => ({
  ttl,
  lastAt: null,
  read: 0,
  written: 0,
  uncached: 0
});
var remainingMs = (clock, now) => clock.lastAt === null ? null : clock.lastAt + ttlMs(clock.ttl) - now;
var warmth = (clock, now) => {
  const left = remainingMs(clock, now);
  if (left === null) return "uncached";
  if (left <= 0) return "cold";
  return left <= warnMs(clock.ttl) ? "expiring" : "warm";
};
var isRecache = (previous, usage) => previous.lastAt !== null && usage.cache_creation_input_tokens >= RECACHE_MIN_TOKENS && usage.cache_read_input_tokens < usage.cache_creation_input_tokens;
var applyUsage = (usage, at, ttl) => ({
  ttl,
  lastAt: at,
  read: usage.cache_read_input_tokens,
  written: usage.cache_creation_input_tokens,
  uncached: usage.input_tokens
});
var clockTokens = (clock) => clock.read + clock.written + clock.uncached;
var formatTokens = (n) => {
  if (n >= 999500) return `${(n / 1e6).toFixed(n >= 995e4 ? 0 : 1)}M`;
  if (n >= 9950) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
};
var formatRemaining = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1e3));
  if (seconds >= 600) return `${Math.ceil(seconds / 60)}m`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
var formatUntil = (ms) => {
  const left = Math.max(0, ms);
  if (left >= DAY_MS) return `${Math.floor(left / DAY_MS)}d`;
  if (left >= 10 * HOUR_MS) return `${Math.floor(left / HOUR_MS)}h`;
  if (left >= HOUR_MS) return `${Math.floor(left / HOUR_MS)}h${Math.floor(left % HOUR_MS / MINUTE_MS)}m`;
  return `${Math.ceil(left / MINUTE_MS)}m`;
};
var bar = (fraction, width) => {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
};
var resolveTtl = (explicit, fallback) => explicit === "5m" || explicit === "1h" ? explicit : fallback;
var toContextView = (breakdown) => ({
  totalTokens: breakdown.totalTokens,
  maxTokens: breakdown.rawMaxTokens,
  categories: breakdown.categories.filter((c) => c.tokens > 0 && c.kind !== "deferred").map((c) => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind }))
});
var BUFFER_COLOR = "warning";
var stackedBar = (view, used, width) => {
  const max = Math.max(1, view.maxTokens);
  const usedCategories = view.categories.filter((c) => c.kind === "used");
  const estimated = usedCategories.reduce((sum, c) => sum + c.tokens, 0);
  const scale = used !== null && estimated > 0 ? used / estimated : 1;
  const buffer = view.categories.filter((c) => c.kind === "buffer").reduce((sum, c) => sum + c.tokens, 0);
  const bufferCells = Math.min(width, Math.round(buffer / max * width));
  const usable = width - bufferCells;
  const segments = [];
  let tokens2 = 0;
  let end = 0;
  for (const c of usedCategories) {
    tokens2 += c.tokens * scale;
    const next = Math.min(usable, Math.round(tokens2 / max * width));
    if (next > end) segments.push({ kind: "used", color: c.color, cells: next - end });
    end = Math.max(end, next);
  }
  if (usable > end) segments.push({ kind: "free", color: "inactive", cells: usable - end });
  if (bufferCells > 0) segments.push({ kind: "buffer", color: BUFFER_COLOR, cells: bufferCells });
  return segments;
};
var fillBar = (fraction, width) => {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  return [
    { kind: "used", color: fillColor(fraction), cells: filled },
    { kind: "free", color: "inactive", cells: width - filled }
  ];
};
var segmentGlyph = (kind) => kind === "used" ? "█" : "░";
var USAGE_STYLES = ["full", "bar", "percent"];
var SEPARATOR = 3;
var MIN_CTX_BAR = 8;
var MIN_USAGE_BAR = 5;
var usageWindow = (limit, now) => {
  const resetsAt = limit.resetsAt === void 0 ? NaN : Date.parse(limit.resetsAt);
  return {
    label: RATE_LABEL[limit.kind] ?? limit.kind,
    percent: Math.round(limit.percentUsed),
    reset: Number.isNaN(resetsAt) ? null : formatUntil(resetsAt - now)
  };
};
var RATE_LABEL = { five_hour: "5h", seven_day: "7d", spend_limit: "$" };
var usageTextWidth = (w, style) => w.label.length + 1 + (style === "percent" ? 0 : 1) + `${w.percent}%`.length + (style === "full" && w.reset !== null ? 1 + w.reset.length : 0);
var layoutLine = (columns, headWidth, ctxTexts, windows) => {
  for (let n = windows.length; n >= 0; n--) {
    for (const style of USAGE_STYLES) {
      for (const ctxText of ctxTexts) {
        const usageText = windows.slice(0, n).reduce((sum, w) => sum + SEPARATOR + usageTextWidth(w, style), 0);
        const room = columns - headWidth - SEPARATOR - "ctx ".length - 1 - ctxText.length - usageText;
        const bars = style === "percent" ? 0 : n;
        const usageBar = bars === 0 ? 0 : Math.floor(room / 2 / bars);
        const ctxBar = room - usageBar * bars;
        if (ctxBar >= MIN_CTX_BAR && (bars === 0 || usageBar >= MIN_USAGE_BAR)) {
          return { ctxBar, usageBar, ctxText, style, windows: n };
        }
      }
    }
  }
  return { ctxBar: 0, usageBar: 0, ctxText: ctxTexts[ctxTexts.length - 1] ?? "", style: "percent", windows: 0 };
};
var fillColor = (fraction) => {
  if (fraction >= 0.85) return "error";
  if (fraction >= 0.65) return "warning";
  return "success";
};

// hooks/logic/lens.ts
var lensMain = atom({ plugin: "context-lens", key: "lensMain" }, emptyClock("1h"));
var lensAgents = atom({ plugin: "context-lens", key: "lensAgents" }, []);
var lensContext = atom({ plugin: "context-lens", key: "lensContext" }, null);
var lensLiveTokens = atom({ plugin: "context-lens", key: "lensLive" }, null);
var lensRewritten = atom({ plugin: "context-lens", key: "lensRewritten" }, false);
var lensLimits = atom({ plugin: "context-lens", key: "lensLimits" }, []);
var lensNow = atom({ plugin: "context-lens", key: "lensNow" }, 0);
var lastContext = null;
var setLastContext = (value) => {
  lastContext = value;
};
var LENS_TICK_MS = 5e3;
var LENS_WARMTH_COLOR = {
  uncached: "inactive",
  warm: "success",
  expiring: "warning",
  cold: "error"
};
async function cacheTtls($) {
  const [settings, usage, mainEnv, agentEnv, force5m, enable1h] = await Promise.all([
    $.settings.read(),
    $.session.usage(),
    envCacheTtl($),
    envAgentCacheTtl($),
    envForce5m($),
    envEnable1h($)
  ]);
  if (force5m) return { main: "5m", agent: "5m" };
  const isSubscription = usage.rateLimits.length > 0;
  return {
    main: resolveTtl(mainEnv ?? settings.promptCacheTtl, isSubscription ? "1h" : "5m"),
    agent: resolveTtl(agentEnv ?? settings.subagentPromptCacheTtl, enable1h ? "1h" : "5m")
  };
}
async function refreshUsage($) {
  const usage = await $.session.usage({ breakdown: "summary" });
  await update($, lensLiveTokens, () => usage.context.tokens ?? null);
  await update($, lensLimits, () => usage.rateLimits);
  const breakdown = usage.context.breakdown;
  if (breakdown) await update($, lensContext, () => toContextView(breakdown));
}
async function recordRequest($, agentId, usage, ran) {
  const [at, ttls] = await Promise.all([$.clock.now(), cacheTtls($)]);
  if (agentId === void 0) {
    const previous = await read($, lensMain);
    await update($, lensRewritten, () => isRecache(previous, usage) && warmth(previous, at) !== "cold");
    await update($, lensMain, () => applyUsage(usage, at, ttls.main));
    return;
  }
  const known = (await read($, lensAgents)).find((a) => a.id === agentId);
  const info = known ? void 0 : (await $.agent.list()).find((a) => a.id === agentId);
  await update($, lensAgents, (list) => {
    const type = list.find((a) => a.id === agentId)?.type ?? info?.type ?? "agent";
    const next = {
      ...applyUsage(usage, at, ttls.agent),
      id: agentId,
      type,
      ...ran?.model ? { model: ran.model } : {},
      ...ran?.effort ? { effort: ran.effort } : {}
    };
    return [...list.filter((a) => a.id !== agentId), next];
  });
}
async function afterCompaction($) {
  await update($, lensMain, (clock) => emptyClock(clock.ttl));
  await update($, lensRewritten, () => false);
  await refreshUsage($);
}
async function lensTick($) {
  const at = await $.clock.now();
  await update($, lensNow, () => at);
}
async function lensStarted($) {
  const at = await $.clock.now();
  await update($, lensNow, () => at);
  void refreshUsage($).catch(() => void 0);
}

// hooks/logic/alerts.ts
var swamped = atom2({ plugin: "context-lens", key: "swamped" }, null);
var hot = atom2({ plugin: "context-lens", key: "hot" }, null);
var hotHidden = atom2({ plugin: "context-lens", key: "hotHidden" }, null);
var saveUntil = atom2({ plugin: "context-lens", key: "saveUntil" }, null);
async function toggleSave($) {
  const saving = await read2($, saveUntil) !== null;
  const heat = await read2($, hot);
  const until = heat?.resetsAt ? new Date(heat.resetsAt).getTime() : await $.clock.now() + 5 * 36e5;
  await update2($, saveUntil, () => saving ? null : until);
  return saving ? "save mode off" : "save mode on, Auto stays at medium or below until the limit resets";
}
var SWAMP_TOKENS = 15e4;
var SWAMP_REGROW = 5e4;
var HOT_PERCENT = 80;
var HOT_FINAL = 95;
var hotWindow = (heat) => (
  // To the quarter hour: the reset time the app reports can shift by seconds between checks.
  `${heat.kind} ${heat.resetsAt ? Math.round(new Date(heat.resetsAt).getTime() / 9e5) : ""}`
);
function hotVisible(heat, closed) {
  if (!closed || closed.window !== hotWindow(heat)) return true;
  return heat.percent >= HOT_FINAL && closed.percent < HOT_FINAL;
}
var hotClosedLoaded = false;
async function hotClosedNow($) {
  if (!hotClosedLoaded) {
    hotClosedLoaded = true;
    const kept = await $.store.get("hotClosed").catch(() => null);
    if (kept && typeof kept.window === "string") await update2($, hotHidden, () => kept);
  }
  return read2($, hotHidden);
}
async function closeHot($, heat) {
  const closed = { window: hotWindow(heat), percent: heat.percent };
  await update2($, hotHidden, () => closed);
  await $.store.set("hotClosed", closed).catch(() => void 0);
}
async function checkHot($, limits) {
  const windows = limits.filter((l) => l.kind === "five_hour" || l.kind === "seven_day");
  const top = windows.sort((a, b) => b.percentUsed - a.percentUsed)[0];
  const next = top && top.percentUsed >= HOT_PERCENT ? { kind: top.kind, percent: top.percentUsed, resetsAt: top.resetsAt ?? null } : null;
  const was = await read2($, hot);
  if (JSON.stringify(next) !== JSON.stringify(was)) {
    await update2($, hot, () => next);
    $.ui.invalidate("ui.render");
  }
  const until = await read2($, saveUntil);
  if (until !== null && await $.clock.now() >= until) await update2($, saveUntil, () => null);
}
function resetLabel(iso, now) {
  if (!iso) return "";
  const at = new Date(iso);
  const hm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return at.getTime() - now < 20 * 36e5 ? hm : `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][at.getDay()]} ${hm}`;
}
async function previewPercent($) {
  const home = await envUserProfile($) ?? await envHome($);
  if (!home) return void 0;
  const text = await $.fs.read(`${home}/.claude/context-lens-preview.json`).catch(() => "");
  if (!text) return void 0;
  try {
    const n = Number(JSON.parse(text).contextPercent);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : void 0;
  } catch {
    return void 0;
  }
}
async function checkSwamp($) {
  const { context, rateLimits } = await $.session.usage();
  const preview = await previewPercent($);
  const tokens2 = preview === void 0 ? context.tokens ?? 0 : Math.round((context.window || 2e5) * preview / 100);
  const percent = preview ?? (context.percent || (context.window ? tokens2 / context.window * 100 : 0));
  if (preview !== void 0 && !context.window) context.window = 2e5;
  const wasStep = handoffGlowStep(lastContext?.percent ?? 0);
  setLastContext({ tokens: tokens2, window: context.window ?? 0, percent });
  if (handoffGlowStep(percent) !== wasStep) $.ui.invalidate("ui.render");
  await checkHot($, rateLimits ?? []);
  const over = percent >= config.swampAt;
  const next = over ? tokens2 : null;
  if (next !== await read2($, swamped)) {
    await update2($, swamped, () => next);
    $.ui.invalidate("ui.render");
  }
}

// hooks/logic/cache.ts
import { atom as atom8, read as read8, update as update8 } from "claude-code";

// hooks/logic/compact.ts
import { atom as atom5, read as read5, update as update5 } from "claude-code";

// hooks/logic/handoff.ts
import { atom as atom4, read as read4, update as update4 } from "claude-code";

// hooks/logic/judge.ts
import { atom as atom3, read as read3, update as update3 } from "claude-code";
var judgeDown = atom3({ plugin: "context-lens", key: "judgeDown" }, null);
var JUDGE_SYSTEM = `You choose which Claude model and reasoning effort an agentic assistant (it reads files, runs tools and edits things, not only code) should use for the user's next message. Pick the cheapest pair that will still do the job well.

Models, cheapest first:
- haiku: quick questions, lookups, renames, small edits in one or two files, summaries, chit-chat. It can read files and run tools; pick it for any small, well-defined job.
- sonnet: normal coding, edits across a few files, explanations, writing.
- opus: hard debugging, architecture, large refactors, careful reviews.
- fable: the hardest long-horizon or research-level work.

Effort: low for quick answers, medium for normal work, high for hard problems, xhigh or max only for very hard ones.

Effort is relative to the model in use ("Current" names it): a stronger model needs less effort for the same job. Opus at medium does about what Sonnet does at high, and Fable is stronger again. So for one and the same task pick one step lower on Opus than on Sonnet, and lower still on Fable; on Sonnet, go one step higher for hard work than you would on Opus.

Judge the SCOPE and the amount of work, not whether it is code. A short message can ask for a lot: "go through my whole drive and clean it up", "review the entire repo", "migrate everything" are big, multi-step, tool-heavy jobs where mistakes are costly: never low, usually high. Low is only for answers that need no tools and no planning.

If the message answers a question in the assistant's last reply (picks an option, says which one, confirms a plan), judge only the work that answer starts, as the reply describes it, not the length of the answer and not the work done before the question: "B" can mean "build the complicated section B" (high), while "yes" or "no" to one small action ("should I archive this?", "delete the old ones too?") is low, and picking a value for one setting (a log level, a colour, a font) is low. But picking which way to build something ("option 1", "the same shapes", "B") starts that build: judge the build. Approving a whole plan or several steps takes the effort of that plan. A plain "yes", "ok" or "do it" after "Is that OK? Then I'll build X" or "Should I build X?" approves building X: judge X, not the word.

A message that pushes back on, corrects or adds to a plan or claim under discussion continues that work: keep at least the effort that work had, never drop to low for it. Thanks, praise or a closing remark with no new request is low. A question about how to do something, or about effort itself, that needs no tools is low.

If the person asks for deep thought ("think hard", "ultrathink", "be thorough"), pick at least high; if they ask for a quick answer, pick low.

If the message is a short follow-up to ongoing work ("yes", "go", "ok", "continue", or the same in any language), keep the current pair. Thanks or praise with no new request ("ok perfect, thanks") is not a follow-up: it is low and one step.

Steps: how many tool calls and replies the task takes. one: a single command, lookup or plain answer, even when the command acts on several items ("delete those branches", "rename it in this file"). few: a handful of reads or edits. many: a broad search, many files or long multi-step work.

Reply with JSON only: {"model":"haiku|sonnet|opus|fable","effort":"low|medium|high|xhigh|max","steps":"one|few|many","sure":0.0-1.0 how sure you are of the effort,"why":"at most 6 words, in the user's language"}`;
function parseVerdict(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return void 0;
  let raw;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return void 0;
  }
  if (typeof raw !== "object" || raw === null) return void 0;
  const { model: model3, effort, why, sure, steps, handoff } = raw;
  const key = typeof model3 === "string" ? model3.toLowerCase() : "";
  const found = MODELS.find((m) => key === m.key || key === m.id || key.includes(m.key));
  if (!found || !EFFORTS.includes(effort)) return void 0;
  const how = typeof sure === "number" && sure >= 0 && sure <= 1 ? { sure } : {};
  const advice = typeof handoff === "string" && handoff.trim() ? { handoff: handoff.trim().slice(0, 70) } : {};
  return {
    model: found.key,
    effort,
    why: typeof why === "string" ? why.slice(0, 60) : "",
    ...how,
    ...STEPS.includes(steps) ? { steps } : {},
    ...advice
  };
}
async function recentContext($) {
  return contextFrom(await $.session.messages());
}
function contextFrom(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastAssistant = lastAssistantText(messages);
  return [
    lastUser ? `user: ${lastUser.text.slice(0, 400)}` : "",
    lastAssistant ? `assistant: ${lastAssistant.slice(-2e3)}` : ""
  ].filter(Boolean).join("\n");
}
function lastAssistantText(messages) {
  return [...messages].reverse().find((m) => m.role === "assistant" && m.text.trim())?.text ?? "";
}
async function typedSkill($, text) {
  const name = text.trim().slice(1).split(/\s+/)[0];
  if (!name) return void 0;
  const found = (await $.command.list().catch(() => [])).find((c) => c.name === name);
  if (!found || !["user", "plugin", "mcp"].includes(found.source) || found.plugin === "context-lens") return void 0;
  return { name, description: found.description ?? "" };
}
var LEVEL_WORD = "(low|medium|high|xhigh|x-high|extra[- ]high|max|maximum)";
var NAMED_LEVEL = new RegExp(
  `\\b${LEVEL_WORD}\\s+effort\\b|\\beffort(?:\\s+level)?\\s*(?:[:=]|to|at|of|on)?\\s*${LEVEL_WORD}\\b|\\bxhigh\\b`,
  "gi"
);
var LEVEL_OF = {
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  "x-high": "xhigh",
  "extra high": "xhigh",
  "extra-high": "xhigh",
  max: "max",
  maximum: "max"
};
function namedEffort(text) {
  for (const m of text.matchAll(NAMED_LEVEL)) {
    const before = text.slice(Math.max(0, m.index - 20), m.index).toLowerCase();
    if (/\b(not|no|don'?t|never|without|instead of)\b/.test(before)) continue;
    return LEVEL_OF[(m[1] ?? m[2] ?? "xhigh").toLowerCase().replace(/\s+/, " ")];
  }
  return void 0;
}
function isFollowUp(text) {
  const t = text.trim();
  return t.length > 0 && t.length <= 12 && t.split(/\s+/).length <= 2;
}
function endsOnQuestion(context) {
  const reply = context.split("\nassistant: ").pop() ?? "";
  return context.includes("assistant: ") && reply.slice(-400).includes("?");
}
function withAttachments(text, attachments) {
  if (!attachments?.length) return text;
  const counts = /* @__PURE__ */ new Map();
  for (const a of attachments) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  const said = [...counts].map(([type, n]) => `${n} ${type}${n > 1 ? "s" : ""}`).join(", ");
  return `${text}

[The message comes with ${said} to look at.]`;
}
function withMidTurn(text, effort) {
  return `${text}

[Sent while the assistant was still working on the last task at ${effort} effort. If it adds to, corrects or steers that task, keep ${effort}; judge it on its own only if it is a separate new request.]`;
}
var heldPick = null;
var setHeldPick = (value) => {
  heldPick = value;
};
function keepsEffort(message, context) {
  return isFollowUp(message) && !endsOnQuestion(context);
}
function judgeFailure(name, status) {
  if (status === "timeout") return `${name} did not answer in time`;
  if (status === 401 || status === 403) return `${name} was refused (${status}): check your Claude login`;
  if (status === 402) return `${name} is out of credits (${status})`;
  if (status === 429) return `${name} is rate limited (${status})`;
  return `${name} failed (${status})`;
}
var warned = /* @__PURE__ */ new Set();
function warnJudge($, reason) {
  void proof($, `judge fallback: ${reason}`);
  void update3($, judgeDown, () => reason).then(() => $.ui.invalidate("ui.render"));
  if (warned.has(reason)) return;
  warned.add(reason);
  $.ui.toast(`context-lens: ${reason}. The effort stays as it is.`);
}
function judgeQuestion(prompt, current2, context) {
  return [
    current2 ? `Current: ${current2.model} / ${current2.effort}` : "Current: none",
    context ? `Recent conversation:
${context}` : "",
    `Next message:
${prompt.slice(0, 2e3)}`
  ].filter(Boolean).join("\n\n");
}
async function judge($, prompt, current2) {
  const context = await recentContext($).catch(() => "");
  return askHaiku($, prompt, current2, context);
}
async function completeWithHaiku($, request) {
  const named = await $.model.complete({ ...request, model: COMPACT_MODEL });
  return named.isAnswered ? named : $.model.complete({ ...request, model: "haiku" });
}
async function askHaiku($, prompt, current2, context) {
  const used = lastContext && lastContext.window ? `Context used: ${Math.round(lastContext.percent)}% of the window` : "";
  const asked = [judgeQuestion(prompt, current2, context), used].filter(Boolean).join("\n\n");
  const r = await completeWithHaiku($, {
    system: JUDGE_SYSTEM,
    prompt: asked,
    maxTokens: 160,
    effort: "low",
    timeoutMs: 6e3
  });
  const verdict = r.isAnswered ? parseVerdict(r.text) : void 0;
  const tokens2 = r.isAnswered && r.usage ? r.usage.input_tokens + r.usage.output_tokens : 0;
  if (!r.isAnswered && r.reason === "api-error")
    warnJudge($, r.status === null ? "Haiku could not be reached" : judgeFailure("Haiku", r.status));
  else if (r.isAnswered && verdict && await read3($, judgeDown)) await update3($, judgeDown, () => null);
  return { verdict: verdict && { ...verdict, by: "haiku" }, tokens: tokens2 };
}
function tipped(effort, sure, bias) {
  if (!bias || sure === void 0 || sure >= (Math.abs(bias) === 1 ? 0.65 : 0.85)) return effort;
  const i = Math.max(0, Math.min(EFFORTS.length - 1, EFFORTS.indexOf(effort) + Math.sign(bias)));
  return EFFORTS[i];
}
function bounded(effort, floor, ceiling) {
  const lo = EFFORTS.indexOf(floor);
  const hi = Math.max(lo, EFFORTS.indexOf(ceiling));
  return EFFORTS[Math.max(lo, Math.min(hi, EFFORTS.indexOf(effort)))];
}
function capped(effort, saving) {
  return saving && EFFORTS.indexOf(effort) > EFFORTS.indexOf("medium") ? "medium" : effort;
}
function drawGlowSteps($, from, span) {
  for (let at = Math.max(0, from); at <= from + span + JUDGE_STEP_MS; at += JUDGE_STEP_MS)
    $.clock.after(at + 5, () => $.ui.invalidate("ui.render"));
}
var judgeStartedAt = 0;
var setJudgeStartedAt = (value) => {
  judgeStartedAt = value;
};
var judgeEndedAt = 0;
var setJudgeEndedAt = (value) => {
  judgeEndedAt = value;
};
async function endJudgeGlow($, why) {
  if (judgeEndedAt !== null) return;
  judgeEndedAt = await $.clock.now().catch(() => Date.now());
  const fadeAt = Math.max(judgeEndedAt, judgeStartedAt + JUDGE_RISE_MS) - judgeEndedAt;
  renderLog.push(
    `${(/* @__PURE__ */ new Date()).toISOString()} ${loadedSession} glow: ${why} ${judgeEndedAt - judgeStartedAt} ms after start, fade in ${fadeAt} ms`
  );
  drawGlowSteps($, fadeAt, JUDGE_FADE_MS);
  $.ui.invalidate("ui.render");
}

// hooks/logic/handoff.ts
var cacheLeft = atom4({ plugin: "context-lens", key: "cacheLeft" }, null);
var handoffStage = atom4({ plugin: "context-lens", key: "handoffStage" }, null);
var handoffPick = atom4({ plugin: "context-lens", key: "handoffPick" }, null);
var handoffAdvice = atom4({ plugin: "context-lens", key: "handoffAdvice" }, null);
var handoffCard = atom4({ plugin: "context-lens", key: "handoffCard" }, null);
var cardRunning = (kind) => kind === "writing" || kind === "compacting";
var cardLanded = (kind) => kind === "done" || kind === "compacted";
var HANDOFF_CARD_MS = 2 * 6e4;
async function setHandoffCard($, kind, full, seen = false) {
  const at = await $.clock.now();
  await update4($, handoffAdvice, () => null);
  await update4($, handoffCard, () => ({ kind, full, at, seen }));
  if (!cardRunning(kind)) {
    try {
      $.clock.after(HANDOFF_CARD_MS, () => void update4($, handoffCard, (card) => card && card.at === at ? null : card));
    } catch {
    }
  }
}
var HANDOFF_CHECK_FROM = 30;
var HANDOFF_CHECK_EVERY = 2;
var HANDOFF_SYSTEM = `You decide whether the person should hand off now: start a fresh chat that carries over a short summary, instead of carrying on in this one. You are shown what the chat was for, the trail of what the person asked, the last turns, the next message, how full the context is and whether the cache is cold.

Say yes only for a clear reason: the task just finished and the next message is something else, the topic has changed so the old context is dead weight, the chat keeps going in circles on the same problem, or a long chat now holds so much unrelated history that a clean start would be sharper. A normal next step of the same work is never a reason, a long chat by itself is not one, and neither is a high context share when the work is going well. When unsure, say no: a wrong yes costs the person more than a missed one.

Reply with JSON only: {"handoff":"reason of at most 8 words, in the person's language"} for yes, or {"handoff":null} for no.`;
function handoffEvidence(messages, next, percent, cold) {
  const asked = messages.filter((m) => m.role === "user" && m.text.trim());
  const first = asked[0]?.text.slice(0, 500) ?? "";
  const trail = asked.slice(-8, -1).map((m) => `- ${m.text.slice(0, 160).replace(/\s+/g, " ")}`);
  const reply = lastAssistantText(messages).slice(-700);
  return [
    first ? `What the chat was for (first message):
${first}` : "",
    trail.length ? `Trail of earlier messages:
${trail.join("\n")}` : "",
    reply ? `The assistant's last reply (its end):
${reply}` : "",
    `Next message:
${next.slice(0, 600)}`,
    `Context used: ${Math.round(percent)}% of the window; ${asked.length} messages so far; the cache is ${cold ? "cold" : "warm"}.`
  ].filter(Boolean).join("\n\n");
}
function parseHandoffAnswer(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const { handoff } = JSON.parse(match[0]);
    return typeof handoff === "string" && handoff.trim() ? handoff.trim().slice(0, 70) : null;
  } catch {
    return null;
  }
}
var promptsSinceHandoffCheck = 0;
async function checkHandoff($, next) {
  const percent = lastContext?.percent ?? 0;
  if (percent < HANDOFF_CHECK_FROM) {
    promptsSinceHandoffCheck = 0;
    if (await read4($, handoffAdvice) !== null) {
      await update4($, handoffAdvice, () => null);
      $.ui.invalidate("ui.render");
    }
    return;
  }
  promptsSinceHandoffCheck++;
  if (promptsSinceHandoffCheck < HANDOFF_CHECK_EVERY) return;
  promptsSinceHandoffCheck = 0;
  try {
    const evidence = handoffEvidence(
      await $.session.messages(),
      next,
      percent,
      await cacheMinutes($) === 0 && cacheExpires > 0
    );
    const r = await completeWithHaiku($, {
      system: HANDOFF_SYSTEM,
      prompt: evidence,
      maxTokens: 60,
      effort: "low",
      timeoutMs: 8e3
    });
    if (!r.isAnswered) return;
    const reason = parseHandoffAnswer(r.text);
    void proof($, `handoff check at ${Math.round(percent)}%: ${reason ?? "no"}`);
    if (reason !== await read4($, handoffAdvice)) {
      await update4($, handoffAdvice, () => reason);
      $.ui.invalidate("ui.render");
    }
  } catch {
  }
}
var HANDOFF_PROMPT = [
  "Write a handoff so this work can continue in a fresh chat that has no other context.",
  "",
  "Start with the project, its folder and the branch. Then:",
  "- Goal: one or two lines.",
  "- Done: what changed, with file paths, and how each change was checked. Never present something planned, skipped or untested as done.",
  "- Not done: what is half done, and the concrete blocker (a failed check, a missing approval, an open question).",
  '- Git: local changes, local commits, pushed commits and open PRs, as last seen in this chat. You cannot check now, so say "as of last check".',
  '- Next steps in priority order. Make the first one runnable: a file path, a command or a specific decision. Mark every step that needs the user with "needs user".',
  "- To resume: the start command, the preview URL, and the limits on what is allowed (what needs the user's approval, test vs production).",
  "- Do not redo: decisions made and why, approaches that failed.",
  "",
  "Give only the final state of anything that changed during the chat. Point to specs, plans and files instead of copying them. Leave out what is finished and no longer matters. Never include secrets, environment values or raw logs. Write in the language the user writes in. Short bullets, at most about 40 lines. Do not use tools. Reply with the handoff only, no preamble or farewell."
].join("\n");
var HANDOFF_FULL_PROMPT = [
  "Write a handoff so this work can continue in a fresh chat that has no other context. You may use tools for this.",
  "",
  "1. Check the real state: git status, the last few commits, whether the branch is pushed, open PRs if gh is set up.",
  "2. Rewrite HANDOFF.md in the project root from scratch (keep it under 80 lines): branch and open PRs, what is half done,",
  "   next steps with the first one runnable, what only the user can do, and pointers to specs, plans and files.",
  "   Never put secrets or environment values in it.",
  "3. Reply with the handoff itself, in the same shape:",
  "",
  HANDOFF_PROMPT.split("\n").slice(2).join("\n").replace("Do not use tools. ", "")
].join("\n");
function handoffMessage(handoff, after, skill) {
  const ask = after === "confirm" ? "Read this, say in two lines where things stand and what is next, then wait for me." : 'Continue with the next step. If it is marked "needs user", say what you need and wait.';
  if (skill)
    return `Handoff from the previous chat: it ran /${skill}, which saved the handoff. Its last words there:

${handoff.trim()}

First read the handoff /${skill} saved: the files named above, or HANDOFF.md in the project if none is named. ${ask}`;
  return `Handoff from the previous chat:

${handoff.trim()}

${ask}`;
}
var handoffText;
var setHandoffText = (value) => {
  handoffText = value;
};
var handoffDriving = false;
var handoffQueued = false;
var handoffFull = false;
var handoffThen = "continue";
async function startHandoff($, full = false, after = config.handoffAfter) {
  if (await read4($, handoffStage) !== null) return;
  await update4($, handoffStage, () => "writing");
  handoffFull = full;
  handoffThen = after;
  handoffQueued = true;
  await setHandoffCard($, "writing", handoffFull);
}
async function lastHandoffChoice($) {
  const kept = await $.store.get("handoffChoice").catch(() => null);
  const kind = kept?.kind === "full" ? "full" : "quick";
  const after = ["continue", "confirm", "copy"].find((a) => a === kept?.after) ?? config.handoffAfter;
  return { kind, after };
}
async function openHandoffBar($) {
  if (await read4($, handoffStage) !== null) return;
  const choice = await lastHandoffChoice($);
  await update4($, handoffPick, () => choice);
  $.ui.invalidate("ui.render");
}
var COMPACT_BUTTON_MIN_COLUMNS = 80;
async function closeHandoffBar($) {
  await update4($, handoffPick, () => null);
  $.ui.invalidate("ui.render");
}
async function goHandoff($, choice) {
  await $.store.set("handoffChoice", choice).catch(() => void 0);
  await closeHandoffBar($);
  await startHandoff($, choice.kind === "full", choice.after);
}
function handoffWhat(choice, skill) {
  const by = choice.kind === "full" ? skill ? `/${skill}, slower` : "Checks git and saves HANDOFF.md, slower" : "Done in seconds";
  const then = choice.after === "copy" ? "Copied, chat stays." : choice.after === "confirm" ? "Clears chat, then waits." : "Clears chat, carries on.";
  return { by, then };
}
function forkOutcome(result, ms) {
  const took = `${(ms / 1e3).toFixed(1)}s`;
  if (result instanceof Error) return `threw: ${result.message.slice(0, 120)} (${took})`;
  const r = result;
  if (!r || typeof r !== "object" || !("isAnswered" in r)) return `threw: ${String(result).slice(0, 120)} (${took})`;
  if (r.isAnswered) {
    const u = r.usage;
    const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens;
    const cached = input ? Math.round(u.cache_read_input_tokens / input * 100) : 0;
    return r.text.trim() ? `answered, ${u.output_tokens} out, ${cached}% cached (${took})` : `answered with blank text (${took})`;
  }
  if (r.reason === "api-error") return `api-error ${r.status ?? "no response"} ${r.error} (${took})`;
  return `${r.reason} (${took})`;
}
async function writeHandoff($) {
  if (!handoffQueued) return;
  handoffQueued = false;
  try {
    if (handoffFull) {
      if (config.handoffSkill) await $.command.run({ command: config.handoffSkill, args: "" });
      else await $.prompt.submit({ text: HANDOFF_FULL_PROMPT });
      return;
    }
    const now = await $.clock.now().catch(() => Date.now());
    if (await read4($, cacheLeft) === 0 || cacheExpires > 0 && now >= cacheExpires) {
      const messages = await $.session.messages().catch(() => []);
      const got = messages.length ? await haikuHandoff($, messages).catch(() => null) : null;
      await $.store.set("lastFork", {
        at: Date.now(),
        outcome: got ? "cold cache: written by Haiku" : "cold cache: Haiku failed, forked"
      }).catch(() => void 0);
      if (got) {
        handoffText = got;
        return;
      }
    }
    const startedAt = Date.now();
    const forked = await $.model.fork({ prompt: HANDOFF_PROMPT }).catch((error) => error);
    const outcome = forkOutcome(forked, Date.now() - startedAt);
    await $.store.set("lastFork", { at: Date.now(), outcome }).catch(() => void 0);
    const answered = forked;
    if (answered?.isAnswered && answered.text.trim()) {
      handoffText = answered.text;
      return;
    }
    if (!outcome.startsWith("nothing-to-fork"))
      $.ui.toast(`context-lens: the fork wrote no handoff (${outcome}); writing it as a turn`);
    await $.prompt.submit({ text: HANDOFF_PROMPT });
  } catch (error) {
    await update4($, handoffStage, () => null);
    $.ui.toast(
      `context-lens: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`
    );
  }
}
async function finishHandoff($) {
  await writeHandoff($);
  if (handoffText === void 0 || handoffDriving) return;
  handoffDriving = true;
  const text = handoffText;
  handoffText = void 0;
  try {
    if (handoffThen === "copy") {
      const message = handoffMessage(text, "continue", handoffFull ? config.handoffSkill : void 0);
      const copied = await $.ui.copy({ text: message }).catch(() => ({ isCopied: false }));
      await setHandoffCard($, "copied", handoffFull, true);
      if (copied.isCopied) $.ui.toast("context-lens: handoff copied. Paste it into a new chat.");
      else {
        await $.prompt.fill({ text: message, mode: "replace" });
        $.ui.toast("context-lens: the clipboard refused, so the handoff is in the prompt box");
      }
      return;
    }
    await update4($, handoffStage, () => "clearing");
    await $.command.run({ command: "clear", args: "" });
    await setHandoffCard($, "done", handoffFull);
    await $.prompt.submit({ text: handoffMessage(text, handoffThen, handoffFull ? config.handoffSkill : void 0) });
  } catch (error) {
    await update4($, handoffCard, () => null);
    $.ui.toast(
      `context-lens: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`
    );
  } finally {
    handoffDriving = false;
    await update4($, handoffStage, () => null);
  }
}
var handoffTimer;
var setHandoffTimer = (value) => {
  handoffTimer = value;
};
var adviceNow = null;
var setAdviceNow = (value) => {
  adviceNow = value;
};
var HANDOFF_ADVICE_LEVEL = 50;
var handoffLevel = () => adviceNow ? HANDOFF_ADVICE_LEVEL : config.handoffButton === "always" ? HANDOFF_BOX_AT : 0;
var handoffLoud = () => adviceNow !== null;
var handoffSlot = () => handoffLoud() || config.handoffButton === "always";
async function haikuHandoff($, messages) {
  const transcript = fittingTranscript(messages);
  if (transcript === null) return null;
  const r = await $.model.complete({
    model: COMPACT_MODEL,
    system: "You read a conversation between a user and Claude Code, an AI coding agent, and write the handoff the user asks for.",
    prompt: `${transcript}

---
${HANDOFF_PROMPT}`,
    maxTokens: 4e3,
    effort: "medium",
    timeoutMs: 12e4
  });
  return r.isAnswered && r.text.trim().length > 100 ? r.text.trim() : null;
}

// hooks/logic/compact.ts
var compactAsk = atom5({ plugin: "context-lens", key: "compactAsk" }, false);
var handoffCard2 = atom5({ plugin: "context-lens", key: "handoffCard" }, null);
var compactNote = "";
var setCompactNote = (value) => {
  compactNote = value;
};
var compactOpenedAt = 0;
async function openCompact($, e) {
  if (e.surface === "terminal") return compactCold($);
  compactNote = "";
  compactOpenedAt = await $.clock.now();
  await update5($, compactAsk, () => true);
}
var lastHaikuCompact = 0;
var setLastHaikuCompact = (value) => {
  lastHaikuCompact = value;
};
var COMPACT_CARD_MS = 2e4;
var SETTINGS_BODY_H = 56 / 19;
async function compactCard($, working = false) {
  const card = await read5($, handoffCard2);
  if (!card || cardRunning(card.kind)) return card;
  const keep = card.kind === "compacted" ? COMPACT_CARD_MS : HANDOFF_CARD_MS;
  if (working || card.kind === "compacted" && card.seen || await $.clock.now() - card.at >= keep) return null;
  return card;
}
var COMPACT_MODEL = "claude-haiku-5-5";
var COMPACT_MAX_CHARS = 24e5;
var COMPACT_SYSTEM = `You compact a conversation between a user and Claude Code, an AI coding agent, so the work can continue
in a fresh context that holds only your summary. Whoever reads it next knows nothing else about the conversation.

Write a detailed summary with these sections:
1. Primary request and intent: everything the user asked for, in detail, including changes of mind.
2. Key technical concepts: technologies, frameworks, constraints and decisions.
3. Files and code: every file read, created or edited, why it matters, and the important snippets or signatures.
4. Errors and fixes: what went wrong, how it was fixed, and any feedback the user gave about it.
5. Problem solving: what was solved and what is still being worked out.
6. All user messages: every message the user wrote that is not a tool result, briefly and in order.
7. Pending tasks: what the user asked for that is not done.
8. Current work: exactly what was being done right before this summary, with file names and code. The last few
messages come nearly uncut: carry the code and errors from them over in full, since the next step builds on them.
9. Next step: the next step, only if it follows directly from the user's latest request, quoting that request.

Be precise: keep names, paths, numbers, commands and error messages exact. Leave out pleasantries.
Reply with the summary only.`;
var COMPACT_TAIL = 6;
var COMPACT_TAIL_CHARS = 2e4;
function compactTranscript2(messages, toolChars = 2e3, tailChars = COMPACT_TAIL_CHARS) {
  const cut = (s, n) => s.length > n ? `${s.slice(0, n)} …[${s.length - n} more characters]` : s;
  const tailFrom = messages.length - COMPACT_TAIL;
  return messages.map((m, i) => {
    const inTail = i >= tailFrom;
    const inputChars = inTail ? tailChars : 400;
    const resultChars = inTail ? tailChars : toolChars;
    const lines = [`${m.role === "user" ? "USER" : "CLAUDE"}: ${m.text}`.trimEnd()];
    for (const t of m.toolUses ?? []) {
      lines.push(`  [${t.tool} ${cut(JSON.stringify(t.input ?? {}), inputChars)}]`);
      if (t.text) lines.push(`  → ${cut(t.text, resultChars)}`);
    }
    if (!m.toolUses?.length) {
      for (const r of m.toolResults ?? []) if (r.text) lines.push(`  → ${cut(r.text, resultChars)}`);
    }
    return lines.join("\n");
  }).join("\n\n");
}
function fittingTranscript(messages) {
  const full = compactTranscript2(messages);
  if (full.length <= COMPACT_MAX_CHARS) return full;
  const shorter = compactTranscript2(messages, 300, 4e3);
  return shorter.length <= COMPACT_MAX_CHARS ? shorter : null;
}
async function haikuCompaction($, messages, instructions) {
  const transcript = fittingTranscript(messages);
  if (transcript === null) return { fail: "the chat is too long for Haiku" };
  const r = await $.model.complete({
    model: COMPACT_MODEL,
    system: COMPACT_SYSTEM,
    prompt: `${transcript}

---
Write the summary now.${instructions?.trim() ? `
The user asked the summary to keep or stress: ${instructions.trim()}` : ""}`,
    maxTokens: 16e3,
    effort: "medium",
    timeoutMs: 24e4
  });
  if (!r.isAnswered) return { fail: "reason" in r ? String(r.reason) : "no answer" };
  return r.text.trim().length > 200 ? { text: r.text.trim() } : { fail: "the summary came back empty" };
}

// hooks/logic/switching.ts
import { atom as atom7, read as read7, update as update7 } from "claude-code";

// hooks/logic/effort.ts
import { atom as atom6, read as read6, update as update6 } from "claude-code";
var isAuto = atom6({ plugin: "context-lens", key: "isAuto" }, true);
var isAutoModel = atom6({ plugin: "context-lens", key: "isAutoModel" }, false);
var pick = atom6({ plugin: "context-lens", key: "pick" }, null);
var isJudging = atom6({ plugin: "context-lens", key: "isJudging" }, false);
var suggestion = atom6({ plugin: "context-lens", key: "suggestion" }, null);
var appEffort = atom6({ plugin: "context-lens", key: "appEffort" }, null);
var model = atom6({ plugin: "context-lens", key: "model" }, null);
var switched = atom6({ plugin: "context-lens", key: "switched" }, null);
var paused = atom6({ plugin: "context-lens", key: "paused" }, false);
var cacheLeft2 = atom6({ plugin: "context-lens", key: "cacheLeft" }, null);
var isCompacting = atom6({ plugin: "context-lens", key: "isCompacting" }, false);
var SWITCHED_MS = 2500;
async function pickEffort($, level) {
  const t0 = Date.now();
  const inUse = await read6($, model) ?? await sessionModel($);
  const t1 = Date.now();
  await Promise.all([
    update6($, isAuto, () => false),
    $.store.set("isAuto", false),
    choose($, { model: inUse, effort: level, why: "your pick", by: "manual" })
  ]);
  void proof($, `click ${level}: ${Date.now() - t0} ms (read ${t1 - t0}, state ${Date.now() - t1})`);
}
async function toggleAutoEffort($) {
  const turnOn = !await read6($, isAuto);
  await update6($, isAuto, () => turnOn);
  await $.store.set("isAuto", turnOn);
}
async function toggleAutoModel($) {
  const turnOn = !await read6($, isAutoModel);
  await update6($, isAutoModel, () => turnOn);
  await $.store.set("isAutoModel", turnOn);
  if (!turnOn) await update6($, suggestion, () => null);
}
async function choose($, next) {
  setPickCarried(false);
  const before = await read6($, pick);
  await Promise.all([update6($, pick, () => next), $.store.set("pick", next)]);
  if (next && next.by !== "manual" && before && before.effort !== next.effort) {
    const change = { from: before.effort, to: next.effort };
    await update6($, switched, () => change);
    $.clock.after(SWITCHED_MS, () => void update6($, switched, () => null));
  }
}
async function snap($) {
  const [
    auto,
    autoModel,
    current2,
    judging,
    wanted,
    shownByApp,
    modelNow,
    switchedNow,
    pausedNow,
    cacheNow,
    compacting
  ] = await Promise.all([
    read6($, isAuto),
    read6($, isAutoModel),
    read6($, pick),
    read6($, isJudging),
    read6($, suggestion),
    read6($, appEffort),
    read6($, model),
    read6($, switched),
    read6($, paused),
    read6($, cacheLeft2),
    read6($, isCompacting)
  ]);
  return {
    auto,
    autoModel,
    current: current2,
    judging,
    wanted,
    shownByApp,
    modelNow,
    switchedNow,
    pausedNow,
    cacheNow,
    compacting
  };
}
function effortOf(v) {
  if (v.current) return v.current.effort;
  return EFFORTS.includes(v.shownByApp) ? v.shownByApp : void 0;
}

// hooks/logic/switching.ts
var pick2 = atom7({ plugin: "context-lens", key: "pick" }, null);
var suggestion2 = atom7({ plugin: "context-lens", key: "suggestion" }, null);
var model2 = atom7({ plugin: "context-lens", key: "model" }, null);
var paused2 = atom7({ plugin: "context-lens", key: "paused" }, false);
function keyOf(id) {
  return MODELS.find((m) => id.includes(m.key))?.key;
}
async function modelIs($, id) {
  const pause = !cacheSafe(id) && takesEffort(id);
  if (pause !== await read7($, paused2)) await update7($, paused2, () => pause);
  const key = keyOf(id);
  if (!key || key === await read7($, model2)) return;
  await update7($, model2, () => key);
  setEngineEffort(void 0);
  declined = null;
  settleOffer(false);
  const current2 = await read7($, pick2);
  if (current2 && current2.model !== key) await choose($, { ...current2, model: key });
  if (await read7($, suggestion2) === key) await update7($, suggestion2, () => null);
}
async function sessionModel($) {
  return keyOf(await sessionModelId($)) ?? "sonnet";
}
async function sessionModelId($) {
  return sessionPick ? MODELS.find((m) => m.key === sessionPick).id : $.session.model();
}
var declined = null;
var setDeclined = (value) => {
  declined = value;
};
var sessionPick = null;
var setSessionPick = (value) => {
  sessionPick = value;
};
var modelCaches = /* @__PURE__ */ new Map();
var suggestedAs = "switch";
var setSuggestedAs = (value) => {
  suggestedAs = value;
};
function warmTokens(key, now) {
  const cache = modelCaches.get(key);
  return cache && cache.expires > now ? cache.tokens : void 0;
}
function subagentNote(model3) {
  return `

[context-lens, on my behalf: I want a subagent on ${model3} to do this task (Agent tool, model: "${model3}") to save my usage on the chat's model. Delegate it with a complete brief, even if it looks small, then use its result.]`;
}
async function typeCommand($, text) {
  try {
    const draft = (await $.prompt.read()).text.trim();
    if (draft !== "" && draft !== lastTyped) return false;
    const filled = await $.prompt.fill({ text });
    if (filled.isFilled) setLastTyped(text);
    if (filled.isFilled && !toldAboutEnter) {
      setToldAboutEnter(true);
      $.ui.toast(`Press Enter to send ${text} so the app's own control follows`);
    }
    return filled.isFilled;
  } catch {
    return false;
  }
}
var offer = null;
var OFFER_HOLD_MS = 8e3;
function settleOffer(accepted) {
  const open = offer;
  offer = null;
  open?.done(accepted);
}
async function holdForOffer($, model3) {
  settleOffer(false);
  const until = await $.clock.now() + OFFER_HOLD_MS;
  $.ui.invalidate("ui.render");
  return new Promise((resolve) => {
    const timer = $.clock.after(OFFER_HOLD_MS, () => settleOffer(false));
    const tick = $.clock.every(1e3, () => $.ui.invalidate("ui.render"));
    offer = {
      model: model3,
      until,
      done: (accepted) => {
        timer?.cancel?.();
        tick?.cancel?.();
        resolve(accepted);
      }
    };
  });
}
async function switchModel($, model3) {
  try {
    sessionPick = keyOf(await $.session.model()) === model3 ? null : model3;
    await modelIs($, await sessionModelId($));
    $.ui.invalidate("ui.render");
    declined = null;
    await update7($, suggestion2, () => null);
    const current2 = await read7($, pick2);
    if (current2) await choose($, { ...current2, model: model3 });
  } catch {
    $.ui.toast("Could not switch the model right now");
  }
}
var COLD_MIN_TOKENS = 15e4;
var SMALL_CHAT_TOKENS = 2e4;
var INPUT_PRICE = { haiku: 0.1, sonnet: 2, opus: 4, fable: 10 };
var priceOf = (key, tokens2) => key === "haiku" && tokens2 > 1e5 ? 0.5 : INPUT_PRICE[key];
var HAIKU_SWITCH_MAX_TOKENS = 1e5;
var PAYBACK_REQUESTS = 8;
function switchWorth(verdict, inUse, chat) {
  if (verdict === "fable" || verdict === inUse) return null;
  const tokens2 = chat.tokens;
  if (tokens2 === void 0) return "switch";
  if (verdict === "haiku" && tokens2 > HAIKU_SWITCH_MAX_TOKENS) return "subagent";
  const write = chat.ttl === "5m" ? WEIGHT.write : WEIGHT.write1h;
  const writtenStay = chat.cold ? tokens2 : 0;
  const writtenGo = Math.max(0, tokens2 - Math.min(tokens2, chat.warm ?? 0));
  if (writtenGo - writtenStay <= SMALL_CHAT_TOKENS) return "switch";
  const rank = (k) => MODELS.findIndex((m) => m.key === k);
  if (rank(verdict) > rank(inUse)) return "subagent";
  const stay = (writtenStay * write + (tokens2 - writtenStay) * WEIGHT.read) * priceOf(inUse, tokens2);
  const go = (writtenGo * write + (tokens2 - writtenGo) * WEIGHT.read) * priceOf(verdict, tokens2);
  const gain = tokens2 * WEIGHT.read * (priceOf(inUse, tokens2) - priceOf(verdict, tokens2));
  return go - stay <= PAYBACK_REQUESTS * gain ? "switch" : "subagent";
}
var STEP_REQUESTS = { one: 1, few: 4, many: 12 };
var SUBAGENT_START_TOKENS = 15e3;
function subagentPays(verdict, inUse, task) {
  const byEffort = task.effort === "low" ? "one" : task.effort === "medium" ? "few" : "many";
  const steps = STEPS[Math.min(STEPS.indexOf(task.steps ?? byEffort), STEPS.indexOf(byEffort))];
  if (steps === "one") return false;
  const rank = (k) => MODELS.findIndex((m) => m.key === k);
  if (rank(verdict) > rank(inUse)) return true;
  const requests = STEP_REQUESTS[steps];
  const spared = (requests - 1) * task.tokens * WEIGHT.read * priceOf(inUse, task.tokens);
  const started = (SUBAGENT_START_TOKENS * WEIGHT.write + requests * SUBAGENT_START_TOKENS * WEIGHT.read) * priceOf(verdict, SUBAGENT_START_TOKENS);
  return spared > started;
}

// hooks/logic/cache.ts
var cacheLeft3 = atom8({ plugin: "context-lens", key: "cacheLeft" }, null);
var cacheMemo = atom8({ plugin: "context-lens", key: "cacheMemo" }, null);
var isCompacting2 = atom8({ plugin: "context-lens", key: "isCompacting" }, false);
var compactAsk2 = atom8({ plugin: "context-lens", key: "compactAsk" }, false);
var handoffCard3 = atom8({ plugin: "context-lens", key: "handoffCard" }, null);
var isColdHidden = atom8({ plugin: "context-lens", key: "isColdHidden" }, false);
var CACHE_YELLOW_MIN = 20;
var CACHE_RED_MIN = 5;
function cacheTtlOf(usage) {
  const c = usage?.cache_creation;
  if ((c?.ephemeral_1h_input_tokens ?? 0) > 0) return "1h";
  if ((c?.ephemeral_5m_input_tokens ?? 0) > 0) return "5m";
  return void 0;
}
function mostlyCached(usage) {
  const u = usage ?? {};
  const read_ = u.cache_read_input_tokens ?? 0;
  const all = read_ + (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  return all > 0 && read_ / all > 0.5;
}
async function coldWorth($) {
  if (await read8($, cacheLeft3) !== 0 || config.hide.includes("cold") || await read8($, isColdHidden)) return null;
  const tokens2 = lastContext?.tokens;
  if (coldForced) return tokens2 ?? 0;
  return tokens2 !== void 0 && tokens2 >= COLD_MIN_TOKENS ? tokens2 : null;
}
function cacheColor(minutesLeft) {
  const shown = minutesLeft - 1;
  if (minutesLeft <= 0) return ICE;
  if (shown > CACHE_YELLOW_MIN) return void 0;
  return shown <= CACHE_RED_MIN ? RED : YELLOW;
}
function cacheLabel(minutesLeft) {
  if (minutesLeft <= 0) return "❄ Cold";
  if (minutesLeft === 1) return "<1m";
  return `${minutesLeft - 1}m`;
}
var cacheTtl = "1h";
var cacheExpires = 0;
var setCacheExpires = (value) => {
  cacheExpires = value;
};
var cacheRestored = false;
async function restoreCache($) {
  if (cacheRestored) return;
  cacheRestored = true;
  const memo2 = await read8($, cacheMemo);
  if (!memo2 || cacheExpires !== 0 || memo2.expires <= 0) {
    if (cacheExpires === 0 && !coldForced)
      $.clock.after(0, () => void update8($, cacheLeft3, (l) => l === 0 && cacheExpires === 0 && !coldForced ? null : l));
    return;
  }
  cacheExpires = memo2.expires;
  cacheTtl = memo2.ttl;
  lastResponseAt = memo2.last;
}
function rememberCache($) {
  return update8($, cacheMemo, () => ({ expires: cacheExpires, ttl: cacheTtl, last: lastResponseAt }));
}
async function showCache($) {
  if (cacheExpires === 0) {
    if (!coldForced && await read8($, cacheLeft3) !== null) {
      await update8($, cacheLeft3, () => null);
      $.ui.invalidate("ui.render");
    }
    return;
  }
  const minutes = await cacheMinutes($);
  const was = await read8($, cacheLeft3);
  if (minutes === was) return;
  await update8($, cacheLeft3, () => minutes);
  if (minutes === 0 !== (was === 0)) $.ui.invalidate("ui.render");
}
async function cacheMinutes($) {
  const left = cacheExpires - await $.clock.now();
  return left <= 0 ? 0 : Math.ceil(left / 6e4);
}
var usageLogged = false;
var lastResponseAt;
var setLastResponseAt = (value) => {
  lastResponseAt = value;
};
var repliesSeen = 0;
async function cacheTouched($, usage) {
  const now = await $.clock.now();
  repliesSeen++;
  if (!usageLogged) {
    usageLogged = true;
    void proof($, `first response usage: ${JSON.stringify(usage)}`);
  }
  const ttl = cacheTtlOf(usage) ?? (lastResponseAt !== void 0 && now - lastResponseAt > CACHE_TTL["5m"] && mostlyCached(usage) ? "1h" : void 0);
  lastResponseAt = now;
  coldForced = false;
  if (ttl && ttl !== cacheTtl && !(ttl === "5m" && cacheTtl === "1h" && mostlyCached(usage))) {
    cacheTtl = ttl;
    void proof($, `cache lifetime ${ttl}`);
  }
  cacheExpires = now + CACHE_TTL[cacheTtl];
  await rememberCache($);
  if (await read8($, isColdHidden)) await update8($, isColdHidden, () => false);
  await showCache($);
}
async function compactCold($, note = "") {
  if (await read8($, isCompacting2)) return;
  await update8($, compactAsk2, () => false);
  await update8($, isCompacting2, () => true);
  await setHandoffCard($, "compacting", false);
  let compacted = false;
  try {
    await $.command.run({ command: "compact", args: note.trim() });
    cacheExpires = 0;
    modelCaches.clear();
    await rememberCache($);
    await update8($, cacheLeft3, () => null);
    compacted = true;
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    void proof($, `compact failed: ${why}`);
    $.ui.toast(`context-lens: compact failed: ${why.slice(0, 140)}`);
  } finally {
    await update8($, isCompacting2, () => false);
    if (compacted) {
      await setHandoffCard($, "compacted", false);
      $.clock.after(COMPACT_CARD_MS + 100, () => $.ui.invalidate("ui.render"));
    } else await update8($, handoffCard3, (card) => card?.kind === "compacting" ? null : card);
  }
}
var coldForced = false;
var setColdForced = (value) => {
  coldForced = value;
};

// hooks/logic/settings.ts
import { atom as atom10, read as read10, update as update10 } from "claude-code";

// hooks/logic/setup.ts
import { atom as atom9, read as read9, update as update9 } from "claude-code";
var setupPending = atom9({ plugin: "context-lens", key: "setupPending" }, false);
var setupStep = atom9({ plugin: "context-lens", key: "setupStep" }, null);
var setupDraft = atom9({ plugin: "context-lens", key: "setupDraft" }, {});
var LEAN_STOPS = [
  ["Cheapest", "more picks go lower"],
  ["Cheaper", "unsure picks go lower"],
  ["Balanced", "the judge decides"],
  ["Smarter", "unsure picks go higher"],
  ["Smartest", "more picks go higher"]
];
function setupNext(step) {
  if (step === "lean") return "handoff";
  if (step === "handoff") return "look";
  if (step === "look") return "done";
  return null;
}
function setupBack(step) {
  if (step === "handoff") return "lean";
  if (step === "look") return "handoff";
  if (step === "done") return "look";
  return null;
}
function setupCounter(step) {
  const n = { lean: 1, handoff: 2, look: 3, done: 0 }[step];
  return n ? `${n}/3` : "";
}
async function goSetup($, step) {
  if (step === "handoff") await loadInstalledSkills($);
  await update9($, setupStep, () => step);
}
function setupShown(draft, saved5) {
  return {
    bias: draft.bias !== void 0 ? Number(draft.bias) : saved5.bias,
    handoffSkill: draft.handoffSkill ?? saved5.handoffSkill,
    hide: (draft.hide ?? saved5.hide.join(",")).split(",").filter(Boolean),
    appearance: draft.appearance ?? saved5.appearance
  };
}
async function flushSetup($) {
  const draft = await read9($, setupDraft);
  await update9($, setupDraft, () => ({}));
  const saved5 = {
    bias: String(config.bias),
    handoffSkill: config.handoffSkill,
    hide: config.hide.join(","),
    appearance: config.appearance
  };
  const changes = {};
  for (const field of ["hide", "bias", "handoffSkill", "appearance"]) {
    const value = draft[field];
    if (value !== void 0 && value.trim() !== saved5[field]) changes[field] = value.trim();
  }
  await $.store.set("setupSave", changes);
  await drainSetupSave($);
}
var drainingSetup = false;
async function drainSetupSave($) {
  if (drainingSetup) return;
  drainingSetup = true;
  try {
    for (; ; ) {
      const queue = await $.store.get("setupSave").catch(() => null) ?? {};
      const [field] = Object.keys(queue);
      if (!field) return;
      const { [field]: value, ...rest } = queue;
      await $.store.set("setupSave", Object.keys(rest).length ? rest : null);
      if (field in SETTING_FIELDS && value !== void 0)
        await saveSetting($, field, value);
    }
  } finally {
    drainingSetup = false;
  }
}
async function markSetupDone($) {
  await Promise.all([update9($, setupPending, () => false), $.store.set("setupDone", true)]);
}
async function closeSetup($) {
  await markSetupDone($);
  await goSetup($, null);
  await flushSetup($);
}

// hooks/logic/settings.ts
var settingsOpen = atom10({ plugin: "context-lens", key: "settingsOpen" }, false);
var installedSkills = atom10({ plugin: "context-lens", key: "installedSkills" }, []);
var settingsDraft = atom10({ plugin: "context-lens", key: "settingsDraft" }, {});
async function loadInstalledSkills($) {
  const installed = await $.command.list().catch(() => []);
  const names = [...new Set(installed.filter((c) => c.source === "user" || c.source === "plugin").map((c) => c.name))].filter((name) => !name.startsWith("context-lens")).sort((a, b) => Number(!/handoff/i.test(a)) - Number(!/handoff/i.test(b)) || a.localeCompare(b)).slice(0, 25);
  await update10($, installedSkills, () => names);
}
async function openPluginSettings($) {
  await loadInstalledSkills($);
  await update10($, settingsOpen, () => true);
  await $.store.set("openSettingsAt", { at: Date.now(), session: await $.session.id().catch(() => "") });
  $.ui.invalidate("ui.render");
}
var SETTING_FIELDS = {
  bias: "effortBias",
  floor: "effortFloor",
  ceiling: "effortCeiling",
  handoffAfter: "handoffAfter",
  handoffSkill: "handoffSkill",
  hide: "hide",
  swampAt: "swampAt",
  layout: "layout",
  compactWith: "compactWith",
  handoffButton: "handoffButton",
  subagents: "subagents",
  subagentModel: "subagentModel",
  overrideDefinitions: "overrideDefinitions",
  holdOffer: "holdOffer",
  theme: "theme",
  appearance: "appearance"
};
async function saveSetting($, field, value) {
  const { deny } = await $.config.set({ key: `context-lens.${SETTING_FIELDS[field]}`, value }).catch((error) => ({ deny: error instanceof Error ? error.message : String(error) }));
  const kept = await $.store.get("savedSettings").catch(() => null) ?? {};
  const { [SETTING_FIELDS[field]]: _old, ...others } = kept;
  const stored = await $.store.set("savedSettings", deny ? { ...kept, [SETTING_FIELDS[field]]: value } : others).then(() => true).catch(() => false);
  if (deny && !stored) $.ui.toast(`context-lens: could not save ${field}: ${String(deny).slice(0, 120)}`);
  const raw = {
    effortBias: String(config.bias),
    effortFloor: config.floor,
    effortCeiling: config.ceiling,
    handoffAfter: config.handoffAfter,
    handoffSkill: config.handoffSkill,
    hide: config.hide.join(","),
    swampAt: String(config.swampAt),
    layout: config.layout,
    compactWith: config.compactWith,
    handoffButton: config.handoffButton,
    subagents: config.subagents,
    subagentModel: config.subagentModel,
    overrideDefinitions: config.overrideDefinitions,
    holdOffer: config.holdOffer,
    theme: config.theme,
    appearance: config.appearance,
    [SETTING_FIELDS[field]]: value
  };
  setConfig(readConfig(raw));
  applyTheme();
  $.ui.invalidate("ui.render");
}
var SAVED_CARD_MS = 2500;
var RENAMED_SETTINGS = { helpers: "subagents", helperModel: "subagentModel" };
function renamedSettings(saved5) {
  const carried = {};
  for (const [old, now] of Object.entries(RENAMED_SETTINGS))
    if (typeof saved5[old] === "string" && saved5[now] === void 0) carried[now] = saved5[old];
  return carried;
}
async function carryRenamedSettings($, kept) {
  const configs = (await $.settings.read().catch(() => ({}))).pluginConfigs ?? {};
  const stored = configs[pluginId($)]?.options ?? Object.entries(configs).find(([id]) => id.startsWith("context-lens@"))?.[1]?.options ?? {};
  const carried = renamedSettings({ ...stored, ...kept });
  const oldInStore = Object.keys(RENAMED_SETTINGS).filter((old) => old in kept);
  if (oldInStore.length)
    await $.store.set(
      "savedSettings",
      Object.fromEntries(Object.entries(kept).filter(([key]) => !oldInStore.includes(key)))
    );
  if (!Object.keys(carried).length) return carried;
  const fields = Object.fromEntries(Object.entries(SETTING_FIELDS).map(([field, option]) => [option, field]));
  const queue = await $.store.get("setupSave").catch(() => null) ?? {};
  const queued = Object.fromEntries(Object.entries(carried).map(([option, value]) => [fields[option], value]));
  await $.store.set("setupSave", { ...queued, ...queue });
  void proof($, `settings renamed: ${Object.keys(carried).join(", ")} carried from their old names`);
  return carried;
}
async function saveDraft($) {
  const draft = await read10($, settingsDraft);
  const changes = {};
  for (const field of Object.keys(SETTING_FIELDS)) {
    const value = draft[field];
    if (value !== void 0) changes[field] = value;
  }
  await update10($, settingsDraft, () => ({}));
  await update10($, settingsOpen, () => false);
  await $.store.set("settingsSavedAt", await $.clock.now().catch(() => Date.now()));
  $.ui.invalidate("ui.render");
  await $.store.set("setupSave", changes);
  await drainSetupSave($);
}

// hooks/logic/timers.ts
var CACHE_TICK_MS = 15e3;
var redrawsOwed = 0;
var redrawAskedAt = 0;
var REDRAW_SETTLE_MS = 500;
function redrawSoon(times = 5) {
  redrawsOwed = Math.max(redrawsOwed, times);
  redrawAskedAt = Date.now();
}
var HANDOFF_POLL_MS = 1e3;
var timersFrom = null;
var setTimersFrom = (value) => {
  timersFrom = value;
};
var tickers = [];
var timersScheduled = false;
var setTimersScheduled = (value) => {
  timersScheduled = value;
};
function startTimers($, from) {
  if (timersFrom === "start" || timersFrom === "draw" && from === "draw") return;
  timersFrom = from;
  tickers.forEach((ticker) => ticker.cancel());
  tickers = [
    $.clock.every(CACHE_TICK_MS, () => void showCache($).catch(() => void 0)),
    $.clock.every(CACHE_TICK_MS, () => void checkSwamp($).catch(() => void 0)),
    $.clock.every(LENS_TICK_MS, () => void lensTick($).catch(() => void 0))
  ];
  void checkSwamp($).then(() => $.ui.invalidate("ui.render")).catch(() => void 0);
  handoffTimer?.cancel();
  setHandoffTimer(
    $.clock.every(HANDOFF_POLL_MS, () => {
      if (redrawsOwed > 0) {
        if (lastRenderAt > redrawAskedAt + REDRAW_SETTLE_MS) redrawsOwed = 0;
        else {
          redrawsOwed--;
          $.ui.invalidate("ui.render");
        }
      }
      if (!lastContext || !lastContext.window)
        void checkSwamp($).then(() => lastContext?.window && $.ui.invalidate("ui.render")).catch(() => void 0);
      void writeRenderLog($).catch(() => void 0);
      void finishHandoff($).catch(() => void 0);
    })
  );
}

// hooks/render/alert-bands.tsx
import { atom as atom15, read as read14, update as update14 } from "claude-code";

// hooks/logic/spend.ts
import { atom as atom11, update as update11 } from "claude-code";
var saved = atom11({ plugin: "context-lens", key: "saved" }, EMPTY_SPENT);
var TURN_LINES_KEPT = 200;
var TURN_LINES_SESSIONS = 30;
var storedTurnLines = null;
var withTurnLine = (lines, key, line) => Object.fromEntries([
  ...Object.entries(lines).filter(([k]) => k !== key).slice(1 - TURN_LINES_KEPT),
  [key, line]
]);
async function storedLinesOf($) {
  const session = await $.session.id().catch(() => "");
  if (!session) return {};
  if (storedTurnLines?.session !== session) {
    const all = await $.store.get("turnLines").catch(() => void 0);
    const lines = all && typeof all === "object" ? all[session] : void 0;
    storedTurnLines = { session, lines: lines && typeof lines === "object" ? lines : {} };
  }
  return storedTurnLines.lines;
}
async function storeTurnLine($, key, line) {
  const session = await $.session.id().catch(() => "");
  if (!session) return;
  const lines = withTurnLine(await storedLinesOf($), key, line);
  const all = await $.store.get("turnLines").catch(() => void 0);
  const others = Object.entries(all && typeof all === "object" ? all : {}).filter(([k]) => k !== session).slice(1 - TURN_LINES_SESSIONS);
  await $.store.set("turnLines", Object.fromEntries([...others, [session, lines]]));
  storedTurnLines = { session, lines };
}
var turnCost = 0;
var setTurnCost = (value) => {
  turnCost = value;
};
var ranThisTurn = null;
var setRanThisTurn = (value) => {
  ranThisTurn = value;
};
function asSpent(t) {
  const v = t ?? {};
  const num = (x) => typeof x === "number" && Number.isFinite(x) ? x : 0;
  const judged = v.judge ?? {};
  const ran = v.subagents ?? v.helpers;
  return {
    prompts: num(v.prompts),
    requests: num(v.requests),
    input: num(v.input),
    write: num(v.write),
    writeHour: num(v.writeHour),
    read: num(v.read),
    out: num(v.out),
    byEffort: v.byEffort && typeof v.byEffort === "object" ? v.byEffort : {},
    judge: { haiku: num(judged.haiku), ms: num(judged.ms), tokens: num(judged.tokens) },
    subagents: {
      runs: ran?.runs && typeof ran.runs === "object" ? ran.runs : {},
      requests: num(ran?.requests),
      cost: num(ran?.cost)
    }
  };
}
function turnLineFor(lines, ms) {
  const exact = lines[String(ms)];
  if (exact) return exact;
  let best;
  let gap = 1e3;
  for (const [k, v] of Object.entries(lines)) {
    const d = Math.abs(Number(k) - ms);
    if (d < gap) {
      gap = d;
      best = v;
    }
  }
  return best;
}
function weighted(usage) {
  const written = usage.cache_creation_input_tokens ?? 0;
  const hour = Math.min(written, usage.cache_creation?.ephemeral_1h_input_tokens ?? 0);
  return (usage.input_tokens ?? 0) * WEIGHT.input + hour * WEIGHT.write1h + (written - hour) * WEIGHT.write + (usage.cache_read_input_tokens ?? 0) * WEIGHT.read + (usage.output_tokens ?? 0) * WEIGHT.out;
}
async function tally($, effort, usage) {
  const cached = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const cost = weighted(usage);
  await update11($, saved, (old) => {
    const t = asSpent(old);
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 };
    return {
      ...t,
      requests: t.requests + 1,
      input: t.input + usage.input_tokens,
      write: t.write + write,
      writeHour: t.writeHour + Math.min(write, usage.cache_creation?.ephemeral_1h_input_tokens ?? 0),
      read: t.read + cached,
      out: t.out + usage.output_tokens,
      byEffort: { ...t.byEffort, [effort]: { ...bucket, cost: bucket.cost + cost } }
    };
  });
}
async function countPrompt($, effort, by, ms, judgeTokens) {
  await update11($, saved, (old) => {
    const t = asSpent(old);
    const judged = {
      haiku: t.judge.haiku + (by === "haiku" ? 1 : 0),
      ms: t.judge.ms + ms,
      tokens: t.judge.tokens + judgeTokens
    };
    if (!effort) return { ...t, judge: judged };
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 };
    return {
      ...t,
      judge: judged,
      prompts: t.prompts + 1,
      byEffort: { ...t.byEffort, [effort]: { ...bucket, prompts: bucket.prompts + 1 } }
    };
  });
}
function tokens(n) {
  const v = Math.abs(n);
  const text = v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(v);
  return n < 0 ? `-${text}` : text;
}
var share = (part, whole) => `${Math.round(part / whole * 100)} %`;
function savedText(raw) {
  const t = asSpent(raw);
  const judged = t.judge.haiku;
  const subagentRuns = EFFORTS.reduce((n, e) => n + (t.subagents.runs[e] ?? 0), 0);
  if (t.prompts === 0 && judged === 0 && subagentRuns === 0) return "nothing measured yet";
  const input = t.input * WEIGHT.input;
  const write = t.writeHour * WEIGHT.write1h + (t.write - t.writeHour) * WEIGHT.write;
  const cached = t.read * WEIGHT.read;
  const out = t.out * WEIGHT.out;
  const total = input + write + cached + out;
  const lines = [
    `${t.prompts} prompts, ${t.requests} requests, cost about ${tokens(Math.round(total))} tokens weighted by price` + (total > 0 ? ` (cache reads ${share(cached, total)}, cache writes ${share(write, total)}, output ${share(out, total)})` : "")
  ];
  const per = EFFORTS.filter((e) => t.byEffort[e]?.prompts).map((e) => {
    const b = t.byEffort[e];
    return `${EFFORT_LABELS[e]} ${b.prompts}, average ${tokens(Math.round(b.cost / b.prompts))}`;
  });
  if (per.length) lines.push(`Per prompt: ${per.join("; ")}`);
  if (subagentRuns) {
    const per2 = EFFORTS.filter((e) => t.subagents.runs[e]).map((e) => `${EFFORT_LABELS[e]} ${t.subagents.runs[e]}`);
    lines.push(
      `Subagents: ${subagentRuns} (${per2.join(", ")}), ${t.subagents.requests} requests, cost about ${tokens(Math.round(t.subagents.cost))} tokens`
    );
  }
  if (judged) {
    lines.push(
      `Judge: Haiku ${t.judge.haiku}, average ${Math.round(t.judge.ms / judged)} ms, ${tokens(t.judge.tokens)} tokens in all`
    );
  }
  return lines.join("\n");
}
function kTokens(n) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`;
}

// hooks/svg/controls.ts
function enterSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5V7.2A1.8 1.8 0 0 1 9.7 9H2.8"/><path d="M5.3 6.4 2.7 9l2.6 2.6"/></g></svg>`;
}
var GO_CELLS = 12;
var GO_W = Math.round(GO_CELLS * 7.9);
function goPillSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GO_W}" height="20" viewBox="0 0 ${GO_W} 20"><rect width="${GO_W}" height="20" rx="5" fill="#ffffff"/></svg>`;
}
function ringSvg(percent, color) {
  const p = Math.max(0, Math.min(100, percent));
  const c = 2 * Math.PI * 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="2.2"/><circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${(c * p / 100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 8 8)"/></svg>`;
}
function settingsSvg(color) {
  const step = 2 * Math.PI / 8;
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = i * step;
    const at = (f, r) => `${(7 + r * Math.cos(a + f * step)).toFixed(2)},${(7 + r * Math.sin(a + f * step)).toFixed(2)}`;
    pts.push(at(-0.42, 4.6), at(-0.27, 4.6), at(-0.2, 6.1), at(0.2, 6.1), at(0.27, 4.6), at(0.42, 4.6));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round" shape-rendering="geometricPrecision"><path d="M${pts.join("L")}Z"/><circle cx="7" cy="7" r="2"/></g></svg>`;
}
function rowIconSvg(kind, color) {
  const shapes = {
    // A gauge: an open arc with a needle.
    auto: '<path d="M2.6 10.4A5 5 0 1 1 11.4 10.4"/><path d="M7 8.2L9.6 5.2"/><circle cx="7" cy="8.6" r=".9"/>',
    // Layers: the subagents, stacked.
    subagents: '<path d="M7 2 12.2 4.7 7 7.4 1.8 4.7Z"/><path d="M1.8 7.3 7 10 12.2 7.3"/><path d="M1.8 9.9 7 12.6 12.2 9.9"/>',
    // An arrow into a bar: hand off.
    context: '<path d="M1.8 7H9.4M6.6 4.2L9.4 7L6.6 9.8"/><path d="M11.8 2.6V11.4"/>',
    // A pencil: the look. The tip down left, a line across the ferrule.
    look: '<path d="M9.6 2.1 11.9 4.4 4.9 11.4 2.1 11.9 2.6 9.1Z"/><path d="M8.1 3.6 10.4 5.9"/>',
    // Quick and Full are drawn solid below: an outline at 14 px was too thin to read.
    quick: "",
    full: ""
  }[kind];
  if (kind === "quick" || kind === "full") {
    const solid = kind === "quick" ? (
      // A bolt: the quick handoff, done in seconds.
      "M8.6 1 2.8 8.2H6.6L5.4 13 11.2 5.8H7.4Z"
    ) : (
      // A pen: the full handoff, written out by your skill.
      "M10.2 1.5 12.5 3.8 5.3 11 2.3 11.7 3 8.7ZM9 2.7 11.3 5"
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><path d="${solid}" fill="${color}" stroke="${color}" stroke-width="0.6" stroke-linejoin="round"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision">${shapes}</g></svg>`;
}
function binSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 3.8H11.8M5.4 3.8V2.4H8.6V3.8M3.4 3.8L4 12H10L10.6 3.8M5.9 6V9.8M8.1 6V9.8"/></g></svg>`;
}
function handoffLook(percent, hovered = false) {
  const p = Math.max(hovered ? HANDOFF_BOX_AT : 0, Math.min(HANDOFF_LOUD_AT, Math.round(percent) + (hovered ? 5 : 0)));
  const mix2 = (a, b, k2) => {
    const ch = (hex2, i) => parseInt(hex2.slice(1 + i * 2, 3 + i * 2), 16);
    return `#${[0, 1, 2].map(
      (i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k2).toString(16).padStart(2, "0")
    ).join("")}`;
  };
  if (p <= HANDOFF_BOX_AT) {
    const k2 = p / HANDOFF_BOX_AT;
    return { fill: HOVER_BOX, opacity: k2, edge: mix2(DASH_BG, "#3a3a40", k2), label: mix2(DASH_DIM, "#ececf0", k2) };
  }
  const k = (p - HANDOFF_BOX_AT) / (HANDOFF_LOUD_AT - HANDOFF_BOX_AT);
  return {
    fill: mix2(HOVER_BOX, "#ececf0", k),
    opacity: 1,
    edge: mix2("#3a3a40", "#ffffff", k),
    label: k > 0.45 ? "#141416" : "#ececf0"
  };
}
function handoffPillSvg(percent, hovered = false) {
  const l = handoffLook(percent, hovered);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HANDOFF_PILL_W}" height="${HANDOFF_PILL_H}" viewBox="0 0 ${HANDOFF_PILL_W} ${HANDOFF_PILL_H}"><rect x=".5" y=".5" width="${HANDOFF_PILL_W - 1}" height="${HANDOFF_PILL_H - 1}" rx="6" fill="${l.fill}" fill-opacity="${l.opacity.toFixed(3)}" stroke="${l.edge}" stroke-opacity="${l.opacity.toFixed(3)}"/></svg>`;
}
var AUTO_SLIDE_MS = 260;
function autoSwitchSvg(on, slideMs = null) {
  const slide = slideMs !== null && slideMs < AUTO_SLIDE_MS;
  const t = `${AUTO_SLIDE_MS / 1e3}s cubic-bezier(.3,.7,.2,1)`;
  const css = slide ? `<style>.k{animation:k ${t}}.p{animation:p ${t}}@keyframes k{from{transform:translateX(${on ? -11 : 11}px);fill:${on ? "#8b8b93" : "#ffffff"}}}@keyframes p{from{fill:${on ? "#2c2c31" : ACCENT};stroke:${on ? "#4a4a52" : ACCENT}}}</style>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="15" viewBox="0 0 26 15">${css}<rect class="p" x=".5" y=".5" width="25" height="14" rx="7" fill="${on ? ACCENT : "#2c2c31"}" stroke="${on ? ACCENT : "#4a4a52"}"/><circle class="k" data-keep="1" cx="${on ? 18.5 : 7.5}" cy="7.5" r="5" fill="${on ? "#ffffff" : "#8b8b93"}"/></svg>`;
  return slide ? inPhase(svg, slideMs) : svg;
}
var KIND_CELLS = 9;
var CELL_PX = 7.9;
var KIND_W = Math.round(KIND_CELLS * 2 * CELL_PX);
var KIND_H = 20;
function kindSwitchSvg(kind, slideMs = null) {
  const half = KIND_W / 2;
  const at = (k) => k === "full" ? half + 0.5 : 2;
  const slide = slideMs !== null && slideMs < KIND_SLIDE_DELAY_MS + KIND_SLIDE_MS;
  const from = at(kind === "full" ? "quick" : "full");
  const begin = slideMs === null ? 0 : KIND_SLIDE_DELAY_MS - slideMs;
  const move = slide ? `<animate attributeName="x" from="${from}" to="${at(kind)}" begin="${(begin / 1e3).toFixed(3)}s" dur="${KIND_SLIDE_MS / 1e3}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 .7 .2 1"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${KIND_W}" height="${KIND_H}" viewBox="0 0 ${KIND_W} ${KIND_H}"><rect x=".5" y=".5" width="${KIND_W - 1}" height="${KIND_H - 1}" rx="5.5" fill="#ffffff" fill-opacity=".05" stroke="#ffffff" stroke-opacity=".1"/><rect x="${slide ? from : at(kind)}" y="2" width="${half - 2.5}" height="${KIND_H - 4}" rx="4" data-keep="1" fill="#ececf0">${move}</rect>${slide ? `<!--${kindFlipAt}-->` : ""}</svg>`;
}
var KIND_SLIDE_MS = 300;
var KIND_SLIDE_DELAY_MS = 70;
var kindFlipAt = 0;
var setKindFlipAt = (value) => {
  kindFlipAt = value;
};

// hooks/svg/brand-mark.ts
var MARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><mask id="kem"><path fill="#fff" d="M49.84 12.97 L49.84 13.13 L49.84 13.29 L49.78 13.45 L49.78 13.60 L49.78 13.76 L49.73 13.91 L49.73 14.07 L49.67 14.23 L49.67 14.39 L49.67 14.55 L49.62 14.71 L49.62 14.86 L49.57 15.02 L49.57 15.17 L49.51 15.33 L49.51 15.49 L49.46 15.65 L49.46 15.81 L49.40 15.96 L49.35 16.12 L49.35 16.28 L49.29 16.43 L49.29 16.59 L49.24 16.75 L49.24 16.90 L49.18 17.06 L49.13 17.22 L49.13 17.38 L49.07 17.54 L49.02 17.69 L49.02 17.85 L48.96 18.01 L48.91 18.17 L48.91 18.32 L48.85 18.48 L48.80 18.64 L48.74 18.80 L48.74 18.95 L48.69 19.11 L48.64 19.26 L48.64 19.42 L48.58 19.58 L48.53 19.74 L48.47 19.90 L48.42 20.05 L48.42 20.21 L48.36 20.37 L48.31 20.52 L48.25 20.68 L48.20 20.84 L48.14 20.99 L48.14 21.15 L48.09 21.31 L48.03 21.47 L47.98 21.63 L47.92 21.78 L47.87 21.94 L47.82 22.10 L47.76 22.26 L47.71 22.41 L47.65 22.57 L47.60 22.73 L47.54 22.89 L47.49 23.04 L47.43 23.20 L47.38 23.35 L47.32 23.51 L47.27 23.67 L47.21 23.83 L47.16 23.99 L47.10 24.15 L47.05 24.30 L46.99 24.46 L46.94 24.61 L46.89 24.77 L46.78 24.93 L46.72 25.09 L46.67 25.24 L46.61 25.40 L46.56 25.56 L46.45 25.72 L46.39 25.87 L46.34 26.03 L46.28 26.19 L46.23 26.35 L46.12 26.50 L46.07 26.66 L46.01 26.82 L45.96 26.98 L45.85 27.13 L45.79 27.29 L45.69 27.44 L45.63 27.60 L45.58 27.76 L45.47 27.92 L45.41 28.08 L45.30 28.24 L45.25 28.39 L45.14 28.56 L45.09 28.72 L44.98 28.88 L44.92 29.05 L44.81 29.22 L44.76 29.39 L44.65 29.56 L44.59 29.73 L44.48 29.89 L44.38 30.07 L44.32 30.25 L44.21 30.43 L44.10 30.61 L44.05 30.79 L43.94 30.97 L43.83 31.16 L43.72 31.35 L43.61 31.54 L43.50 31.73 L43.39 31.93 L43.34 32.11 L43.23 32.31 L43.12 32.51 L42.95 32.72 L42.84 32.92 L42.73 33.12 L42.63 33.33 L42.52 33.54 L42.41 33.75 L42.30 33.96 L42.13 34.18 L42.02 34.39 L41.86 34.61 L41.75 34.82 L41.64 35.03 L41.48 35.25 L41.32 35.47 L41.21 35.69 L41.04 35.91 L40.88 36.13 L40.77 36.34 L40.61 36.56 L40.44 36.78 L40.28 37.00 L40.11 37.22 L39.95 37.44 L39.73 37.65 L39.57 37.87 L39.40 38.09 L39.19 38.31 L39.02 38.53 L38.80 38.75 L38.64 38.96 L38.42 39.18 L38.20 39.40 L37.98 39.62 L37.76 39.84 L37.55 40.06 L37.33 40.28 L37.11 40.50 L36.84 40.72 L36.62 40.93 L36.35 41.15 L36.13 41.37 L35.85 41.59 L35.58 41.81 L35.31 42.02 L35.03 42.24 L34.76 42.46 L34.43 42.68 L34.16 42.90 L33.83 43.12 L33.50 43.33 L33.18 43.55 L32.85 43.77 L32.47 43.99 L32.09 44.21 L31.76 44.43 L31.32 44.65 L30.94 44.87 L30.50 45.09 L30.06 45.30 L29.63 45.52 L29.19 45.74 L28.70 45.96 L28.15 46.18 L27.66 46.40 L27.12 46.61 L26.51 46.83 L25.91 47.05 L25.26 47.27 L24.60 47.49 L23.89 47.71 L23.13 47.92 L22.36 48.14 L21.49 48.36 L20.61 48.58 L19.63 48.80 L18.59 49.02 L17.39 49.23 L16.14 49.45 L14.66 49.67 L12.91 49.89 L7.78 50.00 L11.88 50.00 L13.84 50.22 L15.43 50.44 L16.84 50.66 L18.05 50.88 L19.14 51.09 L20.18 51.31 L21.11 51.53 L21.93 51.75 L22.75 51.97 L23.51 52.19 L24.28 52.40 L24.93 52.62 L25.58 52.84 L26.24 53.06 L26.79 53.28 L27.39 53.50 L27.94 53.71 L28.43 53.93 L28.92 54.15 L29.41 54.37 L29.84 54.59 L30.34 54.80 L30.72 55.02 L31.16 55.24 L31.54 55.46 L31.92 55.68 L32.31 55.90 L32.63 56.12 L33.01 56.34 L33.34 56.56 L33.67 56.77 L34.00 56.99 L34.27 57.21 L34.60 57.43 L34.87 57.65 L35.20 57.87 L35.47 58.08 L35.75 58.30 L35.96 58.52 L36.24 58.74 L36.51 58.96 L36.73 59.18 L37.00 59.39 L37.22 59.61 L37.44 59.83 L37.65 60.05 L37.87 60.27 L38.09 60.49 L38.31 60.71 L38.53 60.93 L38.75 61.15 L38.91 61.36 L39.13 61.58 L39.29 61.80 L39.46 62.02 L39.68 62.24 L39.84 62.46 L40.01 62.67 L40.17 62.89 L40.33 63.11 L40.50 63.33 L40.66 63.55 L40.83 63.76 L40.99 63.98 L41.10 64.20 L41.26 64.42 L41.43 64.64 L41.53 64.86 L41.70 65.07 L41.81 65.28 L41.97 65.50 L42.08 65.72 L42.19 65.93 L42.35 66.15 L42.46 66.36 L42.57 66.57 L42.68 66.78 L42.79 66.97 L42.90 67.18 L43.06 67.38 L43.17 67.59 L43.28 67.79 L43.39 67.99 L43.45 68.17 L43.55 68.37 L43.66 68.56 L43.77 68.75 L43.88 68.94 L43.99 69.12 L44.05 69.30 L44.16 69.48 L44.27 69.66 L44.38 69.84 L44.43 70.02 L44.54 70.19 L44.59 70.36 L44.70 70.53 L44.81 70.70 L44.87 70.87 L44.98 71.03 L45.03 71.20 L45.14 71.36 L45.20 71.53 L45.30 71.68 L45.36 71.84 L45.47 72.00 L45.52 72.16 L45.58 72.32 L45.69 72.48 L45.74 72.63 L45.79 72.79 L45.90 72.95 L45.96 73.10 L46.01 73.26 L46.12 73.42 L46.17 73.57 L46.23 73.73 L46.28 73.89 L46.39 74.05 L46.45 74.21 L46.50 74.36 L46.56 74.52 L46.61 74.68 L46.72 74.84 L46.78 74.99 L46.83 75.15 L46.89 75.31 L46.94 75.47 L46.99 75.62 L47.05 75.78 L47.10 75.93 L47.21 76.09 L47.27 76.25 L47.32 76.41 L47.38 76.57 L47.43 76.73 L47.49 76.88 L47.54 77.03 L47.60 77.19 L47.65 77.35 L47.71 77.51 L47.76 77.67 L47.82 77.82 L47.87 77.98 L47.92 78.14 L47.92 78.30 L47.98 78.45 L48.03 78.61 L48.09 78.77 L48.14 78.93 L48.20 79.08 L48.25 79.24 L48.25 79.40 L48.31 79.56 L48.36 79.71 L48.42 79.87 L48.47 80.02 L48.53 80.18 L48.53 80.34 L48.58 80.50 L48.64 80.66 L48.69 80.82 L48.69 80.97 L48.74 81.12 L48.80 81.28 L48.85 81.44 L48.85 81.60 L48.91 81.76 L48.96 81.91 L48.96 82.07 L49.02 82.23 L49.07 82.38 L49.07 82.54 L49.13 82.70 L49.18 82.86 L49.18 83.02 L49.24 83.18 L49.24 83.33 L49.29 83.49 L49.35 83.64 L49.35 83.80 L49.40 83.96 L49.40 84.12 L49.46 84.27 L49.46 84.43 L49.51 84.59 L49.51 84.75 L49.57 84.90 L49.57 85.06 L49.62 85.21 L49.62 85.37 L49.67 85.53 L49.67 85.69 L49.73 85.85 L49.73 86.01 L49.73 86.16 L49.78 86.32 L49.78 86.47 L49.84 86.63 L49.84 86.79 L49.84 86.95 L50.16 87.03 L50.16 86.87 L50.16 86.71 L50.22 86.55 L50.22 86.40 L50.22 86.24 L50.27 86.09 L50.27 85.93 L50.33 85.77 L50.33 85.61 L50.33 85.45 L50.38 85.29 L50.38 85.14 L50.43 84.98 L50.43 84.83 L50.49 84.67 L50.49 84.51 L50.54 84.35 L50.54 84.19 L50.60 84.04 L50.65 83.88 L50.65 83.72 L50.71 83.57 L50.71 83.41 L50.76 83.25 L50.76 83.10 L50.82 82.94 L50.87 82.78 L50.87 82.62 L50.93 82.46 L50.98 82.31 L50.98 82.15 L51.04 81.99 L51.09 81.83 L51.09 81.68 L51.15 81.52 L51.20 81.36 L51.26 81.20 L51.26 81.05 L51.31 80.89 L51.36 80.74 L51.36 80.58 L51.42 80.42 L51.47 80.26 L51.53 80.10 L51.58 79.95 L51.58 79.79 L51.64 79.63 L51.69 79.48 L51.75 79.32 L51.80 79.16 L51.86 79.01 L51.86 78.85 L51.91 78.69 L51.97 78.53 L52.02 78.37 L52.08 78.22 L52.13 78.06 L52.18 77.90 L52.24 77.74 L52.29 77.59 L52.35 77.43 L52.40 77.27 L52.46 77.11 L52.51 76.96 L52.57 76.80 L52.62 76.65 L52.68 76.49 L52.73 76.33 L52.79 76.17 L52.84 76.01 L52.90 75.85 L52.95 75.70 L53.01 75.54 L53.06 75.39 L53.11 75.23 L53.22 75.07 L53.28 74.91 L53.33 74.76 L53.39 74.60 L53.44 74.44 L53.55 74.28 L53.61 74.13 L53.66 73.97 L53.72 73.81 L53.77 73.65 L53.88 73.50 L53.93 73.34 L53.99 73.18 L54.04 73.02 L54.15 72.87 L54.21 72.71 L54.31 72.56 L54.37 72.40 L54.42 72.24 L54.53 72.08 L54.59 71.92 L54.70 71.76 L54.75 71.61 L54.86 71.44 L54.91 71.28 L55.02 71.12 L55.08 70.95 L55.19 70.78 L55.24 70.61 L55.35 70.44 L55.41 70.27 L55.52 70.11 L55.62 69.93 L55.68 69.75 L55.79 69.57 L55.90 69.39 L55.95 69.21 L56.06 69.03 L56.17 68.84 L56.28 68.65 L56.39 68.46 L56.50 68.27 L56.61 68.07 L56.66 67.89 L56.77 67.69 L56.88 67.49 L57.05 67.28 L57.16 67.08 L57.27 66.88 L57.37 66.67 L57.48 66.46 L57.59 66.25 L57.70 66.04 L57.87 65.82 L57.98 65.61 L58.14 65.39 L58.25 65.18 L58.36 64.97 L58.52 64.75 L58.68 64.53 L58.79 64.31 L58.96 64.09 L59.12 63.87 L59.23 63.66 L59.39 63.44 L59.56 63.22 L59.72 63.00 L59.89 62.78 L60.05 62.56 L60.27 62.35 L60.43 62.13 L60.60 61.91 L60.81 61.69 L60.98 61.47 L61.20 61.25 L61.36 61.04 L61.58 60.82 L61.80 60.60 L62.02 60.38 L62.24 60.16 L62.45 59.94 L62.67 59.72 L62.89 59.50 L63.16 59.28 L63.38 59.07 L63.65 58.85 L63.87 58.63 L64.15 58.41 L64.42 58.19 L64.69 57.98 L64.97 57.76 L65.24 57.54 L65.57 57.32 L65.84 57.10 L66.17 56.88 L66.50 56.67 L66.82 56.45 L67.15 56.23 L67.53 56.01 L67.91 55.79 L68.24 55.57 L68.68 55.35 L69.06 55.13 L69.50 54.91 L69.94 54.70 L70.37 54.48 L70.81 54.26 L71.30 54.04 L71.85 53.82 L72.34 53.60 L72.88 53.39 L73.49 53.17 L74.09 52.95 L74.74 52.73 L75.40 52.51 L76.11 52.29 L76.87 52.08 L77.64 51.86 L78.51 51.64 L79.39 51.42 L80.37 51.20 L81.41 50.98 L82.61 50.77 L83.86 50.55 L85.34 50.33 L87.09 50.11 L92.22 50.00 L88.12 50.00 L86.16 49.78 L84.57 49.56 L83.16 49.34 L81.95 49.12 L80.86 48.91 L79.82 48.69 L78.89 48.47 L78.07 48.25 L77.25 48.03 L76.49 47.81 L75.72 47.60 L75.07 47.38 L74.42 47.16 L73.76 46.94 L73.21 46.72 L72.61 46.50 L72.06 46.29 L71.57 46.07 L71.08 45.85 L70.59 45.63 L70.16 45.41 L69.66 45.20 L69.28 44.98 L68.84 44.76 L68.46 44.54 L68.08 44.32 L67.69 44.10 L67.37 43.88 L66.99 43.66 L66.66 43.44 L66.33 43.23 L66.00 43.01 L65.73 42.79 L65.40 42.57 L65.13 42.35 L64.80 42.13 L64.53 41.92 L64.25 41.70 L64.04 41.48 L63.76 41.26 L63.49 41.04 L63.27 40.82 L63.00 40.61 L62.78 40.39 L62.56 40.17 L62.35 39.95 L62.13 39.73 L61.91 39.51 L61.69 39.29 L61.47 39.07 L61.25 38.85 L61.09 38.64 L60.87 38.42 L60.71 38.20 L60.54 37.98 L60.32 37.76 L60.16 37.54 L59.99 37.33 L59.83 37.11 L59.67 36.89 L59.50 36.67 L59.34 36.45 L59.17 36.24 L59.01 36.02 L58.90 35.80 L58.74 35.58 L58.57 35.36 L58.47 35.14 L58.30 34.93 L58.19 34.72 L58.03 34.50 L57.92 34.28 L57.81 34.07 L57.65 33.85 L57.54 33.64 L57.43 33.43 L57.32 33.22 L57.21 33.03 L57.10 32.82 L56.94 32.62 L56.83 32.41 L56.72 32.21 L56.61 32.01 L56.55 31.83 L56.45 31.63 L56.34 31.44 L56.23 31.25 L56.12 31.06 L56.01 30.88 L55.95 30.70 L55.84 30.52 L55.73 30.34 L55.62 30.16 L55.57 29.98 L55.46 29.81 L55.41 29.64 L55.30 29.47 L55.19 29.30 L55.13 29.13 L55.02 28.97 L54.97 28.80 L54.86 28.64 L54.80 28.47 L54.70 28.32 L54.64 28.16 L54.53 28.00 L54.48 27.84 L54.42 27.68 L54.31 27.52 L54.26 27.37 L54.21 27.21 L54.10 27.05 L54.04 26.90 L53.99 26.74 L53.88 26.58 L53.83 26.43 L53.77 26.27 L53.72 26.11 L53.61 25.95 L53.55 25.79 L53.50 25.64 L53.44 25.48 L53.39 25.32 L53.28 25.16 L53.22 25.01 L53.17 24.85 L53.11 24.69 L53.06 24.53 L53.01 24.38 L52.95 24.22 L52.90 24.07 L52.79 23.91 L52.73 23.75 L52.68 23.59 L52.62 23.43 L52.57 23.27 L52.51 23.12 L52.46 22.97 L52.40 22.81 L52.35 22.65 L52.29 22.49 L52.24 22.33 L52.18 22.18 L52.13 22.02 L52.08 21.86 L52.08 21.70 L52.02 21.55 L51.97 21.39 L51.91 21.23 L51.86 21.07 L51.80 20.92 L51.75 20.76 L51.75 20.60 L51.69 20.44 L51.64 20.29 L51.58 20.13 L51.53 19.98 L51.47 19.82 L51.47 19.66 L51.42 19.50 L51.36 19.34 L51.31 19.18 L51.31 19.03 L51.26 18.88 L51.20 18.72 L51.15 18.56 L51.15 18.40 L51.09 18.24 L51.04 18.09 L51.04 17.93 L50.98 17.77 L50.93 17.62 L50.93 17.46 L50.87 17.30 L50.82 17.14 L50.82 16.98 L50.76 16.82 L50.76 16.67 L50.71 16.51 L50.65 16.36 L50.65 16.20 L50.60 16.04 L50.60 15.88 L50.54 15.73 L50.54 15.57 L50.49 15.41 L50.49 15.25 L50.43 15.10 L50.43 14.94 L50.38 14.79 L50.38 14.63 L50.33 14.47 L50.33 14.31 L50.27 14.15 L50.27 13.99 L50.27 13.84 L50.22 13.68 L50.22 13.53 L50.16 13.37 L50.16 13.21 L50.16 13.05"/><path fill="#000" d="M-4.00 78.45 L0.00 75.86 L4.00 73.40 L8.00 71.09 L12.00 68.91 L16.00 66.88 L20.00 64.99 L24.00 63.24 L28.00 61.63 L32.00 60.17 L36.00 58.84 L40.00 57.66 L44.00 56.62 L48.00 55.71 L52.00 54.95 L56.52 54.26 L61.31 53.58 L65.75 52.96 L69.84 52.41 L73.59 51.92 L76.99 51.51 L80.04 51.15 L82.75 50.86 L85.11 50.64 L87.12 50.48 L88.79 50.39 L90.11 50.37 L91.08 50.41 L91.71 50.52 L91.99 50.69 L88.02 51.18 L89.80 54.01 L90.76 54.43 L90.47 54.45 L89.57 54.51 L88.23 54.65 L86.49 54.87 L84.39 55.18 L81.92 55.57 L79.10 56.05 L75.93 56.61 L72.42 57.26 L68.55 57.99 L64.34 58.81 L59.79 59.72 L54.93 60.70 L51.19 61.58 L47.45 62.58 L43.72 63.72 L40.00 64.99 L36.29 66.39 L32.58 67.92 L28.80 69.38 L25.01 70.97 L21.20 72.70 L17.40 74.57 L13.58 76.57 L9.76 78.72 L5.92 81.00 L2.08 83.43"/><path fill="#000" transform="matrix(-1 0 0 -1 100 100)" d="M-4.00 78.45 L0.00 75.86 L4.00 73.40 L8.00 71.09 L12.00 68.91 L16.00 66.88 L20.00 64.99 L24.00 63.24 L28.00 61.63 L32.00 60.17 L36.00 58.84 L40.00 57.66 L44.00 56.62 L48.00 55.71 L52.00 54.95 L56.52 54.26 L61.31 53.58 L65.75 52.96 L69.84 52.41 L73.59 51.92 L76.99 51.51 L80.04 51.15 L82.75 50.86 L85.11 50.64 L87.12 50.48 L88.79 50.39 L90.11 50.37 L91.08 50.41 L91.71 50.52 L91.99 50.69 L88.02 51.18 L89.80 54.01 L90.76 54.43 L90.47 54.45 L89.57 54.51 L88.23 54.65 L86.49 54.87 L84.39 55.18 L81.92 55.57 L79.10 56.05 L75.93 56.61 L72.42 57.26 L68.55 57.99 L64.34 58.81 L59.79 59.72 L54.93 60.70 L51.19 61.58 L47.45 62.58 L43.72 63.72 L40.00 64.99 L36.29 66.39 L32.58 67.92 L28.80 69.38 L25.01 70.97 L21.20 72.70 L17.40 74.57 L13.58 76.57 L9.76 78.72 L5.92 81.00 L2.08 83.43"/></mask><clipPath id="cemt"><path transform="matrix(-1 0 0 -1 100 100)" d="M0.12 84.72 L4.01 82.20 L7.84 79.84 L11.67 77.63 L15.49 75.55 L19.30 73.61 L23.11 71.82 L26.90 70.16 L30.69 68.63 L34.43 67.14 L38.14 65.67 L41.86 64.34 L45.58 63.14 L49.32 62.06 L53.06 61.12 L57.38 60.20 L62.11 59.26 L66.49 58.39 L70.53 57.62 L74.22 56.92 L77.56 56.32 L80.56 55.80 L83.20 55.36 L85.48 55.01 L87.41 54.75 L88.95 54.57 L90.08 54.48 L90.71 54.44 L90.53 54.36 L88.45 52.55 L110 51.18 L110 110 L-10 110Z"/></clipPath><clipPath id="cemb"><path d="M0.12 84.72 L4.01 82.20 L7.84 79.84 L11.67 77.63 L15.49 75.55 L19.30 73.61 L23.11 71.82 L26.90 70.16 L30.69 68.63 L34.43 67.14 L38.14 65.67 L41.86 64.34 L45.58 63.14 L49.32 62.06 L53.06 61.12 L57.38 60.20 L62.11 59.26 L66.49 58.39 L70.53 57.62 L74.22 56.92 L77.56 56.32 L80.56 55.80 L83.20 55.36 L85.48 55.01 L87.41 54.75 L88.95 54.57 L90.08 54.48 L90.71 54.44 L90.53 54.36 L88.45 52.55 L110 51.18 L110 110 L-10 110Z"/></clipPath></defs><g mask="url(#kem)"><rect width="100" height="100" fill="#a79cf7"/><rect width="100" height="100" fill="#cfc7ff" clip-path="url(#cemt)"/><rect width="100" height="100" fill="#7566d8" clip-path="url(#cemb)"/></g></svg>';

// hooks/svg/scenes.ts
var HANDOFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.d{fill:#d9d1ff;opacity:0;animation-name:go;animation-timing-function:ease-in-out;animation-iteration-count:infinite}@keyframes go{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}85%{opacity:.7}100%{opacity:0;transform:translate(190px,0)}}.br{animation:br 2.4s ease-in-out infinite}@keyframes br{0%,100%{opacity:.75}50%{opacity:1}}</style><defs><linearGradient id="bg" x1="0" x2="1"><stop offset=".43" stop-color="#7c6cf0" stop-opacity="0"/><stop offset=".7" stop-color="#7c6cf0" stop-opacity=".2"/><stop offset="1" stop-color="#b3a6ff" stop-opacity=".46"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".07"/></pattern></defs><g mask="url(#m)"><rect class="br" width="360" height="30" fill="url(#bg)"/><circle class="d" cx="170" cy="9.2" r="0.83" style="animation-duration:2.7s;animation-delay:-2.2s"/><circle class="d" cx="170" cy="17.8" r="0.54" style="animation-duration:2.2s;animation-delay:-3.0s"/><circle class="d" cx="170" cy="9.7" r="0.64" style="animation-duration:3.6s;animation-delay:-1.7s"/><circle class="d" cx="170" cy="22.4" r="0.79" style="animation-duration:3.1s;animation-delay:-0.5s"/><circle class="d" cx="170" cy="18.0" r="1.02" style="animation-duration:2.9s;animation-delay:-2.7s"/><circle class="d" cx="170" cy="18.8" r="0.54" style="animation-duration:3.3s;animation-delay:-2.1s"/><circle class="d" cx="170" cy="10.6" r="0.52" style="animation-duration:3.4s;animation-delay:-1.7s"/><circle class="d" cx="170" cy="19.8" r="1.03" style="animation-duration:3.2s;animation-delay:-3.3s"/><circle class="d" cx="170" cy="12.7" r="0.98" style="animation-duration:2.8s;animation-delay:-3.4s"/><circle class="d" cx="170" cy="23.3" r="0.56" style="animation-duration:2.4s;animation-delay:-0.8s"/><circle class="d" cx="170" cy="25.2" r="0.76" style="animation-duration:3.1s;animation-delay:-1.1s"/><circle class="d" cx="170" cy="15.2" r="0.73" style="animation-duration:2.7s;animation-delay:-2.1s"/><circle class="d" cx="170" cy="16.9" r="1.04" style="animation-duration:3.2s;animation-delay:-3.3s"/><circle class="d" cx="170" cy="22.8" r="1.09" style="animation-duration:3.1s;animation-delay:-0.6s"/><rect width="360" height="30" fill="url(#grain)"/></g></svg>`;
var FROST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.f path{stroke:#eaf6ff;stroke-width:.5;stroke-linecap:round;fill:none}.f{transform-box:fill-box;transform-origin:center;animation:spin linear infinite;opacity:.75}@keyframes spin{to{transform:rotate(360deg)}}.fr{stroke:#dff1ff;stroke-width:.4;fill:none;stroke-linecap:round;opacity:.5}.gl{fill:#fff;opacity:0;animation:tw 3.6s ease-in-out infinite}@keyframes tw{0%,70%,100%{opacity:0}80%{opacity:.9}}.br{animation:br 6s ease-in-out infinite}@keyframes br{0%,100%{opacity:.85}50%{opacity:1}}</style><defs><linearGradient id="ice" x1="0" x2="1"><stop offset=".43" stop-color="#5aa9e6" stop-opacity="0"/><stop offset=".62" stop-color="#5aa9e6" stop-opacity=".12"/><stop offset=".85" stop-color="#8fd0ff" stop-opacity=".28"/><stop offset="1" stop-color="#cdeaff" stop-opacity=".42"/></linearGradient><radialGradient id="cold" cx="330" cy="15" r="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e9f6ff" stop-opacity=".22"/><stop offset="1" stop-color="#e9f6ff" stop-opacity="0"/></radialGradient><linearGradient id="rime" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".22" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".15"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".07"/></pattern></defs><g mask="url(#m)"><rect class="br" width="360" height="30" fill="url(#ice)"/><rect width="360" height="30" fill="url(#cold)"/><rect width="360" height="30" fill="url(#rime)"/><rect width="360" height="30" fill="url(#grain)"/><path class="fr" d="M360.0 3.0L354.1 2.1M354.1 2.1L349.8 1.8M349.8 1.8L346.7 2.1M346.7 2.1L344.4 2.2M348.2 1.9L347.5 3.2M351.9 1.9L350.3 3.1M350.3 3.1L349.2 3.8M357.0 2.5L355.1 0.6M355.1 0.6L353.5 -0.5M353.5 -0.5L352.4 -1.4M356.1 1.6L354.9 1.4M360.0 27.0L354.1 27.9M354.1 27.9L349.8 28.5M349.8 28.5L346.9 29.6M346.9 29.6L345.0 30.8M348.3 29.0L347.1 28.4M351.9 28.2L350.9 29.9M350.9 29.9L350.3 31.1M357.0 27.5L355.2 29.4M355.2 29.4L353.9 30.9M353.9 30.9L352.8 31.8M356.1 28.4L354.9 28.5M350.0 30.0L348.8 26.2M348.8 26.2L347.9 23.4M347.9 23.4L347.6 21.4M347.6 21.4L347.7 19.9M348.4 24.8L348.9 23.6M349.4 28.1L350.2 26.5M350.2 26.5L350.8 25.3M352.0 0.0L351.0 3.9M351.0 3.9L350.4 6.7M350.4 6.7L349.6 8.6M349.6 8.6L349.0 10.0M350.7 5.3L349.6 5.9M351.5 1.9L352.2 3.6M352.2 3.6L352.9 4.7"/><circle class="gl" cx="228" cy="26" r="0.5" style="animation-delay:0s"/><circle class="gl" cx="205" cy="4" r="0.45" style="animation-delay:1.3s"/><circle class="gl" cx="186" cy="26" r="0.4" style="animation-delay:2.4s"/><circle class="gl" cx="262" cy="6" r="0.5" style="animation-delay:0.7s"/><circle class="gl" cx="300" cy="25" r="0.45" style="animation-delay:3.1s"/><circle class="gl" cx="330" cy="6" r="0.5" style="animation-delay:1.9s"/><g class="f" style="animation-duration:10s;animation-delay:0s"><path d="M236.0 9.0L236.0 13.2M236.0 10.9L237.0 11.8M236.0 10.9L235.0 11.8M236.0 11.9L236.7 12.6M236.0 11.9L235.3 12.6M236.0 9.0L232.4 11.1M234.4 9.9L234.0 11.2M234.4 9.9L233.1 9.6M233.5 10.5L233.2 11.4M233.5 10.5L232.6 10.2M236.0 9.0L232.4 6.9M234.4 8.1L233.1 8.4M234.4 8.1L234.0 6.8M233.5 7.5L232.6 7.8M233.5 7.5L233.2 6.6M236.0 9.0L236.0 4.8M236.0 7.1L235.0 6.2M236.0 7.1L237.0 6.2M236.0 6.1L235.3 5.4M236.0 6.1L236.7 5.4M236.0 9.0L239.6 6.9M237.6 8.1L238.0 6.8M237.6 8.1L238.9 8.4M238.5 7.5L238.8 6.6M238.5 7.5L239.4 7.8M236.0 9.0L239.6 11.1M237.6 9.9L238.9 9.6M237.6 9.9L238.0 11.2M238.5 10.5L239.4 10.2M238.5 10.5L238.8 11.4"/></g><g class="f" style="animation-duration:12s;animation-delay:-4s"><path d="M214.0 21.0L214.0 24.2M214.0 22.4L214.7 23.2M214.0 22.4L213.3 23.2M214.0 23.2L214.5 23.7M214.0 23.2L213.5 23.7M214.0 21.0L211.2 22.6M212.8 21.7L212.5 22.7M212.8 21.7L211.8 21.5M212.1 22.1L211.9 22.8M212.1 22.1L211.4 21.9M214.0 21.0L211.2 19.4M212.8 20.3L211.8 20.5M212.8 20.3L212.5 19.3M212.1 19.9L211.4 20.1M212.1 19.9L211.9 19.2M214.0 21.0L214.0 17.8M214.0 19.6L213.3 18.8M214.0 19.6L214.7 18.8M214.0 18.8L213.5 18.3M214.0 18.8L214.5 18.3M214.0 21.0L216.8 19.4M215.2 20.3L215.5 19.3M215.2 20.3L216.2 20.5M215.9 19.9L216.1 19.2M215.9 19.9L216.6 20.1M214.0 21.0L216.8 22.6M215.2 21.7L216.2 21.5M215.2 21.7L215.5 22.7M215.9 22.1L216.6 21.9M215.9 22.1L216.1 22.8"/></g><g class="f" style="animation-duration:11s;animation-delay:-7s"><path d="M194.0 8.0L194.0 10.6M194.0 9.2L194.6 9.8M194.0 9.2L193.4 9.8M194.0 9.8L194.4 10.2M194.0 9.8L193.6 10.2M194.0 8.0L191.7 9.3M193.0 8.6L192.8 9.4M193.0 8.6L192.2 8.4M192.4 8.9L192.3 9.5M192.4 8.9L191.9 8.8M194.0 8.0L191.7 6.7M193.0 7.4L192.2 7.6M193.0 7.4L192.8 6.6M192.4 7.1L191.9 7.2M192.4 7.1L192.3 6.5M194.0 8.0L194.0 5.4M194.0 6.8L193.4 6.2M194.0 6.8L194.6 6.2M194.0 6.2L193.6 5.8M194.0 6.2L194.4 5.8M194.0 8.0L196.3 6.7M195.0 7.4L195.2 6.6M195.0 7.4L195.8 7.6M195.6 7.1L195.7 6.5M195.6 7.1L196.1 7.2M194.0 8.0L196.3 9.3M195.0 8.6L195.8 8.4M195.0 8.6L195.2 9.4M195.6 8.9L196.1 8.8M195.6 8.9L195.7 9.5"/></g><g class="f" style="animation-duration:13s;animation-delay:-2s"><path d="M176.0 19.0L176.0 21.2M176.0 20.0L176.5 20.5M176.0 20.0L175.5 20.5M176.0 20.5L176.3 20.9M176.0 20.5L175.7 20.9M176.0 19.0L174.1 20.1M175.1 19.5L175.0 20.2M175.1 19.5L174.5 19.3M174.7 19.8L174.5 20.2M174.7 19.8L174.2 19.6M176.0 19.0L174.1 17.9M175.1 18.5L174.5 18.7M175.1 18.5L175.0 17.8M174.7 18.2L174.2 18.4M174.7 18.2L174.5 17.8M176.0 19.0L176.0 16.8M176.0 18.0L175.5 17.5M176.0 18.0L176.5 17.5M176.0 17.5L175.7 17.1M176.0 17.5L176.3 17.1M176.0 19.0L177.9 17.9M176.9 18.5L177.0 17.8M176.9 18.5L177.5 18.7M177.3 18.2L177.5 17.8M177.3 18.2L177.8 18.4M176.0 19.0L177.9 20.1M176.9 19.5L177.5 19.3M176.9 19.5L177.0 20.2M177.3 19.8L177.8 19.6M177.3 19.8L177.5 20.2"/></g><g class="f" style="animation-duration:14s;animation-delay:-9s"><path d="M252.0 22.0L252.0 24.4M252.0 23.1L252.5 23.6M252.0 23.1L251.5 23.6M252.0 23.7L252.4 24.1M252.0 23.7L251.6 24.1M252.0 22.0L249.9 23.2M251.1 22.5L250.9 23.3M251.1 22.5L250.3 22.3M250.5 22.8L250.4 23.4M250.5 22.8L250.0 22.7M252.0 22.0L249.9 20.8M251.1 21.5L250.3 21.7M251.1 21.5L250.9 20.7M250.5 21.2L250.0 21.3M250.5 21.2L250.4 20.6M252.0 22.0L252.0 19.6M252.0 20.9L251.5 20.4M252.0 20.9L252.5 20.4M252.0 20.3L251.6 19.9M252.0 20.3L252.4 19.9M252.0 22.0L254.1 20.8M252.9 21.5L253.1 20.7M252.9 21.5L253.7 21.7M253.5 21.2L253.6 20.6M253.5 21.2L254.0 21.3M252.0 22.0L254.1 23.2M252.9 22.5L253.7 22.3M252.9 22.5L253.1 23.3M253.5 22.8L254.0 22.7M253.5 22.8L253.6 23.4"/></g></g></svg>`;
var SWAMP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.b{fill:none;stroke:#cfe8b8;stroke-width:.5;opacity:0;animation-name:rise;animation-timing-function:ease-in;animation-iteration-count:infinite}@keyframes rise{0%{opacity:0;transform:translate(0,0)}15%{opacity:.7}80%{opacity:.5}100%{opacity:0;transform:translate(3px,-30px)}}.rp{fill:none;stroke:#a7c98f;stroke-width:.4;stroke-linecap:round;opacity:.25;animation:drift 7s ease-in-out infinite}@keyframes drift{0%,100%{transform:translate(0,0);opacity:.15}50%{transform:translate(4px,0);opacity:.4}}.mk{animation:mk 8s ease-in-out infinite}@keyframes mk{0%,100%{opacity:.85}50%{opacity:1}}</style><defs><linearGradient id="bog" x1="0" x2="1"><stop offset=".43" stop-color="#4f7a3a" stop-opacity="0"/><stop offset=".62" stop-color="#4f7a3a" stop-opacity=".16"/><stop offset=".85" stop-color="#6f9a4f" stop-opacity=".32"/><stop offset="1" stop-color="#9cc27a" stop-opacity=".42"/></linearGradient><linearGradient id="silt" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#2b3a1f" stop-opacity=".18"/><stop offset="1" stop-color="#1c2614" stop-opacity=".45"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".06"/></pattern></defs><g mask="url(#m)"><rect class="mk" width="360" height="30" fill="url(#bog)"/><rect width="360" height="30" fill="url(#silt)"/><rect width="360" height="30" fill="url(#grain)"/><path class="rp" style="animation-delay:-0s" d="M190 22 q6 -2 12 0 t12 0"/><path class="rp" style="animation-delay:-2.5s" d="M226 9 q6 -2 12 0 t12 0"/><path class="rp" style="animation-delay:-5s" d="M250 18 q6 -2 12 0 t12 0"/><path class="rp" style="animation-delay:-1.5s" d="M300 24 q6 -2 12 0 t12 0"/><path class="rp" style="animation-delay:-3.8s" d="M322 7 q6 -2 12 0 t12 0"/><circle class="b" cx="168" cy="32" r="1.6" style="animation-duration:6.5s;animation-delay:-0s"/><circle class="b" cx="182" cy="32" r="1.1" style="animation-duration:8s;animation-delay:-2.1s"/><circle class="b" cx="197" cy="32" r="2.0" style="animation-duration:7s;animation-delay:-4.2s"/><circle class="b" cx="210" cy="32" r="1.3" style="animation-duration:9s;animation-delay:-1.0s"/><circle class="b" cx="224" cy="32" r="1.7" style="animation-duration:7.5s;animation-delay:-3.3s"/><circle class="b" cx="238" cy="32" r="1.0" style="animation-duration:8.5s;animation-delay:-5.1s"/><circle class="b" cx="252" cy="32" r="1.4" style="animation-duration:6.8s;animation-delay:-2.6s"/><circle class="b" cx="176" cy="32" r="0.9" style="animation-duration:9.5s;animation-delay:-6.0s"/><circle class="b" cx="232" cy="32" r="0.8" style="animation-duration:10s;animation-delay:-0.5s"/></g></svg>`;
var EMBER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.s{fill:#ffb06a;opacity:0;animation-name:up;animation-timing-function:ease-out;animation-iteration-count:infinite}@keyframes up{0%{opacity:0;transform:translate(0,0)}12%{opacity:.95}70%{opacity:.6}100%{opacity:0;transform:translate(4px,-30px)}}.br{animation:br 3.4s ease-in-out infinite}@keyframes br{0%,100%{opacity:.8}50%{opacity:1}}.br2{animation:br2 2.2s ease-in-out infinite}@keyframes br2{0%,100%{opacity:.7}40%{opacity:1}70%{opacity:.8}}</style><defs><linearGradient id="heat" x1="0" x2="1"><stop offset=".43" stop-color="#b8461b" stop-opacity="0"/><stop offset=".62" stop-color="#b8461b" stop-opacity=".16"/><stop offset=".85" stop-color="#d9622a" stop-opacity=".32"/><stop offset="1" stop-color="#f08a3c" stop-opacity=".42"/></linearGradient><linearGradient id="glow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#e2581f" stop-opacity=".08"/><stop offset="1" stop-color="#ff7a2e" stop-opacity=".32"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".06"/></pattern></defs><g mask="url(#m)"><rect class="br" width="360" height="30" fill="url(#heat)"/><rect class="br2" width="360" height="30" fill="url(#glow)"/><circle class="s" cx="166" cy="31" r="0.7" style="animation-duration:3.2s;animation-delay:-0s"/><circle class="s" cx="178" cy="31" r="0.5" style="animation-duration:4.1s;animation-delay:-1.2s"/><circle class="s" cx="191" cy="31" r="0.8" style="animation-duration:3.6s;animation-delay:-2.4s"/><circle class="s" cx="203" cy="31" r="0.5" style="animation-duration:4.6s;animation-delay:-0.7s"/><circle class="s" cx="216" cy="31" r="0.7" style="animation-duration:3.9s;animation-delay:-3.0s"/><circle class="s" cx="228" cy="31" r="0.6" style="animation-duration:4.3s;animation-delay:-1.8s"/><circle class="s" cx="241" cy="31" r="0.8" style="animation-duration:3.4s;animation-delay:-0.4s"/><circle class="s" cx="254" cy="31" r="0.5" style="animation-duration:4.8s;animation-delay:-2.9s"/><circle class="s" cx="184" cy="31" r="0.4" style="animation-duration:5.0s;animation-delay:-3.6s"/><circle class="s" cx="236" cy="31" r="0.4" style="animation-duration:4.4s;animation-delay:-2.1s"/><rect width="360" height="30" fill="url(#grain)"/></g></svg>`;
var DOWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.tr{fill:none;stroke:#e6ecf8;stroke-width:.6;stroke-linecap:round;stroke-linejoin:round}.gw{fill:none;stroke:#9fb0d6;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.35}.hd{animation:hd 4.8s linear infinite}@keyframes hd{0%{transform:translate(150px,0)}88%,100%{transform:translate(372px,0)}}.gl{animation:gl 4.8s ease-in-out infinite}@keyframes gl{0%,100%{opacity:.75}50%{opacity:1}}</style><defs><linearGradient id="steel" x1="0" x2="1"><stop offset=".43" stop-color="#5d6a86" stop-opacity="0"/><stop offset=".65" stop-color="#5d6a86" stop-opacity=".16"/><stop offset=".88" stop-color="#7d8aa8" stop-opacity=".32"/><stop offset="1" stop-color="#a3afca" stop-opacity=".42"/></linearGradient><radialGradient id="glow" cx="330" cy="15" r="80" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c4cee6" stop-opacity=".22"/><stop offset="1" stop-color="#8d9ab8" stop-opacity="0"/></radialGradient><pattern id="grid" width="7.5" height="7.5" patternUnits="userSpaceOnUse"><path d="M7.5 0 L0 0 L0 7.5" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width=".25"/></pattern><linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><mask id="sweep"><g class="hd"><rect x="-110" y="0" width="110" height="30" fill="url(#trail)"/></g></mask></defs><g mask="url(#m)"><rect class="gl" width="360" height="30" fill="url(#steel)"/><rect width="360" height="30" fill="url(#glow)"/><rect width="360" height="30" fill="url(#grid)"/><g mask="url(#sweep)"><g transform="translate(0 3.5)"><path class="gw" d="M150 15 L196 15 L196.0 15.0 L199.0 13.8 L202.0 15.0 L204.0 15.0 L205.5 16.5 L208.0 5.0 L210.5 19.0 L212.0 15.0 L216.0 15.0 L220.0 13.0 L224.0 15.0 L238 15 L238.0 15.0 L241.0 14.2 L244.0 15.0 L246.0 15.0 L247.5 16.1 L250.0 8.0 L252.5 17.8 L254.0 15.0 L258.0 15.0 L262.0 13.6 L266.0 15.0 L278 15 L278.0 15.0 L281.0 14.5 L284.0 15.0 L286.0 15.0 L287.5 15.6 L290.0 11.2 L292.5 16.5 L294.0 15.0 L298.0 15.0 L302.0 14.2 L306.0 15.0 L316 15 L316.0 15.0 L319.0 14.9 L322.0 15.0 L324.0 15.0 L325.5 15.2 L328.0 13.8 L330.5 15.5 L332.0 15.0 L336.0 15.0 L340.0 14.8 L344.0 15.0 L360 15"/><path class="tr" d="M150 15 L196 15 L196.0 15.0 L199.0 13.8 L202.0 15.0 L204.0 15.0 L205.5 16.5 L208.0 5.0 L210.5 19.0 L212.0 15.0 L216.0 15.0 L220.0 13.0 L224.0 15.0 L238 15 L238.0 15.0 L241.0 14.2 L244.0 15.0 L246.0 15.0 L247.5 16.1 L250.0 8.0 L252.5 17.8 L254.0 15.0 L258.0 15.0 L262.0 13.6 L266.0 15.0 L278 15 L278.0 15.0 L281.0 14.5 L284.0 15.0 L286.0 15.0 L287.5 15.6 L290.0 11.2 L292.5 16.5 L294.0 15.0 L298.0 15.0 L302.0 14.2 L306.0 15.0 L316 15 L316.0 15.0 L319.0 14.9 L322.0 15.0 L324.0 15.0 L325.5 15.2 L328.0 13.8 L330.5 15.5 L332.0 15.0 L336.0 15.0 L340.0 14.8 L344.0 15.0 L360 15"/></g></g></g></svg>`;
var BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.sp{fill:#fff;opacity:0;transform:scale(0);animation-name:gl;animation-timing-function:ease-in-out;animation-iteration-count:infinite}@keyframes gl{0%,72%,100%{opacity:0;transform:scale(0) rotate(0deg)}82%{opacity:.9;transform:scale(1) rotate(30deg)}92%{opacity:0;transform:scale(.2) rotate(60deg)}}.br{animation:br 6s ease-in-out infinite}@keyframes br{0%,100%{opacity:.85}50%{opacity:1}}</style><defs><linearGradient id="bg" x1="0" x2="1"><stop offset=".43" stop-color="#7c6cf0" stop-opacity="0"/><stop offset=".62" stop-color="#7c6cf0" stop-opacity=".16"/><stop offset=".85" stop-color="#8f7ff0" stop-opacity=".34"/><stop offset="1" stop-color="#b3a6ff" stop-opacity=".48"/></linearGradient><radialGradient id="glow" cx="320" cy="15" r="70" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c9bdff" stop-opacity=".28"/><stop offset="1" stop-color="#9a86ff" stop-opacity="0"/></radialGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".07"/></pattern></defs><g mask="url(#m)"><rect class="br" width="360" height="30" fill="url(#bg)"/><rect width="360" height="30" fill="url(#glow)"/><rect width="360" height="30" fill="url(#grain)"/><line x1="186" y1="32" x2="198" y2="-2" stroke="#fff" stroke-opacity="0.04" stroke-width="3"/><line x1="204" y1="32" x2="216" y2="-2" stroke="#fff" stroke-opacity="0.05" stroke-width="1.2"/><line x1="226" y1="32" x2="238" y2="-2" stroke="#fff" stroke-opacity="0.05" stroke-width="4"/><line x1="262" y1="32" x2="274" y2="-2" stroke="#fff" stroke-opacity="0.04" stroke-width="1.5"/><line x1="290" y1="32" x2="302" y2="-2" stroke="#fff" stroke-opacity="0.05" stroke-width="3"/><line x1="320" y1="32" x2="332" y2="-2" stroke="#fff" stroke-opacity="0.04" stroke-width="1.2"/><path class="sp" style="transform-origin:168px 8px;animation-duration:4.2s;animation-delay:0.3s" d="M168 6.4 L168.34 7.66 L169.6 8 L168.34 8.34 L168 9.6 L167.66 8.34 L166.4 8 L167.66 7.66 Z"/><path class="sp" style="transform-origin:182px 22px;animation-duration:5.1s;animation-delay:2.1s" d="M182 20.7 L182.27 21.73 L183.3 22 L182.27 22.27 L182 23.3 L181.73 22.27 L180.7 22 L181.73 21.73 Z"/><path class="sp" style="transform-origin:196px 6px;animation-duration:3.8s;animation-delay:1.2s" d="M196 4.2 L196.38 5.62 L197.8 6 L196.38 6.38 L196 7.8 L195.62 6.38 L194.2 6 L195.62 5.62 Z"/><path class="sp" style="transform-origin:208px 19px;animation-duration:4.6s;animation-delay:3.4s" d="M208 17.8 L208.25 18.75 L209.2 19 L208.25 19.25 L208 20.2 L207.75 19.25 L206.8 19 L207.75 18.75 Z"/><path class="sp" style="transform-origin:221px 9px;animation-duration:5.4s;animation-delay:0.9s" d="M221 7.5 L221.31 8.69 L222.5 9 L221.31 9.31 L221 10.5 L220.69 9.31 L219.5 9 L220.69 8.69 Z"/><path class="sp" style="transform-origin:232px 23px;animation-duration:4.0s;animation-delay:2.7s" d="M232 21.9 L232.23 22.77 L233.1 23 L232.23 23.23 L232 24.1 L231.77 23.23 L230.9 23 L231.77 22.77 Z"/><path class="sp" style="transform-origin:244px 7px;animation-duration:4.8s;animation-delay:1.8s" d="M244 5.7 L244.27 6.73 L245.3 7 L244.27 7.27 L244 8.3 L243.73 7.27 L242.7 7 L243.73 6.73 Z"/><path class="sp" style="transform-origin:176px 15px;animation-duration:5.8s;animation-delay:4.0s" d="M176 14.0 L176.21 14.79 L177.0 15 L176.21 15.21 L176 16.0 L175.79 15.21 L175.0 15 L175.79 14.79 Z"/><path class="sp" style="transform-origin:214px 26px;animation-duration:4.4s;animation-delay:3.0s" d="M214 25.0 L214.21 25.79 L215.0 26 L214.21 26.21 L214 27.0 L213.79 26.21 L213.0 26 L213.79 25.79 Z"/><path class="sp" style="transform-origin:238px 15px;animation-duration:3.6s;animation-delay:0.1s" d="M238 14.0 L238.21 14.79 L239.0 15 L238.21 15.21 L238 16.0 L237.79 15.21 L237.0 15 L237.79 14.79 Z"/></g></svg>`;
var DASH_SVG = BRAND_SVG.replace(
  /stop-opacity="([0-9.]+)"/g,
  (_m, v) => `stop-opacity="${(Number(v) * 0.4).toFixed(3)}"`
).replace(/#(7c6cf0|8f7ff0|b3a6ff|c9bdff|9a86ff)/g, "#9a9aa2");
var SETTINGS_TITLE = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="28" viewBox="0 0 112 28"><defs><radialGradient id="c" cx="1" cy="1" r=".75" gradientTransform="matrix(.7 0 0 2.3 .3 -1.3)"><stop offset=".35" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient><radialGradient id="s" cx=".9" cy=".85" r=".55" gradientTransform="matrix(.7 0 0 2.3 .27 -1.1)"><stop offset=".4" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="mc"><rect width="112" height="28" fill="url(#c)"/></mask><mask id="ms"><rect width="112" height="28" fill="url(#s)"/></mask><filter id="g" x="-20%" y="-40%" width="140%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="moved"/><feGaussianBlur in="moved" stdDeviation="0.35" result="soft"/><feComponentTransfer in="noise" result="dots"><feFuncA type="discrete" tableValues="0 1 1 1 1"/></feComponentTransfer><feComposite in="soft" in2="dots" operator="in"/></filter></defs><g font-size="21" font-weight="600" letter-spacing="-.5"><text x="1" y="20" fill="#ffffff" mask="url(#mc)">context-lens</text><g mask="url(#ms)"><text x="1" y="20" fill="#ffffff" filter="url(#g)">context-lens</text></g></g></svg>`;
var SETTINGS_MARK = MARK_SVG.replace("<g mask=", '<g opacity=".2" transform="rotate(9 50 50)" mask=');
var DASH_MARK_OFF = MARK_SVG.replace("<g mask=", '<g opacity=".35" mask=');
var DONE_SVG = BRAND_SVG.replace(/#7c6cf0/g, "#2fae62").replace(/#8f7ff0/g, "#3cc472").replace(/#b3a6ff/g, "#7fe0a4").replace(/#c9bdff/g, "#b4f0c8").replace(/#9a86ff/g, "#4fd486").replace(
  "</g></svg>",
  '<path d="M323 15.5 L330 22 L345 7.5" fill="none" stroke="#0c3a20" stroke-opacity=".8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g></svg>'
);
var DONE_MARK_SVG = MARK_SVG.replace(/#7566d8/g, "#2f9a5e").replace(/#a79cf7/g, "#7fe0a4").replace(/#cfc7ff/g, "#c8f4d8");
var INTRO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="240" viewBox="0 0 1600 240" preserveAspectRatio="none"><style>.w{opacity:0;animation:w .7s ease-out}.s{opacity:0;animation:s 1.1s cubic-bezier(.2,.7,.2,1)}@keyframes w{from{opacity:.16}to{opacity:0}}@keyframes s{from{transform:translateX(-520px);opacity:1}80%{opacity:1}to{transform:translateX(1700px);opacity:0}}</style><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#b9a7ff" stop-opacity=".16"/><stop offset=".7" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect class="w" width="1600" height="240" fill="#8b6cff"/><rect class="s" width="480" height="240" fill="url(#g)"/></svg>`;

// hooks/svg/art.ts
var ART_COLUMNS = 16;
var ART_ROWS = 2;
var ART_MIN_WIDTH = 90;
var ART_FRAME_MS = 100;
var MOVING = /* @__PURE__ */ new Set(["cold", "swamp", "hot", "down", "compacting"]);
var hex = (h2) => [parseInt(h2.slice(1, 3), 16), parseInt(h2.slice(3, 5), 16), parseInt(h2.slice(5, 7), 16)];
var mix = (a, b, k) => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k
];
var pack = (c) => (Math.round(c[0]) << 16 | Math.round(c[1]) << 8 | Math.round(c[2])) >>> 0;
var rand = (seed) => {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
var PALETTE = {
  cold: { ground: hex("#0e1820"), deep: hex("#2f5c80"), light: hex("#dff1ff"), glow: hex("#7cc4ff") },
  swamp: { ground: hex("#111710"), deep: hex("#22351c"), light: hex("#cfe8b8"), glow: hex("#a7c98f") },
  hot: { ground: hex("#1a110c"), deep: hex("#b8461b"), light: hex("#ffb06a"), glow: hex("#f08a3c") },
  down: { ground: hex("#12141b"), deep: hex("#39415a"), light: hex("#b4b8c4"), glow: hex("#6b7288") },
  brand: { ground: hex("#15121f"), deep: hex("#4a3f80"), light: hex("#e4dfff"), glow: hex("#a79cf7") },
  // The dashboard's: the brand's sparkles in grey, since it shows all the time.
  calm: { ground: hex("#141416"), deep: hex("#2a2a2f"), light: hex("#d4d4d8"), glow: hex("#6e6e76") },
  compacting: { ground: hex("#15121f"), deep: hex("#4a3f80"), light: hex("#e4dfff"), glow: hex("#a79cf7") },
  done: { ground: hex("#0f1c15"), deep: hex("#2f7a4c"), light: hex("#d8f5e3"), glow: hex("#5ec48a") }
};
var themed = /* @__PURE__ */ new Map();
function paletteOf(kind) {
  const base = PALETTE[kind];
  if (getTheme() === "violet" || kind !== "brand" && kind !== "compacting") return base;
  const key = `${getTheme()}-${kind}`;
  let p = themed.get(key);
  if (!p) {
    const turn = (c) => hex(tintHex(`#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`));
    p = { ground: turn(base.ground), deep: turn(base.deep), light: turn(base.light), glow: turn(base.glow) };
    themed.set(key, p);
  }
  return p;
}
var TICK = [
  [9, 2],
  [10, 3],
  [11, 2],
  [12, 1],
  [13, 0]
];
function artPixel(kind, t, x, y, cols = ART_COLUMNS, rows = ART_ROWS) {
  const p = paletteOf(kind);
  const h2 = rows * 2;
  let c = mix(p.ground, p.deep, y / (h2 - 1) * 0.45);
  if (kind === "cold") {
    if (y === h2 - 1) c = mix(c, p.glow, 0.35 + 0.15 * rand(x));
    for (let i = 0; i < 5; i++) {
      const lane = 4 + Math.floor(rand(i + 1) * (cols - 4));
      const fy = (t / (5 + i) + rand(i + 9) * h2) % (h2 + 1);
      const fx = lane + Math.round(Math.sin(t / 7 + i));
      if (x === fx && y === Math.floor(fy)) c = p.light;
    }
  } else if (kind === "swamp") {
    for (let i = 0; i < 4; i++) {
      const lane = 5 + Math.floor(rand(i + 3) * (cols - 5));
      const by = h2 - 1 - (t / (6 + i * 2) + rand(i + 5) * h2) % (h2 + 1);
      if (x === lane && y === Math.round(by)) c = mix(p.glow, p.light, 1 - by / h2);
    }
  } else if (kind === "hot") {
    if (y === h2 - 1) c = mix(p.deep, p.glow, 0.5 + 0.5 * Math.abs(Math.sin(t / 3 + x)));
    for (let i = 0; i < 5; i++) {
      const lane = 4 + Math.floor(rand(i + 7) * (cols - 4));
      const ey = h2 - 1 - (t / (3 + i) + rand(i + 2) * h2) % h2;
      if (x === lane && y === Math.round(ey) && y < h2 - 1) c = mix(p.light, p.glow, 1 - ey / h2);
    }
  } else if (kind === "down") {
    const pulse = 0.5 + 0.5 * Math.sin(t / 8);
    if (rand(x * 7 + y * 13) > 0.82) c = mix(c, p.light, 0.25 + 0.35 * pulse);
  } else if (kind === "brand" || kind === "calm" || kind === "compacting") {
    if (rand(x * 5 + y * 11 + 3) > 0.84) {
      const twinkle = kind === "compacting" ? 0.5 + 0.5 * Math.sin(t / 2 + x * 1.7 + y) : 0.8;
      c = mix(p.glow, p.light, twinkle);
    }
  } else if (kind === "done") {
    if (TICK.some(([tx, ty]) => tx === x && ty === y)) c = p.light;
  }
  return pack(mix(p.ground, c, Math.min(1, x / 6)));
}
function artFrame(kind, t, cols = ART_COLUMNS, rows = ART_ROWS) {
  const words = new Uint32Array(cols * rows * 3);
  for (let row = 0; row < rows; row++)
    for (let x = 0; x < cols; x++) {
      const i = (row * cols + x) * 3;
      words[i] = 9600;
      words[i + 1] = artPixel(kind, t, x, row * 2, cols, rows);
      words[i + 2] = artPixel(kind, t, x, row * 2 + 1, cols, rows);
    }
  return new Uint8Array(words.buffer).toBase64();
}

// hooks/render/effort-rows.tsx
import { atom as atom13, read as read12, update as update13 } from "claude-code";

// hooks/logic/subagents.ts
import { atom as atom12, read as read11, update as update12 } from "claude-code";
var saved2 = atom12({ plugin: "context-lens", key: "saved" }, EMPTY_SPENT);
var saveUntil2 = atom12({ plugin: "context-lens", key: "saveUntil" }, null);
var subagentSpawns = /* @__PURE__ */ new Map();
var subagentWaiting = [];
var setSubagentWaiting = (value) => {
  subagentWaiting = value;
};
var callEfforts = /* @__PURE__ */ new Set();
var SUBAGENT_MODEL_SURE = 0.65;
function subagentModelFor(wanted, given) {
  if (!wanted || !given || wanted === "fable") return null;
  const rank = (k) => MODELS.findIndex((m) => m.key === k);
  return rank(wanted) < rank(given) ? wanted : null;
}
function subagentQuestion(prompt, type) {
  return `${prompt.slice(0, 4e3)}

[This is the task Claude gave a ${type} subagent, not a message from the person. Judge the effort that subagent needs to do it well.]`;
}
function subagentFloor(floor, ceiling) {
  const i = Math.min(Math.max(EFFORTS.indexOf(floor), EFFORTS.indexOf("medium")), EFFORTS.indexOf(ceiling));
  return EFFORTS[i];
}
async function subagentEffort($, prompt, type) {
  const { verdict } = await judge($, subagentQuestion(prompt, type), null);
  if (!verdict) return null;
  const saving = await read11($, saveUntil2) !== null;
  const leaned = tipped(verdict.effort, verdict.sure, config.bias);
  const effort = capped(bounded(leaned, subagentFloor(config.floor, config.ceiling), config.ceiling), saving);
  return {
    ...verdict,
    effort,
    why: effort !== leaned && EFFORTS.indexOf(leaned) < EFFORTS.indexOf(effort) ? `${verdict.why} (subagents start at medium)` : verdict.why
  };
}
async function subagentSpawnOf($, id) {
  const known = subagentSpawns.get(id);
  if (known || subagentWaiting.length === 0) return known;
  const info = (await $.agent.list().catch(() => [])).find((a) => a.id === id);
  if (!info) return void 0;
  const match = subagentWaiting.find(
    (w) => w.description === info.description && w.type === info.type && w.parentId === info.parentId
  );
  if (!match) return void 0;
  subagentWaiting = subagentWaiting.filter((w) => w !== match);
  const spawn = { pick: match.pick, call: match.call };
  subagentSpawns.set(id, spawn);
  return spawn;
}
async function subagentPickOf($, id) {
  return (await subagentSpawnOf($, id))?.pick;
}
function subagentSteerable(request, parent, call, override) {
  const modelInherited = !parent.model || !request.model || request.model === parent.model;
  const effortInherited = typeof parent.effort !== "string" || request.effort === parent.effort;
  return {
    model: !call?.model && (modelInherited || override),
    effort: !call?.effort && (effortInherited || override)
  };
}
async function subagentEffortOf($, id) {
  return (await subagentPickOf($, id))?.effort;
}
async function subagentTally($, usage) {
  await update12($, saved2, (old) => {
    const t = asSpent(old);
    return {
      ...t,
      subagents: { ...t.subagents, requests: t.subagents.requests + 1, cost: t.subagents.cost + weighted(usage) }
    };
  });
}

// hooks/render/effort-rows.tsx
var isAutoModel2 = atom13({ plugin: "context-lens", key: "isAutoModel" }, false);
var suggestion3 = atom13({ plugin: "context-lens", key: "suggestion" }, null);
var lensAgents2 = atom13({ plugin: "context-lens", key: "lensAgents" }, []);
async function effortRows($, e) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e));
  const v = await snap($);
  const { auto, autoModel, wanted } = v;
  const agentId = e.props.view.agentId;
  const viewed = agentId === void 0 ? void 0 : (await read12($, lensAgents2)).find((a) => a.id === agentId);
  const inAgent = agentId !== void 0;
  const current2 = inAgent ? null : v.current;
  const judging = !inAgent && v.judging;
  const inUse = inAgent ? viewed?.model : v.modelNow ?? await sessionModel($);
  const effortNow = inAgent ? viewed?.effort ?? await subagentEffortOf($, agentId).catch(() => void 0) : effortOf(v);
  const setEffort = (level) => () => pickEffort($, level);
  const setModel = (model3) => async () => {
    await update13($, isAutoModel2, () => false);
    await $.store.set("isAutoModel", false);
    await switchModel($, model3);
  };
  const acceptSuggestion = (model3) => async () => {
    if (offer) settleOffer(true);
    else await switchModel($, model3);
  };
  const dismiss = async () => {
    setDeclined(wanted);
    await update13($, suggestion3, () => null);
    settleOffer(false);
  };
  const neverHold = async () => {
    await dismiss();
    await saveSetting($, "holdOffer", "off");
    $.ui.toast(
      "context-lens: prompts are not held for model offers now. /context-lens settings, Model, turns it back on."
    );
  };
  const offerKeys = offer && e.surface === "terminal";
  const question = wanted ? /* @__PURE__ */ h(Box, { flexDirection: "column" }, /* @__PURE__ */ h(Box, { flexDirection: "row", gap: 1, alignItems: "center" }, /* @__PURE__ */ h(Text, null, suggestedAs === "subagent" ? `Hand this to a ${MODELS.find((m) => m.key === wanted)?.label} subagent?` : `Switch to ${MODELS.find((m) => m.key === wanted)?.label}?`, " ", offer ? `Your prompt waits ${Math.max(1, Math.ceil((offer.until - await $.clock.now()) / 1e3))}s.` : "The context reloads."), /* @__PURE__ */ h(
    Button,
    {
      key: "accept",
      variant: "primary",
      hotkey: offerKeys ? "1" : void 0,
      plain: offerKeys ? true : void 0,
      label: suggestedAs === "subagent" ? "Hand off" : "Switch",
      onPress: acceptSuggestion(wanted)
    }
  ), /* @__PURE__ */ h(
    Button,
    {
      key: "decline",
      hotkey: offerKeys ? "2" : void 0,
      plain: offerKeys ? true : void 0,
      label: "Keep",
      onPress: dismiss
    }
  ), offer ? /* @__PURE__ */ h(
    Button,
    {
      key: "never",
      hotkey: offerKeys ? "3" : void 0,
      plain: offerKeys ? true : void 0,
      label: "Don't ask again",
      onPress: neverHold
    }
  ) : null)) : null;
  if (e.surface !== "terminal") return { question, rows: null };
  const reasonNote = judging ? "Deciding…" : current2 ? `${current2.by === "manual" || current2.by === "named" ? "You" : "Why"}: ${current2.why}` : auto ? "Picks the effort at the next prompt" : "Pick an effort";
  const hint = inAgent ? "" : await appHint($, v);
  const modelPicker = /* @__PURE__ */ h(Box, { key: "model-picker", flexDirection: "row", alignItems: "center", gap: 1, flexShrink: 0 }, /* @__PURE__ */ h(Text, { dimColor: true }, "Model"), MODELS.map(
    (m) => m.key === inUse ? /* @__PURE__ */ h(Button, { key: `m-${m.key}`, variant: "primary", label: m.label, onPress: setModel(m.key) }) : /* @__PURE__ */ h(Button, { key: `m-${m.key}`, plain: true, dimColor: true, label: m.label, onPress: setModel(m.key) })
  ), /* @__PURE__ */ h(
    Button,
    {
      key: "auto-model",
      hotkey: "m",
      variant: autoModel ? "primary" : void 0,
      label: autoModel ? "Auto" : "Manual",
      onPress: () => toggleAutoModel($)
    }
  ));
  const effortPicker = /* @__PURE__ */ h(Box, { key: "effort-picker", flexDirection: "row", alignItems: "center", gap: 1, flexShrink: 0 }, /* @__PURE__ */ h(Text, { dimColor: true }, "Effort"), EFFORTS.map(
    (level) => level === effortNow ? /* @__PURE__ */ h(Button, { key: `e-${level}`, variant: "primary", label: level, onPress: setEffort(level) }) : /* @__PURE__ */ h(Button, { key: `e-${level}`, plain: true, dimColor: true, label: level, onPress: setEffort(level) })
  ), /* @__PURE__ */ h(
    Button,
    {
      key: "auto",
      hotkey: "a",
      variant: auto ? "primary" : void 0,
      label: auto ? "Auto" : "Manual",
      onPress: () => toggleAutoEffort($)
    }
  ));
  const rows = /* @__PURE__ */ h(Box, { flexDirection: "column" }, question, /* @__PURE__ */ h(Box, { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", columnGap: 2 }, modelPicker, effortPicker));
  const pickerWidth = (word, labels) => word.length + [...labels, "Manual"].reduce((sum, label) => sum + label.length + 4, 0);
  const bothWidth = pickerWidth(
    "Model",
    MODELS.map((m) => m.label)
  ) + 2 + pickerWidth("Effort", EFFORTS);
  const columns = typeof e.props.bodyColumns === "number" ? e.props.bodyColumns : 100;
  const height = (bothWidth > columns ? 2 : 1) + (question ? 1 : 0);
  const noteLine = inAgent ? null : hintLine({ Box, Text }, hint, reasonNote, "effort-note");
  return { question, rows, height, noteLine };
}

// hooks/render/lens-row.tsx
import { atom as atom14, read as read13 } from "claude-code";
var lensMain2 = atom14({ plugin: "context-lens", key: "lensMain" }, emptyClock("1h"));
var lensAgents3 = atom14({ plugin: "context-lens", key: "lensAgents" }, []);
var lensContext2 = atom14({ plugin: "context-lens", key: "lensContext" }, null);
var lensLiveTokens2 = atom14({ plugin: "context-lens", key: "lensLive" }, null);
var lensRewritten2 = atom14({ plugin: "context-lens", key: "lensRewritten" }, false);
var lensLimits2 = atom14({ plugin: "context-lens", key: "lensLimits" }, []);
var lensNow2 = atom14({ plugin: "context-lens", key: "lensNow" }, 0);
function lensCacheTime(state, left) {
  if (state === "uncached") return "—";
  if (state === "cold") return "cold";
  return formatRemaining(left ?? 0);
}
async function lensRow($, e, columns) {
  const [mainClock, ctx, live, rewritten, limits, at, agentList] = await Promise.all([
    read13($, lensMain2),
    read13($, lensContext2),
    read13($, lensLiveTokens2),
    read13($, lensRewritten2),
    read13($, lensLimits2),
    read13($, lensNow2),
    read13($, lensAgents3)
  ]);
  const agentId = e.props.view.agentId;
  const agent = agentId === void 0 ? void 0 : agentList.find((a) => a.id === agentId) ?? { ...emptyClock("5m"), id: agentId, type: "agent" };
  if (agent === void 0 && mainClock.lastAt === null && ctx === null && limits.length === 0) return null;
  const { Box, Text } = themedEls($.ui.resolve(e));
  const clock = agent ?? mainClock;
  const state = warmth(clock, at);
  const time = lensCacheTime(state, remainingMs(clock, at));
  const showRewritten = agent === void 0 && rewritten && state !== "cold";
  const headWidth = 2 + time.length + (showRewritten ? " re-cached".length : 0);
  const max = ctx?.maxTokens ?? 0;
  const used = agent === void 0 ? live ?? ctx?.totalTokens ?? 0 : clockTokens(agent);
  const ctxTexts = max > 0 ? [`${formatTokens(used)}/${formatTokens(max)}`, formatTokens(used)] : [formatTokens(used)];
  const windows = limits.map((l) => usageWindow(l, at));
  const layout = layoutLine(columns, headWidth, ctxTexts, windows);
  const segments = max === 0 || layout.ctxBar === 0 ? [] : agent === void 0 && ctx !== null ? stackedBar(ctx, live, layout.ctxBar) : fillBar(used / max, layout.ctxBar);
  const boxedBar = (key, parts, cells) => /* @__PURE__ */ h(Box, { key, flexDirection: "row", flexGrow: cells, flexShrink: 1, width: 0, minWidth: 0 }, parts.filter((s) => s.cells > 0).map((s, i) => /* @__PURE__ */ h(
    Box,
    {
      key: `${key}-${i}`,
      flexGrow: s.cells,
      width: 0,
      backgroundColor: s.kind === "free" ? "subtle" : s.color
    }
  )));
  const glyphs = e.surface === "terminal";
  return /* @__PURE__ */ h(Box, { key: "lens-row", flexDirection: "row", gap: 1 }, /* @__PURE__ */ h(Text, { color: LENS_WARMTH_COLOR[state] }, "●"), /* @__PURE__ */ h(Text, { color: state === "uncached" ? "inactive" : LENS_WARMTH_COLOR[state] }, time), showRewritten && /* @__PURE__ */ h(Text, { color: "warning" }, "re-cached"), /* @__PURE__ */ h(Text, { dimColor: true }, "│"), /* @__PURE__ */ h(Text, null, "ctx"), segments.length > 0 && !glyphs && boxedBar("ctx-bar", segments, layout.ctxBar), segments.length > 0 && glyphs && /* @__PURE__ */ h(Box, { flexDirection: "row" }, segments.filter((s) => s.cells > 0).map((s, i) => /* @__PURE__ */ h(Text, { key: `s${i}`, color: s.color }, segmentGlyph(s.kind).repeat(s.cells)))), /* @__PURE__ */ h(Text, null, layout.ctxText), windows.slice(0, layout.windows).map((w) => /* @__PURE__ */ h(
    Box,
    {
      key: `u-${w.label}`,
      flexDirection: "row",
      gap: 1,
      flexGrow: glyphs || layout.style === "percent" ? 0 : layout.usageBar,
      minWidth: 0
    },
    /* @__PURE__ */ h(Text, { dimColor: true }, "│"),
    /* @__PURE__ */ h(Text, null, w.label),
    layout.style !== "percent" && (glyphs ? /* @__PURE__ */ h(Text, { color: fillColor(w.percent / 100) }, bar(w.percent / 100, layout.usageBar)) : boxedBar(`u-${w.label}-bar`, fillBar(w.percent / 100, layout.usageBar), layout.usageBar)),
    /* @__PURE__ */ h(Text, { color: layout.style === "percent" ? fillColor(w.percent / 100) : void 0 }, w.percent, "%"),
    layout.style === "full" && w.reset !== null && /* @__PURE__ */ h(Text, { dimColor: true }, w.reset)
  )));
}

// hooks/render/band.tsx
var INTRO_MS = 1300;
var introKind = "";
var setIntroKind = (value) => {
  introKind = value;
};
var introAt = 0;
var introElapsed = 0;
var introFresh = false;
var setIntroFresh = (value) => {
  introFresh = value;
};
async function introShows($, kind) {
  const now = await $.clock.now();
  if (kind !== introKind) {
    introKind = kind;
    introAt = now;
    introFresh = true;
    $.clock.after(INTRO_MS + 100, () => $.ui.invalidate("ui.render"));
  }
  introElapsed = now - introAt;
  return introElapsed < INTRO_MS;
}
var TITLE_MARK_SIZE = 16;
function markTitle({ Box, Text, Svg }, key, color, title, mark = MARK_SVG) {
  if (!Svg)
    return /* @__PURE__ */ h(Text, { key, color, bold: true, wrap: "truncate" }, title);
  return /* @__PURE__ */ h(Box, { key, flexDirection: "row", alignItems: "center", flexShrink: 1, minWidth: 0 }, /* @__PURE__ */ h(Box, { flexShrink: 0, marginRight: 1, alignItems: "center" }, /* @__PURE__ */ h(Svg, { source: mark, alt: "context-lens", width: TITLE_MARK_SIZE, height: TITLE_MARK_SIZE })), /* @__PURE__ */ h(Text, { color, bold: true, wrap: "truncate" }, title.replace(/^✦ /, "")));
}
function optionButtons(Button, key, value, options, onSelect) {
  return options.map(
    (option) => option.value === value ? /* @__PURE__ */ h(
      Button,
      {
        key: `${key}-${option.value}`,
        variant: "secondary",
        label: option.label,
        onPress: () => onSelect(option.value)
      }
    ) : /* @__PURE__ */ h(
      Button,
      {
        key: `${key}-${option.value}`,
        plain: true,
        dimColor: true,
        label: option.label,
        onPress: () => onSelect(option.value)
      }
    )
  );
}
function introLayer({ Box, Svg }, key, show, wash = "#8b6cff", light2 = "#b9a7ff") {
  if (!Svg || !show) return null;
  return /* @__PURE__ */ h(Box, { key: `${key}-intro`, position: "absolute", top: -1, left: 0, right: 0, bottom: -1 }, /* @__PURE__ */ h(
    Svg,
    {
      source: inPhase(INTRO_SVG.replace("#8b6cff", wash).replace("#b9a7ff", light2), introElapsed),
      alt: "",
      width: 1600,
      height: 240
    }
  ));
}
function appHintText(app, sent) {
  const appEffortKnown = EFFORTS.includes(app.effort) ? app.effort : void 0;
  const modelDiffers = app.model && sent.model && app.model !== sent.model;
  const effortDiffers = appEffortKnown && sent.effort && appEffortKnown !== sent.effort;
  if (!modelDiffers && !effortDiffers) return "";
  const parts = [MODELS.find((m) => m.key === app.model)?.long, appEffortKnown && EFFORT_LABELS[appEffortKnown]];
  return `App: ${parts.filter(Boolean).join(" · ")}`;
}
function hintLine({ Box, Text }, hint, words, key) {
  return /* @__PURE__ */ h(Box, { key, flexDirection: "row", justifyContent: "space-between", columnGap: 2 }, hint ? /* @__PURE__ */ h(Box, { flexShrink: 0 }, /* @__PURE__ */ h(Text, { dimColor: true }, hint)) : null, /* @__PURE__ */ h(Box, { flexShrink: 1, minWidth: 0 }, /* @__PURE__ */ h(Text, { dimColor: true, wrap: "truncate-end" }, words)));
}
async function appHint($, v) {
  const pickGoesOut = v.current && (v.current.by === "manual" || v.auto && !v.pausedNow);
  return appHintText(
    { model: keyOf(await $.session.model()), effort: v.shownByApp },
    { model: await sessionModel($), effort: pickGoesOut ? v.current.effort : void 0 }
  );
}
var artTimer = null;
var artShown = null;
var artFrameCount = 0;
function bandArt($, e, kind) {
  const els = themedEls($.ui.resolve(e));
  const columns = typeof e.props.bodyColumns === "number" ? e.props.bodyColumns : 0;
  if (e.surface !== "terminal" || !("Raster" in els) || columns < ART_MIN_WIDTH) return null;
  if (kind === "calm" || kind === "brand") return null;
  const { Box, Raster } = els;
  artShown = { requestId: e.requestId, kind };
  if (MOVING.has(kind) && !artTimer) {
    artTimer = $.clock.every(ART_FRAME_MS, () => {
      const shown = artShown;
      if (!shown || !MOVING.has(shown.kind)) {
        artTimer?.cancel();
        artTimer = null;
        return;
      }
      artFrameCount++;
      void $.ui.blit({ requestId: shown.requestId, key: "art", cells: artFrame(shown.kind, artFrameCount) }).then((r) => {
        if ("deny" in r && r.deny) {
          artTimer?.cancel();
          artTimer = null;
        }
      }).catch(() => void 0);
    });
  }
  return /* @__PURE__ */ h(Box, { key: "art-box", flexShrink: 0 }, /* @__PURE__ */ h(Raster, { key: "art", columns: ART_COLUMNS, rows: ART_ROWS, cells: artFrame(kind, artFrameCount) }));
}
function terminalPanel($, e, key, title, words, controls) {
  const { Box, Text } = themedEls($.ui.resolve(e));
  return /* @__PURE__ */ h(
    Box,
    {
      key,
      flexDirection: "column",
      paddingX: 1,
      backgroundColor: BRAND_BG,
      borderStyle: "round",
      borderColor: BRAND_EDGE
    },
    /* @__PURE__ */ h(Box, { flexDirection: "row", gap: 1, alignItems: "center" }, /* @__PURE__ */ h(Box, { flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0 }, /* @__PURE__ */ h(Text, { color: ACCENT, bold: true, wrap: "truncate" }, title), typeof words === "string" ? /* @__PURE__ */ h(Text, { key: `${key}-what`, dimColor: true, wrap: "truncate" }, words) : words), bandArt($, e, "brand")),
    /* @__PURE__ */ h(
      Box,
      {
        key: `${key}-actions`,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        columnGap: 1,
        alignItems: "center"
      },
      controls
    )
  );
}
function bandFit(maxRows, parts) {
  const fit = { detail: true, border: true, effort: parts.effort > 0, lens: parts.lens };
  const rows = () => 1 + (fit.border ? 2 : 0) + (fit.detail ? 1 : 0) + (fit.lens ? 1 : 0) + (fit.effort ? parts.effort : 0);
  if (rows() > maxRows && !parts.detailText) fit.detail = false;
  if (rows() > maxRows) fit.border = false;
  if (rows() > maxRows) fit.effort = false;
  if (rows() > maxRows) fit.lens = false;
  return fit;
}
async function terminalBand($, e, b) {
  const { Box, Text } = themedEls($.ui.resolve(e));
  const { rows: effort, height } = await effortRows($, e);
  const maxRows = typeof e.props.maxRows === "number" ? e.props.maxRows : 99;
  const fit = bandFit(maxRows, { detailText: Boolean(b.detail || b.hint), lens: b.extra !== null, effort: height ?? 0 });
  const art = fit.border ? bandArt($, e, b.kind) : null;
  const rows = fit.effort ? effort : null;
  const columns = typeof e.props.bodyColumns === "number" ? e.props.bodyColumns : 100;
  const extra = !fit.lens ? null : b.extra !== void 0 ? b.extra : await lensRow($, e, Math.max(20, columns - 4 - (art ? ART_COLUMNS + 1 : 0))).catch(() => null);
  return /* @__PURE__ */ h(Box, { key: `${b.key}-col`, flexDirection: "column" }, /* @__PURE__ */ h(
    Box,
    {
      key: b.key,
      flexDirection: "row",
      gap: 1,
      alignItems: "center",
      paddingX: 1,
      backgroundColor: b.bg,
      borderStyle: fit.border ? "round" : void 0,
      borderColor: b.edge
    },
    /* @__PURE__ */ h(Box, { flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0 }, /* @__PURE__ */ h(Box, { flexDirection: "row", gap: 1, alignItems: "center" }, /* @__PURE__ */ h(Box, { flexShrink: 0 }, b.word ? /* @__PURE__ */ h(Box, { flexDirection: "row" }, /* @__PURE__ */ h(Text, { color: b.color, bold: true }, "✦ "), /* @__PURE__ */ h(Text, { key: `${b.key}-word`, color: b.word.color, bold: true }, b.word.text), /* @__PURE__ */ h(Text, { color: b.color, bold: true }, b.word.rest)) : /* @__PURE__ */ h(Text, { color: b.color, bold: true }, `✦ ${b.title}`)), /* @__PURE__ */ h(Box, { flexGrow: 1 }), b.buttons), fit.detail ? hintLine({ Box, Text }, b.hint ?? "", b.detail || " ", `${b.key}-detail`) : null, extra),
    art
  ), rows);
}

// hooks/render/alert-bands.tsx
var handoffStage2 = atom15({ plugin: "context-lens", key: "handoffStage" }, null);
var swampHiddenAt = atom15({ plugin: "context-lens", key: "swampHiddenAt" }, null);
var judgeDownHidden = atom15({ plugin: "context-lens", key: "judgeDownHidden" }, null);
var saveUntil3 = atom15({ plugin: "context-lens", key: "saveUntil" }, null);
var isColdHidden2 = atom15({ plugin: "context-lens", key: "isColdHidden" }, false);
function savedCardTree($, e) {
  const { Box, Text } = themedEls($.ui.resolve(e));
  return /* @__PURE__ */ h(
    Box,
    {
      key: "saved",
      flexDirection: "row",
      alignItems: "center",
      gap: 1,
      paddingX: 1,
      backgroundColor: DASH_BG,
      borderStyle: "round",
      borderColor: DASH_EDGE
    },
    /* @__PURE__ */ h(Text, { color: ACCENT }, "✓"),
    /* @__PURE__ */ h(Text, { bold: true }, "Settings saved")
  );
}
async function judgeDownBand($, e, downReason) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e));
  if (e.surface === "terminal")
    return terminalBand($, e, {
      key: "down",
      kind: "down",
      color: SLATE,
      bg: SLATE_BG,
      edge: SLATE_EDGE,
      title: "Judge down",
      detail: `${downReason}. The effort stays as it is.`,
      buttons: [
        /* @__PURE__ */ h(
          Button,
          {
            key: "down-close",
            plain: true,
            role: "dismiss",
            label: "✕",
            onPress: () => update14($, judgeDownHidden, () => downReason)
          }
        )
      ]
    });
  const { Svg } = themedEls($.ui.resolve(e));
  return /* @__PURE__ */ h(
    Box,
    {
      key: "down",
      position: "relative",
      flexDirection: "row",
      gap: 1,
      alignItems: "center",
      paddingX: 1,
      overflow: "hidden",
      backgroundColor: SLATE_BG,
      borderStyle: "round",
      borderColor: SLATE_EDGE
    },
    /* @__PURE__ */ h(Box, { key: "down-art", position: "absolute", top: -1, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: DOWN_SVG, alt: "judge down", width: FROST_WIDTH, height: FROST_HEIGHT })),
    introLayer({ Box, Svg }, "down", await introShows($, "down"), "#7d8aa8", "#e6ecf8"),
    /* @__PURE__ */ h(Box, { flexShrink: 0 }, /* @__PURE__ */ h(Text, { color: SLATE, bold: true, wrap: "truncate" }, "✦ Judge down")),
    /* @__PURE__ */ h(Text, { wrap: "truncate" }, `${downReason}. The effort stays as it is.`),
    /* @__PURE__ */ h(Box, { flexGrow: 1, minWidth: 30 }),
    /* @__PURE__ */ h(
      Box,
      {
        key: "down-actions",
        position: "absolute",
        top: 0,
        right: 1,
        bottom: 0,
        flexDirection: "row",
        gap: 1,
        alignItems: "center"
      },
      /* @__PURE__ */ h(
        Button,
        {
          key: "down-close",
          plain: true,
          role: "dismiss",
          label: "✕",
          onPress: () => update14($, judgeDownHidden, () => downReason)
        }
      )
    )
  );
}
async function hotBand($, e, heat) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e));
  const saving = await read14($, saveUntil3) !== null;
  const window = heat.kind === "five_hour" ? "5h" : "weekly";
  const resets = resetLabel(heat.resetsAt, await $.clock.now());
  if (e.surface === "terminal")
    return terminalBand($, e, {
      key: "hot",
      kind: "hot",
      color: EMBER,
      bg: EMBER_BG,
      edge: EMBER_EDGE,
      title: "Running hot",
      detail: `${Math.round(heat.percent)}% of your ${window} limit used${resets ? ` · resets ${resets}` : ""}`,
      buttons: [
        /* @__PURE__ */ h(
          Button,
          {
            key: "hot-save",
            variant: "primary",
            hotkey: "s",
            label: saving ? "Save mode on" : "Save mode",
            onPress: async () => {
              $.ui.toast(`context-lens: ${await toggleSave($)}`);
            }
          }
        ),
        /* @__PURE__ */ h(Button, { key: "hot-close", plain: true, role: "dismiss", label: "✕", onPress: () => closeHot($, heat) })
      ]
    });
  const { Svg } = themedEls($.ui.resolve(e));
  return /* @__PURE__ */ h(
    Box,
    {
      key: "hot",
      position: "relative",
      flexDirection: "row",
      gap: 1,
      alignItems: "center",
      paddingX: 1,
      overflow: "hidden",
      backgroundColor: EMBER_BG,
      borderStyle: "round",
      borderColor: EMBER_EDGE
    },
    /* @__PURE__ */ h(Box, { key: "ember", position: "absolute", top: -1, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: EMBER_SVG, alt: "embers", width: FROST_WIDTH, height: FROST_HEIGHT })),
    introLayer({ Box, Svg }, "hot", await introShows($, "hot"), EMBER, "#ffd2a8"),
    /* @__PURE__ */ h(Box, { flexShrink: 0 }, /* @__PURE__ */ h(Text, { color: EMBER, bold: true, wrap: "truncate" }, "✦ Running hot")),
    /* @__PURE__ */ h(Text, { wrap: "truncate" }, `${Math.round(heat.percent)}% of your ${window} limit used${resets ? ` · resets ${resets}` : ""}`),
    /* @__PURE__ */ h(Box, { flexGrow: 1, minWidth: 30 }),
    /* @__PURE__ */ h(
      Box,
      {
        key: "hot-actions",
        position: "absolute",
        top: 0,
        right: 1,
        bottom: 0,
        flexDirection: "row",
        gap: 1,
        alignItems: "center"
      },
      /* @__PURE__ */ h(
        Button,
        {
          key: "hot-save",
          variant: "primary",
          label: saving ? "Save mode on" : "Save mode",
          onPress: async () => {
            $.ui.toast(`context-lens: ${await toggleSave($)}`);
          }
        }
      ),
      /* @__PURE__ */ h(Button, { key: "hot-close", plain: true, role: "dismiss", label: "✕", onPress: () => closeHot($, heat) })
    )
  );
}
async function coldBand($, e, coldTokens) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e));
  const line = `Next message rereads ${kTokens(coldTokens)} tokens at full price.`;
  if (e.surface === "terminal")
    return terminalBand($, e, {
      key: "cold",
      kind: "cold",
      color: ICE,
      bg: ICE_BG,
      edge: ICE_EDGE,
      title: "Chat went cold",
      detail: `${line} Hand off or compact first.`,
      buttons: [
        /* @__PURE__ */ h(Button, { key: "cold-hide", plain: true, hotkey: "n", label: "Not now", onPress: () => update14($, isColdHidden2, () => true) }),
        /* @__PURE__ */ h(Button, { key: "cold-compact", hotkey: "c", label: "Compact", onPress: () => openCompact($, e) }),
        /* @__PURE__ */ h(Button, { key: "cold-handoff", variant: "primary", hotkey: "h", label: "Handoff", onPress: () => openHandoffBar($) })
      ]
    });
  const { Svg } = themedEls($.ui.resolve(e));
  return /* @__PURE__ */ h(
    Box,
    {
      key: "cold",
      position: "relative",
      flexDirection: "row",
      gap: 1,
      alignItems: "center",
      paddingX: 1,
      overflow: "hidden",
      backgroundColor: ICE_BG,
      borderStyle: "round",
      borderColor: ICE_EDGE
    },
    /* @__PURE__ */ h(Box, { key: "frost", position: "absolute", top: -1, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: FROST_SVG, alt: "frost", width: FROST_WIDTH, height: FROST_HEIGHT })),
    /* @__PURE__ */ h(Box, { key: "cold-glow", position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, /* @__PURE__ */ h(
      Svg,
      {
        source: inPhase(coldGlowSvg(), await $.clock.now() % COLD_GLOW_MS),
        alt: "cold glow",
        width: AUTO_GLOW_W,
        height: AUTO_GLOW_H
      }
    )),
    introLayer({ Box, Svg }, "cold", await introShows($, "cold"), ICE, "#cfeeff"),
    /* @__PURE__ */ h(Box, { flexShrink: 0 }, /* @__PURE__ */ h(Text, { color: ICE, bold: true, wrap: "truncate" }, "✦ Chat went cold")),
    /* @__PURE__ */ h(Text, { wrap: "truncate" }, line),
    /* @__PURE__ */ h(Box, { flexGrow: 1, minWidth: 34 }),
    /* @__PURE__ */ h(
      Box,
      {
        key: "cold-actions",
        position: "absolute",
        top: 0,
        right: 1,
        bottom: 0,
        flexDirection: "row",
        gap: 1,
        alignItems: "center"
      },
      /* @__PURE__ */ h(Button, { key: "cold-hide", plain: true, label: "Not now", onPress: () => update14($, isColdHidden2, () => true) }),
      /* @__PURE__ */ h(Button, { key: "cold-compact", variant: "secondary", label: "Compact", onPress: () => openCompact($, e) }),
      /* @__PURE__ */ h(Button, { key: "cold-handoff", variant: "primary", label: "Handoff", onPress: () => openHandoffBar($) })
    )
  );
}
async function swampBand($, e, swampTokens) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e));
  const handing = await read14($, handoffStage2) !== null;
  if (e.surface === "terminal")
    return terminalBand($, e, {
      key: "swamp",
      kind: "swamp",
      color: BOG,
      bg: BOG_BG,
      edge: BOG_EDGE,
      title: "Chat is getting swamped",
      detail: `${Math.round(swampTokens / 1e3)}k tokens${lastContext && lastContext.window ? ` (${Math.round(lastContext.percent)}% of context)` : ""} re-read every message.`,
      buttons: [
        /* @__PURE__ */ h(Button, { key: "swamp-compact", variant: "primary", label: "Compact", onPress: () => openCompact($, e) }),
        /* @__PURE__ */ h(Button, { key: "swamp-handoff", label: handing ? "Handing off…" : "Handoff", onPress: () => openHandoffBar($) }),
        /* @__PURE__ */ h(
          Button,
          {
            key: "swamp-close",
            plain: true,
            role: "dismiss",
            label: "✕",
            onPress: () => update14($, swampHiddenAt, () => swampTokens)
          }
        )
      ]
    });
  const { Svg } = themedEls($.ui.resolve(e));
  return /* @__PURE__ */ h(
    Box,
    {
      key: "swamp",
      position: "relative",
      flexDirection: "row",
      gap: 1,
      alignItems: "center",
      paddingX: 1,
      overflow: "hidden",
      backgroundColor: BOG_BG,
      borderStyle: "round",
      borderColor: BOG_EDGE
    },
    /* @__PURE__ */ h(Box, { key: "bog", position: "absolute", top: -1, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: SWAMP_SVG, alt: "swamp", width: FROST_WIDTH, height: FROST_HEIGHT })),
    introLayer({ Box, Svg }, "swamp", await introShows($, "swamp"), "#6f9a4f", "#d6ecc2"),
    /* @__PURE__ */ h(Box, { flexShrink: 0 }, /* @__PURE__ */ h(Text, { color: BOG, bold: true, wrap: "truncate" }, "✦ Chat is getting swamped")),
    lastContext && lastContext.window ? /* @__PURE__ */ h(Box, { key: "swamp-ring", flexShrink: 0, flexDirection: "row", gap: 1, alignItems: "center" }, /* @__PURE__ */ h(
      Svg,
      {
        source: ringSvg(lastContext.percent, BOG),
        alt: `${Math.round(lastContext.percent)}% of context`,
        width: 16,
        height: 16
      }
    ), /* @__PURE__ */ h(Text, { color: BOG }, `${Math.round(lastContext.percent)}%`)) : null,
    /* @__PURE__ */ h(Text, { wrap: "truncate" }, `${Math.round(swampTokens / 1e3)}k tokens re-read every message.`),
    /* @__PURE__ */ h(Box, { flexGrow: 1, minWidth: 34 }),
    /* @__PURE__ */ h(
      Box,
      {
        key: "swamp-actions",
        position: "absolute",
        top: 0,
        right: 1,
        bottom: 0,
        flexDirection: "row",
        gap: 1,
        alignItems: "center"
      },
      /* @__PURE__ */ h(Button, { key: "swamp-compact", variant: "primary", label: "Compact", onPress: () => openCompact($, e) }),
      /* @__PURE__ */ h(Button, { key: "swamp-handoff", label: handing ? "Handing off…" : "Handoff", onPress: () => openHandoffBar($) }),
      /* @__PURE__ */ h(
        Button,
        {
          key: "swamp-close",
          plain: true,
          role: "dismiss",
          label: "✕",
          onPress: () => update14($, swampHiddenAt, () => swampTokens)
        }
      )
    )
  );
}

// hooks/render/compact-bar.tsx
import { atom as atom16, update as update15 } from "claude-code";
var compactAsk3 = atom16({ plugin: "context-lens", key: "compactAsk" }, false);
async function compactBar($, e) {
  const elements = themedEls($.ui.resolve(e));
  const { Box, Text, Button, Svg } = elements;
  const Input = e.surface !== "mobile" && "Input" in elements ? elements.Input : void 0;
  const go = () => compactCold($, compactNote);
  const nowCompact = await $.clock.now();
  if (nowCompact - compactOpenedAt < COMPACT_FADE_MS)
    $.clock.after(COMPACT_FADE_MS + 150 - (nowCompact - compactOpenedAt), () => $.ui.invalidate("ui.render"));
  return /* @__PURE__ */ h(
    Box,
    {
      key: "compact-bar",
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
      paddingX: 1,
      overflow: "hidden",
      backgroundColor: BRAND_BG,
      borderStyle: "round",
      borderColor: BRAND_EDGE
    },
    /* @__PURE__ */ h(Box, { key: "compact-art", position: "absolute", top: -1, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: BRAND_SVG, alt: "context-lens", width: FROST_WIDTH * 2, height: FROST_HEIGHT * 2 })),
    nowCompact - compactOpenedAt < COMPACT_FADE_MS + 100 ? /* @__PURE__ */ h(Box, { key: "compact-fade", position: "absolute", top: -1, left: 0, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: compactFadeSvg(nowCompact - compactOpenedAt), alt: "", width: 1600, height: 240 })) : null,
    introLayer({ Box, Svg }, "compact", await introShows($, "compact")),
    /* @__PURE__ */ h(Box, { key: "compact-words", position: "relative", flexShrink: 0 }, markTitle({ Box, Text, Svg }, "compact-title", ACCENT, "✦ Compact"), /* @__PURE__ */ h(Box, { key: "compact-switch-box", position: "relative", flexShrink: 0, marginLeft: 1 }, /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }), /* @__PURE__ */ h(
      Button,
      {
        key: "compact-to-handoff",
        plain: true,
        dimColor: true,
        label: "Handoff instead",
        onPress: async () => {
          await update15($, compactAsk3, () => false);
          await openHandoffBar($);
        }
      }
    ))),
    /* @__PURE__ */ h(
      Box,
      {
        key: "compact-controls",
        position: "relative",
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 1
      },
      /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }),
      Input ? /* @__PURE__ */ h(Box, { key: "compact-field", position: "relative", width: 48, minWidth: 6, height: 1, flexShrink: 1 }, /* @__PURE__ */ h(Box, { position: "absolute", top: -1, bottom: -1, left: 0, right: 0, overflow: "hidden" }, /* @__PURE__ */ h(
        Box,
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          right: -3,
          width: 60,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 1
        },
        /* @__PURE__ */ h(
          Input,
          {
            key: "compact-note",
            placeholder: "Summary (optional)",
            submitLabel: "​",
            onInput: (v) => {
              setCompactNote(v);
            },
            onSubmit: (v) => {
              setCompactNote(v);
              void go();
            }
          }
        )
      ))) : null,
      /* @__PURE__ */ h(Box, { key: "compact-go-box", position: "relative", flexShrink: 0, flexDirection: "row", alignItems: "center" }, /* @__PURE__ */ h(Box, { width: GO_CELLS, height: 1, flexShrink: 0 }), /* @__PURE__ */ h(Box, { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ h(Svg, { source: goPillSvg(), alt: "Compact", width: GO_W, height: 20 })), /* @__PURE__ */ h(
        Box,
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 1
        },
        /* @__PURE__ */ h(Text, { color: "#141416" }, "Compact"),
        /* @__PURE__ */ h(Svg, { source: enterSvg("#141416"), alt: "Enter", width: 14, height: 14 })
      ), /* @__PURE__ */ h(Box, { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ h(
        Button,
        {
          key: "compact-go",
          plain: true,
          hover: { backgroundColor: "#00000000" },
          label: " ".repeat(GO_CELLS),
          onPress: go
        }
      ))),
      /* @__PURE__ */ h(Box, { key: "compact-close-box", position: "relative", flexShrink: 0 }, /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }), /* @__PURE__ */ h(
        Button,
        {
          key: "compact-close",
          plain: true,
          label: "✕",
          hover: { backgroundColor: CARD_CLOSE_HOVER },
          onPress: () => update15($, compactAsk3, () => false)
        }
      ))
    )
  );
}

// hooks/render/dashboard.tsx
import { atom as atom17, read as read15, update as update16 } from "claude-code";

// hooks/svg/thinking.ts
var THINK_W = 34;
var PILL_H = 16;
function thinkingSvg(w = THINK_W, h2 = PILL_H) {
  const color = tintHex("#a79cf7");
  const r = h2 / 2;
  const dots = [0, 1, 2].map(
    (i) => `<circle class="dot" style="animation-delay:${(i * 0.18).toFixed(2)}s" cx="${6 + i * 11}" cy="${r}" r="3" fill="${color}"/>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h2}" viewBox="0 0 ${w} ${h2}"><style>:root{color-scheme:light dark}html,body{margin:0;overflow:hidden}svg{background:transparent;display:block}.dot{transform-box:fill-box;transform-origin:center;opacity:.3;animation:dot 1.1s ease-in-out infinite}@keyframes dot{30%{opacity:1;transform:translateY(-2.5px) scale(1.15)}60%{opacity:.3;transform:none}}</style>` + dots + "</svg>";
}

// hooks/render/dashboard.tsx
var handoffAdvice2 = atom17({ plugin: "context-lens", key: "handoffAdvice" }, null);
var settingsOpen2 = atom17({ plugin: "context-lens", key: "settingsOpen" }, false);
var settingsDraft2 = atom17({ plugin: "context-lens", key: "settingsDraft" }, {});
var lensAgents4 = atom17({ plugin: "context-lens", key: "lensAgents" }, []);
var DASH_MARK_SIZE = 18;
function dashboardLines(d) {
  const level = d.effort ? EFFORT_LABELS[d.effort] : "Auto";
  const what = d.agent ? d.effort ? level : "Subagent" : d.judging ? "Deciding…" : !d.auto ? "Off" : d.paused ? `${level} · Auto paused` : level;
  const pair = d.model ? `${d.model} · ${what}` : what;
  const head = [
    `✦ ${pair}`,
    d.cacheNow === null ? null : `cache ${cacheLabel(d.cacheNow)}`,
    d.contextPercent === null ? null : `${Math.round(d.contextPercent)}% context`
  ];
  const shown = head.filter(Boolean);
  return {
    head: shown.join(" · "),
    what,
    pair,
    rest: shown.slice(1).map((part) => ` · ${part}`).join(""),
    detail: d.reason
  };
}
var FLASH_HOLD_MS = 1e3;
var FLASH_MS = 1800;
var FLASH_STEPS = [
  [1e3, 0.15],
  [1160, 0.35],
  [1320, 0.55],
  [1480, 0.75],
  [1640, 0.9]
];
function flashColor(ms) {
  if (ms === null || ms >= FLASH_MS) return DASH_TEXT;
  if (ms < FLASH_HOLD_MS) return FLASH_COLOR;
  const k = [...FLASH_STEPS].reverse().find(([at]) => ms >= at)?.[1] ?? 0;
  const ch = (hex2, i) => parseInt(hex2.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map(
    (i) => Math.round(ch(FLASH_COLOR, i) + (ch(DASH_TEXT, i) - ch(FLASH_COLOR, i)) * k).toString(16).padStart(2, "0")
  ).join("")}`;
}
var flashWord = null;
var flashAt = null;
async function effortFlash($, what, judging, entering = false) {
  const now = await $.clock.now();
  if (entering && !judging) {
    flashWord = what;
    flashAt = null;
  }
  if (!judging) {
    if (flashWord !== null && flashWord !== what) flashAt = what === "Off" || flashWord === "Off" ? null : now;
    flashWord = what;
  }
  const since = flashAt === null ? null : now - flashAt;
  if (since === 0) {
    for (const at of [...FLASH_STEPS.map(([t]) => t), FLASH_MS])
      $.clock.after(at + 20, () => $.ui.invalidate("ui.render"));
  }
  return flashColor(since);
}
var glowReadAt = null;
var setGlowReadAt = (value) => {
  glowReadAt = value;
};
var drawLead = 20;
var setDrawLead = (value) => {
  drawLead = value;
};
var autoSeen;
var autoOnAt = -Infinity;
var autoFlipAt = 0;
var autoModelSeen;
var autoModelFlipAt = 0;
async function dashboardBand($, e) {
  const els = themedEls($.ui.resolve(e));
  const { Box, Text, Button } = els;
  const v = await snap($);
  setAdviceNow(await read15($, handoffAdvice2) ?? null);
  await introShows($, "dash");
  const entering = introFresh;
  setIntroFresh(false);
  const nowMs = await $.clock.now();
  if (autoSeen !== void 0 && autoSeen !== v.auto) {
    autoFlipAt = nowMs;
    autoOnAt = nowMs;
  }
  autoSeen = v.auto;
  if (autoModelSeen !== void 0 && autoModelSeen !== v.autoModel) autoModelFlipAt = nowMs;
  autoModelSeen = v.autoModel;
  const inAgent = e.props.view.agentId !== void 0;
  const viewed = inAgent ? (await read15($, lensAgents4)).find((a) => a.id === e.props.view.agentId) : void 0;
  const shownModel = inAgent ? viewed?.model : v.modelNow ?? void 0;
  const effortNow = inAgent ? viewed?.effort ?? await subagentEffortOf($, e.props.view.agentId).catch(() => void 0) : effortOf(v);
  const by = v.current?.by;
  const reason = v.current ? `${by === "manual" || by === "named" ? "You" : "Why"}: ${v.current.why}` : v.auto ? "Auto picks the effort at the next prompt" : "You pick the effort";
  const cacheShown = config.hide.includes("timer") || v.cacheNow !== null && v.cacheNow <= 0 ? null : v.cacheNow;
  const columns = typeof e.props.bodyColumns === "number" ? e.props.bodyColumns : 100;
  const lens = await lensRow($, e, Math.max(20, columns - 4)).catch(() => null);
  const judgingHere = !inAgent && Boolean(v.judging);
  const hint = inAgent ? "" : await appHint($, v);
  const modelName = MODELS.find((m) => m.key === shownModel)?.long;
  const { head, what, pair, rest, detail } = dashboardLines({
    auto: v.auto,
    paused: Boolean(v.pausedNow),
    judging: judgingHere,
    agent: inAgent,
    effort: effortNow,
    model: modelName,
    cacheNow: lens ? null : cacheShown,
    contextPercent: !lens && lastContext && lastContext.window ? lastContext.percent : null,
    // The judge's reason and the handoff advice are about the chat's own prompt, not a subagent's work.
    reason: inAgent ? "" : adviceNow ? `Handoff would suit: ${adviceNow}` : config.hide.includes("reason") ? "" : reason
  });
  const toggleSettings = async () => {
    if (await read15($, settingsOpen2)) {
      await update16($, settingsDraft2, () => ({}));
      await update16($, settingsOpen2, () => false);
      $.ui.invalidate("ui.render");
    } else await openPluginSettings($);
  };
  const buttons = [
    // Once the slot is Handoff (advised, or the setting says always), Compact stays beside it as quiet text, so both are
    // a press away. Desktop only, where there is room for it; the terminal compacts in one press from its own rows.
    ...e.surface !== "terminal" && "Svg" in els && !config.hide.includes("handoff") && handoffSlot() && (typeof e.props.bodyColumns !== "number" || e.props.bodyColumns >= COMPACT_BUTTON_MIN_COLUMNS) ? [/* @__PURE__ */ h(Button, { key: "dash-compact", plain: true, dimColor: true, label: "Compact", onPress: () => openCompact($, e) })] : [],
    ...config.hide.includes("handoff") ? [] : [
      // One button in one place: Compact until Haiku says a fresh chat would suit, then Handoff, loud. Pressing it opens
      // the matching card, which can switch to the other. Desktop draws it: no box on a fresh chat, then a
      // step a percent of context to a white box at HANDOFF_LOUD_AT (handoffLook), the label as Text over the box and
      // a blank button over both to take the click. The terminal keeps the plain buttons: grey, white from
      // HANDOFF_LOUD_AT.
      "Svg" in els && e.surface !== "terminal" ? /* @__PURE__ */ h(Box, { key: "dash-handoff-wrap", flexShrink: 0, flexDirection: "row" }, handoffLoud() && !e.props.isWorking ? /* @__PURE__ */ h(
        Box,
        {
          key: "dash-glow",
          position: "absolute",
          top: 0,
          bottom: 0,
          left: -2,
          right: -2,
          alignItems: "center",
          justifyContent: "center"
        },
        /* @__PURE__ */ h(
          els.Svg,
          {
            source: handoffGlowSvg(handoffGlowStep(handoffLevel()), nowMs),
            alt: "handoff glow",
            width: GLOW_W,
            height: GLOW_H
          }
        )
      ) : null, handoffLoud() ? /* @__PURE__ */ h(Box, { key: "dash-handoff-key", width: 0, height: 1, overflow: "hidden" }, /* @__PURE__ */ h(Button, { key: "dash-handoff-h", plain: true, hotkey: "h", label: "Handoff", onPress: () => openHandoffBar($) })) : null, /* @__PURE__ */ h(Box, { key: "dash-handoff-box", flexShrink: 0, flexDirection: "row", alignItems: "center" }, /* @__PURE__ */ h(Box, { width: 9, height: 1, flexShrink: 0 }), /* @__PURE__ */ h(
        Box,
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center"
        },
        /* @__PURE__ */ h(
          els.Svg,
          {
            source: handoffPillSvg(handoffLevel()),
            alt: "Handoff box",
            width: HANDOFF_PILL_W,
            height: HANDOFF_PILL_H
          }
        )
      ), /* @__PURE__ */ h(
        Box,
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center",
          display: "none",
          hover: { scope: "handoff", display: "flex" }
        },
        /* @__PURE__ */ h(
          els.Svg,
          {
            source: handoffPillSvg(handoffLevel(), true),
            alt: "Handoff box",
            width: HANDOFF_PILL_W,
            height: HANDOFF_PILL_H
          }
        )
      ), /* @__PURE__ */ h(
        Box,
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center"
        },
        /* @__PURE__ */ h(
          Text,
          {
            color: handoffLook(handoffLevel()).label,
            hover: { scope: "handoff", color: handoffLook(handoffLevel(), true).label }
          },
          handoffSlot() ? "Handoff" : "Compact"
        )
      ), /* @__PURE__ */ h(
        Box,
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center"
        },
        /* @__PURE__ */ h(
          Button,
          {
            key: "dash-handoff",
            plain: true,
            label: " ".repeat(14),
            hover: { scope: "handoff", backgroundColor: "#00000000" },
            onPress: () => handoffSlot() ? openHandoffBar($) : openCompact($, e)
          }
        )
      ))) : handoffLoud() ? /* @__PURE__ */ h(Button, { key: "dash-handoff", variant: "primary", hotkey: "h", label: "Handoff", onPress: () => openHandoffBar($) }) : /* @__PURE__ */ h(Button, { key: "dash-handoff", variant: "secondary", label: "Handoff", onPress: () => openHandoffBar($) })
    ],
    // The terminal says it in a word; the desktop draws an icon, with this button laid blank over it to take the click.
    // No-break spaces, not braille blanks: some fonts draw U+2800 as a dot.
    /* @__PURE__ */ h(
      Button,
      {
        key: "dash-settings",
        plain: true,
        label: "Svg" in els && e.surface !== "terminal" ? "   " : "Settings",
        onPress: toggleSettings
      }
    )
  ].filter(Boolean);
  const autoButtons = [
    /* @__PURE__ */ h(
      Button,
      {
        key: "dash-auto-model",
        variant: "secondary",
        dimColor: !v.autoModel,
        label: v.autoModel ? "Auto model on" : "Auto model off",
        onPress: () => toggleAutoModel($)
      }
    ),
    /* @__PURE__ */ h(
      Button,
      {
        key: "dash-auto",
        variant: "secondary",
        dimColor: !v.auto,
        label: v.auto ? "Auto effort on" : "Auto effort off",
        onPress: () => toggleAutoEffort($)
      }
    )
  ];
  if (e.surface === "terminal")
    return terminalBand($, e, {
      key: "dash",
      kind: "calm",
      color: DASH_TEXT,
      bg: DASH_BG,
      edge: DASH_EDGE,
      title: head.replace(/^✦ /, ""),
      detail,
      hint,
      buttons,
      extra: lens,
      word: { text: pair, color: await effortFlash($, what, judgingHere, entering), rest }
    });
  const Svg = "Svg" in els ? els.Svg : void 0;
  const wordColor = await effortFlash($, what, judgingHere, entering);
  glowReadAt = Date.now();
  const glowNow = await $.clock.now().catch(() => nowMs) + drawLead;
  const glowSource = Svg ? judgeGlowAt(judgeStartedAt, judgeEndedAt, glowNow) : null;
  const autoGlowing = Svg && v.auto && nowMs - autoOnAt < AUTO_GLOW_MS;
  if (autoGlowing) renderLog.push(`glow on at ${nowMs - autoOnAt} ms`);
  if (glowSource && judgeEndedAt !== null)
    renderLog.push(
      `${(/* @__PURE__ */ new Date()).toISOString()} ${loadedSession} glow: fade drawn at +${Math.round(glowNow - Math.max(judgeEndedAt, judgeStartedAt + JUDGE_RISE_MS))} ms, lead ${Math.round(drawLead)} ms, ${Math.round(glowNow - drawLead - nowMs)} ms after the draw began`
    );
  return /* @__PURE__ */ h(
    Box,
    {
      key: "dash",
      position: "relative",
      flexDirection: "column",
      paddingX: 1,
      overflow: "hidden",
      backgroundColor: DASH_BG,
      borderStyle: "round",
      borderColor: DASH_EDGE
    },
    Svg ? (
      // Auto off: the art goes, so the bar reads as resting, not working.
      v.auto ? /* @__PURE__ */ h(Box, { key: "dash-art", position: "absolute", top: -1, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: DASH_SVG, alt: "context-lens", width: FROST_WIDTH * 2, height: FROST_HEIGHT * 2 })) : null
    ) : null,
    autoGlowing ? /* @__PURE__ */ h(Box, { key: "dash-auto-glow", position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, /* @__PURE__ */ h(
      Svg,
      {
        source: inPhase(autoGlowSvg(v.auto), nowMs - autoOnAt),
        alt: "auto glow",
        width: AUTO_GLOW_W,
        height: AUTO_GLOW_H
      }
    )) : null,
    Svg && glowSource ? /* @__PURE__ */ h(Box, { key: "dash-judge-glow", position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, /* @__PURE__ */ h(Svg, { source: glowSource, alt: "deciding glow", width: AUTO_GLOW_W, height: AUTO_GLOW_H })) : null,
    /* @__PURE__ */ h(Box, { key: "dash-title", flexDirection: "row", alignItems: "center" }, /* @__PURE__ */ h(
      Box,
      {
        key: "dash-words",
        position: "relative",
        flexDirection: "row",
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        overflow: "hidden"
      },
      /* @__PURE__ */ h(Box, { flexShrink: 0, flexDirection: "row" }, Svg ? (
        // The mark, as it is, where the ✦ stood; faded while Auto is off.
        /* @__PURE__ */ h(Box, { key: "dash-mark", flexShrink: 0, marginRight: 1, alignItems: "center" }, /* @__PURE__ */ h(
          Svg,
          {
            source: v.auto ? MARK_SVG : DASH_MARK_OFF,
            alt: "context-lens",
            width: DASH_MARK_SIZE,
            height: DASH_MARK_SIZE
          }
        ))
      ) : /* @__PURE__ */ h(Text, { color: v.auto ? ACCENT : DASH_DIM, bold: true }, "✦", " "), /* @__PURE__ */ h(Text, { key: "dash-level", color: wordColor, bold: true }, judgingHere && Svg ? modelName ? `${modelName} · Deciding` : "Deciding" : pair), judgingHere && Svg ? /* @__PURE__ */ h(Box, { key: "dash-thinking", flexShrink: 0, marginLeft: 1, alignItems: "center" }, /* @__PURE__ */ h(Svg, { source: thinkingSvg(), alt: "deciding", width: THINK_W, height: PILL_H })) : null),
      rest ? /* @__PURE__ */ h(Box, { flexShrink: 1, minWidth: 0 }, /* @__PURE__ */ h(Text, { color: DASH_TEXT, bold: true, wrap: "truncate" }, rest)) : null
    ), /* @__PURE__ */ h(Box, { minWidth: 1 }), /* @__PURE__ */ h(Box, { key: "dash-actions", flexShrink: 0, flexDirection: "row", gap: 1, alignItems: "center", marginLeft: 1 }, /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }), Svg ? (
      // Each Auto as a switch, drawn, with a blank button laid over it to take the click (the cog's pattern).
      [
        {
          key: "dash-auto-model",
          word: "model",
          on: v.autoModel,
          flipAt: autoModelFlipAt,
          toggle: () => toggleAutoModel($)
        },
        { key: "dash-auto", word: "effort", on: v.auto, flipAt: autoFlipAt, toggle: () => toggleAutoEffort($) }
      ].map((autoSwitch) => /* @__PURE__ */ h(
        Box,
        {
          key: `${autoSwitch.key}-switch`,
          position: "relative",
          flexDirection: "row",
          alignItems: "center",
          gap: 1,
          paddingX: 1
        },
        /* @__PURE__ */ h(
          Svg,
          {
            source: autoSwitchSvg(autoSwitch.on, nowMs - autoSwitch.flipAt),
            alt: `Auto ${autoSwitch.word} ${autoSwitch.on ? "on" : "off"}`,
            width: 26,
            height: 15
          }
        ),
        /* @__PURE__ */ h(Text, { color: autoSwitch.on ? DASH_TEXT : DASH_DIM }, `Auto ${autoSwitch.word}`),
        /* @__PURE__ */ h(
          Box,
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center"
          },
          /* @__PURE__ */ h(Button, { key: autoSwitch.key, plain: true, label: " ".repeat(32), onPress: autoSwitch.toggle })
        )
      ))
    ) : autoButtons, Svg ? buttons.slice(0, -1) : buttons, Svg ? (
      // The cog sits in the flow and the button in an absolute layer after it: an absolute layer paints over plain
      // ones, and the desktop ignores position="relative" on a Box without absolute children. A Button is at most as
      // wide as its box, so the box keeps a cell of padding each side of the cog for the hover box.
      /* @__PURE__ */ h(Box, { key: "dash-settings-icon", position: "relative", alignItems: "center", justifyContent: "center", paddingX: 1 }, /* @__PURE__ */ h(Svg, { source: settingsSvg(DASH_TEXT), alt: "Settings", width: 14, height: 14 }), /* @__PURE__ */ h(
        Box,
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center"
        },
        buttons[buttons.length - 1]
      ))
    ) : null)),
    hintLine({ Box, Text }, hint, detail || " ", "dash-detail"),
    lens
  );
}

// hooks/render/handoff-bar.tsx
import { atom as atom18, update as update17 } from "claude-code";
var handoffPick2 = atom18({ plugin: "context-lens", key: "handoffPick" }, null);
async function handoffBar($, e, choice) {
  const elements = themedEls($.ui.resolve(e));
  const { Box, Text, Button } = elements;
  const Svg = "Svg" in elements ? elements.Svg : void 0;
  const Select = e.surface !== "mobile" && "Select" in elements ? elements.Select : void 0;
  const afterOptions = [
    { value: "continue", label: "Clear & carry on" },
    { value: "confirm", label: "Clear & wait" },
    { value: "copy", label: "Keep chat & copy" }
  ];
  const setBar = (change) => async () => {
    if (change.kind && change.kind !== choice.kind) setKindFlipAt(await $.clock.now());
    await update17($, handoffPick2, () => ({ ...choice, ...change }));
  };
  const what = handoffWhat(choice, config.handoffSkill);
  const term = e.surface === "terminal";
  const kindNow = await $.clock.now();
  const controls = [
    // Desktop: one switch with both words, the knob under the picked one (like Auto), each half a blank button.
    !term && Svg ? /* @__PURE__ */ h(Box, { key: "handoff-kind", position: "relative", flexShrink: 0, flexDirection: "row", alignItems: "center" }, /* @__PURE__ */ h(Box, { width: KIND_CELLS * 2, height: 1, flexShrink: 0 }), /* @__PURE__ */ h(Box, { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ h(
      Svg,
      {
        source: kindSwitchSvg(choice.kind, kindNow - kindFlipAt),
        alt: choice.kind === "full" ? "Full handoff" : "Quick handoff",
        width: KIND_W,
        height: KIND_H
      }
    )), /* @__PURE__ */ h(Box, { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center" }, ["quick", "full"].map((k) => /* @__PURE__ */ h(
      Box,
      {
        key: `handoff-kind-${k}`,
        flexGrow: 1,
        width: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center"
      },
      /* @__PURE__ */ h(Box, { flexShrink: 0, width: 2, alignItems: "center" }, /* @__PURE__ */ h(
        Svg,
        {
          source: rowIconSvg(k, choice.kind === k ? "#141416" : DASH_DIM),
          alt: k === "quick" ? "bolt" : "pen",
          width: 14,
          height: 14
        }
      )),
      /* @__PURE__ */ h(Text, { color: choice.kind === k ? "#141416" : DASH_DIM }, k === "quick" ? "Quick" : "Full")
    ))), /* @__PURE__ */ h(Box, { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center" }, ["quick", "full"].map((k) => /* @__PURE__ */ h(Box, { key: `handoff-kind-hit-${k}`, flexGrow: 1, width: 0, justifyContent: "center" }, /* @__PURE__ */ h(
      Button,
      {
        key: `handoff-${k}`,
        plain: true,
        hover: { backgroundColor: "#00000000" },
        label: " ".repeat(KIND_CELLS),
        onPress: setBar({ kind: k })
      }
    ))))) : null,
    term || !Svg ? choice.kind === "quick" ? /* @__PURE__ */ h(
      Button,
      {
        key: "handoff-quick",
        hotkey: term ? "q" : void 0,
        variant: "secondary",
        label: "Quick",
        onPress: setBar({ kind: "quick" })
      }
    ) : /* @__PURE__ */ h(
      Button,
      {
        key: "handoff-quick",
        hotkey: term ? "q" : void 0,
        plain: true,
        dimColor: true,
        label: "Quick",
        onPress: setBar({ kind: "quick" })
      }
    ) : null,
    term || !Svg ? choice.kind === "full" ? /* @__PURE__ */ h(
      Button,
      {
        key: "handoff-full",
        hotkey: term ? "f" : void 0,
        variant: "secondary",
        label: "Full",
        onPress: setBar({ kind: "full" })
      }
    ) : /* @__PURE__ */ h(
      Button,
      {
        key: "handoff-full",
        hotkey: term ? "f" : void 0,
        plain: true,
        dimColor: true,
        label: "Full",
        onPress: setBar({ kind: "full" })
      }
    ) : null,
    ...Select ? [
      /* @__PURE__ */ h(
        Select,
        {
          key: "handoff-after",
          value: choice.after,
          options: afterOptions,
          onSelect: (v) => setBar({ after: v })()
        }
      )
    ] : optionButtons(
      Button,
      "handoff-after",
      choice.after,
      afterOptions,
      (v) => setBar({ after: v })()
    ),
    /* @__PURE__ */ h(Button, { key: "handoff-go", variant: "primary", autoFocus: true, label: "Go", onPress: () => goHandoff($, choice) }),
    /* @__PURE__ */ h(Button, { key: "handoff-close", plain: true, role: "dismiss", label: "✕", onPress: () => closeHandoffBar($) })
  ];
  const line = e.surface === "terminal" ? `${what.by}. ${what.then}` : choice.kind === "full" ? config.handoffSkill ? `/${config.handoffSkill}` : "Saves HANDOFF.md" : "A few seconds";
  if (e.surface === "terminal") return terminalPanel($, e, "handoff-bar", "⇥ Handoff", line, controls);
  return (
    // The art is a still image here: an animated one sits in a frame the app rebuilds on every redraw, and the bar
    // redraws on every choice. The title over the line on what happens, on the left; the controls on the right in
    // their own absolute layer, drawn last: the app draws anything in the flow under the absolute art, where it takes
    // no clicks.
    /* @__PURE__ */ h(
      Box,
      {
        key: "handoff-bar",
        position: "relative",
        flexDirection: "row",
        alignItems: "center",
        paddingX: 1,
        overflow: "hidden",
        backgroundColor: BRAND_BG,
        borderStyle: "round",
        borderColor: BRAND_EDGE
      },
      Svg ? /* @__PURE__ */ h(Box, { key: "handoff-art", position: "absolute", top: -1, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: BRAND_SVG, alt: "context-lens", width: FROST_WIDTH * 2, height: FROST_HEIGHT * 2 })) : null,
      introLayer({ Box, Svg }, "handoff", await introShows($, "handoff")),
      /* @__PURE__ */ h(Box, { key: "handoff-words", position: "relative", flexDirection: "row", gap: 1, flexShrink: 1, minWidth: 0 }, /* @__PURE__ */ h(Text, { color: ACCENT, bold: true, wrap: "truncate" }, "⇥ Handoff"), /* @__PURE__ */ h(Text, { key: "handoff-what", dimColor: true, wrap: "truncate" }, line)),
      /* @__PURE__ */ h(Box, { flexGrow: 1, minWidth: 48 }),
      /* @__PURE__ */ h(
        Box,
        {
          key: "handoff-actions",
          position: "absolute",
          top: 0,
          right: 1,
          bottom: 0,
          flexDirection: "row",
          gap: 1,
          alignItems: "center"
        },
        !term ? /* @__PURE__ */ h(
          Button,
          {
            key: "handoff-to-compact",
            plain: true,
            dimColor: true,
            label: "Compact instead",
            onPress: async () => {
              await closeHandoffBar($);
              await openCompact($, e);
            }
          }
        ) : null,
        controls
      )
    )
  );
}

// hooks/render/handoff-card.tsx
function handoffCardTree($, e, fresh, above, onDismiss) {
  const elements = themedEls($.ui.resolve(e));
  const { Box, Text, Button } = elements;
  const Svg = "Svg" in elements ? elements.Svg : void 0;
  const by = fresh.full ? "Full" : "Quick";
  const words = {
    writing: [
      "✦ Handing off…",
      `${by} handoff being written. ${fresh.full ? "Your skill takes a little while." : "A few seconds."}`
    ],
    done: ["✦ Handoff complete", "Carried on from the last chat. The old one is cleared."],
    copied: ["✦ Handoff copied", "Paste it into a new chat. This one stays."],
    compacting: ["✦ Compacting…", "The chat is being summed up. Takes a minute or so."],
    compacted: ["✦ Compact complete", "The chat is summed up; the next message reads far less."]
  }[fresh.kind];
  const quiet = fresh.kind === "compacting";
  const card = /* @__PURE__ */ h(
    Box,
    {
      key: "reply-handoff",
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
      paddingX: 1,
      overflow: "hidden",
      backgroundColor: cardLanded(fresh.kind) ? DONE_BG : BRAND_BG,
      borderStyle: "round",
      borderColor: cardLanded(fresh.kind) ? DONE_EDGE : BRAND_EDGE
    },
    Svg ? /* @__PURE__ */ h(Box, { key: "reply-handoff-art", position: "absolute", top: -1, right: 0, bottom: -1 }, quiet ? /* @__PURE__ */ h(Svg, { source: DASH_SVG, alt: "compacting", width: FROST_WIDTH * 2, height: FROST_HEIGHT * 2 }) : cardRunning(fresh.kind) ? /* @__PURE__ */ h(Svg, { source: HANDOFF_SVG, alt: "handing off", width: FROST_WIDTH * 2, height: FROST_HEIGHT * 2 }) : /* @__PURE__ */ h(
      Svg,
      {
        source: cardLanded(fresh.kind) ? DONE_SVG : BRAND_SVG,
        alt: "context-lens",
        width: FROST_WIDTH * 2,
        height: FROST_HEIGHT * 2
      }
    )) : null,
    /* @__PURE__ */ h(
      Box,
      {
        key: "reply-handoff-words",
        position: "relative",
        flexDirection: quiet ? "row" : "column",
        gap: quiet ? 1 : 0,
        flexShrink: 1,
        minWidth: 0
      },
      markTitle(
        { Box, Text, Svg },
        "reply-handoff-title",
        cardLanded(fresh.kind) ? DONE_ACCENT : ACCENT,
        words[0],
        cardLanded(fresh.kind) ? DONE_MARK_SVG : MARK_SVG
      ),
      /* @__PURE__ */ h(Text, { wrap: "truncate" }, words[1])
    ),
    onDismiss ? /* @__PURE__ */ h(Box, { key: "reply-handoff-close", position: "relative", flexGrow: 1, flexDirection: "row", justifyContent: "flex-end" }, /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }), /* @__PURE__ */ h(Box, { key: "card-close-box", position: "relative", flexShrink: 0 }, /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }), /* @__PURE__ */ h(
      Button,
      {
        key: "card-close",
        plain: true,
        role: "dismiss",
        label: "✕",
        hover: { backgroundColor: CARD_CLOSE_HOVER },
        onPress: onDismiss
      }
    ))) : null
  );
  if (above === void 0) return card;
  return /* @__PURE__ */ h(Box, { key: "reply", flexDirection: "column", gap: 1 }, above, card);
}

// hooks/render/settings-panel.tsx
import { atom as atom19, read as read16, update as update18 } from "claude-code";
var settingsOpen3 = atom19({ plugin: "context-lens", key: "settingsOpen" }, false);
var installedSkills2 = atom19({ plugin: "context-lens", key: "installedSkills" }, []);
var settingsDraft3 = atom19({ plugin: "context-lens", key: "settingsDraft" }, {});
var settingsCard = atom19({ plugin: "context-lens", key: "settingsCard" }, null);
var UNINSTALL_ARM_MS = 4e3;
var uninstallArmedAt = 0;
var uninstalling = false;
var RELOAD_ARGS = "--force";
function uninstallButton($, els) {
  const { Box, Text, Button } = els;
  const Svg = "Svg" in els ? els.Svg : void 0;
  const armed = Date.now() - uninstallArmedAt < UNINSTALL_ARM_MS;
  const press = async () => {
    if (uninstalling) return;
    if (!armed) {
      uninstallArmedAt = Date.now();
      $.ui.invalidate("ui.render");
      $.clock.after(UNINSTALL_ARM_MS + 50, () => $.ui.invalidate("ui.render"));
      return;
    }
    uninstalling = true;
    $.ui.invalidate("ui.render");
    const r = await runClaude($, ["plugin", "uninstall", pluginId($)], { timeoutMs: 12e4 }).catch((error) => ({
      exitCode: 1,
      stdout: "",
      stderr: String(error)
    }));
    uninstalling = false;
    if (r.exitCode !== 0) {
      const why = (r.stderr || r.stdout).trim().split("\n").pop() ?? "";
      $.ui.toast(`context-lens: uninstall failed: ${noClaudeHint(why, await homeDir($)) ?? why}`);
      $.ui.invalidate("ui.render");
      return;
    }
    $.ui.toast("context-lens is uninstalled. Thanks for trying it.");
    const reloaded = await $.command.run({ command: "reload-plugins", args: RELOAD_ARGS }).then(
      () => true,
      () => false
    );
    if (!reloaded) await typeCommand($, `/reload-plugins ${RELOAD_ARGS}`);
  };
  const label = uninstalling ? "Uninstalling…" : armed ? "Press again to uninstall" : "Uninstall";
  if (!Svg) return /* @__PURE__ */ h(Button, { key: "settings-uninstall", plain: true, dimColor: !armed, label, onPress: press });
  const red = armed || uninstalling;
  return /* @__PURE__ */ h(Box, { key: "settings-uninstall-box", position: "relative", flexDirection: "row", alignItems: "center", flexShrink: 0 }, /* @__PURE__ */ h(Box, { position: "relative", width: 2, height: 1, alignItems: "center" }, /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }, /* @__PURE__ */ h(Svg, { source: binSvg(DASH_DIM), alt: "bin", width: 14, height: 14 })), /* @__PURE__ */ h(
    Box,
    {
      position: "absolute",
      top: 0,
      left: 0,
      display: red ? "flex" : "none",
      hover: red ? void 0 : { scope: "uninstall", display: "flex" }
    },
    /* @__PURE__ */ h(Svg, { source: binSvg(UNINSTALL_RED), alt: "bin", width: 14, height: 14 })
  )), /* @__PURE__ */ h(Text, { color: red ? UNINSTALL_RED : DASH_DIM, hover: { scope: "uninstall", color: UNINSTALL_RED } }, label), /* @__PURE__ */ h(Box, { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }, /* @__PURE__ */ h(
    Button,
    {
      key: "settings-uninstall",
      plain: true,
      hover: { scope: "uninstall", backgroundColor: "#00000000" },
      label: " ".repeat(label.length + 3),
      onPress: press
    }
  )));
}
var settingSwitches = /* @__PURE__ */ new Map();
var CARDS = [
  {
    id: "auto",
    title: "Auto",
    about: "How Auto picks. The slider tips the judge's close calls; Never below and Never above bound every pick."
  },
  { id: "subagents", title: "Subagents", about: "What the subagents the chat sends off run on." },
  {
    id: "context",
    title: "Context",
    about: "What happens as the chat fills up: the alert, compacting and the handoff."
  },
  { id: "look", title: "Look", about: "How context-lens looks and which parts of it show. Uninstall removes it." }
];
var BIAS_WORDS = ["Cheapest", "Cheaper", "Balanced", "Smarter", "Smartest"];
var THEME_LABELS = { violet: "Violet", orange: "Claude orange", rose: "Cherry blossom" };
async function settingsPanel($, e) {
  const elements = themedEls($.ui.resolve(e));
  const { Box, Text, Button } = elements;
  const Svg = "Svg" in elements ? elements.Svg : void 0;
  const Select = e.surface !== "mobile" && "Select" in elements ? elements.Select : void 0;
  const roomy = (typeof e.props.maxRows === "number" ? e.props.maxRows : 12) >= 12;
  const opts = (values) => values.map((value) => ({ value, label: value }));
  const skillNames = await read16($, installedSkills2);
  const close = async () => {
    await update18($, settingsDraft3, () => ({}));
    await update18($, settingsCard, () => null);
    await update18($, settingsOpen3, () => false);
    $.ui.invalidate("ui.render");
  };
  const draft = await read16($, settingsDraft3);
  const card = await read16($, settingsCard);
  const openCard = (to) => async () => {
    await update18($, settingsCard, () => to);
    $.ui.invalidate("ui.render");
  };
  const set = (field) => async (value) => {
    await update18($, settingsDraft3, (d) => ({ ...d, [field]: value }));
    $.ui.invalidate("ui.render");
  };
  const shown = {
    bias: draft.bias !== void 0 ? Number(draft.bias) : config.bias,
    floor: draft.floor ?? config.floor,
    ceiling: draft.ceiling ?? config.ceiling,
    handoffAfter: draft.handoffAfter ?? config.handoffAfter,
    handoffSkill: draft.handoffSkill ?? config.handoffSkill,
    swampAt: draft.swampAt ?? String(config.swampAt),
    layout: draft.layout ?? config.layout,
    compactWith: draft.compactWith ?? config.compactWith,
    handoffButton: draft.handoffButton ?? config.handoffButton,
    subagents: draft.subagents ?? config.subagents,
    subagentModel: draft.subagentModel ?? config.subagentModel,
    overrideDefinitions: draft.overrideDefinitions ?? config.overrideDefinitions,
    holdOffer: draft.holdOffer ?? config.holdOffer,
    theme: draft.theme ?? config.theme,
    appearance: draft.appearance ?? config.appearance
  };
  const panelNow = await $.clock.now();
  const sameSet = (a, b) => a.split(",").filter(Boolean).sort().join() === b.split(",").filter(Boolean).sort().join();
  const dirty = Object.entries(draft).some(
    ([field, value]) => value === void 0 ? false : field === "hide" ? !sameSet(value, config.hide.join(",")) : value !== String(config[field] ?? "")
  );
  const hidden = (draft.hide ?? config.hide.join(",")).split(",").filter(Boolean);
  const withPart = (part, off) => (off ? [.../* @__PURE__ */ new Set([...hidden, part])] : hidden.filter((h2) => h2 !== part)).join(",");
  const contextAlert = hidden.includes("swamp") ? "off" : shown.swampAt;
  const handoffButton = hidden.includes("handoff") ? "hidden" : shown.handoffButton;
  const showParts = [
    ["timer", "Cache timer"],
    ["reason", "Judge line"],
    ["hot", "Running-low alert"],
    ["cold", "Cold-cache alert"]
  ];
  const summaries = {
    auto: `${BIAS_WORDS[shown.bias + 2]} · ${shown.floor} to ${shown.ceiling}${shown.holdOffer === "on" ? " · held offers" : ""}`,
    subagents: `${shown.subagents !== "on" ? "Off" : shown.subagentModel === "on" ? "Effort and cheaper model" : "Effort picked"} · definitions ${shown.overrideDefinitions === "on" ? "overridden" : "kept"}`,
    context: `${contextAlert === "off" ? "Alert off" : `Alert at ${contextAlert}%`} · ${shown.compactWith === "session" ? "Chat's model" : "Haiku"} · ${shown.handoffSkill ? `/${shown.handoffSkill}` : "built-in handoff"}`,
    look: `${shown.layout === "minimal" ? "Minimal" : "Dashboard"} · ${THEME_LABELS[shown.theme] ?? shown.theme} · ${showParts.filter(([part]) => !hidden.includes(part)).length} of ${showParts.length} shown`
  };
  const box = ([part, label]) => {
    const off = hidden.includes(part);
    return /* @__PURE__ */ h(
      Button,
      {
        key: `show-box-${part}`,
        plain: true,
        dimColor: off,
        label: `${off ? "☐" : "☑"}︎ ${label}`,
        onPress: () => set("hide")(withPart(part, !off))
      }
    );
  };
  const settingSwitch = (p) => {
    const last = settingSwitches.get(p.key);
    const flipAt = last && last.on !== p.on ? panelNow : last?.at ?? 0;
    settingSwitches.set(p.key, { on: p.on, at: flipAt });
    return /* @__PURE__ */ h(Box, { key: `${p.key}-row`, width: "100%", flexDirection: "row", alignItems: "center", gap: 1 }, Svg && !term ? /* @__PURE__ */ h(
      Box,
      {
        key: p.key,
        position: "relative",
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
        paddingX: 1,
        flexShrink: 0
      },
      /* @__PURE__ */ h(
        Svg,
        {
          source: autoSwitchSvg(p.on, panelNow - flipAt),
          alt: `${p.label} ${p.on ? "on" : "off"}`,
          width: 26,
          height: 15
        }
      ),
      /* @__PURE__ */ h(Text, { color: p.on && !p.dim ? DASH_TEXT : DASH_DIM }, p.label),
      /* @__PURE__ */ h(
        Box,
        {
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        },
        /* @__PURE__ */ h(Box, { flexShrink: 0 }, /* @__PURE__ */ h(
          Button,
          {
            key: `${p.key}-switch`,
            plain: true,
            hover: { backgroundColor: "#00000000" },
            label: " ".repeat(60),
            onPress: p.onPress
          }
        ))
      )
    ) : /* @__PURE__ */ h(
      Button,
      {
        key: `${p.key}-switch`,
        plain: true,
        dimColor: p.dim,
        label: `${p.on ? "◉" : "○"} ${p.label}`,
        onPress: p.onPress
      }
    ), /* @__PURE__ */ h(Text, { dimColor: true, wrap: "truncate" }, p.about));
  };
  const unlessSet = shown.overrideDefinitions === "on" ? ", unless its Agent call names one" : ", unless its definition or Agent call sets one";
  const flip = (field) => () => set(field)(shown[field] === "on" ? "off" : "on");
  const track = [];
  for (const n of [-2, -1, 0, 1, 2]) {
    if (n > -2)
      track.push(
        /* @__PURE__ */ h(Text, { key: `t${n}`, dimColor: true }, "─")
      );
    track.push(
      /* @__PURE__ */ h(Button, { key: `bias${n + 2}`, plain: true, label: n === shown.bias ? "◉" : "○", onPress: () => set("bias")(String(n)) })
    );
  }
  const term = e.surface === "terminal";
  const settingRow = (p) => term && p.options.length <= 5 || !Select ? /* @__PURE__ */ h(Box, { key: p.key, width: "100%", flexDirection: "row", flexWrap: "wrap", columnGap: 1, alignItems: "center" }, p.label ? /* @__PURE__ */ h(Text, { key: `${p.key}-label`, dimColor: true }, p.label) : null, optionButtons(Button, p.key, p.value, p.options, p.onSelect)) : /* @__PURE__ */ h(Select, { key: p.key, label: p.label, value: p.value, options: p.options, onSelect: p.onSelect });
  if (probeLevel === 1) {
    return /* @__PURE__ */ h(Box, { key: "probe", borderStyle: "round", borderColor: BRAND_EDGE, paddingX: 1 }, /* @__PURE__ */ h(Text, null, "context-lens probe 1: a bare box"));
  }
  const frameOnly = probeLevel === 2;
  const bare = probeLevel === 3;
  const headRow = (kids) => term ? /* @__PURE__ */ h(Box, { key: "settings-head", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 2 }, kids) : kids;
  return (
    // The dashboard's look: the neutral band and its quiet edge, purple only on the star, no art behind the rows (it
    // made them busy). The entrance
    // sweep plays once, behind everything, as the panel opens.
    /* @__PURE__ */ h(
      Box,
      {
        key: "settings",
        position: "relative",
        flexDirection: "column",
        gap: roomy && !term ? 1 : 0,
        paddingX: term ? 1 : 2,
        overflow: "hidden",
        backgroundColor: DASH_BG,
        borderStyle: "round",
        borderColor: DASH_EDGE
      },
      term ? null : introLayer({ Box, Svg }, "settings", await introShows($, "settings")),
      Svg && !term ? /* @__PURE__ */ h(
        Box,
        {
          key: "settings-bar",
          position: "absolute",
          top: -1,
          left: 0,
          right: 0,
          height: 3.5,
          overflow: "hidden",
          backgroundColor: DASH_HEAD
        },
        /* @__PURE__ */ h(Box, { key: "settings-bar-mark", position: "absolute", top: -2, right: 20, marginTop: 1 }, /* @__PURE__ */ h(Svg, { source: SETTINGS_MARK, alt: "context-lens mark", width: 140, height: 140 })),
        /* @__PURE__ */ h(Box, { key: "settings-rule", position: "absolute", bottom: 0, left: 0, right: 0, height: 1, alignItems: "flex-end" }, /* @__PURE__ */ h(
          Svg,
          {
            source: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1" viewBox="0 0 1600 1" preserveAspectRatio="none"><rect width="1600" height="1" fill="${DASH_EDGE}"/></svg>`,
            alt: "rule",
            width: 1600,
            height: 1
          }
        ))
      ) : null,
      headRow([
        /* @__PURE__ */ h(
          Box,
          {
            key: "settings-title",
            ...term ? { flexShrink: 0 } : { position: "absolute", top: 0, left: 2, height: 2.5 },
            flexDirection: "row",
            alignItems: "center",
            gap: 1
          },
          term ? /* @__PURE__ */ h(Text, { color: ACCENT, bold: true }, "✦") : null,
          Svg && !term ? /* @__PURE__ */ h(Svg, { source: SETTINGS_TITLE, alt: "context-lens", width: 112, height: 28 }) : /* @__PURE__ */ h(Text, { color: DASH_TEXT, bold: true }, "context-lens"),
          ownVersion ? /* @__PURE__ */ h(Text, { color: "#6b6b73" }, "v", ownVersion) : null,
          card === null ? /* @__PURE__ */ h(Text, { dimColor: true }, "Settings") : /* @__PURE__ */ h(Box, { key: "settings-trail", flexDirection: "row", alignItems: "center", gap: 1 }, /* @__PURE__ */ h(Button, { key: "settings-back", variant: "secondary", label: "← Back", onPress: openCard(null) }), /* @__PURE__ */ h(Text, { color: DASH_TEXT, bold: true }, CARDS.find((c) => c.id === card)?.title)),
          dirty ? /* @__PURE__ */ h(Text, { dimColor: true }, " · unsaved changes") : null
        ),
        /* @__PURE__ */ h(
          Box,
          {
            key: "settings-actions",
            ...term ? { flexShrink: 1, flexWrap: "wrap", columnGap: 2 } : { position: "absolute", top: 0, right: 2, height: 2.5, gap: 2 },
            flexDirection: "row",
            alignItems: "center"
          },
          dirty ? /* @__PURE__ */ h(Button, { key: "settings-save", variant: "primary", hotkey: "s", label: "Save", onPress: () => saveDraft($) }) : /* @__PURE__ */ h(Button, { key: "settings-save", variant: "secondary", dimColor: true, label: "Save", onPress: () => {
          } }),
          /* @__PURE__ */ h(Button, { key: "settings-close", plain: true, label: "✕", onPress: close })
        )
      ]),
      term ? null : /* @__PURE__ */ h(Box, { key: "settings-spacer", height: roomy ? 2 : 1 }),
      frameOnly ? null : card === null ? (
        // The overview: a card per part, what it is set to in a few words. A card opens that part alone.
        /* @__PURE__ */ h(Box, { key: "settings-cards", flexDirection: "row", flexWrap: "wrap", columnGap: 1, rowGap: term ? 0 : 1 }, /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }), CARDS.map((c) => /* @__PURE__ */ h(
          Box,
          {
            key: `card-${c.id}`,
            position: "relative",
            flexDirection: "column",
            flexGrow: 1,
            width: 0,
            minWidth: 18,
            paddingX: 1,
            borderStyle: "round",
            borderColor: DASH_EDGE,
            hover: { backgroundColor: CARD_HOVER, borderColor: CARD_HOVER_EDGE }
          },
          /* @__PURE__ */ h(Box, { flexDirection: "row", gap: 1, alignItems: "center" }, Svg && !term ? /* @__PURE__ */ h(Svg, { source: rowIconSvg(c.id, DASH_TEXT), alt: c.title, width: 14, height: 14 }) : null, term ? /* @__PURE__ */ h(Button, { key: `settings-card-${c.id}`, plain: true, label: `${c.title} ›`, onPress: openCard(c.id) }) : /* @__PURE__ */ h(Text, { color: DASH_TEXT, bold: true, hover: { color: "#ffffff" } }, c.title)),
          /* @__PURE__ */ h(Text, { dimColor: true, wrap: "truncate", hover: { dimColor: false, color: DASH_TEXT } }, summaries[c.id]),
          term ? null : /* @__PURE__ */ h(
            Box,
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              flexDirection: "column",
              justifyContent: "space-between"
            },
            ["", "-2", "-3"].map((n) => /* @__PURE__ */ h(
              Box,
              {
                key: `settings-card-box-${c.id}${n}`,
                flexDirection: "row",
                justifyContent: "center",
                overflow: "hidden"
              },
              /* @__PURE__ */ h(Box, { flexShrink: 0 }, /* @__PURE__ */ h(
                Button,
                {
                  key: `settings-card-${c.id}${n}`,
                  plain: true,
                  hover: { backgroundColor: "#00000000" },
                  label: " ".repeat(800),
                  onPress: openCard(c.id)
                }
              ))
            ))
          )
        )))
      ) : (
        // One part: Back, its name and what it does, then its controls.
        /* @__PURE__ */ h(
          Box,
          {
            key: `settings-${card}`,
            flexDirection: "column",
            gap: roomy && !term ? 1 : 0,
            minHeight: term ? void 0 : SETTINGS_BODY_H
          },
          /* @__PURE__ */ h(Box, { position: "absolute", top: 0, left: 0 }),
          /* @__PURE__ */ h(Text, { dimColor: true, wrap: "truncate" }, CARDS.find((c) => c.id === card)?.about),
          /* @__PURE__ */ h(Box, { flexDirection: "row", flexWrap: "wrap", gap: 1, alignItems: "center" }, card === "auto" ? [
            /* @__PURE__ */ h(Text, { key: "cheap", dimColor: true }, "Cheaper"),
            /* @__PURE__ */ h(Box, { key: "track", flexDirection: "row", alignItems: "center" }, track),
            /* @__PURE__ */ h(Text, { key: "smart", dimColor: true }, "Smarter"),
            ...bare ? [] : [
              /* @__PURE__ */ h(Box, { key: "gap", width: 2 }),
              settingRow({
                key: "settings-floor",
                label: "Never below",
                value: shown.floor,
                options: opts(EFFORTS),
                onSelect: set("floor")
              }),
              settingRow({
                key: "settings-ceiling",
                label: "Never above",
                value: shown.ceiling,
                options: opts(EFFORTS),
                onSelect: set("ceiling")
              }),
              settingSwitch({
                key: "settings-hold-offer",
                label: "Hold the prompt for a model offer",
                on: shown.holdOffer === "on",
                onPress: flip("holdOffer"),
                about: shown.holdOffer === "on" ? "With model on Manual, a typed prompt waits for Switch or Keep" : "With model on Manual, a toast suggests the model and the prompt goes on"
              })
            ]
          ] : card === "subagents" ? bare ? [] : [
            settingSwitch({
              key: "settings-subagents",
              label: "Effort for subagents",
              on: shown.subagents === "on",
              onPress: flip("subagents"),
              about: `${shown.subagents === "on" ? "The judge picks each subagent's effort, medium or more" : "Subagents run at the chat's effort"}${unlessSet}`
            }),
            settingSwitch({
              key: "settings-subagent-model",
              label: "Cheaper model for subagents",
              on: shown.subagentModel === "on",
              dim: shown.subagents !== "on",
              onPress: flip("subagentModel"),
              about: shown.subagents !== "on" ? "Needs Effort for subagents" : shown.subagentModel === "on" ? `A subagent the judge calls simple runs on a cheaper model, never a dearer one${unlessSet}` : "A subagent keeps the model it was given"
            }),
            settingSwitch({
              key: "settings-override-definitions",
              label: "Override definitions",
              on: shown.overrideDefinitions === "on",
              onPress: flip("overrideDefinitions"),
              about: shown.overrideDefinitions === "on" ? "The judge's picks replace a definition's model and effort; an Agent call's own stay" : "A subagent keeps the model and effort its definition sets"
            })
          ] : card === "context" ? bare ? [] : [
            settingRow({
              key: "settings-swamp",
              label: "Context alert",
              value: contextAlert,
              options: [
                { value: "off", label: "Off" },
                ...SWAMP_STEPS.map((n) => ({ value: String(n), label: `At ${n}%` }))
              ],
              onSelect: async (v) => {
                await set("hide")(withPart("swamp", v === "off"));
                if (v !== "off") await set("swampAt")(v);
              }
            }),
            settingRow({
              key: "settings-compact-with",
              label: "Compact with",
              value: shown.compactWith,
              options: [
                { value: "haiku", label: "Haiku 5.5" },
                { value: "session", label: "Chat's model" }
              ],
              onSelect: set("compactWith")
            }),
            settingRow({
              key: "settings-skill",
              label: "Handoff skill",
              value: shown.handoffSkill || "-",
              options: [
                { value: "-", label: "Built in" },
                ...[.../* @__PURE__ */ new Set([...shown.handoffSkill ? [shown.handoffSkill] : [], ...skillNames])].map(
                  (name) => ({ value: name, label: `/${name}` })
                )
              ],
              onSelect: (v) => set("handoffSkill")(v === "-" ? "" : v)
            }),
            settingRow({
              key: "settings-handoff-button",
              label: "Handoff button",
              value: handoffButton,
              options: [
                { value: "hidden", label: "Hidden" },
                { value: "advised", label: "When advised" },
                { value: "always", label: "Always" }
              ],
              onSelect: async (v) => {
                await set("hide")(withPart("handoff", v === "hidden"));
                if (v !== "hidden") await set("handoffButton")(v);
              }
            })
          ] : [
            ...bare ? [] : [
              settingRow({
                key: "settings-layout",
                label: "Look",
                value: shown.layout,
                options: [
                  { value: "default", label: "Dashboard" },
                  { value: "minimal", label: "Minimal" }
                ],
                onSelect: set("layout")
              }),
              settingRow({
                key: "settings-appearance",
                label: "Appearance",
                value: shown.appearance,
                options: [
                  { value: "auto", label: "Match Claude Code" },
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" }
                ],
                onSelect: set("appearance")
              }),
              settingRow({
                key: "settings-theme",
                label: "Theme",
                value: shown.theme,
                options: THEMES.map((theme) => ({ value: theme, label: THEME_LABELS[theme] })),
                onSelect: set("theme")
              })
            ],
            /* @__PURE__ */ h(
              Box,
              {
                key: "settings-show",
                width: "100%",
                flexDirection: "row",
                flexWrap: "wrap",
                columnGap: 1,
                alignItems: "center"
              },
              /* @__PURE__ */ h(Text, { dimColor: true }, "Show"),
              showParts.map(box)
            ),
            ...bare ? [] : [
              /* @__PURE__ */ h(Box, { key: "settings-uninstall-row", width: "100%", flexDirection: "row" }, uninstallButton($, themedEls($.ui.resolve(e))))
            ]
          ])
        )
      )
    )
  );
}

// hooks/render/setup-guide.tsx
import { atom as atom20, read as read17, update as update19 } from "claude-code";
var installedSkills3 = atom20({ plugin: "context-lens", key: "installedSkills" }, []);
var setupDraft2 = atom20({ plugin: "context-lens", key: "setupDraft" }, {});
async function setupGuide($, e, step) {
  const elements = themedEls($.ui.resolve(e));
  const { Box, Text, Button } = elements;
  const Svg = "Svg" in elements ? elements.Svg : void 0;
  const Select = e.surface !== "mobile" && "Select" in elements ? elements.Select : void 0;
  const draft = await read17($, setupDraft2);
  const shown = setupShown(draft, config);
  const setDraft = (field, value) => update19($, setupDraft2, (d) => ({ ...d, [field]: value }));
  const go = (to) => () => goSetup($, to);
  const back = setupBack(step);
  const counter = setupCounter(step);
  const nav = (forward) => [
    ...back ? [/* @__PURE__ */ h(Button, { key: "setup-back", plain: true, dimColor: true, label: "Back", onPress: go(back) })] : [],
    forward,
    /* @__PURE__ */ h(Button, { key: "setup-close", plain: true, role: "dismiss", label: "✕", onPress: () => closeSetup($) })
  ];
  const nextButton = /* @__PURE__ */ h(Button, { key: "setup-next", variant: "primary", label: "Next", onPress: go(setupNext(step)) });
  const band = (words, room, controls) => e.surface === "terminal" ? terminalPanel(
    $,
    e,
    "setup",
    counter ? `✦ context-lens setup  ${counter}` : "✦ context-lens setup",
    words,
    controls
  ) : /* @__PURE__ */ h(
    Box,
    {
      key: "setup",
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
      paddingX: 1,
      overflow: "hidden",
      backgroundColor: BRAND_BG,
      borderStyle: "round",
      borderColor: BRAND_EDGE
    },
    Svg ? /* @__PURE__ */ h(Box, { key: "setup-art", position: "absolute", top: -1, right: 0, bottom: -1 }, /* @__PURE__ */ h(Svg, { source: BRAND_SVG, alt: "context-lens", width: FROST_WIDTH * 2, height: FROST_HEIGHT * 2 })) : null,
    /* @__PURE__ */ h(Box, { key: "setup-words", position: "relative", flexDirection: "column", flexShrink: 1, minWidth: 0 }, /* @__PURE__ */ h(Text, { color: ACCENT, bold: true, wrap: "truncate" }, counter ? `✦ context-lens setup  ${counter}` : "✦ context-lens setup"), typeof words === "string" ? /* @__PURE__ */ h(Text, { key: "setup-what", wrap: "truncate" }, words) : words),
    /* @__PURE__ */ h(Box, { flexGrow: 1, minWidth: room }),
    /* @__PURE__ */ h(
      Box,
      {
        key: "setup-actions",
        position: "absolute",
        top: 0,
        right: 1,
        bottom: 0,
        flexDirection: "row",
        gap: 1,
        alignItems: "center"
      },
      controls
    )
  );
  if (step === "lean") {
    const lean = shown.bias;
    const track = [];
    for (const n of [-2, -1, 0, 1, 2]) {
      if (n > -2) {
        const lit2 = lean > 0 ? n > 0 && n <= lean : lean < 0 ? n <= 0 && n > lean : false;
        track.push(
          lit2 ? /* @__PURE__ */ h(Text, { key: `t${n}`, color: ACCENT }, "──") : /* @__PURE__ */ h(Text, { key: `t${n}`, dimColor: true }, "──")
        );
      }
      track.push(
        /* @__PURE__ */ h(
          Button,
          {
            key: `setup-bias${n + 2}`,
            plain: true,
            label: n === lean ? "◉" : "○",
            onPress: () => setDraft("bias", String(n))
          }
        )
      );
    }
    const [name, does] = LEAN_STOPS[lean + 2];
    const side = (label, lit2) => lit2 ? /* @__PURE__ */ h(Text, { key: label, color: ACCENT }, label) : /* @__PURE__ */ h(Text, { key: label, dimColor: true }, label);
    return band(
      /* @__PURE__ */ h(Box, { key: "setup-what", flexDirection: "row", flexShrink: 1, minWidth: 0 }, /* @__PURE__ */ h(Text, { color: ACCENT, bold: true, wrap: "truncate" }, `${name}: `), /* @__PURE__ */ h(Text, { wrap: "truncate" }, does)),
      62,
      [
        side("Cheaper", lean < 0),
        /* @__PURE__ */ h(Box, { key: "track", flexDirection: "row", alignItems: "center" }, track),
        side("Smarter", lean > 0),
        ...nav(nextButton)
      ]
    );
  }
  if (step === "handoff") {
    const skillNames = await read17($, installedSkills3);
    const writers = [
      { value: "-", label: "Built in" },
      ...[.../* @__PURE__ */ new Set([...shown.handoffSkill ? [shown.handoffSkill] : [], ...skillNames])].map((name) => ({
        value: name,
        label: `/${name}`
      }))
    ];
    const pickWriter = (v) => setDraft("handoffSkill", v === "-" ? "" : v);
    return band("Who writes a Full ⇥ handoff?", 48, [
      ...Select ? [/* @__PURE__ */ h(Select, { key: "setup-skill", value: shown.handoffSkill || "-", options: writers, onSelect: pickWriter })] : optionButtons(Button, "setup-skill", shown.handoffSkill || "-", writers, pickWriter),
      ...nav(nextButton)
    ]);
  }
  if (step === "look") {
    const mode = shown.appearance;
    return band("Dark or light panels?", 56, [
      ...["auto", "dark", "light"].map((value) => /* @__PURE__ */ h(
        Button,
        {
          key: `setup-look-${value}`,
          plain: true,
          label: `${mode === value ? "◉" : "○"} ${{ auto: "Match Claude Code", dark: "Dark", light: "Light" }[value]}`,
          onPress: () => setDraft("appearance", value)
        }
      )),
      ...nav(nextButton)
    ]);
  }
  return band("⏻ Auto on or off. ⚙ all settings. Auto pauses on Fable.", 24, [
    ...nav(/* @__PURE__ */ h(Button, { key: "setup-done", variant: "primary", autoFocus: true, label: "Done", onPress: () => closeSetup($) }))
  ]);
}

// hooks/handlers/above-prompt.tsx
var isCompacting3 = atom21({ plugin: "context-lens", key: "isCompacting" }, false);
var compactAsk4 = atom21({ plugin: "context-lens", key: "compactAsk" }, false);
var handoffPick3 = atom21({ plugin: "context-lens", key: "handoffPick" }, null);
var swamped2 = atom21({ plugin: "context-lens", key: "swamped" }, null);
var handoffCard4 = atom21({ plugin: "context-lens", key: "handoffCard" }, null);
var swampHiddenAt2 = atom21({ plugin: "context-lens", key: "swampHiddenAt" }, null);
var settingsOpen4 = atom21({ plugin: "context-lens", key: "settingsOpen" }, false);
var judgeDown2 = atom21({ plugin: "context-lens", key: "judgeDown" }, null);
var judgeDownHidden2 = atom21({ plugin: "context-lens", key: "judgeDownHidden" }, null);
var hot2 = atom21({ plugin: "context-lens", key: "hot" }, null);
var setupStep2 = atom21({ plugin: "context-lens", key: "setupStep" }, null);
function registerAbovePromptHooks(on) {
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    void drainSetupSave($).catch(() => void 0);
    await restoreCache($).catch(() => void 0);
    setRenderCalls(renderCalls + 1);
    setLastRenderAt(Date.now());
    void refreshAppearance($).catch(() => void 0);
    setLastRenderProps(JSON.stringify(e.props).slice(0, 200));
    renderLog.push(`${new Date(lastRenderAt).toISOString()} ${loadedSession} ${lastRenderProps}`);
    if (!firstDrawLogged) {
      setFirstDrawLogged(true);
      renderLog.push(
        `${(/* @__PURE__ */ new Date()).toISOString()} ${loadedSession} first draw asked ${lastRenderAt - loadedAt} ms after load`
      );
      void writeRenderLog($).catch(() => void 0);
    }
    try {
      if (timersFrom === null && !timersScheduled) {
        try {
          setTimersScheduled(
            Boolean(
              $.clock.after(0, () => {
                readOwnVersion($);
                startTimers($, "draw");
              })
            )
          );
        } catch {
        }
      }
      if (e.props.hasSurvey) {
        setLastRenderBranch("stepped aside: the app has a survey in this spot");
        return next(e);
      }
      const asked = await $.store.get("openSettingsAt");
      const askedHere = asked && typeof asked === "object" && asked.session === await $.session.id().catch(() => "") ? asked.at : null;
      let open = Boolean(await read18($, settingsOpen4));
      if (typeof askedHere === "number") {
        await $.store.set("openSettingsAt", null);
        if (Date.now() - askedHere < 6e4 && !open) {
          open = true;
          $.clock.after(0, () => void update20($, settingsOpen4, () => true));
        }
      }
      setLastRenderBranch(open ? "drew the settings panel" : "drew a band or nothing");
      const { Box } = themedEls($.ui.resolve(e));
      if (open) return await settingsPanel($, e);
      if (e.surface !== "terminal" && await read18($, compactAsk4)) return await compactBar($, e);
      const choice = await read18($, handoffPick3);
      if (choice) return await handoffBar($, e, choice);
      const storedStep = await read18($, setupStep2);
      const step = storedStep && !["lean", "handoff", "look", "done"].includes(storedStep) ? "lean" : storedStep;
      if (step) return await setupGuide($, e, step);
      const downReason = await read18($, judgeDown2);
      if (downReason && downReason !== await read18($, judgeDownHidden2)) return await judgeDownBand($, e, downReason);
      const heat = await read18($, hot2);
      if (heat && !config.hide.includes("hot") && hotVisible(heat, await hotClosedNow($)))
        return await hotBand($, e, heat);
      const savedAt = await $.store.get("settingsSavedAt").catch(() => null);
      if (typeof savedAt === "number") {
        const since = await $.clock.now().catch(() => Date.now()) - savedAt;
        if (since >= 0 && since < SAVED_CARD_MS) {
          $.clock.after(SAVED_CARD_MS - since + 50, () => $.ui.invalidate("ui.render"));
          return savedCardTree($, e);
        }
      }
      const compactNow = e.surface === "terminal" ? null : await compactCard($, !!e.props.isWorking);
      if (compactNow)
        return handoffCardTree(
          $,
          e,
          compactNow,
          void 0,
          !cardRunning(compactNow.kind) ? () => update20($, handoffCard4, (card) => card && !cardRunning(card.kind) ? null : card) : void 0
        );
      const compacting = await read18($, isCompacting3);
      const coldTokens = compacting ? null : await coldWorth($);
      if (coldTokens !== null) return await coldBand($, e, coldTokens);
      const swampTokens = await read18($, swamped2);
      const hiddenAt = await read18($, swampHiddenAt2);
      if (swampTokens !== null && !config.hide.includes("swamp") && !turnBusy() && !compacting && (hiddenAt === null || swampTokens >= hiddenAt + SWAMP_REGROW))
        return await swampBand($, e, swampTokens);
      if (config.layout === "default") {
        if (e.surface === "terminal") return dashboardBand($, e);
        const { question: question2 } = await effortRows($, e);
        const dash = await dashboardBand($, e);
        return question2 ? /* @__PURE__ */ h(Box, { key: "dash-col", flexDirection: "column" }, question2, dash) : dash;
      }
      setIntroKind("rest");
      const { question, rows, noteLine } = await effortRows($, e);
      if (e.surface !== "terminal") return question ?? next(e);
      return /* @__PURE__ */ h(Box, { key: "rows-col", flexDirection: "column" }, rows, noteLine);
    } catch (error) {
      setLastRenderError((error instanceof Error ? error.message : String(error)).slice(0, 300));
      return next(e);
    } finally {
      if (glowReadAt !== null) {
        setDrawLead(drawLead * 0.7 + Math.min(150, Date.now() - glowReadAt + 16) * 0.3);
        setGlowReadAt(null);
      }
      if (drawsTimed < 5) {
        setDrawsTimed(drawsTimed + 1);
        renderLog.push(`${(/* @__PURE__ */ new Date()).toISOString()} ${loadedSession} draw took ${Date.now() - lastRenderAt} ms`);
      }
    }
  });
}

// hooks/handlers/agents.ts
import { atom as atom22, update as update21 } from "claude-code";
var saved3 = atom22({ plugin: "context-lens", key: "saved" }, EMPTY_SPENT);
function registerAgentHooks(on) {
  on("tool.call", { tool: "Agent" }, async ($, e, next) => {
    if (e.tool_use_id && typeof e.effort === "string") callEfforts.add(e.tool_use_id);
    return next(e);
  });
  on("agent.spawn", async ($, e, next) => {
    const verdict = config.subagents === "on" && !e.fork && !e.isTeammate && !e.workflow ? await subagentEffort($, e.prompt, e.subagentType).catch(() => null) : null;
    const named = verdict && config.subagentModel === "on" && (verdict.sure === void 0 || verdict.sure >= SUBAGENT_MODEL_SURE) ? verdict.model : void 0;
    const pick6 = verdict ? { effort: verdict.effort, ...named ? { model: named } : {} } : void 0;
    const call = {
      model: e.model !== void 0,
      effort: callEfforts.delete(e.tool_use_id),
      parentModel: e.parentModel ? keyOf(e.parentModel) : void 0
    };
    const waiting = { description: e.description, type: e.subagentType, parentId: e.parentAgentId, pick: pick6, call };
    setSubagentWaiting([...subagentWaiting, waiting].slice(-20));
    const result = await next(e);
    setSubagentWaiting(subagentWaiting.filter((w) => w !== waiting));
    const agentId = "agentId" in result ? result.agentId : void 0;
    if (agentId && !subagentSpawns.has(agentId)) subagentSpawns.set(agentId, { pick: pick6, call });
    if (agentId && pick6) {
      await update21($, saved3, (old) => {
        const t = asSpent(old);
        return {
          ...t,
          subagents: {
            ...t.subagents,
            runs: { ...t.subagents.runs, [pick6.effort]: (t.subagents.runs[pick6.effort] ?? 0) + 1 }
          }
        };
      }).catch(() => void 0);
      void proof(
        $,
        `subagent ${e.subagentType} "${e.description}": ${pick6.effort}${pick6.model ? ` on ${pick6.model} if cheaper` : ""} (${verdict?.why})`
      );
    }
    return result;
  });
}

// hooks/handlers/commands.ts
import { atom as atom23, read as read19, update as update22 } from "claude-code";

// hooks/logic/bench.ts
function benchGrade(c, effort) {
  if (!effort) return "none";
  if (c.ok.includes(effort)) return "hit";
  const rank = EFFORTS.indexOf(effort);
  return rank < Math.min(...c.ok.map((e) => EFFORTS.indexOf(e))) ? "under" : "over";
}
function stepsGrade(c, steps) {
  if (!steps || !c.steps) return "none";
  if (c.steps.includes(steps)) return "hit";
  return STEPS.indexOf(steps) < Math.min(...c.steps.map((s) => STEPS.indexOf(s))) ? "under" : "over";
}
function benchReport(cases, answers) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const judges = [...new Set(answers.map((a) => a.judge))];
  const kinds = [...new Set(cases.map((c) => c.kind))];
  const pct = (n, of) => of ? `${Math.round(n / of * 100)}%` : "-";
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const lines = [
    "| Judge | Right | Too low | Too high | No answer | Median ms |",
    "| --- | --- | --- | --- | --- | --- |"
  ];
  for (const j of judges) {
    const mine = answers.filter((a) => a.judge === j);
    const g = mine.map((a) => benchGrade(byId.get(a.id), a.effort));
    const n = (k) => g.filter((x) => x === k).length;
    const asked = mine.filter((a) => a.ms > 0).map((a) => a.ms);
    lines.push(
      `| ${j} | ${pct(n("hit"), g.length)} | ${n("under")} | ${n("over")} | ${n("none")} | ${asked.length ? median(asked) : "-"} |`
    );
  }
  const sets = [
    ["tuned on", cases.filter((c) => !c.holdout)],
    ["held out", cases.filter((c) => c.holdout)]
  ];
  lines.push("", `| Set (cases) | ${judges.join(" | ")} |`, `| --- | ${judges.map(() => "---").join(" | ")} |`);
  for (const [name, set] of sets) {
    if (!set.length) continue;
    const ids = set.map((c) => c.id);
    const cells = judges.map((j) => {
      const mine = answers.filter((a) => a.judge === j && ids.includes(a.id));
      return pct(mine.filter((a) => benchGrade(byId.get(a.id), a.effort) === "hit").length, mine.length);
    });
    lines.push(`| ${name} (${set.length}) | ${cells.join(" | ")} |`);
  }
  lines.push("", `| Kind (cases) | ${judges.join(" | ")} |`, `| --- | ${judges.map(() => "---").join(" | ")} |`);
  for (const k of kinds) {
    const ids = cases.filter((c) => c.kind === k).map((c) => c.id);
    const cells = judges.map((j) => {
      const mine = answers.filter((a) => a.judge === j && ids.includes(a.id));
      return pct(mine.filter((a) => benchGrade(byId.get(a.id), a.effort) === "hit").length, mine.length);
    });
    lines.push(`| ${k} (${ids.length}) | ${cells.join(" | ")} |`);
  }
  const judged = judges.filter((j) => !j.startsWith("always"));
  const sureLines = [
    "",
    "| Judge | Sure when right | Sure when wrong | Misses under 65% sure | Misses under 85% sure | Answers under 65% | Answers under 85% |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const j of judged) {
    const mine = answers.filter((a) => a.judge === j && a.effort && typeof a.sure === "number");
    if (!mine.length) continue;
    const wrong = mine.filter((a) => benchGrade(byId.get(a.id), a.effort) !== "hit");
    const right = mine.filter((a) => benchGrade(byId.get(a.id), a.effort) === "hit");
    const avg = (xs) => xs.length ? `${Math.round(xs.reduce((t, a) => t + a.sure, 0) / xs.length * 100)}%` : "-";
    const under = (xs, t) => xs.filter((a) => a.sure < t).length;
    sureLines.push(
      `| ${j} (${mine.length} with a score) | ${avg(right)} | ${avg(wrong)} | ${under(wrong, 0.65)} of ${wrong.length} | ${under(wrong, 0.85)} of ${wrong.length} | ${under(mine, 0.65)} | ${under(mine, 0.85)} |`
    );
  }
  const pickLines = ["", "| Judge | Haiku | Sonnet | Opus | Other |", "| --- | --- | --- | --- | --- |"];
  for (const j of judged) {
    const mine = answers.filter((a) => a.judge === j && a.model);
    if (!mine.length) continue;
    const n = (k) => mine.filter((a) => a.model === k).length;
    pickLines.push(
      `| ${j} | ${n("haiku")} | ${n("sonnet")} | ${n("opus")} | ${mine.length - n("haiku") - n("sonnet") - n("opus")} |`
    );
  }
  const stepLines = ["", "| Judge | Steps right | Too few | Too many | No answer |", "| --- | --- | --- | --- | --- |"];
  for (const j of judged) {
    const mine = answers.filter((a) => a.judge === j && byId.get(a.id).steps);
    if (!mine.length) continue;
    const g = mine.map((a) => stepsGrade(byId.get(a.id), a.steps));
    const n = (k) => g.filter((x) => x === k).length;
    stepLines.push(`| ${j} | ${pct(n("hit"), g.length)} | ${n("under")} | ${n("over")} | ${n("none")} |`);
  }
  lines.push(
    ...sureLines.length > 3 ? sureLines : [],
    ...pickLines.length > 3 ? pickLines : [],
    ...stepLines.length > 3 ? stepLines : []
  );
  const stepMisses = answers.filter(
    (a) => !a.judge.startsWith("always") && a.steps && ["under", "over"].includes(stepsGrade(byId.get(a.id), a.steps))
  ).map(
    (a) => `- ${a.judge} ${a.id}: said ${a.steps} steps, wanted ${byId.get(a.id).steps.join("/")}: "${byId.get(a.id).message.slice(0, 60)}"`
  );
  const misses = answers.filter((a) => !a.judge.startsWith("always") && benchGrade(byId.get(a.id), a.effort) !== "hit").map(
    (a) => `- ${a.judge}${a.by && a.by !== a.judge ? ` (via ${a.by})` : ""} ${a.id}: said ${a.effort ?? "nothing"}${a.why ? ` (${a.why})` : ""}, wanted ${byId.get(a.id).ok.join("/")}: "${byId.get(a.id).message.slice(0, 60)}"`
  );
  return [
    ...lines,
    "",
    "Misses:",
    ...misses.length ? misses : ["- none"],
    ...stepMisses.length ? ["", "Steps misses:", ...stepMisses] : []
  ].join("\n");
}
async function runBench($, cases) {
  const judges = [
    ["haiku", (c) => askHaiku($, c.message, c.current, c.context ?? "")]
  ];
  const answers = [];
  for (const fixed of ["medium", "high"])
    for (const c of cases) answers.push({ id: c.id, judge: `always ${fixed}`, effort: fixed, ms: 0, tokens: 0 });
  const jobs = judges.flatMap(([name, ask]) => cases.map((c) => ({ name, ask, c })));
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { name, ask, c } = jobs[next++];
      if (keepsEffort(c.message, c.context ?? "")) {
        answers.push({ id: c.id, judge: name, effort: c.current.effort, ms: 0, tokens: 0 });
        continue;
      }
      const started = await $.clock.now();
      const got = await ask(c).catch(() => void 0);
      answers.push({
        id: c.id,
        judge: name,
        effort: got?.verdict?.effort,
        by: got?.verdict?.by,
        why: got?.verdict?.why,
        sure: got?.verdict?.sure,
        model: got?.verdict?.model,
        steps: got?.verdict?.steps,
        ms: await $.clock.now() - started,
        tokens: got?.tokens ?? 0
      });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return answers;
}

// hooks/handlers/commands.ts
var isAuto2 = atom23({ plugin: "context-lens", key: "isAuto" }, true);
var suggestion4 = atom23({ plugin: "context-lens", key: "suggestion" }, null);
var saved4 = atom23({ plugin: "context-lens", key: "saved" }, EMPTY_SPENT);
var cacheLeft4 = atom23({ plugin: "context-lens", key: "cacheLeft" }, null);
var handoffStage3 = atom23({ plugin: "context-lens", key: "handoffStage" }, null);
var swamped3 = atom23({ plugin: "context-lens", key: "swamped" }, null);
var swampHiddenAt3 = atom23({ plugin: "context-lens", key: "swampHiddenAt" }, null);
var settingsOpen5 = atom23({ plugin: "context-lens", key: "settingsOpen" }, false);
var judgeDown3 = atom23({ plugin: "context-lens", key: "judgeDown" }, null);
var judgeDownHidden3 = atom23({ plugin: "context-lens", key: "judgeDownHidden" }, null);
var hot3 = atom23({ plugin: "context-lens", key: "hot" }, null);
var hotHidden2 = atom23({ plugin: "context-lens", key: "hotHidden" }, null);
var setupStep3 = atom23({ plugin: "context-lens", key: "setupStep" }, null);
var lensLimits3 = atom23({ plugin: "context-lens", key: "lensLimits" }, []);
function registerCommandHooks(on) {
  on("command.run", async ($, e, next) => {
    if (e.command !== "context-lens" && e.command !== "context-lens:context-lens") return next(e);
    const wanted = await read19($, suggestion4);
    const arg = e.args.trim().toLowerCase();
    if (arg === "auto") {
      await toggleAutoEffort($);
      return {
        text: await read19($, isAuto2) ? "Auto on: effort is picked for every prompt." : "Auto off: the effort is yours."
      };
    }
    if (arg === "hot") {
      await update22($, hotHidden2, () => null);
      await $.store.set("hotClosed", null).catch(() => void 0);
      await update22($, hot3, () => ({
        kind: "five_hour",
        percent: 82,
        resetsAt: new Date(Date.now() + 2 * 36e5).toISOString()
      }));
      $.ui.invalidate("ui.render");
      return {
        text: "The running-hot band is showing now (a test). It goes away at the next check unless a limit really is close."
      };
    }
    if (arg === "down") {
      await update22($, judgeDownHidden3, () => null);
      await update22($, judgeDown3, () => "Haiku is out of credits (402)");
      $.ui.invalidate("ui.render");
      return { text: "The judge-down band is showing now (a test). It goes away once the judge answers again." };
    }
    if (arg === "swamp") {
      await update22($, swampHiddenAt3, () => null);
      await update22($, swamped3, () => SWAMP_TOKENS);
      $.ui.invalidate("ui.render");
      return {
        text: "The swamp band is showing now (a test). It goes away at the next check unless the chat really is swamped."
      };
    }
    if (arg === "save") return { text: await toggleSave($) };
    if (arg === "handoff" || arg === "handoff full") {
      const full = arg === "handoff full";
      const { after } = await lastHandoffChoice($);
      await startHandoff($, full, after);
      const what = handoffWhat({ kind: full ? "full" : "quick", after }, config.handoffSkill);
      return { text: `Writing the ${full ? "full" : "quick"} handoff. ${what.by}. ${what.then}` };
    }
    if (arg.startsWith("probe")) {
      setProbeLevel(Number(arg.slice(5).trim()) || 0);
      await update22($, settingsOpen5, () => true);
      $.ui.invalidate("ui.render");
      return { text: `Probe ${probeLevel} drawn above the prompt (0 is the real panel). Tell me if you see it.` };
    }
    if (arg === "debug") {
      const ago = (t) => t ? `${Math.round((Date.now() - t) / 1e3)}s ago` : "never";
      const debugNow = await $.clock.now().catch(() => Date.now());
      const lastFork = await $.store.get("lastFork").catch(() => null);
      const limitsText = (limits) => limits.map((limit) => `${limit.kind} ${Math.round(limit.percentUsed)}%`).join(", ") || "none";
      const appLimits = (await $.session.usage().catch(() => null))?.rateLimits;
      return {
        text: [
          // A copy outside the plugin cache (--plugin-dir) has no marketplace; name its folder instead.
          `plugin: ${ownVersion || "?"}, ${/cache[\\/][^\\/]+[\\/]/.test($.plugin.root) ? pluginId($) : `local copy at ${$.plugin.root}`}`,
          `session.start ${ago(sessionStarted)}`,
          `app SessionStart: ${classicStart ? `${ago(classicStart.at)} (${classicStart.said})` : "never"}`,
          `cache: ${cacheExpires === 0 ? "not started" : `${await cacheMinutes($)} min left`}, shown ${await read19($, cacheLeft4)}, ttl ${cacheTtl}, last reply ${lastResponseAt ? ago(lastResponseAt) : "none seen"}, replies seen ${repliesSeen}, forced ${coldForced}`,
          `rate limits: app ${appLimits ? limitsText(appLimits) : "unreadable"}, band ${limitsText(await read19($, lensLimits3))}`,
          `model caches: ${[...modelCaches].map(([k, c]) => `${k} ${kTokens(c.tokens)} ${Math.max(0, Math.ceil((c.expires - debugNow) / 6e4))} min`).join(", ") || "none"}${sessionPick ? `, session on ${sessionPick}` : ""}`,
          `band asked for ${renderCalls} times, last ${ago(lastRenderAt)}`,
          `band error: ${lastRenderError || "none"}`,
          `last draw: ${lastRenderBranch || "none"}`,
          `app sent: ${lastRenderProps || "nothing"}`,
          `settings open: ${await read19($, settingsOpen5)}`,
          `setup step: ${await read19($, setupStep3)}`,
          `handoff: ${await read19($, handoffStage3)}`,
          `last fork: ${lastFork ? `${lastFork.outcome}, ${ago(lastFork.at)}` : "none"}`,
          `hidden: ${config.hide.join(",") || "nothing"}`,
          lastRequest ? `last request: app asked ${lastRequest.appModel} at ${lastRequest.appEffort ?? "none"}, sent ${lastRequest.model} at ${lastRequest.effort ?? "none"}${lastRequest.model === lastRequest.appModel && lastRequest.effort === lastRequest.appEffort ? " (unchanged)" : " (changed by context-lens)"}, ${ago(lastRequest.at)}` : "last request: none yet",
          `compact with: ${config.compactWith}${lastHaikuCompact ? `, last by Haiku ${ago(lastHaikuCompact)}` : ""}`
        ].join(" | ") + // On its own line, easy to find: the model and effort the last request actually ran on.
        `
model used: ${lastRequest ? `${lastRequest.model} at ${lastRequest.effort ?? "none"}` : "none yet"}`
      };
    }
    if (arg === "settings") {
      await openPluginSettings($);
      return { text: "The context-lens settings are open above the prompt." };
    }
    if (arg === "setup") {
      await update22($, setupStep3, () => "lean");
      $.ui.invalidate("ui.render");
      return { text: "The context-lens setup is open above the prompt." };
    }
    if (arg === "bench") {
      const cases = JSON.parse(await $.fs.read(`${$.plugin.root}/bench/judge-cases.json`)).cases;
      const answers = await runBench($, cases);
      const report = benchReport(cases, answers);
      const stamp = new Date(await $.clock.now()).toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const out = `context-lens-bench-${stamp}`;
      await $.fs.write(`${out}.json`, JSON.stringify({ cases: cases.length, answers }, null, 2));
      await $.fs.write(`${out}.md`, report);
      return {
        text: `${report}

Saved to ${out}.md and .json`
      };
    }
    if (arg === "cold") {
      setColdForced(true);
      setCacheExpires(await $.clock.now());
      await update22($, cacheLeft4, () => 0);
      $.ui.invalidate("ui.render");
      return {
        text: "The cache shows as cold now (a test). Compact is in the footer. The next response restarts the countdown."
      };
    }
    if (arg === "stats" || arg === "saved") return { text: `Auto, this session:
${savedText(await read19($, saved4))}` };
    if (!wanted) return { text: "No model suggestion right now." };
    if (arg === "switch") {
      if (offer && suggestedAs === "subagent") {
        settleOffer(true);
        return { text: `Handing the prompt to a ${wanted} subagent. The chat stays on its model.` };
      }
      if (offer) settleOffer(true);
      else await switchModel($, wanted);
      return { text: `Switching to ${wanted} for this session. The context reloads.` };
    }
    setDeclined(wanted);
    await update22($, suggestion4, () => null);
    settleOffer(false);
    return { text: `Keeping the current model.` };
  });
  on("command.run", { command: "model" }, async ($, e, next) => {
    const result = await next(e);
    if (!sessionPick) return result;
    setSessionPick(null);
    await modelIs($, await $.session.model());
    $.ui.invalidate("ui.render");
    return result;
  });
  on("classic.PostModelSwitch", async ($, e, next) => {
    const result = await next(e);
    setSessionPick(null);
    await modelIs($, e.to_model);
    return result;
  });
}

// hooks/handlers/footer.tsx
import { atom as atom24, read as read20, update as update23 } from "claude-code";
var handoffStage4 = atom24({ plugin: "context-lens", key: "handoffStage" }, null);
var handoffPick4 = atom24({ plugin: "context-lens", key: "handoffPick" }, null);
var turnLines = atom24({ plugin: "context-lens", key: "turnLines" }, {});
var setupPending2 = atom24({ plugin: "context-lens", key: "setupPending" }, false);
var settingsOpen6 = atom24({ plugin: "context-lens", key: "settingsOpen" }, false);
var settingsDraft4 = atom24({ plugin: "context-lens", key: "settingsDraft" }, {});
var saveUntil4 = atom24({ plugin: "context-lens", key: "saveUntil" }, null);
var setupStep4 = atom24({ plugin: "context-lens", key: "setupStep" }, null);
function registerFooterHooks(on) {
  on("ui.render", { component: "SessionMode" }, async ($, e, next) => {
    if (e.surface !== "desktop" || config.layout === "default") return next(e);
    const { Box, Text, Button } = themedEls($.ui.resolve(e));
    const v = await snap($);
    const handoffNow = await read20($, handoffStage4) !== null;
    const needsSetup = await read20($, setupPending2);
    const effortNow = effortOf(v);
    const saving = await read20($, saveUntil4) !== null;
    const label = v.judging ? "Deciding…" : v.switchedNow ? `${EFFORT_LABELS[v.switchedNow.from]} → ${EFFORT_LABELS[v.switchedNow.to]}` : effortNow ? EFFORT_LABELS[effortNow] : "Auto";
    return /* @__PURE__ */ h(Box, { flexDirection: "row", gap: 1, alignItems: "center" }, e.props.modes.length > 0 ? /* @__PURE__ */ h(Text, { dimColor: true }, e.props.modes.join(" & ")) : null, v.auto && v.pausedNow ? (
      // Fable and older models: an effort change rewrites the cache there, so Auto waits.
      /* @__PURE__ */ h(Text, { dimColor: true, hover: { scope: "effort", backgroundColor: HOVER_BOX } }, " Paused ")
    ) : v.auto ? /* @__PURE__ */ h(Text, { color: saving ? EMBER : ACCENT, bold: true, hover: { scope: "effort", backgroundColor: HOVER_BOX } }, ` ${label} `) : /* @__PURE__ */ h(Text, { dimColor: true, hover: { scope: "effort", backgroundColor: HOVER_BOX } }, " Off "), /* @__PURE__ */ h(
      Button,
      {
        key: "auto",
        plain: true,
        dimColor: true,
        label: " ⏻ ",
        hover: { scope: "power", backgroundColor: HOVER_BOX },
        onPress: () => toggleAutoEffort($)
      }
    ), needsSetup ? /* @__PURE__ */ h(
      Button,
      {
        key: "setup",
        plain: true,
        label: " Setup ",
        hover: { scope: "setup", backgroundColor: HOVER_BOX },
        onPress: async () => {
          await update23($, setupStep4, () => "lean");
          $.ui.invalidate("ui.render");
        }
      }
    ) : /* @__PURE__ */ h(
      Button,
      {
        key: "settings",
        plain: true,
        dimColor: true,
        label: " ⚙︎ ",
        hover: { scope: "settings", backgroundColor: HOVER_BOX },
        onPress: async () => {
          if (await read20($, settingsOpen6)) {
            await update23($, settingsDraft4, () => ({}));
            await update23($, settingsOpen6, () => false);
            $.ui.invalidate("ui.render");
          } else await openPluginSettings($);
        }
      }
    ), config.hide.includes("handoff") ? null : /* @__PURE__ */ h(
      Button,
      {
        key: "handoff",
        plain: true,
        dimColor: true,
        label: handoffNow ? " … " : " ⇥ ",
        hover: { scope: "handoff", backgroundColor: HOVER_BOX },
        onPress: async () => await read20($, handoffPick4) ? closeHandoffBar($) : openHandoffBar($)
      }
    ), config.hide.includes("timer") ? null : v.cacheNow === 0 ? /* @__PURE__ */ h(Text, { color: ICE, hover: { scope: "cache", backgroundColor: HOVER_BOX } }, cacheLabel(0)) : v.cacheNow === null ? null : cacheColor(v.cacheNow) ? /* @__PURE__ */ h(Text, { color: cacheColor(v.cacheNow), hover: { scope: "cache", backgroundColor: HOVER_BOX } }, cacheLabel(v.cacheNow)) : /* @__PURE__ */ h(Text, { dimColor: true, hover: { scope: "cache", backgroundColor: HOVER_BOX } }, cacheLabel(v.cacheNow)));
  });
  const firstDrawn = /* @__PURE__ */ new Map();
  on("ui.render", { component: "TurnDuration" }, async ($, e, next) => {
    const { Box, Text } = themedEls($.ui.resolve(e));
    const key = String(e.props.durationMs);
    let ran = turnLineFor(await read20($, turnLines), e.props.durationMs) ?? turnLineFor(await storedLinesOf($), e.props.durationMs) ?? firstDrawn.get(key);
    if (!ran && ranThisTurn) {
      ran = { ...ranThisTurn };
      firstDrawn.set(key, ran);
    }
    const model3 = MODELS.find((m) => m.key === ran?.model)?.long;
    const took = Math.max(1, Math.round(e.props.durationMs / 1e3));
    return /* @__PURE__ */ h(Box, { key: "turn-line", flexDirection: "row", gap: 1 }, /* @__PURE__ */ h(Text, { dimColor: true }, `${e.props.word} ${took < 60 ? `${took}s` : `${Math.floor(took / 60)}m ${took % 60}s`}`), ran ? /* @__PURE__ */ h(
      Text,
      {
        color: ACCENT
      },
      `✦ ${model3 ? `${model3} · ` : ""}${ran.effort ? EFFORT_LABELS[ran.effort] : "Auto"}`
    ) : null, ran?.cost ? /* @__PURE__ */ h(Text, { dimColor: true }, `· ≈${tokens(ran.cost)} tokens`) : null);
  });
}

// hooks/handlers/prompt.ts
import { atom as atom25, read as read21, update as update24 } from "claude-code";
var isAuto3 = atom25({ plugin: "context-lens", key: "isAuto" }, true);
var isAutoModel3 = atom25({ plugin: "context-lens", key: "isAutoModel" }, false);
var pick3 = atom25({ plugin: "context-lens", key: "pick" }, null);
var isJudging2 = atom25({ plugin: "context-lens", key: "isJudging" }, false);
var suggestion5 = atom25({ plugin: "context-lens", key: "suggestion" }, null);
var cacheLeft5 = atom25({ plugin: "context-lens", key: "cacheLeft" }, null);
var handoffCard5 = atom25({ plugin: "context-lens", key: "handoffCard" }, null);
var saveUntil5 = atom25({ plugin: "context-lens", key: "saveUntil" }, null);
function registerPromptHooks(on) {
  on("prompt.submit", async ($, e, next) => {
    await setTurnBusy($, true);
    if (e.turnId === void 0) {
      setTurnCost(0);
      setRanThisTurn(null);
    }
    const card = await read21($, handoffCard5);
    if (card && (card.kind === "done" || card.kind === "copied")) await update24($, handoffCard5, () => null);
    const byPerson = e.origin.kind === "composer" || e.origin.kind === "bridge" || e.origin.kind === "sdk";
    const byAgent = [
      "task-notification",
      "peer",
      "peer-send-message",
      "scheduled-trigger",
      "channel",
      "auto-continuation"
    ].includes(e.origin.kind);
    if (byPerson && !e.text.trim().startsWith("/") && !isFollowUp(e.text))
      void checkHandoff($, e.text).catch(() => void 0);
    const wantsEffort = await read21($, isAuto3);
    const wantsModel = await read21($, isAutoModel3);
    settleOffer(false);
    const slash = e.text.trim().startsWith("/");
    const skill = slash && byPerson ? await typedSkill($, e.text) : void 0;
    if (byAgent && !wantsEffort) return next(e);
    if (!byPerson && !byAgent || slash && !skill || !wantsEffort && !wantsModel) return next(e);
    const modelId = await sessionModelId($);
    await modelIs($, modelId);
    if (!cacheSafe(modelId) && takesEffort(modelId)) return next(e);
    const before = await read21($, pick3);
    const midTurn = e.turnId !== void 0 && before !== null;
    const said = byAgent ? e.text.slice(0, 1500) : skill ? `${e.text}

[This is a slash command that runs a skill: ${skill.description || skill.name}. Judge the work the skill will do.]` : e.text;
    const shown = midTurn ? withMidTurn(withAttachments(said, e.attachments), before.effort) : withAttachments(said, e.attachments);
    if (wantsEffort && before && before.by !== "manual" && !e.attachments?.length && !slash && isFollowUp(e.text) && keepsEffort(e.text, await recentContext($).catch(() => ""))) {
      await countPrompt($, before.effort, void 0, 0, 0);
      void proof($, `follow-up "${e.text.trim()}": keeping ${before.effort}`);
      return next(e);
    }
    const named = wantsEffort && !slash && !byAgent ? namedEffort(e.text) : void 0;
    if (named) {
      const inUse = await sessionModel($);
      const applied = { model: inUse, effort: named, why: "you asked for it", by: "named" };
      const running = await read21($, pick3);
      if (midTurn && running && EFFORTS.indexOf(named) < EFFORTS.indexOf(running.effort)) setHeldPick(applied);
      else {
        setHeldPick(null);
        await choose($, applied);
      }
      await countPrompt($, takesEffort(modelId) ? named : void 0, "named", 0, 0);
      void proof($, `named level ${named} in "${e.text.slice(0, 50)}": no judge`);
      $.ui.invalidate("ui.render");
      return next(e);
    }
    setJudgeStartedAt(await $.clock.now().catch(() => Date.now()));
    setJudgeEndedAt(null);
    renderLog.push(`${(/* @__PURE__ */ new Date()).toISOString()} ${loadedSession} glow: start`);
    drawGlowSteps($, 0, JUDGE_RISE_MS);
    $.ui.invalidate("ui.render");
    await update24($, isJudging2, () => true);
    let held = null;
    let handTo = null;
    try {
      const inUse = await sessionModel($);
      const startedAt = Date.now();
      const { verdict, tokens: judgeTokens } = await judge($, shown, {
        model: inUse,
        effort: (await read21($, pick3))?.effort ?? "medium",
        why: "",
        by: "manual"
      });
      await endJudgeGlow($, "verdict");
      const ms = Date.now() - startedAt;
      await countPrompt(
        $,
        wantsEffort && takesEffort(modelId) ? verdict?.effort : void 0,
        verdict?.by,
        ms,
        judgeTokens
      );
      void proof(
        $,
        verdict ? `judged by ${verdict.by} in ${ms} ms: ${verdict.model}/${verdict.effort} (${verdict.why}) for "${e.text.slice(0, 50)}"` : `no verdict after ${ms} ms for "${e.text.slice(0, 50)}"`
      );
      $.ui.invalidate("ui.render");
      if (verdict) {
        if (wantsEffort) {
          const saving = await read21($, saveUntil5) !== null;
          const leaned = bounded(tipped(verdict.effort, verdict.sure, config.bias), config.floor, config.ceiling);
          const effort = capped(leaned, saving);
          const why = effort !== leaned ? "save mode" : leaned !== verdict.effort ? "your settings" : verdict.why;
          const applied = { ...verdict, model: inUse, effort, why };
          const running = await read21($, pick3);
          if (midTurn && running && EFFORTS.indexOf(effort) < EFFORTS.indexOf(running.effort)) {
            setHeldPick(applied);
            void proof($, `typed mid-turn: ${effort} waits, the running turn keeps ${running.effort}`);
          } else {
            setHeldPick(null);
            await choose($, applied);
          }
        }
        const cold = await read21($, cacheLeft5) === 0 || coldForced;
        const now = await $.clock.now().catch(() => Date.now());
        const tokens2 = lastContext?.tokens ?? modelCaches.get(inUse)?.tokens;
        const offered = verdict.model === declined ? null : switchWorth(verdict.model, inUse, {
          cold,
          tokens: tokens2,
          ttl: cacheTtl,
          warm: warmTokens(verdict.model, now)
        });
        const worth = offered === "subagent" && !subagentPays(verdict.model, inUse, { ...verdict, tokens: tokens2 ?? 0 }) ? null : offered;
        const typedNow = byPerson && !midTurn && !slash;
        const offerable = worth === "switch" || worth === "subagent" && typedNow;
        const label = MODELS.find((m) => m.key === verdict.model).label;
        if (worth && offerable && wantsModel) {
          await update24($, suggestion5, () => null);
          if (worth === "subagent") handTo = verdict.model;
          else await switchModel($, verdict.model);
          $.ui.toast(
            worth === "subagent" ? `Handed to a subagent on ${label}: ${verdict.why}` : `Switched to ${label} for this session: ${verdict.why}`
          );
        } else if (worth && offerable && typedNow && config.holdOffer === "on") {
          setSuggestedAs(worth);
          await update24($, suggestion5, () => verdict.model);
          held = verdict.model;
        } else if (worth === "switch") {
          setSuggestedAs(worth);
          await update24($, suggestion5, () => verdict.model);
          $.ui.toast(`Suggestion: switch to ${label}? /context-lens switch or /context-lens keep`);
        } else {
          await update24($, suggestion5, () => null);
        }
      }
    } finally {
      await endJudgeGlow($, "end");
      await update24($, isJudging2, () => false);
    }
    if (handTo) {
      void proof($, `auto hand-off: a subagent on ${handTo} for "${e.text.slice(0, 50)}"`);
      return next({ ...e, text: e.text + subagentNote(handTo) });
    }
    if (held) {
      const as = suggestedAs;
      void proof($, `offer (${as}): ${held} for "${e.text.slice(0, 50)}", the prompt waits`);
      const accepted = await holdForOffer($, held);
      await update24($, suggestion5, () => null);
      $.ui.invalidate("ui.render");
      void proof(
        $,
        accepted ? `offer taken: ${as === "subagent" ? "a subagent on" : "switching to"} ${held}` : "offer not taken: the prompt goes on as it is"
      );
      if (accepted && as === "subagent") return next({ ...e, text: e.text + subagentNote(held) });
      if (accepted) await switchModel($, held);
    }
    return next(e);
  });
}

// hooks/handlers/session.ts
import { atom as atom26, update as update25 } from "claude-code";
var isAuto4 = atom26({ plugin: "context-lens", key: "isAuto" }, true);
var isAutoModel4 = atom26({ plugin: "context-lens", key: "isAutoModel" }, false);
var pick4 = atom26({ plugin: "context-lens", key: "pick" }, null);
var setupPending3 = atom26({ plugin: "context-lens", key: "setupPending" }, false);
var setupStep5 = atom26({ plugin: "context-lens", key: "setupStep" }, null);
var lensMain3 = atom26({ plugin: "context-lens", key: "lensMain" }, emptyClock("1h"));
var lensLiveTokens3 = atom26({ plugin: "context-lens", key: "lensLive" }, null);
var lensRewritten3 = atom26({ plugin: "context-lens", key: "lensRewritten" }, false);
var lensLimits4 = atom26({ plugin: "context-lens", key: "lensLimits" }, []);
function registerSessionHooks(on) {
  on("session.measure", async ($, e, next) => {
    const result = await next(e);
    if (e.changed.includes("rateLimits")) await update25($, lensLimits4, () => e.rateLimits);
    if (e.changed.includes("context")) await refreshUsage($);
    return result;
  });
  on("session.end", async ($, e, next) => {
    if (e.reason === "clear") {
      modelCaches.clear();
      await update25($, lensMain3, (clock) => emptyClock(clock.ttl));
      await update25($, lensLiveTokens3, () => null);
      await update25($, lensRewritten3, () => false);
      void refreshUsage($).catch(() => void 0);
    }
    return next(e);
  });
  on("session.compact", async ($, e, next) => {
    const result = await (async () => {
      if (e.agentId !== void 0 || config.compactWith !== "haiku") return next(e);
      if (e.trigger === "precompute") return { skip: "context-lens compacts with Haiku when it is time" };
      const messages = Array.isArray(e.messages) && e.messages.length ? e.messages : await $.session.messages().catch(() => []);
      const got = await haikuCompaction($, messages, e.instructions).catch((error) => ({
        fail: String(error).slice(0, 80)
      }));
      if ("fail" in got) {
        $.ui.toast(`context-lens: Haiku could not compact (${got.fail}). The chat's own model does it.`);
        return next(e);
      }
      setLastHaikuCompact(Date.now());
      return {
        messages: [
          {
            role: "user",
            text: `This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation, written by Haiku 5.5 for context-lens.

${got.text}

Continue the conversation from where it left off without asking the user any further questions.`,
            toolUses: []
          }
        ]
      };
    })();
    if (e.agentId === void 0 && e.trigger !== "precompute" && !("skip" in result && result.skip))
      await afterCompaction($).catch(() => void 0);
    return result;
  });
  on("session.start", async ($, e, next) => {
    setSessionStarted(Date.now());
    await lensStarted($).catch(() => void 0);
    const [sid, kept, storedAuto, storedAutoModel, storedPick, setupDone] = await Promise.all([
      $.session.id().catch(() => "?"),
      $.store.get("savedSettings").catch(() => null),
      $.store.get("isAuto").catch(() => null),
      $.store.get("isAutoModel").catch(() => null),
      $.store.get("pick").catch(() => null),
      $.store.get("setupDone").catch(() => null)
    ]);
    setLoadedSession(String(sid).slice(0, 8));
    const keptSettings = kept && typeof kept === "object" ? kept : {};
    const carried = await carryRenamedSettings($, keptSettings).catch(() => ({}));
    if (Object.keys(keptSettings).length || Object.keys(carried).length) {
      setConfig(readConfig({ ...pluginOptions, ...carried, ...keptSettings }));
      applyTheme();
    }
    await Promise.all([
      typeof storedAuto === "boolean" ? update25($, isAuto4, () => storedAuto) : null,
      typeof storedAutoModel === "boolean" ? update25($, isAutoModel4, () => storedAutoModel) : null,
      // Auto off means the effort you chose should still be the one in force.
      storedAuto === false && storedPick && EFFORTS.includes(storedPick.effort) ? update25($, pick4, () => storedPick).then(() => {
        setPickCarried(true);
      }) : null,
      // The first time the mod runs, the setup guide opens above the prompt.
      setupDone !== true ? update25($, setupStep5, () => "lean").then(() => update25($, setupPending3, () => true)) : null
    ]);
    void $.command.register({
      name: "context-lens",
      description: "context-lens: settings, debug, handoff, setup, bench, auto, stats."
    }).catch(() => void 0);
    readOwnVersion($);
    void drainSetupSave($).catch(() => void 0);
    startTimers($, "start");
    $.ui.status(void 0);
    void $.session.model().then((m) => modelIs($, m)).catch(() => void 0);
    renderLog.push(
      `${(/* @__PURE__ */ new Date()).toISOString()} ${loadedSession} session.start (${e.surface ?? "?"}), ready in ${Date.now() - sessionStarted} ms`
    );
    void writeRenderLog($).catch(() => void 0);
    return next(e);
  });
  on("classic.SessionStart", async ($, e, next) => {
    const result = await next(e);
    const r = e;
    setClassicStart({
      at: Date.now(),
      said: `${r.source ?? "?"}, ${r.seconds_since_last_response ?? "?"}s since reply, expired ${r.prompt_cache_likely_expired ?? "?"}`
    });
    if ((r.source === "resume" || r.source === "fork") && typeof r.seconds_since_last_response === "number" && cacheExpires === 0) {
      const now = await $.clock.now();
      setLastResponseAt(now - r.seconds_since_last_response * 1e3);
      const left = lastResponseAt + CACHE_TTL[cacheTtl];
      setCacheExpires(r.prompt_cache_likely_expired || left <= now ? now - 1 : left);
      await rememberCache($);
      await checkSwamp($).catch(() => void 0);
      await showCache($).catch(() => void 0);
      $.ui.invalidate("ui.render");
      redrawSoon();
    }
    return result;
  });
}

// hooks/handlers/turn.ts
import { atom as atom27, read as read22, update as update26 } from "claude-code";
var isAuto5 = atom27({ plugin: "context-lens", key: "isAuto" }, true);
var pick5 = atom27({ plugin: "context-lens", key: "pick" }, null);
var appEffort2 = atom27({ plugin: "context-lens", key: "appEffort" }, null);
var handoffStage5 = atom27({ plugin: "context-lens", key: "handoffStage" }, null);
var handoffCard6 = atom27({ plugin: "context-lens", key: "handoffCard" }, null);
var lastAnswer = atom27({ plugin: "context-lens", key: "lastAnswer" }, "");
var turnLines2 = atom27({ plugin: "context-lens", key: "turnLines" }, {});
function registerTurnHooks(on) {
  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) await setTurnBusy($, false);
    if (!e.agentId && heldPick) {
      const held = heldPick;
      setHeldPick(null);
      if (await read22($, isAuto5)) await choose($, held);
    }
    if (!e.agentId && e.reason === "answer") await update26($, lastAnswer, () => e.answer.trim());
    if (!e.agentId && e.durationMs) {
      const key = String(e.durationMs);
      const cost = Math.round(turnCost);
      const line = { ...ranThisTurn, ...cost > 0 ? { cost } : {} };
      await update26($, turnLines2, (lines) => withTurnLine(lines, key, line));
      await storeTurnLine($, key, line).catch(() => void 0);
      setRanThisTurn(null);
    }
    if (!e.agentId) {
      await update26(
        $,
        handoffCard6,
        (card) => !card || cardRunning(card.kind) ? card : card.seen ? null : { ...card, seen: true }
      );
    }
    if (!e.agentId && await read22($, handoffStage5) === "writing") {
      if (e.reason === "answer" && e.answer.trim()) setHandoffText(e.answer);
      else {
        await update26($, handoffStage5, () => null);
        $.ui.toast("context-lens: the handoff was not written, nothing was cleared");
      }
    }
    return result;
  });
  on("turn.step", async function* ($, e, next) {
    const asked = { model: e.model, effort: e.effort };
    if (e.agentId === void 0 && sessionPick && keyOf(e.model) !== sessionPick) {
      e = { ...e, model: MODELS.find((m) => m.key === sessionPick).id };
    }
    const send = async function* (request) {
      if (e.agentId === void 0)
        setRanThisTurn({
          model: typeof request.model === "string" ? keyOf(request.model) : void 0,
          effort: EFFORTS.find((x) => x === request.effort)
        });
      if (e.agentId === void 0)
        setLastRequest({
          index: e.index,
          appModel: asked.model,
          appEffort: asked.effort,
          model: request.model,
          effort: request.effort,
          at: Date.now()
        });
      const answer = yield* next(request);
      if (answer?.usage)
        await recordRequest($, e.agentId, answer.usage, {
          model: typeof request.model === "string" ? keyOf(request.model) : void 0,
          effort: EFFORTS.find((x) => x === request.effort)
        }).catch(() => void 0);
      if (e.agentId === void 0 && answer?.usage) await cacheTouched($, answer.usage).catch(() => void 0);
      const sentModel = typeof request.model === "string" ? keyOf(request.model) : void 0;
      if (e.agentId === void 0 && answer?.usage && sentModel) {
        const u = answer.usage;
        const held = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
        modelCaches.set(sentModel, { expires: cacheExpires, tokens: held });
      }
      if (answer?.usage) setTurnCost(turnCost + weighted(answer.usage));
      return answer;
    };
    if (e.agentId === void 0) await setTurnBusy($, true);
    if (e.agentId === void 0) await modelIs($, e.model);
    if (e.agentId === void 0 && typeof e.effort === "string") {
      const seen = e.effort;
      const isFirst = engineEffort === void 0;
      const isByPerson = !isFirst && seen !== engineEffort;
      setEngineEffort(seen);
      if (isFirst || isByPerson) await update26($, appEffort2, () => seen);
      const takesApp = isFirst && pickCarried && !await read22($, isAuto5) && (await read22($, pick5))?.effort !== seen;
      if (isByPerson || takesApp) {
        await update26($, isAuto5, () => false);
        await $.store.set("isAuto", false);
        await choose($, { model: await sessionModel($), effort: seen, why: "your pick in the app", by: "manual" });
        void proof($, `request ${e.index}: you set effort ${seen} yourself, Auto off`);
        $.ui.toast(
          `context-lens: Auto is off. You picked ${EFFORT_LABELS[seen] ?? seen}; turn Auto on to hand it back.`
        );
        return yield* send(e);
      }
    }
    const spawned = e.agentId === void 0 ? void 0 : await subagentSpawnOf($, e.agentId);
    const steer = e.agentId === void 0 ? null : subagentSteerable(
      { model: keyOf(e.model), effort: e.effort },
      { model: spawned?.call.parentModel ?? keyOf(await $.session.model()), effort: engineEffort },
      spawned?.call,
      config.overrideDefinitions === "on"
    );
    if (steer && e.index === 0 && (!steer.model || !steer.effort))
      void proof(
        $,
        `subagent ${e.agentId} keeps its own ${[!steer.model && `model ${e.model}`, !steer.effort && `effort ${e.effort}`].filter(Boolean).join(" and ")}`
      );
    if (steer && config.subagents === "on" && takesEffort(e.model)) {
      const picked = spawned?.pick;
      const cheaper = config.subagentModel === "on" && steer.model ? subagentModelFor(picked?.model, keyOf(e.model)) : null;
      const effort = steer.effort ? picked?.effort : void 0;
      if (effort && typeof e.effort === "string" || cheaper) {
        const model3 = cheaper ? MODELS.find((m) => m.key === cheaper).id : e.model;
        if (e.index === 0)
          void proof(
            $,
            `subagent ${e.agentId} request 0 (${e.model}): ${cheaper ? `model -> ${model3}, ` : ""}effort ${e.effort} -> ${effort ?? e.effort}`
          );
        const result2 = yield* send({ ...e, model: model3, ...effort ? { effort } : {} });
        if (result2.usage) await subagentTally($, result2.usage).catch(() => void 0);
        return result2;
      }
    }
    const p = await read22($, pick5);
    if (!p || !takesEffort(e.model) || !cacheSafe(e.model) && p.by !== "manual") return yield* send(e);
    if (p.by !== "manual" && !await read22($, isAuto5)) return yield* send(e);
    if (e.agentId !== void 0) {
      if (p.by === "manual" || !steer?.effort) return yield* send(e);
      const floor = subagentFloor(config.floor, config.ceiling);
      const effort = EFFORTS.indexOf(p.effort) < EFFORTS.indexOf(floor) ? floor : p.effort;
      if (e.index === 0)
        void proof($, `subagent ${e.agentId} (${e.model}): effort ${e.effort ?? "none"} -> ${effort}, the turn's`);
      return yield* send({ ...e, effort });
    }
    if (e.agentId === void 0)
      void proof($, `request ${e.index} (${e.model}): effort ${e.effort ?? "none"} -> ${p.effort}`);
    const result = yield* send({ ...e, effort: p.effort });
    if (e.agentId === void 0 && p.by !== "manual" && result.usage) {
      await tally($, p.effort, result.usage);
      void proof(
        $,
        `response ${e.index} at ${p.effort}: ${result.usage.output_tokens} out, ${result.usage.cache_read_input_tokens ?? 0} cache read, ${result.usage.cache_creation_input_tokens ?? 0} cache write`
      );
    }
    return result;
  });
}

// hooks/register.tsx
function register(on, options) {
  setLoadedAt(Date.now());
  setTimersFrom(null);
  setTimersScheduled(false);
  setFirstDrawLogged(false);
  setDrawsTimed(0);
  setConfig(readConfig(options));
  applyTheme();
  setPluginOptions(options);
  registerSessionHooks(on);
  registerTurnHooks(on);
  registerCommandHooks(on);
  registerPromptHooks(on);
  registerFooterHooks(on);
  registerAgentHooks(on);
  registerAbovePromptHooks(on);
}
export {
  register
};
