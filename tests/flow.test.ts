import type {
  On,
  SessionContextBreakdown,
  SessionUsage,
  TurnStepResult,
} from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const MINUTE = 60_000
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
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: USAGE }))
  on('settings.read', () => ({ value: {} }))
  on('env.get', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('agent.list', () => ({
    value: [{ id: 'agent-1', description: 'Implement spec 14', type: 'pz-implementer', status: 'running' as const }],
  }))
  return { toasts }
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
  await $.session.start(START)
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
  await $.session.start(START)
  await step($)

  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(60) })
  expect(await line.find({ text: /^152k/ })).toBeDefined()
  expect(await line.find({ text: /^2h14m$/ })).toBeUndefined()
})

test('a large idle context warns before the hour ends and again when it goes cold', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const host = engine(on)
  answering(on, 140_000, 4_000)
  await $.session.start(START)
  await step($)

  await clock.advance(49 * MINUTE)
  expect(host.toasts).toEqual([])
  await clock.advance(2 * MINUTE)
  expect(host.toasts.length).toBe(1)
  expect(host.toasts[0]).toMatch(/expires in .* \(152k\)/)
  await clock.advance(10 * MINUTE)
  expect(host.toasts.length).toBe(2)
  expect(host.toasts[1]).toMatch(/went cold.*152k/)

  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await line.find({ text: /^cold$/ })).toBeDefined()
})

test('a request that rewrites a warm cache is marked re-cached', async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 0, 120_000)
  await $.session.start(START)
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
  await $.session.start(START)
  await step($, 'agent-1')
  await clock.advance(MINUTE)

  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140, 'agent-1') })
  expect(await line.find({ text: /^pz-implementer$/ })).toBeUndefined()
  expect(await line.find({ text: /^4:00$/ })).toBeDefined()
  expect(await line.find({ text: /^22k\/250k$/ })).toBeDefined()

  const mainLine = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await mainLine.find({ text: /^—$/ })).toBeDefined()
})
