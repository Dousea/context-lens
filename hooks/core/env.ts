import type { EngineInterface } from 'claude-code'

// Proof log: every verdict, /effort and request effort, written to CONTEXT_LENS_LOG, or to
// %TEMP%/context-lens-proof.log while the mod is loaded from a dev-mods folder. Off otherwise.
const proofLines: string[] = []
// An environment variable does not change while the session runs, so each one is asked for once. The
// engine wants the name spelled out in every $.env.get call, hence one small getter per variable.
type EnvAsk = Promise<string | undefined> | undefined
let askLog: EnvAsk
let askTemp: EnvAsk
let askTmpdir: EnvAsk
let askUserProfile: EnvAsk
let askHome: EnvAsk
let askCacheTtl: EnvAsk
let askAgentCacheTtl: EnvAsk
let askForce5m: EnvAsk
let askEnable1h: EnvAsk
function envLog($: EngineInterface) {
  return (askLog = askLog ?? $.env.get('CONTEXT_LENS_LOG'))
}
function envTemp($: EngineInterface) {
  return (askTemp = askTemp ?? $.env.get('TEMP'))
}
function envTmpdir($: EngineInterface) {
  return (askTmpdir = askTmpdir ?? $.env.get('TMPDIR'))
}
export function envUserProfile($: EngineInterface) {
  return (askUserProfile = askUserProfile ?? $.env.get('USERPROFILE'))
}
export function envHome($: EngineInterface) {
  return (askHome = askHome ?? $.env.get('HOME'))
}
export function envCacheTtl($: EngineInterface) {
  return (askCacheTtl = askCacheTtl ?? $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL'))
}
export function envAgentCacheTtl($: EngineInterface) {
  return (askAgentCacheTtl = askAgentCacheTtl ?? $.env.get('CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL'))
}
export function envForce5m($: EngineInterface) {
  return (askForce5m = askForce5m ?? $.env.get('FORCE_PROMPT_CACHING_5M'))
}
export function envEnable1h($: EngineInterface) {
  return (askEnable1h = askEnable1h ?? $.env.get('ENABLE_PROMPT_CACHING_1H'))
}

async function proofPath($: EngineInterface): Promise<string | undefined> {
  const named = await envLog($)
  if (named) return named
  if (!$.plugin.root.replace(/\\/g, '/').includes('/dev-mods/')) return undefined
  const tmp = (await envTemp($)) ?? (await envTmpdir($)) ?? '/tmp'
  return `${tmp}/context-lens-proof.log`
}
export async function proof($: EngineInterface, line: string) {
  const path = await proofPath($).catch(() => undefined)
  if (!path) return
  proofLines.push(`${new Date().toISOString()} ${line}`)
  await $.fs.write(path, proofLines.slice(-200).join('\n') + '\n').catch(() => undefined)
}

/** This install's version, read from its plugin.json when the timers start. */
export let ownVersion = ''
export function readOwnVersion($: EngineInterface) {
  void $.fs
    .read(`${$.plugin.root}/.claude-plugin/plugin.json`)
    .then(text => {
      ownVersion = String(JSON.parse(String(text)).version ?? '')
    })
    .catch(() => undefined)
}

/**
 * Where `claude` may be: on PATH, then where the official installers put it. The desktop app starts with the PATH it
 * had at login, so a CLI installed since is not on it until the next sign-in.
 */
export function claudeCandidates(home: string | undefined): string[] {
  if (!home) return ['claude']
  const win = /^[A-Za-z]:/.test(home)
  const sep = home.includes('\\') ? '\\' : '/'
  return ['claude', [home.replace(/[\\/]+$/, ''), '.local', 'bin', win ? 'claude.exe' : 'claude'].join(sep)]
}
// What the engine says when a command cannot be started at all, as opposed to one that ran and failed.
const NOT_STARTED = /ENOENT|not found or is in an unsafe location|failed to start/i
/** For a `claude` that would not start: what to install, in the person's own shell; undefined for any other error. */
export function noClaudeHint(error: string, home: string | undefined): string | undefined {
  if (!NOT_STARTED.test(error)) return undefined
  const install =
    home && /^[A-Za-z]:/.test(home)
      ? 'irm https://claude.ai/install.ps1 | iex'
      : 'curl -fsSL https://claude.ai/install.sh | bash'
  return `This needs the Claude Code CLI. Install it with ${install}, then reopen the app.`
}
export async function homeDir($: EngineInterface) {
  return ((await envUserProfile($)) ?? (await envHome($))) || undefined
}
/** `claude <args>`, from the next place it may be when one will not start. */
export async function runClaude(
  $: EngineInterface,
  args: string[],
  opts: Parameters<EngineInterface['process']['run']>[1],
) {
  let last: unknown
  for (const bin of claudeCandidates(await homeDir($))) {
    try {
      return await $.process.run([bin, ...args], opts)
    } catch (error) {
      last = error
      if (!NOT_STARTED.test(String(error))) throw error
    }
  }
  throw last
}
/** This install's id, context-lens@<marketplace>, read off the cache path (…/plugins/cache/<marketplace>/context-lens/<version>). */
export function pluginId($: EngineInterface) {
  return `context-lens@${$.plugin.root.match(/cache[\\/]([^\\/]+)[\\/]/)?.[1] ?? 'context-lens'}`
}
