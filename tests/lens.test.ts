import type { On, SessionContextBreakdown, SessionUsage, TurnStepResult } from 'claude-code'
import { expect, mock, test as baseTest } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'

const MINUTE = 60_000

// The lens row lives in the dashboard band, so every test runs in the dashboard look.
const test = (name: string, run: TestBody) => baseTest(name, { options: { layout: 'default' } }, run)
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
  mock.env(on, {})
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
  const stream = $.turn.step({
    turnId: 't',
    index: 0,
    model: 'claude-opus-5-5',
    messageCount: 3,
    ...(agentId ? { agentId } : {}),
  })
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
    expect(await line.find({ text: /^152k$/ })).toBeDefined()
    expect(await line.find({ text: /^\/ 250k$/ })).toBeDefined()
    expect(await line.find({ text: /^Session$/ })).toBeDefined()
    expect(await line.find({ text: /^46%$/ })).toBeDefined()
    expect(await line.find({ text: /^↻ 2h14m$/ })).toBeDefined()
    expect(await line.find({ text: /^Week$/ })).toBeDefined()
    expect(await line.find({ text: /^↻ 3d$/ })).toBeDefined()
    await line.unmount()
  }

  await clock.advance(30 * MINUTE)
  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await line.find({ text: /^30m$/ })).toBeDefined()
})

test('the usage windows draw bars on a wide terminal and one-cell gauges on a narrower one', async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 140_000, 4_000)
  await begin($)
  await step($)

  const wide = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await wide.find({ key: 'u-5h-bar' })).toBeDefined()
  expect(await wide.find({ text: /^System prompt$/ })).toBeUndefined()
  expect(await wide.find({ text: /^▄$/ })).toBeUndefined()
  await wide.unmount()

  const narrow = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(100) })
  expect(await narrow.find({ key: 'u-5h-bar' })).toBeUndefined()
  expect(await narrow.find({ text: /^▄$/ })).toBeDefined()
  await narrow.unmount()
})

test('a narrow line keeps the token count and drops the reset times', async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 140_000, 4_000)
  await begin($)
  await step($)

  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(60) })
  expect(await line.find({ text: /^152k/ })).toBeDefined()
  expect(await line.find({ text: /^↻ 2h14m$/ })).toBeUndefined()
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

  const line = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AbovePrompt',
    props: band(140, 'agent-1'),
  })
  expect(await line.find({ text: /^pz-implementer$/ })).toBeUndefined()
  expect(await line.find({ text: /^4:00$/ })).toBeDefined()
  expect(await line.find({ text: /^22k$/ })).toBeDefined()
  expect(await line.find({ text: /^\/ 250k$/ })).toBeDefined()

  const mainLine = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band(140) })
  expect(await mainLine.find({ text: /^—$/ })).toBeDefined()
})

baseTest(
  'hiding the cache timer drops the clock from the row on both surfaces',
  { options: { layout: 'default', hide: 'timer' } },
  async ($, on) => {
    mock.clock(on, { now: 0 })
    engine(on)
    answering(on, 140_000, 4_000)
    await begin($)
    await step($)

    for (const surface of ['terminal', 'desktop'] as const) {
      const line = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band(140) })
      expect(await line.find({ text: /^Context$/ })).toBeDefined()
      expect(await line.find({ text: /^152k$/ })).toBeDefined()
      expect(await line.find({ text: /^\/ 250k$/ })).toBeDefined()
      expect(await line.find({ text: /^60m$/ })).toBeUndefined()
      expect(await line.find({ text: /^●$/ })).toBeUndefined()
      await line.unmount()
    }
  },
)

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
  expect(await line.find({ text: /^Context$/ })).toBeDefined()
  expect(await line.find({ text: /^152k$/ })).toBeDefined()
  expect(await line.find({ text: /^\/ 250k$/ })).toBeDefined()
})

baseTest(
  'the desktop strip and rings follow the light look',
  { options: { layout: 'default', appearance: 'light' } },
  async ($, on) => {
    mock.clock(on, { now: 0 })
    engine(on)
    answering(on, 140_000, 4_000)
    await begin($)
    await step($)

    const line = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band(140) })
    const dashboard = JSON.stringify(keyed(await line.drawn(), 'dash'))
    expect(dashboard).toContain('"u-5h-ring"')
    expect(dashboard).toContain('preserveAspectRatio=\\"none\\"')
    // The messages row (permission) and the dim free space are drawn for a dark app, then turned for a light one.
    expect(dashboard).not.toContain('#b1b9f9')
    expect(dashboard).not.toContain('#3b3b42')
    // The tokens used carry the band's text colour: the app's default would be white on a light band in a dark app.
    expect((await line.find({ text: /^152k$/ }))?.props.color).toMatch(/^#/)
  },
)

/** The element keyed `key` in a drawn tree, with everything under it. */
function keyed(node: unknown, key: string): unknown {
  if (!node || typeof node !== 'object') return undefined
  const element = node as { props?: { key?: string; children?: unknown } }
  if (element.props?.key === key) return node
  const children = element.props?.children
  for (const child of Array.isArray(children) ? children : [children]) {
    const hit = keyed(child, key)
    if (hit) return hit
  }
  return undefined
}

test('desktop draws the lens row inside the dashboard, the context as a strip and the limits as rings', async ($, on) => {
  mock.clock(on, { now: 0 })
  engine(on)
  answering(on, 140_000, 4_000)
  await begin($)
  await step($)

  const line = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band(140) })
  const dashboard = JSON.stringify(keyed(await line.drawn(), 'dash'))
  expect(dashboard).toContain('"lens-row"')
  expect(dashboard).toContain('"ctx-bar"')
  expect(dashboard).toContain('preserveAspectRatio=\\"none\\"')
  expect(dashboard).toContain('"u-5h-ring"')
  expect(dashboard).toContain('"u-7d-ring"')
  // Every row keeps its colour in the strip, however small its share of the window.
  expect(dashboard).toContain('#b1b9f9')
  // The breakdown waits under the context for the pointer: each row by name and tokens.
  expect(await line.find({ text: /^System prompt$/ })).toBeDefined()
  expect(await line.find({ text: /^Messages$/ })).toBeDefined()
  expect(await line.find({ text: /^Free space$/ })).toBeDefined()
  // No usage bars and no gauges: a ring takes their place.
  expect(dashboard).not.toContain('"u-5h-bar"')
  expect(dashboard).not.toContain('▄')
  // A run of rule glyphs wraps and leaves gaps in the desktop's proportional font.
  expect(dashboard).not.toContain('━')
  expect(dashboard).not.toContain('─')
  // The lens row carries the cache and the context, so the title does not repeat them.
  expect(await line.find({ key: 'dash-ring' })).toBeUndefined()
  expect(dashboard).not.toContain('% context')
})
