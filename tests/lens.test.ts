import type {
  On,
  SessionContextBreakdown,
  SessionUsage,
  TurnStepResult,
} from 'claude-code'
import { expect, mock, test as baseTest } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const MINUTE = 60_000

// The lens row lives in the dashboard band, so every test runs in the dashboard look.
type Opts = Parameters<typeof baseTest>[1]
const test = ((name: string, run: unknown) => baseTest(name, { options: { layout: 'default' } } as Opts, run as never)) as unknown as (
  name: string,
  run: ($: Engine, on: On) => unknown,
) => void
const PLUGIN = 'context-lens'

const BREAKDOWN: SessionContextBreakdown = {
  categories: [
    { name: 'System prompt', tokens: 9_000, color: 'promptBorder', isDeferred: false, kind: 'used' },
    { name: 'Messages', tokens: 140_000, color: 'permission', isDeferred: false, kind: 'used' },
    { name: 'Free space', tokens: 88_000, color: 'inactive', isDeferred: false, kind: 'free' },
    { name: 'Autocompact buffer', tokens: 13_000, color: 'inactive', isDeferred: false, kind: 'buffer' },
  ],
  totalTokens: 149_000,
  maxTokens: 250_000,
  rawMaxTokens: 250_000,
  autocompactSource: 'settings',
  percentage: 60,
  gridRows: [],
  model: 'claude-opus-5-5',
  memoryFiles: [{ path: '/home/me/project/CLAUDE.md', type: 'Project', tokens: 2_400 }],
  mcpTools: [],
  agents: [{ agentType: 'pz-implementer', source: 'projectSettings', tokens: 600 }],
  autoCompactThreshold: 237_000,
  isAutoCompactEnabled: true,
  apiUsage: null,
}

const HOUR = 60 * MINUTE

const USAGE: SessionUsage = {
  startedAt: 0,
  context: { tokens: 152_000, window: 1_000_000, percent: 15, breakdown: BREAKDOWN },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 46, resetsAt: new Date(2 * HOUR + 14 * MINUTE).toISOString() },
    { kind: 'seven_day', percentUsed: 21, resetsAt: new Date(3 * 24 * HOUR + HOUR).toISOString() },
  ],
}

const band = (bodyColumns: number, agentId?: string) => ({
  hasSurvey: false,
  isWorking: false,
  maxRows: 6,
  bodyColumns,
  scroll: { offset: 0, bodyRows: 6 },
  view: agentId === undefined ? {} : { agentId },
})

const START = { cwd: '/tmp/project', surface: 'terminal' as const, isInteractive: true }

/** Stands in for the engine beneath the plugin; keeps the toasts it was asked to raise. */
function engine(on: On) {
  const toasts: string[] = []
  // What the dashboard around the lens needs beneath it: a store, the environment, the prompt and the session's model.
  mock.store(on)
  mock.env(on, { CONTEXT_LENS_MODEL_UI: '1' })
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('session.messages', () => ({ value: [] }) as never)
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('session.usage', () => ({ value: USAGE }))
  on('settings.read', () => ({ value: {} }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('agent.list', () => ({
    value: [{ id: 'agent-1', description: 'Implement spec 14', type: 'pz-implementer', status: 'running' as const }],
  }))
  return { toasts }
}

/** Starts the session and closes the setup guide the dashboard opens the first time. */
async function begin($: Engine) {
  await $.session.start(START)
  const guide = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  await guide.press({ key: 'setup-close' })
  await guide.unmount()
}

async function step($: Engine, agentId?: string) {
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', messageCount: 3, ...(agentId ? { agentId } : {}) })
  for await (const _ of stream) {
    // drain
  }
  return stream.result
}

function answering(on: On, read: number, written: number) {
  on('turn.step', async function* (): AsyncGenerator<never, TurnStepResult> {
    return {
      turnId: 't',
      index: 0,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        model: 'claude-opus-5-5',
        input_tokens: 500,
        output_tokens: 200,
        cache_read_input_tokens: read,
        cache_creation_input_tokens: written,
      },
    }
  })
}

test('the line counts the main cache down and shows the context and usage', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 140_000, 4_000)
  await begin($)
  await step($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const line = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band(140) })
    expect(await line.find({ text: /^60m$/ })).toBeDefined()
    expect(await line.find({ text: /^152k\/250k$/ })).toBeDefined()
    expect(await line.find({ text: /^5h$/ })).toBeDefined()
    expect(await line.find({ text: /^46%$/ })).toBeDefined()
    expect(await line.find({ text: /^2h14m$/ })).toBeDefined()
    expect(await line.find({ text: /^7d$/ })).toBeDefined()
    expect(await line.find({ text: /^3d$/ })).toBeDefined()
    await line.unmount()
  }

  await clock.advance(30 * MINUTE)
  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await line.find({ text: /^30m$/ })).toBeDefined()
})

test('a narrow line keeps the token count and drops the reset times', async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 140_000, 4_000)
  await begin($)
  await step($)

  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(60) })
  expect(await line.find({ text: /^152k/ })).toBeDefined()
  expect(await line.find({ text: /^2h14m$/ })).toBeUndefined()
})

test('a request that rewrites a warm cache is marked re-cached', async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 0, 120_000)
  await begin($)
  await step($)

  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await line.find({ text: /re-cached/ })).toBeUndefined()
  await step($)
  expect(await line.find({ text: /re-cached/ })).toBeDefined()
})

test('a subagent in view shows its own five-minute clock', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 20_000, 1_000)
  await begin($)
  await step($, 'agent-1')
  await clock.advance(MINUTE)

  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140, 'agent-1') })
  expect(await line.find({ text: /^pz-implementer$/ })).toBeUndefined()
  expect(await line.find({ text: /^4:00$/ })).toBeDefined()
  expect(await line.find({ text: /^22k\/250k$/ })).toBeDefined()

  const mainLine = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await mainLine.find({ text: /^—$/ })).toBeDefined()
})

test('the lens row stays under an alert band on the terminal', async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 140_000, 4_000)
  await begin($)
  await step($)
  // The cold alert, forced: it takes the slot, and the row sits under it.
  await $.command.run({ command: 'context-lens', args: 'cold' } as never)
  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await line.find({ key: 'cold-hide' })).toBeDefined()
  expect(await line.find({ text: /^ctx$/ })).toBeDefined()
  expect(await line.find({ text: /^152k\/250k$/ })).toBeDefined()
})
