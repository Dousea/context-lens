import { describe, expect, mock, test as baseTest } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine, MountTarget, TestOptions, TestRest } from 'claude-code/testing'
import { readConfig } from '../hooks/core/config'
import { cacheSafe } from '../hooks/core/constants'
import { claudeCandidates, noClaudeHint } from '../hooks/core/env'
import { hotVisible, resetLabel } from '../hooks/logic/alerts'
import { benchGrade, benchReport, stepsGrade } from '../hooks/logic/bench'
import { cacheClock, cacheColor, cacheLabel, cacheTtlOf, mostlyCached } from '../hooks/logic/cache'
import { compactTranscript } from '../hooks/logic/compact'
import {
  forkOutcome,
  HANDOFF_PROMPT,
  handoffEvidence,
  handoffMessage,
  parseHandoffAnswer,
} from '../hooks/logic/handoff'
import {
  bounded,
  capped,
  contextFrom,
  endsOnQuestion,
  isFollowUp,
  judgeFailure,
  keepsEffort,
  namedEffort,
  parseVerdict,
  tipped,
  withAttachments,
} from '../hooks/logic/judge'
import { renamedSettings } from '../hooks/logic/settings'
import { setupBack, setupCounter, setupNext } from '../hooks/logic/setup'
import { asSpent, savedText, turnLineFor, weighted } from '../hooks/logic/spend'
import { subagentFloor, subagentModelFor, subagentSteerable } from '../hooks/logic/subagents'
import { priceOf, subagentNote, subagentPays, switchWorth } from '../hooks/logic/switching'
import { bandFit } from '../hooks/render/band'
import { dashboardLines, flashColor } from '../hooks/render/dashboard'
import { handoffLook } from '../hooks/svg/controls'
import {
  handoffGlowStep,
  JUDGE_FADE_MS,
  JUDGE_PIECE_MS,
  JUDGE_RISE_MS,
  JUDGE_STEP_MS,
  judgeBrightnessAt,
  judgeGlowAt,
  judgeGlowSvg,
} from '../hooks/svg/glows'
import { ART_COLUMNS, artFrame, artPixel, MOVING } from '../hooks/svg/art'
import { thinkingSvg } from '../hooks/svg/thinking'
import { isLight, lightHex, lightProps, setLight, setTheme, themedEls, themedSvg, tint, tintHex } from '../hooks/theme'

// The test runner has a timer; the lib the host's tsconfig names declares none.
declare function setTimeout(callback: (value?: unknown) => void, ms: number): unknown

// Most tests below were written for the footer's buttons: they run in the minimal look unless they name another.
// The dashboard's own tests pass { layout: 'default' }.
const minimal = (testOptions?: TestOptions): TestOptions => ({
  ...testOptions,
  options: { layout: 'minimal', ...testOptions?.options },
})
const test = (name: string, ...rest: TestRest) =>
  rest.length === 1 ? baseTest(name, minimal(), rest[0]) : baseTest(name, minimal(rest[0]), rest[1])

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

/** Haiku as the judge answers this reply, and counts how often it was asked. */
function judgeSays(on: On, text: string) {
  const asked: string[] = []
  on('model.complete', (_$, e) => {
    asked.push(e.prompt)
    return { value: { isAnswered: true as const, text, usage: USAGE } }
  })
  return asked
}

/** The prompts that got through to the app, since the last engine(). */
const submitted: string[] = []

/** What sits beneath the plugins in a session: the prompt goes through, the status line takes text. */
function engine(
  on: On,
  env: Record<string, string> = {},
  sessionModel = 'claude-opus-5-5',
  said: { role: string; text: string }[] = [],
  stored: Record<string, unknown> = {},
) {
  mock.store(on, stored)
  mock.env(on, env)
  submitted.length = 0
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.messages', () => ({ value: said }) as never)
  on('session.model', () => ({ value: sessionModel }))
  on('command.list', () => ({
    value: [{ name: 'model' }, { name: 'effort' }, { name: 'session-handoff', source: 'user' }] as never,
  }))
}

/** Records the slash commands the mod runs, as the person's own /model and /effort. */
function recordCommands(on: On) {
  const ran: string[] = []
  on('command.run', (_$, e) => {
    ran.push(`/${e.command} ${e.args}`)
    return { text: 'ok' }
  })
  return ran
}

/** Records the model and effort each main-conversation request was sent with. */
function recordSteps(on: On) {
  const sent: { model: string; effort: unknown }[] = []
  on('turn.step', async function* (_$, e) {
    sent.push({ model: e.model, effort: e.effort })
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return sent
}

/** One main-loop request, the engine sending `effort` as its own setting (high unless /effort set another). */
async function step(
  $: Engine,
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'high',
  model = 'claude-opus-5-5',
) {
  const stream = $.turn.step({ turnId: 't1', index: 0, model, effort, messageCount: 1 })
  for await (const _ of stream) {
    // drain
  }
}

/** The desktop footer: one Auto button, and the effort in use beside it. */
const FOOTER = { plugin: 'context-lens', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never

/** The band above the prompt on desktop: it draws nothing (only the terminal has rows there). */
const DESK_BAND = { plugin: 'context-lens', surface: 'desktop', ...BAND } as MountTarget<'desktop', 'AbovePrompt'>

/** What a mounted tree draws, as text: its elements, props and strings. */
/** Nothing shows above the prompt on desktop: only the hidden hover cards, revealed by hovering the footer. */
async function noBand($: Engine, at: never) {
  const ui = await $.ui.mount(at)
  const text = await drawn(ui)
  expect(text).toContain('hover-cards')
  expect(text).not.toMatch(/"key":"(settings|setup|down|hot|cold|swamp)"/)
  await ui.unmount()
}

async function drawn(ui: { drawn: () => Promise<unknown> }): Promise<string> {
  return JSON.stringify(await ui.drawn())
}

/**
 * The band's buttons take clicks: the app draws anything in the flow under an absolutely placed art layer, so the
 * layer holding them must itself be absolute and come after the art.
 */
async function clickable(ui: { drawn: () => Promise<unknown> }, layer: string) {
  const find = (node: unknown): Record<string, unknown> | undefined => {
    if (!node || typeof node !== 'object') return undefined
    const n = node as Record<string, unknown>
    const props = (n.props ?? {}) as Record<string, unknown>
    if (n.key === layer || props.key === layer) return n
    for (const value of Object.values(n)) {
      const hit = Array.isArray(value) ? value.map(find).find(Boolean) : find(value)
      if (hit) return hit
    }
    return undefined
  }
  const node = find(await ui.drawn())
  expect(node).toBeDefined()
  const props = ((node as Record<string, unknown>).props ?? node) as Record<string, unknown>
  expect(props.position).toBe('absolute')
}

describe('auto', () => {
  test('effort follows the judge and the model stays the one in use', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"low","why":"simple question"}')
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'vad heter mappen?', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
  })

  test('Auto switched off: the app effort goes out, not the pick the judge made while Auto was on', async ($, on) => {
    engine(on)
    on('model.complete', () => ({
      value: { isAnswered: true as const, text: '{"model":"opus","effort":"low","why":"tiny"}', usage: USAGE },
    }))
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'rename this one variable for me', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[0]?.effort).toBe('low')
    // Auto off, the app still on Extra (no change the mod could see): Extra goes out, not the judge's old low.
    await $.command.run({ command: 'context-lens', args: 'auto' } as never)
    await step($, 'xhigh')
    expect(sent[1]?.effort).toBe('xhigh')
    await $.prompt.submit({ text: 'now plan the whole architecture', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[2]?.effort).toBe('xhigh')
  })

  test('an agent report is judged for its own effort when Auto is on, and runs on the last pick when Auto is off', async ($, on) => {
    engine(on)
    const said = [
      '{"model":"opus","effort":"high","why":"design"}',
      '{"model":"haiku","effort":"low","why":"a short status"}',
    ]
    let asked = 0
    on('model.complete', () => ({
      value: { isAnswered: true as const, text: said[Math.min(asked++, said.length - 1)] ?? '', usage: USAGE },
    }))
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'design the whole trainer architecture', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[0]?.effort).toBe('high')
    await $.prompt.submit({ text: 'The background task finished.', wait: false, origin: { kind: 'task-notification' } })
    await step($, 'xhigh')
    // Judged on its own: the last typed prompt's high is not kept, and the model stays.
    expect(asked).toBe(2)
    expect(sent[1]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
    // A scheduled firing, a relayed channel message and an auto-continuation are judged the same way.
    await $.prompt.submit({ text: 'Check the deploy.', wait: false, origin: { kind: 'scheduled-trigger' } })
    await $.prompt.submit({ text: 'Is the build green?', wait: false, origin: { kind: 'channel', server: 'slack' } })
    await $.prompt.submit({
      text: 'Now plan the migration to the new schema.',
      wait: false,
      origin: { kind: 'auto-continuation' },
    })
    expect(asked).toBe(5)
    await $.command.run({ command: 'context-lens', args: 'auto' } as never)
    await $.prompt.submit({
      text: 'The background task finished again.',
      wait: false,
      origin: { kind: 'task-notification' },
    })
    await $.prompt.submit({ text: 'Check the deploy again.', wait: false, origin: { kind: 'scheduled-trigger' } })
    expect(asked).toBe(5)
  })

  test("a subagent in view shows its own effort, never the chat's effort or the judge's reason for the chat's prompt", async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"high","why":"design work"}')
    await $.prompt.submit({ text: 'design the whole trainer architecture', wait: false, origin: { kind: 'composer' } })
    const chat = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND } as never)
    await chat.press({ key: 'setup-close' }).catch(() => undefined)
    const own = await drawn(chat)
    expect(own).toContain('design work')
    await chat.unmount()
    const agent = await $.ui.mount({
      plugin: 'context-lens',
      surface: 'terminal',
      ...BAND,
      props: { ...BAND.props, view: { agentId: 'a1' } },
    } as never)
    const text = await drawn(agent)
    expect(text).not.toContain('design work')
    // No effort lit: the chat's high is not the subagent's, whose own is not known yet.
    expect(text).not.toContain('"label":"high","variant":"primary"')
    await agent.unmount()
    // The dashboard's own line: the subagent's effort alone, none of the chat's Auto state or judge.
    const base = {
      auto: true,
      paused: true,
      judging: true,
      effort: undefined,
      cacheNow: null,
      contextPercent: null,
      reason: '',
    }
    expect(dashboardLines({ ...base, agent: true }).what).toBe('Subagent')
    expect(dashboardLines({ ...base, agent: true, effort: 'low' }).what).toBe('Low')
  })

  test('the band gives up rows in order when the app leaves it little room, and keeps the effort line', () => {
    const all = { detailText: false, lens: true, effort: 1 }
    expect(bandFit(6, all)).toEqual({ detail: true, border: true, effort: true, lens: true })
    // The paste: room for 5 rows, a 6-row band: the empty detail row goes.
    expect(bandFit(5, all)).toEqual({ detail: false, border: true, effort: true, lens: true })
    expect(bandFit(3, all)).toEqual({ detail: false, border: false, effort: true, lens: true })
    expect(bandFit(2, all)).toEqual({ detail: false, border: false, effort: false, lens: true })
    expect(bandFit(1, all)).toEqual({ detail: false, border: false, effort: false, lens: false })
    // An alert's words are kept: the border and the effort row give way first.
    expect(bandFit(5, { ...all, detailText: true })).toEqual({ detail: true, border: false, effort: true, lens: true })
  })

  test("a typed skill is judged like a prompt (told what it is); the app's own commands are not", async ($, on) => {
    engine(on)
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(String((e as { prompt?: string }).prompt ?? ''))
      return {
        value: { isAnswered: true as const, text: '{"model":"haiku","effort":"low","why":"small job"}', usage: USAGE },
      }
    })
    const sent = recordSteps(on)
    // /session-handoff is a user skill (see engine's command list): judged, even though it is short enough to look like a follow-up.
    await $.prompt.submit({ text: '/session-handoff', wait: false, origin: { kind: 'composer' } })
    await step($)
    expect(asked.length).toBe(1)
    expect(asked[0]).toContain('slash command that runs a skill')
    // /model is the app's own: never judged.
    await $.prompt.submit({ text: '/model', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(1)
  })

  test("a dearer model than the chat's is only offered: declined, the request keeps the chat model", async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const sent = recordSteps(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    const sending = $.prompt.submit({ text: 'debug this race condition', wait: false, origin: { kind: 'composer' } })
    for (let i = 0; i < 5; i++) await ui.redraw()
    expect(await ui.find({ key: 'accept' })).toBeDefined()
    await ui.press({ key: 'decline' })
    await sending
    for await (const _ of $.turn.step({
      turnId: 't1',
      index: 0,
      model: 'claude-sonnet-5-5',
      effort: 'high',
      messageCount: 1,
    })) {
      // drain
    }
    expect(sent[0]?.model).toBe('claude-sonnet-5-5')
    await ui.unmount()
  })

  test('a reply that is not a verdict leaves the session as it is', async ($, on) => {
    engine(on)
    judgeSays(on, 'I think sonnet')
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'fixa buggen', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
  })

  test('slash commands are not judged', async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"model":"opus","effort":"max","why":"x"}')

    await $.prompt.submit({ text: '/clear', wait: false, origin: { kind: 'composer' } })

    expect(asked.length).toBe(0)
  })
})

describe('manual effort', () => {
  test("the app's own Effort control wins over Auto and turns it off", async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const sent = recordSteps(on)
    const drain = async (index: number, effort: 'low' | 'medium' | 'high') => {
      for await (const _ of $.turn.step({ turnId: 't1', index, model: 'claude-opus-5-5', effort, messageCount: 1 })) {
        // drain
      }
    }

    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    await drain(0, 'medium')
    expect(sent[0]?.effort).toBe('high')

    // The person picks Low in the app between two requests.
    await drain(1, 'low')
    expect(sent[1]?.effort).toBe('low')
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'auto' }))?.text).toContain('Manual')
    await ui.unmount()

    await drain(2, 'low')
    expect(sent[2]?.effort).toBe('low')
  })
})

describe('model in use', () => {
  test('a switch in the app moves the band, and effort applies to the new model at once', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"low","why":"kort"}')
    const sent = recordSteps(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const switchTo = (from: string, to: string) =>
      $.classic.PostModelSwitch({
        from_model: from,
        to_model: to,
        requested_model: null,
        source: 'picker',
        context_tokens: 0,
      } as never)

    await switchTo('claude-opus-5-5', 'claude-haiku-5-5')
    await $.prompt.submit({ text: 'ok', wait: false, origin: { kind: 'composer' } })
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await ui.redraw()
    expect((await ui.find({ key: 'm-haiku' }))?.text).toContain('Haiku')

    // The person picks Opus in the app.
    await switchTo('claude-haiku-5-5', 'claude-opus-5-5')
    await ui.redraw()
    expect((await ui.find({ key: 'm-opus' }))?.text).toContain('Opus')

    await step($, 'medium')
    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
    await ui.unmount()
  })
})

describe('two autos', () => {
  test('Auto for model starts off: effort follows the judge and the judge naming the chat model offers nothing', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"low","why":"simple"}')
    const ran = recordCommands(on)
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'auto' }))?.text).toContain('Auto')
    expect((await ui.find({ key: 'auto-model' }))?.text).toContain('Manual')

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await ui.redraw()
    expect(await ui.find({ key: 'accept' })).toBeUndefined()

    await step($, 'medium')
    expect(sent[0]?.effort).toBe('low')
    expect(ran).toEqual([])
    await ui.unmount()
  })

  test('Auto for effort off, Auto for model on: the judge still switches the model, effort is left alone', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple"}')
    const ran = recordCommands(on)
    const sent = recordSteps(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await ui.press({ key: 'auto' })
    await ui.press({ key: 'auto-model' })

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await step($, 'high')

    expect(ran).toEqual([])
    expect(sent[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'high' })
    await ui.unmount()
  })
})

describe('model suggestion', () => {
  test('priceOf: Haiku costs five times as much past 100k tokens of context, Opus the same at any size', () => {
    expect(priceOf('haiku', 50_000)).toBe(0.1)
    expect(priceOf('haiku', 100_000)).toBe(0.1)
    expect(priceOf('haiku', 100_001)).toBe(0.5)
    expect(priceOf('opus', 50_000)).toBe(4)
    expect(priceOf('opus', 500_000)).toBe(4)
  })

  test('switchWorth: a switch where the rewritten cache is cheap or pays back, a subagent otherwise', () => {
    // A new chat (size unknown), a small one, or a cold one: switch, either way.
    expect(switchWorth('haiku', 'opus', { cold: false })).toBe('switch')
    expect(switchWorth('sonnet', 'opus', { cold: false, tokens: 5_000 })).toBe('switch')
    expect(switchWorth('opus', 'sonnet', { cold: false, tokens: 5_000 })).toBe('switch')
    expect(switchWorth('sonnet', 'opus', { cold: true, tokens: 90_000 })).toBe('switch')
    expect(switchWorth('opus', 'sonnet', { cold: true, tokens: 400_000 })).toBe('switch')
    // Warm, under the line: Haiku's write costs less than Opus's read, so it pays at once; Sonnet's would take ~18 requests.
    expect(switchWorth('haiku', 'opus', { cold: false, tokens: 90_000 })).toBe('switch')
    expect(switchWorth('sonnet', 'opus', { cold: false, tokens: 90_000 })).toBe('subagent')
    expect(switchWorth('sonnet', 'opus', { cold: false, tokens: 90_000, ttl: '5m' })).toBe('subagent')
    // Past 100k Haiku is a subagent, however cheap the switch: warm, cold, or its own cache still warm.
    expect(switchWorth('haiku', 'opus', { cold: false, tokens: 257_000 })).toBe('subagent')
    expect(switchWorth('haiku', 'opus', { cold: true, tokens: 257_000 })).toBe('subagent')
    expect(switchWorth('haiku', 'sonnet', { cold: false, tokens: 150_000, warm: 140_000 })).toBe('subagent')
    expect(switchWorth('haiku', 'opus', { cold: false, tokens: 100_000 })).toBe('switch')
    // Sonnet is left to the price at any size: a switch when it is cheap (cold, or its cache still warm), else a subagent.
    expect(switchWorth('sonnet', 'opus', { cold: true, tokens: 400_000 })).toBe('switch')
    expect(switchWorth('sonnet', 'opus', { cold: false, tokens: 200_000, warm: 190_000 })).toBe('switch')
    expect(switchWorth('sonnet', 'opus', { cold: false, tokens: 500_000 })).toBe('subagent')
    // A stronger model never pays in tokens: in a big warm chat it is a subagent...
    expect(switchWorth('opus', 'sonnet', { cold: false, tokens: 120_000 })).toBe('subagent')
    // ...unless its own cache is still warm and only the tail since is written.
    expect(switchWorth('opus', 'sonnet', { cold: false, tokens: 120_000, warm: 110_000 })).toBe('switch')
    expect(switchWorth('sonnet', 'opus', { cold: false, tokens: 90_000, warm: 85_000 })).toBe('switch')
    // The same model and Fable never.
    expect(switchWorth('opus', 'opus', { cold: true })).toBe(null)
    expect(switchWorth('fable', 'opus', { cold: true })).toBe(null)
  })

  test('subagentPays: only a task big enough to spare the chat more than the subagent costs to start', () => {
    // One step spares the chat nothing, at any size.
    expect(subagentPays('haiku', 'opus', { tokens: 257_000, effort: 'low', steps: 'one' })).toBe(false)
    expect(subagentPays('sonnet', 'opus', { tokens: 500_000, effort: 'high', steps: 'one' })).toBe(false)
    // A few steps in a big chat pay; in a small one they do not.
    expect(subagentPays('sonnet', 'opus', { tokens: 200_000, effort: 'medium', steps: 'few' })).toBe(true)
    expect(subagentPays('sonnet', 'opus', { tokens: 30_000, effort: 'medium', steps: 'few' })).toBe(false)
    // Without steps the effort stands in: low is one step.
    expect(subagentPays('haiku', 'opus', { tokens: 257_000, effort: 'low' })).toBe(false)
    expect(subagentPays('haiku', 'opus', { tokens: 257_000, effort: 'medium' })).toBe(true)
    // The smaller of the steps and the effort counts: one command on several items is a few steps at low effort.
    expect(subagentPays('haiku', 'opus', { tokens: 257_000, effort: 'low', steps: 'few' })).toBe(false)
    expect(subagentPays('sonnet', 'opus', { tokens: 200_000, effort: 'medium', steps: 'many' })).toBe(true)
    // A stronger model goes for anything bigger than one step.
    expect(subagentPays('opus', 'sonnet', { tokens: 120_000, effort: 'high', steps: 'few' })).toBe(true)
    expect(subagentPays('opus', 'sonnet', { tokens: 120_000, effort: 'high', steps: 'one' })).toBe(false)
  })

  test("a stronger model than the chat's is suggested in a new chat", async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard problem"}')
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    void $.prompt.submit({ text: 'design the whole trainer architecture', wait: false, origin: { kind: 'composer' } })
    for (let i = 0; i < 5; i++) await ui.redraw()
    expect(await ui.find({ key: 'accept' })).toBeDefined()
    await ui.press({ key: 'decline' })
    await ui.unmount()
  })
})

describe('offer a model first', () => {
  // The prompt as the engine sees it: when it is let through (its text reaches the app), and what ran meanwhile.
  const sendHeld = async ($: Engine, _on: On, text = 'vad heter mappen?') => {
    const sending = $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
    return { through: submitted, sending }
  }
  const settle = async (ui: { redraw(): Promise<unknown> }) => {
    for (let i = 0; i < 5; i++) await ui.redraw()
  }
  const NO_HOLD = { options: { holdOffer: 'off' } } as never

  test('offer first: a new chat holds the prompt until Switch, then it goes on the new model, for this session only', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple question"}')
    const ran = recordCommands(on)
    const sent = recordSteps(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    const { through, sending } = await sendHeld($, on)
    await settle(ui)
    expect(await ui.find({ key: 'accept' })).toBeDefined()
    expect(through).toEqual([])
    await ui.press({ key: 'accept' })
    await sending
    // No /model: that would make Haiku the app's default for later sessions too. The requests carry it instead.
    expect(ran).toEqual([])
    expect(through).toEqual(['vad heter mappen?'])
    await step($)
    expect(sent[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'low' })
    await ui.unmount()
  })

  test("offer first: the person's own model switch ends the session's model", async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple question"}')
    on('classic.PostModelSwitch', () => ({}) as never)
    const sent = recordSteps(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    const { sending } = await sendHeld($, on)
    await settle(ui)
    await ui.press({ key: 'accept' })
    await sending
    await $.classic.PostModelSwitch({
      from_model: 'claude-opus-5-5',
      to_model: 'claude-opus-5-5',
      requested_model: 'opus',
      source: 'picker',
      context_tokens: 0,
    } as never)
    await step($)
    expect(sent[0]?.model).toBe('claude-opus-5-5')
    await ui.unmount()
  })

  test('offer first: Keep sends the prompt as it is, on the chat model', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple question"}')
    const ran = recordCommands(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    const { through, sending } = await sendHeld($, on)
    await settle(ui)
    expect(through).toEqual([])
    await ui.press({ key: 'decline' })
    await sending
    expect(ran).toEqual([])
    expect(through).toEqual(['vad heter mappen?'])
    await ui.unmount()
  })

  test('offer first: nobody answers, the prompt goes after 8 seconds, the model unchanged', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple question"}')
    const ran = recordCommands(on)
    const clock = mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    const { through, sending } = await sendHeld($, on)
    await settle(ui)
    expect(through).toEqual([])
    // The question counts the wait down, and the prompt goes when it ends: within the host's 10-second hook budget.
    expect(await drawn(ui)).toContain('Your prompt waits 8s.')
    await clock.advance(7_000)
    await settle(ui)
    expect(await drawn(ui)).toContain('Your prompt waits 1s.')
    expect(through).toEqual([])
    await clock.advance(1_000)
    await sending
    expect(ran).toEqual([])
    expect(through).toEqual(['vad heter mappen?'])
    await ui.unmount()
  })

  test('offer first: a stronger model is offered too, and the prompt waits', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard problem"}')
    const ran = recordCommands(on)
    const sent = recordSteps(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    const { through, sending } = await sendHeld($, on, 'design the whole trainer architecture')
    await settle(ui)
    expect(await ui.find({ key: 'accept' })).toBeDefined()
    expect(through).toEqual([])
    await ui.press({ key: 'accept' })
    await sending
    expect(ran).toEqual([])
    expect(through).toEqual(['design the whole trainer architecture'])
    await step($)
    expect(sent[0]?.model).toBe('claude-opus-5-5')
    await ui.unmount()
  })

  /** The main model answers every request with `tokens` held in its cache; records the model each went out on. */
  const bigChat = (on: On, tokens: number) => {
    const sent: string[] = []
    on(
      'session.usage',
      () => ({ value: { context: { tokens, window: 1_000_000, percent: tokens / 10_000 } } }) as never,
    )
    on('turn.step', async function* (_$, e) {
      sent.push(e.model)
      const usage = {
        ...USAGE,
        cache_read_input_tokens: tokens,
        cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
      }
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage } as never
    })
    return sent
  }

  test('offer first: in a big warm chat a switch that does not pay back becomes a subagent, and the chat keeps its model', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"sonnet","effort":"medium","why":"routine"}')
    const sent = bigChat(on, 200_000)
    const clock = mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await step($)
    await clock.advance(2_000)
    await settle(ui)
    const { through, sending } = await sendHeld($, on, 'rename the config loader')
    await settle(ui)
    expect(await drawn(ui)).toContain('Hand off')
    await ui.press({ key: 'accept' })
    await sending
    expect(through).toEqual([`rename the config loader${subagentNote('sonnet')}`])
    await step($)
    expect(sent.at(-1)).toBe('claude-opus-5-5')
    await ui.unmount()
  })

  test('offer first: back to a model whose cache is still warm is a plain switch, even in a big chat', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const sent = bigChat(on, 200_000)
    const clock = mock.clock(on)
    // A draft in the box: a model click switches this session itself (no /model to type).
    on('prompt.read', () => ({ value: { text: 'draft', cursor: 5 } }) as never)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    // Opus answers with 200k cached, then the session moves to Sonnet.
    await step($)
    await clock.advance(2_000)
    await settle(ui)
    await ui.press({ key: 'm-sonnet' })
    await step($)
    expect(sent.at(-1)).toBe('claude-sonnet-5-5')
    await clock.advance(10 * 60_000)
    // Opus is dearer and the chat big, but Opus still holds it warm: only the tail is written, so a plain switch.
    const { sending } = await sendHeld($, on, 'now the hard part')
    await settle(ui)
    expect(await drawn(ui)).toContain('Switch to Opus')
    await ui.press({ key: 'accept' })
    await sending
    await step($)
    expect(sent.at(-1)).toBe('claude-opus-5-5')
    await ui.unmount()
  })

  const toastsOf = (on: On) => {
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    return toasts
  }

  test(
    'model on Manual, hold off: a typed prompt goes on at once and the other model is suggested in a toast',
    NO_HOLD,
    async ($, on) => {
      engine(on)
      judgeSays(on, '{"model":"haiku","effort":"low","why":"simple question"}')
      const toasts = toastsOf(on)
      const sent = recordSteps(on)
      mock.clock(on)
      const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

      const { through, sending } = await sendHeld($, on)
      await sending
      await settle(ui)

      expect(through).toEqual(['vad heter mappen?'])
      expect(toasts.join(' ')).toContain('Suggestion: switch to Haiku?')
      expect((await ui.find({ key: 'accept' }))?.props.hotkey).toBeUndefined()
      expect(await ui.find({ key: 'never' })).toBeUndefined()
      await step($)
      expect(sent[0]?.model).toBe('claude-opus-5-5')
      await ui.unmount()
    },
  )

  test('model on Manual, hold off: a hand-off is not suggested once the prompt has gone', NO_HOLD, async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"sonnet","effort":"medium","why":"routine"}')
    const toasts = toastsOf(on)
    bigChat(on, 200_000)
    const clock = mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await step($)
    await clock.advance(2_000)
    await settle(ui)

    const { through, sending } = await sendHeld($, on, 'rename the config loader')
    await sending
    await settle(ui)

    expect(through).toEqual(['rename the config loader'])
    expect(await ui.find({ key: 'accept' })).toBeUndefined()
    expect(toasts.join(' ')).not.toContain('Sonnet')
    await ui.unmount()
  })

  test('model on Auto: the judge switches the model without asking, and a toast says so', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple question"}')
    const toasts = toastsOf(on)
    const sent = recordSteps(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await ui.press({ key: 'auto-model' })

    const { through, sending } = await sendHeld($, on)
    await sending
    await step($)

    expect(through).toEqual(['vad heter mappen?'])
    expect(toasts.join(' ')).toContain('Switched to Haiku for this session: simple question')
    expect(sent[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'low' })
    await ui.unmount()
  })

  test('model on Auto: in a big warm chat the prompt goes to a subagent without asking, and a toast says so', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"sonnet","effort":"medium","why":"routine"}')
    const toasts = toastsOf(on)
    const sent = bigChat(on, 200_000)
    const clock = mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await ui.press({ key: 'auto-model' })
    await step($)
    await clock.advance(2_000)
    await settle(ui)

    const { through, sending } = await sendHeld($, on, 'rename the config loader')
    await sending
    await step($)

    expect(through).toEqual([`rename the config loader${subagentNote('sonnet')}`])
    expect(toasts.join(' ')).toContain('Handed to a subagent on Sonnet: routine')
    expect(sent.at(-1)).toBe('claude-opus-5-5')
    await ui.unmount()
  })

  test('model on Auto: a one-step task in a big warm chat stays on the chat model, with no subagent', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","steps":"one","why":"one command"}')
    const toasts = toastsOf(on)
    const sent = bigChat(on, 257_000)
    const clock = mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await ui.press({ key: 'auto-model' })
    await step($)
    await clock.advance(2_000)
    await settle(ui)

    const { through, sending } = await sendHeld($, on, 'delete those branches')
    await sending
    await step($)

    expect(through).toEqual(['delete those branches'])
    expect(toasts.join(' ')).not.toContain('Handed to a subagent')
    expect(sent.at(-1)).toBe('claude-opus-5-5')
    await ui.unmount()
  })

  test("Don't ask again sends the prompt as it is and turns the hold off: the next offer is a toast", async ($, on) => {
    engine(on)
    const says = [
      '{"model":"haiku","effort":"low","why":"simple"}',
      '{"model":"sonnet","effort":"medium","why":"normal work"}',
    ]
    on('model.complete', () => ({ value: { isAnswered: true as const, text: says.shift() ?? '', usage: USAGE } }))
    const toasts = toastsOf(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    const first = await sendHeld($, on)
    await settle(ui)
    expect((await ui.find({ key: 'never' }))?.props).toMatchObject({ hotkey: '3' })
    await ui.press({ key: 'never' })
    await first.sending
    expect(first.through).toEqual(['vad heter mappen?'])
    expect(toasts.join(' ')).toContain('not held for model offers')

    const second = await sendHeld($, on, 'write the parser')
    await second.sending
    expect(second.through).toEqual(['vad heter mappen?', 'write the parser'])
    expect(toasts.join(' ')).toContain('Suggestion: switch to Sonnet?')
    await ui.unmount()
  })

  test('offer first: Fable is never offered, so the prompt is not held', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    judgeSays(on, '{"model":"fable","effort":"max","why":"research"}')
    mock.clock(on)
    const { through, sending } = await sendHeld($, on, 'prove the conjecture')
    await sending
    expect(through).toEqual(['prove the conjecture'])
  })
})

describe('typed commands', () => {
  const box = (on: On, draft: string) => {
    const filled: string[] = []
    on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }) as never)
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })
    return filled
  }

  test('a model click switches this session only and leaves the app default as it is', async ($, on) => {
    engine(on)
    const filled = box(on, '')
    const ran = recordCommands(on)
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    await ui.press({ key: 'm-haiku' })

    expect(filled).toEqual([])
    expect(ran).toEqual([])
    await step($)
    expect(sent[0]?.model).toBe('claude-haiku-5-5')

    // The app's own model is still Opus, so the picker marks it.
    await ui.redraw()
    expect((await ui.find({ key: 'm-opus' }))?.text).toContain('( Opus )')
    expect((await ui.find({ key: 'm-haiku' }))?.text).not.toContain('(')
    await ui.unmount()
  })

  test("a click on the app's own model ends the switch: the requests go out as the app sends them", async ($, on) => {
    engine(on)
    box(on, '')
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    await ui.press({ key: 'm-haiku' })
    await step($)
    await ui.press({ key: 'm-opus' })
    await step($)

    expect(sent.map(s => s.model)).toEqual(['claude-haiku-5-5', 'claude-opus-5-5'])
    await ui.unmount()
  })

  test('/model naming the model the app already runs ends a taken switch, though the app sees no switch', async ($, on) => {
    engine(on)
    box(on, '')
    recordCommands(on)
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    await ui.press({ key: 'm-haiku' })
    await $.command.run({ command: 'model', args: 'opus' } as never)
    await step($)

    expect(sent[0]?.model).toBe('claude-opus-5-5')
    await ui.unmount()
  })

  test("an effort click sets this session's effort and leaves the app's own level as it is", async ($, on) => {
    engine(on)
    const filled = box(on, '')
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    await ui.press({ key: 'e-high' })
    await step($, 'medium')
    await ui.redraw()

    expect(filled).toEqual([])
    expect(sent[0]?.effort).toBe('high')
    // Your pick goes out for this session only, so the app's /effort still says medium: the picker marks it.
    expect((await ui.find({ key: 'e-medium' }))?.text).toContain('( medium )')
    expect((await ui.find({ key: 'e-high' }))?.text).not.toContain('(')
    expect(await drawn(ui)).not.toContain('App: ')
    await ui.unmount()
  })

  test('on Fable 5.1, where Auto waits, an effort you click still goes out', async ($, on) => {
    engine(on, {}, 'claude-fable-5-1')
    box(on, '')
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    await ui.press({ key: 'e-high' })
    await step($, 'medium', 'claude-fable-5-1')

    expect(sent[0]).toEqual({ model: 'claude-fable-5-1', effort: 'high' })
    await ui.unmount()
  })
})

describe('footer text', () => {
  const PURPLE = '#a79cf7'
  const auto = async ($: Engine) =>
    String((await $.command.run({ command: 'context-lens', args: 'auto' } as never)).text)
  const saving = (on: On, outputTokens: number) =>
    on('turn.step', async function* (_$, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: { ...USAGE, output_tokens: outputTokens, model: 'claude-opus-5-5' },
      } as never
    })
  const asked = async ($: Engine) =>
    String((await $.command.run({ command: 'context-lens', args: 'stats' } as never)).text)

  test('the footer is purple text and one small button; no box, nothing lit', async ($, on) => {
    engine(on)
    const footer = await $.ui.mount(FOOTER)
    const text = await drawn(footer)
    expect(text).toContain(`"color":"${PURPLE}"`)
    expect(text).toContain('"children":[" Auto "]')
    // The only button is the small switch for Auto: no label other than the power glyph, not the lit look.
    // The Auto switch, the setup (or settings gear) and the handoff symbol.
    expect(text.match(/"type":"Button"/g)?.length).toBe(3)
    expect(text).toContain('"label":" ⏻ "')
    // No frame of its own (it drew wide and cut off): plain, with the same grey box as the level on hover.
    expect(text).toContain('"plain":true')
    expect(text).toContain('"hover":{"scope":"power","backgroundColor":"#2b2b2f"}')
    expect(text).not.toContain('"variant":"primary"')
    expect(text).not.toContain('borderStyle')
    // Hovering the level puts a grey box behind it.
    expect(text).toContain('"hover":{"scope":"effort","backgroundColor":"#2b2b2f"}')
    // No background at rest: the only ones are in the hover styles and the hidden hover cards (display none).
    expect(
      text.replaceAll('"backgroundColor":"#2b2b2f"}', '').replaceAll('"backgroundColor":"#221c3a"', ''),
    ).not.toContain('backgroundColor')
    await footer.unmount()
  })

  test('with Auto on it is the effort in use, in purple', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const footer = await $.ui.mount(FOOTER)
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    const text = await drawn(footer)
    expect(text).toContain('"children":[" High "]')
    expect(text).toContain(`"color":"${PURPLE}"`)
    await footer.unmount()
  })

  test('the small button switches Auto off ("Off", dim, not purple) and on again', async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const footer = await $.ui.mount(FOOTER)
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(footer)).toContain('"children":[" High "]')

    await footer.press({ key: 'auto' })
    const off = await drawn(footer)
    expect(off).toContain('"children":[" Off "]')
    expect(off).not.toContain(`"color":"${PURPLE}"`)
    await $.prompt.submit({ text: 'en till', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(1)

    await footer.press({ key: 'auto' })
    expect(await drawn(footer)).toContain(`"color":"${PURPLE}"`)

    // The command does the same.
    expect(await auto($)).toContain('Auto off')
    expect(await drawn(footer)).toContain('"children":[" Off "]')
    await footer.unmount()
  })

  test("the app's own Effort control turns Auto off and the footer says Off", async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    recordSteps(on)
    const footer = await $.ui.mount(FOOTER)
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(await drawn(footer)).toContain(`"color":"${PURPLE}"`)

    // The person picks another effort in the app between two requests.
    await step($, 'low')
    expect(await drawn(footer)).toContain('"children":[" Off "]')
    await footer.unmount()
  })

  test("on Haiku 5.5 the judge's effort is named and goes out", async ($, on) => {
    engine(on, {}, 'claude-haiku-5-5')
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple"}')
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const sent = recordSteps(on)
    const footer = await $.ui.mount(FOOTER)

    await $.classic.PostModelSwitch({
      from_model: 'claude-opus-5-5',
      to_model: 'claude-haiku-5-5',
      requested_model: 'haiku',
      source: 'picker',
      context_tokens: 0,
    } as never)
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium', 'claude-haiku-5-5')

    expect(await drawn(footer)).toContain('Low')
    expect(sent[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'low' })
    await footer.unmount()
  })

  test('Haiku 4.5 takes no effort: its requests go out as the app sends them', async ($, on) => {
    engine(on, {}, 'claude-haiku-4-5-20251001')
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple"}')
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    for await (const _ of $.turn.step({
      turnId: 't1',
      index: 0,
      model: 'claude-haiku-4-5-20251001',
      messageCount: 1,
    })) {
      // drain
    }

    expect(sent[0]).toEqual({ model: 'claude-haiku-4-5-20251001', effort: undefined })
  })

  test('the judge is told that scope counts: a short message can be a big job', async ($, on) => {
    engine(on)
    let system = ''
    on('model.complete', (_$, e) => {
      system = String(e.system)
      return {
        value: {
          isAnswered: true as const,
          text: '{"model":"opus","effort":"high","why":"stor uppgift"}',
          usage: USAGE,
        },
      } as never
    })
    await $.prompt.submit({
      text: 'go through my whole google drive and clean it up',
      wait: false,
      origin: { kind: 'composer' },
    })
    expect(system).toContain('SCOPE')
    expect(system).toContain('whole drive')
    expect(system).toContain('never low')
  })

  test('a thinking state while the judge decides', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    // The judge takes half a second to answer.
    on('model.complete', async () => {
      await mocked.sleep(500)
      return {
        value: { isAnswered: true as const, text: '{"model":"opus","effort":"high","why":"x"}', usage: USAGE },
      } as never
    })
    const footer = await $.ui.mount(FOOTER)
    expect(await drawn(footer)).not.toContain('Deciding')

    const submitted = $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await mocked.advance(100)
    expect(await drawn(footer)).toContain('"children":[" Deciding… "]')

    await mocked.advance(600)
    await submitted
    expect(await drawn(footer)).not.toContain('Deciding')
    expect(await drawn(footer)).toContain('"children":[" High "]')
    await footer.unmount()
  })

  test('a switch is shown as Low → High for a moment, then only the level', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let verdict = '{"model":"opus","effort":"low","why":"simple"}'
    on('model.complete', () => ({ value: { isAnswered: true as const, text: verdict, usage: USAGE } }) as never)
    const footer = await $.ui.mount(FOOTER)

    // The first verdict has nothing to switch from.
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(footer)).not.toContain('→')

    verdict = '{"model":"opus","effort":"high","why":"hard"}'
    await $.prompt.submit({ text: 'hard task across several files', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(footer)).toContain('"children":[" Low → High "]')

    await mocked.advance(2600)
    const settled = await drawn(footer)
    expect(settled).not.toContain('→')
    expect(settled).toContain('"children":[" High "]')
    await footer.unmount()
  })

  test('/context-lens stats reports the measured cost of every token kind, per effort, and the judge', async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"model":"opus","effort":"low","why":"simple"}')
    on('turn.step', async function* (_$, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 600,
          cache_read_input_tokens: 10000,
          cache_creation_input_tokens: 800,
          model: 'claude-opus-5-5',
        },
      } as never
    })
    expect(await asked($)).toContain('nothing measured yet')

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await step($, 'high')

    // 100 in + 800 written x1.25 + 10000 read x0.1 + 600 out x5 = 100 + 1000 + 1000 + 3000 = 5100.
    const text = await asked($)
    expect(text).toContain('1 prompts, 1 requests, cost about 5.1k')
    expect(text).toContain('cache reads 20 %, cache writes 20 %, output 59 %')
    expect(text).toContain('Low 1, average 5.1k')
    expect(text).toContain('Judge: Haiku 1')
    expect(text).not.toContain('saved about')
  })

  test('requests you steered yourself are not counted', async ($, on) => {
    engine(on)
    saving(on, 600)
    const rows = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await rows.press({ key: 'e-low' })
    await step($, 'high')
    expect(await asked($)).toContain('nothing measured yet')
    await rows.unmount()
  })

  test('nothing is drawn above the prompt on desktop', async ($, on) => {
    engine(on)
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
  })

  test('a model suggestion still asks above the prompt on desktop', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple"}')
    mock.clock(on)
    const rows = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    void $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    for (let i = 0; i < 5; i++) await rows.redraw()
    const ask = await $.ui.mount(DESK_BAND)
    expect(await ask.find({ key: 'accept' })).toBeDefined()
    expect((await ask.find({ key: 'accept' }))?.props.hotkey).toBeUndefined()
    await rows.press({ key: 'decline' })
    await ask.unmount()
    await rows.unmount()
  })
})

describe('subagents', () => {
  test('cacheSafe: effort may change on Opus, Sonnet and Haiku 5.5 only', () => {
    expect(cacheSafe('claude-opus-5-5')).toBe(true)
    expect(cacheSafe('claude-sonnet-5-5[1m]')).toBe(true)
    expect(cacheSafe('claude-haiku-5-5')).toBe(true)
    expect(cacheSafe('claude-haiku-4-5-20251001')).toBe(false)
    expect(cacheSafe('claude-fable-5-1')).toBe(false)
    expect(cacheSafe('claude-opus-4-8')).toBe(false)
    expect(cacheSafe('claude-opus-5')).toBe(false)
  })
})

describe('follow-ups', () => {
  test('isFollowUp: short go-aheads yes, real requests no', () => {
    for (const t of ['go', 'ok', ' yes ', 'ok go', 'continue']) expect(isFollowUp(t)).toBe(true)
    for (const t of ['', 'rename x to count in utils', 'go through my whole drive']) expect(isFollowUp(t)).toBe(false)
  })

  test('"go" after a judged prompt keeps its effort and asks no judge', async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"model":"opus","effort":"high","why":"hard"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'granska hela relayn', wait: false, origin: { kind: 'composer' } })
    await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(asked.length).toBe(1)
    expect(sent[0]?.effort).toBe('high')
  })
})

describe('named level', () => {
  test('namedEffort: a level said with the word effort, or xhigh, counts; other senses and negations do not', () => {
    expect(namedEffort('do this with max effort please')).toBe('max')
    expect(namedEffort('Effort: high, then refactor the relay')).toBe('high')
    expect(namedEffort('run it at effort low')).toBe('low')
    expect(namedEffort('use extra high effort for this one')).toBe('xhigh')
    expect(namedEffort('xhigh, review the whole repo')).toBe('xhigh')
    expect(namedEffort('maximum effort on this bug')).toBe('max')
    expect(namedEffort('make a medium sized image')).toBeUndefined()
    expect(namedEffort('this needs a lot of effort, the bug is high up in the stack')).toBeUndefined()
    expect(namedEffort("don't use max effort for this")).toBeUndefined()
    expect(namedEffort('no need for high effort here')).toBeUndefined()
    expect(namedEffort('a high effort job: migrate everything')).toBe('high')
  })

  test(
    'a prompt that names a level runs at it without asking the judge, past Max',
    { options: { effortCeiling: 'high' } } as never,
    async ($, on) => {
      engine(on)
      const asked = judgeSays(on, '{"model":"opus","effort":"low","why":"small"}')
      const sent = recordSteps(on)
      await $.prompt.submit({
        text: 'max effort: find why the relay drops messages',
        wait: false,
        origin: { kind: 'composer' },
      })
      await step($, 'medium')
      expect(asked.length).toBe(0)
      expect(sent[0]?.effort).toBe('max')
      // The next prompt without a level goes back to the judge, within Max.
      await $.prompt.submit({ text: 'now rename the subagent in utils', wait: false, origin: { kind: 'composer' } })
      await step($, 'medium')
      expect(asked.length).toBe(1)
      expect(sent[1]?.effort).toBe('low')
    },
  )
})

describe('state from an older version', () => {
  test('the pre-0.2.0 tally { requests, actual, baseline } reads as an empty tally, never throws', () => {
    const old = { requests: 3, actual: 900, baseline: 1500 } as never
    expect(asSpent(old).judge).toEqual({ haiku: 0, ms: 0, tokens: 0 })
    expect(asSpent(old).byEffort).toEqual({})
    expect(() => savedText(old)).not.toThrow()
    expect(asSpent(undefined).prompts).toBe(0)
  })

  test("a tally saved before the rename keeps the subagents' counts it held under helpers", () => {
    const old = { helpers: { runs: { low: 2 }, requests: 3, cost: 5 } } as never
    expect(asSpent(old).subagents).toEqual({ runs: { low: 2 }, requests: 3, cost: 5 })
  })

  test('renamedSettings: an old name is carried to the new one unless the new one is saved already', () => {
    expect(renamedSettings({ helpers: 'on', helperModel: 'on', theme: 'rose' })).toEqual({
      subagents: 'on',
      subagentModel: 'on',
    })
    expect(renamedSettings({ helpers: 'on', subagents: 'off' })).toEqual({})
    expect(renamedSettings({})).toEqual({})
  })

  test('settings saved under their old names are used at once and saved under the new ones', async ($, on) => {
    engine(on, {}, 'claude-opus-5-5', [], { savedSettings: { helperModel: 'on', theme: 'rose' }, setupDone: true })
    const mocked = mock.clock(on)
    on(
      'settings.read',
      () => ({ value: { pluginConfigs: { 'context-lens@context-lens': { options: { helpers: 'on' } } } } }) as never,
    )
    const set: { key: string; value: unknown }[] = []
    on('config.set', (_$, e) => {
      set.push({ key: e.key, value: e.value })
      return { value: e.value } as never
    })
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)

    // Used at once: the Subagents card says both are on.
    await $.command.run({ command: 'context-lens', args: 'settings' } as never)
    const panel = await $.ui.mount({ plugin: 'context-lens', surface: 'desktop', ...BAND } as never)
    expect(await drawn(panel)).toContain('Effort and cheaper model')
    await panel.unmount()

    // Then saved under the new names, by the save queue.
    await mocked.advance(1_000)
    expect(set).toContainEqual({ key: 'context-lens.subagents', value: 'on' })
    expect(set).toContainEqual({ key: 'context-lens.subagentModel', value: 'on' })
  })
})

describe('cache countdown', () => {
  const answer = (on: On, cacheCreation?: Record<string, number>) =>
    on('turn.step', async function* (_$, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: { ...USAGE, ...(cacheCreation ? { cache_creation: cacheCreation } : {}) },
      } as never
    })
  // The countdown's timer starts with the session, as in the app.
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }
  const shows = (text: string) => `"children":["${text}"]`

  test('cacheTtlOf and cacheLabel', () => {
    expect(cacheTtlOf({ cache_creation: { ephemeral_1h_input_tokens: 900, ephemeral_5m_input_tokens: 0 } })).toBe('1h')
    expect(cacheTtlOf({ cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 10 } })).toBe('5m')
    expect(cacheTtlOf({ input_tokens: 1 })).toBeUndefined()
    expect(cacheLabel(60)).toBe('59m')
    expect(cacheClock(3_521_000)).toBe('58:41')
    expect(cacheClock(59_400)).toBe('1:00')
    expect(cacheClock(5_000)).toBe('0:05')
    expect(cacheClock(0)).toBe('❄ Cold')
    expect(cacheLabel(1)).toBe('<1m')
    expect(cacheLabel(0)).toBe('❄ Cold')
    expect(cacheColor(60)).toBeUndefined()
    expect(cacheColor(22)).toBeUndefined()
    expect(cacheColor(21)).toBe('#e0a33a')
    expect(cacheColor(7)).toBe('#e0a33a')
    expect(cacheColor(6)).toBe('#e5534b')
    expect(cacheColor(1)).toBe('#e5534b')
    expect(cacheColor(0)).toBe('#7cc4ff')
    expect(mostlyCached({ input_tokens: 90000, cache_read_input_tokens: 10 })).toBe(false)
  })

  test('nothing before the first response; then it counts down with no further response, turns amber, goes cold', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_1h_input_tokens: 500, ephemeral_5m_input_tokens: 0 })
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    expect(await drawn(footer)).not.toContain('Cold')

    await step($)
    expect(await drawn(footer)).toContain(shows('59m'))

    // No request in between: the session's own timer moves it.
    await mocked.advance(30 * 60_000)
    expect(await drawn(footer)).toContain(shows('29m'))

    expect(await drawn(footer)).not.toContain('"color":"#e')
    await mocked.advance(10 * 60_000)
    expect(await drawn(footer)).toContain(shows('19m'))
    expect(await drawn(footer)).toContain('"color":"#e0a33a"')
    await mocked.advance(16 * 60_000)
    const late = await drawn(footer)
    expect(late).toContain(shows('3m'))
    expect(late).toContain('"color":"#e5534b"')

    await mocked.advance(5 * 60_000)
    expect(await drawn(footer)).toContain(shows('❄ Cold'))

    await step($)
    expect(await drawn(footer)).toContain(shows('59m'))
    await footer.unmount()
  })

  test('a response that does not say its lifetime is counted as 1 hour', async ($, on) => {
    engine(on)
    mock.clock(on)
    answer(on)
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    await step($)
    expect(await drawn(footer)).toContain(shows('59m'))
    await footer.unmount()
  })

  test('a response that says 5 minutes counts down 5 minutes', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_5m_input_tokens: 500 })
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    await step($)
    expect(await drawn(footer)).toContain(shows('4m'))
    await mocked.advance(6 * 60_000)
    expect(await drawn(footer)).toContain(shows('❄ Cold'))
    await footer.unmount()
  })

  /** The band above the prompt, with the first-run setup guide closed so the cold band can show. */
  const coldBand = async ($: Engine) => {
    const band = await $.ui.mount(DESK_BAND)
    if (await band.find({ key: 'setup-close' })) await band.press({ key: 'setup-close' })
    return band
  }

  test('Compact appears only once the cache is cold, and a click compacts', async ($, on) => {
    engine(on)
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 1_000_000, percent: 20 } } }) as never)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_1h_input_tokens: 500, ephemeral_5m_input_tokens: 0 })
    let compacted = 0
    let note = ''
    on('command.run', (_$, e) => {
      if (e.command === 'compact') note = e.args
      if (e.command === 'compact') compacted++
      return { text: 'ok' }
    })
    await start($, on)
    await step($)
    await mocked.advance(59 * 60_000)
    // Still warm: no band (only the first-run guide, closed here), so nothing to compact yet.
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
    await mocked.advance(2 * 60_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await band.find({ key: 'cold-compact' })).toBeDefined()
    await band.press({ key: 'cold-compact' })
    // The bar asks for an optional note first; Enter in it compacts with the note as /compact's instructions.
    await band.input({ key: 'compact-note', text: 'keep the API decisions' })
    await mocked.advance(100)
    // The test kit's compaction has no transcript to run over, so only the call is checked here.
    expect(compacted).toBe(1)
    expect(note).toBe('keep the API decisions')
    await band.unmount()
  })

  test('/context-lens cold shows Cold and the Compact button at once, for testing', async ($, on) => {
    engine(on)
    mock.clock(on)
    answer(on, { ephemeral_1h_input_tokens: 500 })
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    await step($)
    const reply = await $.command.run({ command: 'context-lens', args: 'cold' } as never)
    expect(String(reply.text)).toContain('cold')
    expect(await drawn(footer)).toContain(shows('❄ Cold'))
    expect(await footer.find({ key: 'compact' })).toBeUndefined()
    const band = await coldBand($)
    expect(await band.find({ key: 'cold-compact' })).toBeDefined()
    await band.unmount()
    await footer.unmount()
  })

  test('a compact that fails says why in a toast, nothing breaks', async ($, on) => {
    engine(on)
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 1_000_000, percent: 20 } } }) as never)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_5m_input_tokens: 500 })
    on('command.run', (_$, e) => {
      if (e.command === 'compact') throw new Error('compact is not available here')
      return { text: 'ok' }
    })
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    const band = await coldBand($)
    await step($)
    await mocked.advance(6 * 60_000)
    await band.press({ key: 'cold-compact' })
    // The bar asks for an optional note first; Compact runs it.
    await band.press({ key: 'compact-go' })
    expect(toasts.join(' ')).toContain('compact failed')
    expect(await drawn(footer)).toContain(shows('❄ Cold'))
    await band.unmount()
    await footer.unmount()
  })
})

describe('cache guard', () => {
  test('on Fable Auto neither judges nor changes the effort, and the footer says Paused', async ($, on) => {
    engine(on, {}, 'claude-fable-5-1')
    const asked = judgeSays(on, '{"model":"opus","effort":"low","why":"x"}')
    const sent: unknown[] = []
    on('turn.step', async function* (_$, e) {
      sent.push(e.effort)
      return { turnId: e.turnId, index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
    })
    const footer = await $.ui.mount(FOOTER)
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-fable-5-1', effort: 'xhigh', messageCount: 1 })
    for await (const _ of stream) {
      // drain
    }
    expect(asked.length).toBe(0)
    expect(sent).toEqual(['xhigh'])
    expect(await drawn(footer)).toContain('"children":[" Paused "]')
    await footer.unmount()
  })

  test('a pick made on Opus 5.5 is not applied to a Fable request', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"low","why":"x"}')
    const sent: unknown[] = []
    on('turn.step', async function* (_$, e) {
      sent.push(e.effort)
      return { turnId: e.turnId, index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
    })
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    for (const model of ['claude-opus-5-5', 'claude-fable-5-1']) {
      const stream = $.turn.step({ turnId: 't1', index: 0, model, effort: 'xhigh', messageCount: 1 })
      for await (const _ of stream) {
        // drain
      }
    }
    expect(sent).toEqual(['low', 'xhigh'])
  })
})

describe('footer', () => {
  test('auto sets the effort of the request, never runs /effort or /model', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"low","why":"simple"}')
    const ran = recordCommands(on)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'rename the function', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')

    expect(sent[0]?.effort).toBe('low')
    expect(ran).toEqual([])
  })

  test('a different model is offered with the prompt held, and Switch switches it', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple"}')
    const ran = recordCommands(on)
    const sent = recordSteps(on)
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    const sending = $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    for (let i = 0; i < 5; i++) await ui.redraw()
    expect(ran.some(c => c.startsWith('/model'))).toBe(false)
    expect((await ui.find({ key: 'accept' }))?.props).toMatchObject({ hotkey: '1', plain: true })
    expect((await ui.find({ key: 'decline' }))?.props).toMatchObject({ hotkey: '2', plain: true })

    await ui.press({ key: 'accept' })
    await sending
    expect(ran).toEqual([])
    await step($)
    expect(sent[0]?.model).toBe('claude-haiku-5-5')
    await ui.unmount()
  })

  test('an offer that holds no prompt takes no digit: a 1 typed in the composer stays the next message', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple"}')
    mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    // A report nobody typed is offered the model too, but it does not wait for the answer.
    await $.prompt.submit({ text: 'The background task finished.', wait: false, origin: { kind: 'task-notification' } })
    for (let i = 0; i < 5; i++) await ui.redraw()

    expect(await ui.find({ key: 'accept' })).toBeDefined()
    expect((await ui.find({ key: 'accept' }))?.props.hotkey).toBeUndefined()
    expect((await ui.find({ key: 'accept' }))?.props.plain).toBeUndefined()
    expect((await ui.find({ key: 'decline' }))?.props.hotkey).toBeUndefined()
    await ui.unmount()
  })

  test('Keep turns the suggestion down and it does not come back', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"haiku","effort":"low","why":"simple"}')
    recordCommands(on)
    const mocked = mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    const first = $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    for (let i = 0; i < 5; i++) await ui.redraw()
    await ui.press({ key: 'decline' })
    await first
    // The same model is not offered again: this prompt is not held.
    await $.prompt.submit({ text: 'hej igen', wait: false, origin: { kind: 'composer' } })
    await mocked.advance(10)
    await ui.redraw()

    expect(await ui.find({ key: 'accept' })).toBeUndefined()
    await ui.unmount()
  })
})

describe('band', () => {
  for (const surface of ['terminal'] as const) {
    test(`clicking an effort turns auto off and is what the turn runs with (${surface})`, async ($, on) => {
      engine(on)
      const asked = judgeSays(on, '{"model":"opus","effort":"low","why":"x"}')
      const sent = recordSteps(on)
      const ran = recordCommands(on)

      const ui = await $.ui.mount({ plugin: 'context-lens', surface, ...BAND })
      expect((await ui.find({ key: 'auto' }))?.text).toContain('Auto')

      await ui.press({ key: 'e-xhigh' })
      expect((await ui.find({ key: 'auto' }))?.text).toContain('Manual')
      expect(ran).toEqual([])

      await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
      await step($, 'xhigh')

      expect(asked.length).toBe(0)
      expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'xhigh' })

      await ui.press({ key: 'auto' })
      expect((await ui.find({ key: 'auto' }))?.text).toContain('Auto')
      await ui.unmount()
    })
  }
})

describe('review fixes', () => {
  test('a model switch that changes the engine effort is not read as you choosing, Auto stays on', async ($, on) => {
    engine(on)
    judgeSays(on, '{"model":"opus","effort":"low","why":"simple"}')
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[0]?.effort).toBe('low')

    // The person picks another model; the engine's own effort for it is different.
    await $.classic.PostModelSwitch({
      from_model: 'claude-opus-5-5',
      to_model: 'claude-sonnet-5-5',
      requested_model: 'sonnet',
      source: 'picker',
      context_tokens: 0,
    } as never)
    await step($, 'medium')

    // Auto still decides: the request keeps the judged effort instead of the engine's 'medium'.
    expect(sent[1]?.effort).toBe('low')
  })

  test('/context-lens switch switches to the offered model and /context-lens keep turns it down', async ($, on) => {
    engine(on)
    // Haiku is offered first; on Haiku, the next prompt is offered Opus back.
    const says = ['{"model":"haiku","effort":"low","why":"simple"}', '{"model":"opus","effort":"high","why":"hard"}']
    on('model.complete', () => ({
      value: { isAnswered: true as const, text: says.length > 1 ? says.shift()! : (says[0] ?? ''), usage: USAGE },
    }))
    const ran = recordCommands(on)
    const mocked = mock.clock(on)
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })

    const first = $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    for (let i = 0; i < 5; i++) await ui.redraw()
    const result = await $.command.run({ command: 'context-lens', args: 'switch' } as never)
    await first
    expect(String(result.text)).toContain('haiku')
    expect(ran).toEqual([])

    const second = $.prompt.submit({
      text: 'a new question about something else',
      wait: false,
      origin: { kind: 'composer' },
    })
    for (let i = 0; i < 5; i++) await ui.redraw()
    const kept = await $.command.run({ command: 'context-lens', args: 'keep' } as never)
    await second
    expect(String(kept.text)).toContain('Keeping')
    await ui.unmount()
  })
})

describe('judge choice (plugin settings)', () => {
  const chat = (content: string) =>
    JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 300, completion_tokens: 20 } })
})

describe('context for the judge', () => {
  test("the assistant's last reply goes along, long and from its end, where its question sits", () => {
    const question = 'Which section should I build: A (simple), B (a complicated multi-step layout) or C?'
    const reply = 'x'.repeat(5000) + ' ' + question
    const text = contextFrom([
      { role: 'user', text: 'make me a new section' },
      { role: 'assistant', text: reply },
    ])
    expect(text).toContain(question)
    expect(text).toContain('user: make me a new section')
    expect(text.length).toBeLessThan(2500)
    expect(contextFrom([])).toBe('')
  })

  test("Haiku is handed the assistant's question and told how to judge an answer to it", async ($, on) => {
    mock.store(on)
    mock.env(on, {})
    mock.clock(on)
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    on('ui.status', () => ({ value: undefined }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on(
      'session.messages',
      () =>
        ({
          value: [
            { role: 'user', text: 'make me a new section' },
            { role: 'assistant', text: 'Which one: A (simple) or B (a complicated multi-step layout)?' },
          ],
        }) as never,
    )
    const seen: { system?: string; prompt: string }[] = []
    on('model.complete', (_$, e) => {
      seen.push({ system: e.system, prompt: e.prompt })
      return {
        value: { isAnswered: true as const, text: '{"model":"opus","effort":"high","why":"B is big"}', usage: USAGE },
      }
    })
    await $.prompt.submit({ text: 'B', wait: false, origin: { kind: 'composer' } })
    expect(seen[0]?.prompt).toContain('B (a complicated multi-step layout)')
    expect(seen[0]?.system).toContain('judge only the work that answer starts')
    expect(seen[0]?.system).toContain('should I archive this?')
  })
})

describe('model-aware effort', () => {
  test('the judge is told which model runs and that effort is relative to it', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    mock.clock(on)
    const seen: { system?: string; prompt: string }[] = []
    on('model.complete', (_$, e) => {
      seen.push({ system: e.system, prompt: e.prompt })
      return {
        value: { isAnswered: true as const, text: '{"model":"sonnet","effort":"high","why":"x"}', usage: USAGE },
      }
    })
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    expect(seen[0]?.prompt).toContain('Current: sonnet')
    expect(seen[0]?.system).toContain('Opus at medium does about what Sonnet does at high')
  })
})

describe('keys', () => {})

describe('setup guide', () => {
  const DESK = { plugin: 'context-lens', surface: 'desktop', ...BAND } as MountTarget<'desktop', 'AbovePrompt'>
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }
  const settings = (on: On) => {
    const set: { key: string; value: unknown }[] = []
    on('config.set', (_$, e) => {
      set.push({ key: e.key, value: e.value })
      return { value: e.value } as never
    })
    return set
  }
  const toasts = (on: On) => {
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    return said
  }

  test('an app with no /config row for the plugin: the choices are kept in the store and come back next session', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on(
      'config.set',
      () => ({ deny: 'no /config row with key context-lens.effortBias ($.config.list names them)' }) as never,
    )
    const said = toasts(on)
    await start($, on)
    const band = await $.ui.mount(DESK)
    await band.press({ key: 'setup-next' })
    await band.press({ key: 'setup-next' })
    await band.press({ key: 'setup-next' })
    await band.press({ key: 'setup-done' })
    await band.unmount()
    await mocked.advance(16_000)
    expect(said.join(' ')).not.toContain('could not save')
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.command.run({ command: 'context-lens', args: 'settings' } as never)
    const panel = await $.ui.mount(DESK)
    // The judge is Haiku alone: no card to pick or test it in.
    expect(await panel.find({ key: 'settings-card-judge' })).toBeUndefined()
    expect(await drawn(panel)).not.toMatch(/Jev|TypeSafe/)
    await panel.unmount()
  })

  test('the steps run lean, handoff, look, done; Back goes one step back', () => {
    expect(setupNext('lean')).toBe('handoff')
    expect(setupNext('handoff')).toBe('look')
    expect(setupNext('look')).toBe('done')
    expect(setupNext('done')).toBeNull()
    expect(setupBack('lean')).toBeNull()
    expect(setupBack('handoff')).toBe('lean')
    expect(setupBack('look')).toBe('handoff')
    expect(setupBack('done')).toBe('look')
    expect(setupCounter('lean')).toBe('1/3')
    expect(setupCounter('handoff')).toBe('2/3')
    expect(setupCounter('look')).toBe('3/3')
    expect(setupCounter('done')).toBe('')
  })

  test('opens by itself the first time; the choices are saved together at Done, which closes it for good', async ($, on) => {
    engine(on)
    mock.clock(on)
    const set = settings(on)
    const said = toasts(on)
    await start($, on)
    const band = await $.ui.mount(DESK)
    expect(await band.find({ key: 'setup-bias2' })).toBeDefined()
    expect(await band.find({ key: 'setup-back' })).toBeUndefined()
    await clickable(band, 'setup-actions')
    // Branded: the name in the footer's purple, the step counter beside it.
    expect(await drawn(band)).toContain('"color":"#a79cf7"')
    expect(await drawn(band)).toContain('✦ context-lens setup  1/3')
    // The right side: a still SVG (every click redraws the band, and a redrawn animation flickers) with the gradient.
    const first = await drawn(band)
    expect(first).toContain('"type":"Svg"')
    expect(first).not.toContain('"isInteractive":true')
    expect(first).toContain('linearGradient')
    // Nothing is saved yet: each saved setting reloads the plugin and puts a notice in the chat.
    expect(set).toEqual([])
    expect(said.join(' ')).not.toContain('judges')

    // 1/3 the lean: each stop is named and says what it does; the track lights toward the marker.
    expect(await drawn(band)).toContain('Balanced: ')
    await band.press({ key: 'setup-bias4' })
    expect(await drawn(band)).toContain('Smartest: ')
    expect(await drawn(band)).toContain('{"color":"#a79cf7"},"children":["──"]')
    await band.press({ key: 'setup-next' })

    // 2/3 the handoff: the installed skills to pick from.
    expect(await drawn(band)).toContain('2/3')
    expect(await drawn(band)).toContain('/session-handoff')
    await band.select({ key: 'setup-skill', value: 'session-handoff' })
    await band.press({ key: 'setup-next' })

    // 3/3 the look: match Claude Code, dark or light. Light is picked here.
    expect(await drawn(band)).toContain('3/3')
    expect(await drawn(band)).toContain('Dark or light panels?')
    expect(await drawn(band)).toContain('◉ Match Claude Code')
    await band.press({ key: 'setup-look-light' })
    expect(await drawn(band)).toContain('◉ Light')
    await band.press({ key: 'setup-next' })

    // The last word: the footer's buttons and Fable; no step of ticks. Back goes to the look step.
    expect(await drawn(band)).toContain('Auto pauses on Fable')
    expect(await band.find({ key: 'setup-box-timer' })).toBeUndefined()
    await band.press({ key: 'setup-back' })
    expect(await drawn(band)).toContain('3/3')
    await band.press({ key: 'setup-next' })
    expect(set).toEqual([])
    await band.press({ key: 'setup-done' })
    expect(set).toEqual([
      { key: 'context-lens.effortBias', value: '2' },
      { key: 'context-lens.handoffSkill', value: 'session-handoff' },
      { key: 'context-lens.appearance', value: 'light' },
    ])
    await band.unmount()
    await expect($.ui.mount(DESK)).rejects.toThrow()

    // A new session: the guide stays closed; /context-lens setup opens it again.
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await expect($.ui.mount(DESK)).rejects.toThrow()
    await $.command.run({ command: 'context-lens', args: 'setup' } as never)
    const again = await $.ui.mount(DESK)
    expect(await again.find({ key: 'setup-bias2' })).toBeDefined()
    await again.unmount()
  })
})

describe('judge failures are said', () => {
  test('judgeFailure names the cause', () => {
    expect(judgeFailure('Haiku', 402)).toContain('out of credits')
    expect(judgeFailure('Haiku', 429)).toContain('rate limited')
    expect(judgeFailure('Haiku', 401)).toContain('was refused')
    expect(judgeFailure('Haiku', 'timeout')).toContain('did not answer')
  })
})

describe('judge benchmark', () => {
  const c = (id: string, ok: ('low' | 'medium' | 'high')[], message = 'do a thing please') =>
    ({ id, kind: 'k', current: { model: 'sonnet', effort: 'medium' }, message, ok }) as never

  test('grades an answer as right, too low, too high or missing', () => {
    expect(benchGrade(c('a', ['medium', 'high']), 'high')).toBe('hit')
    expect(benchGrade(c('a', ['medium', 'high']), 'low')).toBe('under')
    expect(benchGrade(c('a', ['low']), 'xhigh')).toBe('over')
    expect(benchGrade(c('a', ['low']), undefined)).toBe('none')
  })

  test('the report counts per judge and lists the misses', () => {
    const cases = [c('a', ['low']), c('b', ['high'])]
    const report = benchReport(cases, [
      { id: 'a', judge: 'haiku', effort: 'low', ms: 300, tokens: 10 },
      { id: 'b', judge: 'haiku', effort: 'medium', ms: 500, tokens: 10 },
    ])
    expect(report).toContain('| haiku | 50% | 1 | 0 | 0 | 500 |')
    expect(report).toContain('haiku b: said medium, wanted high')
  })

  test('task sizes are graded and reported for the cases labelled with them', () => {
    const sized = (id: string, steps: ('one' | 'few' | 'many')[]) => ({ ...(c(id, ['low']) as object), steps }) as never
    expect(stepsGrade(sized('a', ['one', 'few']), 'few')).toBe('hit')
    expect(stepsGrade(sized('a', ['one']), 'many')).toBe('over')
    expect(stepsGrade(sized('a', ['many']), 'one')).toBe('under')
    expect(stepsGrade(c('a', ['low']), 'one')).toBe('none')

    const report = benchReport(
      [sized('a', ['one']), sized('b', ['many']), c('c', ['low'])],
      [
        { id: 'a', judge: 'haiku', effort: 'low', steps: 'few', ms: 300, tokens: 10 },
        { id: 'b', judge: 'haiku', effort: 'low', steps: 'many', ms: 300, tokens: 10 },
        { id: 'c', judge: 'haiku', effort: 'low', steps: 'one', ms: 300, tokens: 10 },
      ],
    )
    expect(report).toContain('| haiku | 50% | 0 | 1 | 0 |')
    expect(report).toContain('haiku a: said few steps, wanted one')
  })

  test('/context-lens bench runs every case through Haiku, keeps follow-ups, and writes the report', async ($, on) => {
    engine(on)
    mock.clock(on)
    const asked = judgeSays(on, '{"model":"sonnet","effort":"low","why":"x"}')
    const cases = { cases: [c('a', ['low'], 'rename foo to bar in utils.ts'), c('f', ['medium'], 'go')] }
    on(
      'fs.read',
      (_$, e) => ({ value: String(e.path).endsWith('judge-cases.json') ? JSON.stringify(cases) : '' }) as never,
    )
    const written: Record<string, string> = {}
    on('fs.write', (_$, e) => {
      written[String(e.path)] = String(e.text)
      return { value: undefined } as never
    })
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const res = await $.command.run({ command: 'context-lens', args: 'bench' } as never)
    expect(asked.length).toBe(1)
    expect(res.text).toContain('| haiku | 100% |')
    expect(res.text).toContain('| always medium |')
    expect(Object.keys(written).some(p => p.endsWith('.md'))).toBe(true)
  })
})

describe('short answers to a question', () => {
  test('a short reply after a question goes to the judge; between two steps it keeps the effort', () => {
    const asked = 'user: tidy up\nassistant: Done. Should I archive it?'
    const told = 'user: add export\nassistant: Added the button. Next I wire it up.'
    expect(endsOnQuestion(asked)).toBe(true)
    expect(endsOnQuestion(told)).toBe(false)
    expect(endsOnQuestion('')).toBe(false)
    expect(keepsEffort('yes', asked)).toBe(false)
    expect(keepsEffort('go', told)).toBe(true)
    expect(keepsEffort('build the whole thing', told)).toBe(false)
  })

  test('"yes" to "should I archive it?" is judged, not kept', async ($, on) => {
    const said: { role: string; text: string }[] = []
    engine(on, {}, 'claude-sonnet-5-5', said)
    mock.clock(on)
    const asked = judgeSays(on, '{"model":"sonnet","effort":"high","why":"x"}')
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    said.push({ role: 'assistant', text: 'Done. Should I archive the old branch?' })
    await $.prompt.submit({ text: 'yes', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(2)
  })
})

describe('images', () => {
  test('the judge is told what the message carries', () => {
    expect(withAttachments('fix this', [{ type: 'image' }, { type: 'image' }])).toContain(
      '[The message comes with 2 images to look at.]',
    )
    expect(withAttachments('fix this')).toBe('fix this')
  })

  test('"fix this" with a screenshot is judged, not kept as a follow-up', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    mock.clock(on)
    const asked = judgeSays(on, '{"model":"sonnet","effort":"medium","why":"x"}')
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    await $.prompt.submit({
      text: 'fix this',
      wait: false,
      origin: { kind: 'composer' },
      attachments: [{ type: 'image', mediaType: 'image/png' }],
    } as never)
    expect(asked.length).toBe(2)
    expect(asked[1]).toContain('1 image')
  })
})

describe('compaction by Haiku', () => {
  const SUMMARY = '1. Primary request: rename userId across the app. ' + 'Details. '.repeat(40)
  const said = [
    { role: 'user', text: 'rename this variable to userId', toolUses: [] },
    {
      role: 'assistant',
      text: 'Renamed in 4 files.',
      toolUses: [{ tool_use_id: 't1', tool: 'Edit', input: { file_path: 'a.ts' }, text: 'x'.repeat(5000) }],
    },
  ]
  /** Claude Code's own compaction beneath the mod, and whether it ran. */
  const core = (on: On) => {
    const ran = { core: 0 }
    on('session.compact', (_$, e) => {
      ran.core++
      return { messages: [{ role: 'user', text: 'core summary', toolUses: [] }] } as never
    })
    return ran
  }

  test('the last messages reach Haiku nearly whole: the code just written is not cut to 400 characters', () => {
    const code = 'x'.repeat(5000)
    const old = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      text: `turn ${i}`,
      toolUses: [{ tool: 'Edit', input: { new_string: code }, text: code }],
    }))
    const text = compactTranscript(old as never)
    // The first message is cut, the last one is whole.
    expect(text.split('turn 0')[1]?.split('turn 1')[0]).toContain('more characters')
    expect(text.split('turn 9')[1]).not.toContain('more characters')
  })

  test('the transcript names each tool call and cuts long results', () => {
    // Two messages are all tail; with the tail held to the same 2000 the cut shows.
    const text = compactTranscript(said as never, 2000, 2000)
    expect(text).toContain('USER: rename this variable to userId')
    expect(text).toContain('[Edit {"file_path":"a.ts"}]')
    expect(text).toContain('[3000 more characters]')
  })

  test('Haiku 5.5 writes the summary, with the note typed after /compact; Claude Code does not compact', async ($, on) => {
    engine(on, {}, 'claude-opus-5-5', said as never)
    const ran = core(on)
    const asked: { model: string; prompt: string }[] = []
    on('model.complete', (_$, e) => {
      asked.push({ model: e.model, prompt: e.prompt })
      return { value: { isAnswered: true as const, text: SUMMARY, usage: USAGE } }
    })
    const out = (await $.session.compact({ instructions: 'keep the API decisions' } as never)) as {
      messages?: { text: string }[]
    }
    expect(ran.core).toBe(0)
    expect(asked[0]?.model).toBe('claude-haiku-5-5')
    expect(asked[0]?.prompt).toContain('keep the API decisions')
    expect(out.messages?.[0]?.text).toContain('rename userId across the app')
  })

  test('when Haiku fails, Claude Code compacts as usual and a toast says why', async ($, on) => {
    engine(on)
    const ran = core(on)
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
      return { value: undefined } as never
    })
    on('model.complete', () => ({ value: { isAnswered: false as const, reason: 'api-error', status: 500 } }) as never)
    await $.session.compact({} as never)
    expect(ran.core).toBe(1)
    expect(toasts.join(' ')).toContain('Haiku could not compact')
  })

  test(
    "set to the chat's model, Claude Code compacts and Haiku is never asked",
    { options: { compactWith: 'session' } } as never,
    async ($, on) => {
      engine(on)
      const ran = core(on)
      let asked = 0
      on('model.complete', () => {
        asked++
        return { value: { isAnswered: true as const, text: SUMMARY, usage: USAGE } }
      })
      await $.session.compact({} as never)
      expect(ran.core).toBe(1)
      expect(asked).toBe(0)
    },
  )
})

describe('deciding glow', () => {
  const op = (svg: string | null) => Number(/\.r\{opacity:([\d.]+)/.exec(svg ?? '')?.[1] ?? NaN)
  test('rises, holds at full while deciding as a still image, then fades from full in short pieces', () => {
    const at = (end: number | null, now: number) => judgeGlowAt(1000, end, now)
    expect(at(null, 999)).toBeNull()
    expect(op(at(null, 1000))).toBe(0)
    expect(op(at(null, 1000 + JUDGE_RISE_MS / 2))).toBeGreaterThan(0.3)
    // Held: no animation at all, so an old copy drawn again cannot restart anything.
    for (const now of [1000 + JUDGE_RISE_MS, 1900, 9000]) {
      expect(at(null, now)).not.toContain('animation')
      expect(op(at(null, now))).toBe(0.85)
    }
    // A verdict after the rise: the fade starts at once, from full, in pieces of JUDGE_STEP_MS.
    expect(op(at(3000, 3000))).toBe(0.85)
    expect(at(3000, 3000)).toContain('animation:r ' + (JUDGE_PIECE_MS / 1000).toFixed(3) + 's linear forwards')
    expect(at(3000, 3000 + JUDGE_FADE_MS)).toBeNull()
    // A verdict inside the rise: the rise finishes first, so the fade never starts from half-way.
    expect(op(at(1100, 1300))).toBeLessThan(0.85)
    expect(op(at(1100, 1000 + JUDGE_RISE_MS))).toBe(0.85)
    expect(at(1100, 1000 + JUDGE_RISE_MS + JUDGE_FADE_MS)).toBeNull()
  })
  test('each piece runs along the true curve for longer than the app takes to redraw, so the fade never stands still or goes up', () => {
    const pts = (svg: string) => [...svg.matchAll(/(\d+)%\{opacity:([\d.]+)\}/g)].map(m => Number(m[2]))
    for (let t = 0; t < JUDGE_FADE_MS; t += 37) {
      const p = pts(judgeGlowSvg('fade', t))
      expect(p.length).toBe(5)
      // Starts on the curve, only goes down, and ends where the curve is at the end of the piece.
      expect(Math.abs(p[0]! - judgeBrightnessAt('fade', t))).toBeLessThan(0.001)
      for (let k = 1; k < 5; k++) expect(p[k]).toBeLessThanOrEqual(p[k - 1]!)
      expect(Math.abs(p[4]! - judgeBrightnessAt('fade', Math.min(JUDGE_FADE_MS, t + JUDGE_PIECE_MS)))).toBeLessThan(
        0.001,
      )
    }
    expect(JUDGE_PIECE_MS).toBeGreaterThan(120)
    expect(pts(judgeGlowSvg('fade', JUDGE_FADE_MS - 10))[4]).toBe(0)
    expect(Math.abs(judgeBrightnessAt('fade', JUDGE_FADE_MS / 2) - 0.425)).toBeLessThan(0.001)
  })
})

describe('cold band', () => {
  test('shows above the prompt when the cache is cold, compacts in one click, and hides until the next cold', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('session.compact', () => ({ value: { messages: [] } }) as never)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const DESK = { plugin: 'context-lens', surface: 'desktop', ...BAND } as MountTarget<'desktop', 'AbovePrompt'>
    const guide = await $.ui.mount(DESK)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.command.run({ command: 'context-lens', args: 'cold' } as never)
    const band = await $.ui.mount(DESK)
    expect(await drawn(band)).toContain('Chat went cold')
    expect(await drawn(band)).toContain('class=\\"f\\"')
    await band.press({ key: 'cold-hide' })
    await band.unmount()
    await expect($.ui.mount(DESK)).rejects.toThrow()
  })
})

describe('handoff', () => {
  test('the first message carries the handoff and what to do next', () => {
    expect(handoffMessage(' the plan ', 'continue')).toBe(
      'Handoff from the previous chat:\n\nthe plan\n\nContinue with the next step. If it is marked "needs user", say what you need and wait.',
    )
    expect(handoffMessage('x', 'confirm')).toContain('then wait for me')
    // Full: the skill saved the handoff; its last words may only say so. The new chat reads what it saved first.
    const full = handoffMessage("I've saved the handoff.", 'continue', 'session-handoff')
    expect(full).toContain('it ran /session-handoff')
    expect(full).toContain('First read the handoff /session-handoff saved')
    expect(full).toContain('HANDOFF.md')
    expect(full).toContain('Continue with the next step')
  })

  test('the prompt asks for checked work, marked user steps and git as of last check', () => {
    expect(HANDOFF_PROMPT).toContain('needs user')
    expect(HANDOFF_PROMPT).toContain('as of last check')
    expect(HANDOFF_PROMPT).toContain('Never present something planned, skipped or untested as done')
    expect(HANDOFF_PROMPT).toContain('Do not use tools')
  })

  /** Presses ⇥ in the footer, makes the choices in the handoff bar, and presses Go. */
  async function handOff(
    $: Engine,
    footer: { press: (at: { key: string }) => Promise<unknown> },
    keys: string[] = [],
    after?: string,
  ) {
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    for (const key of keys) await bar.press({ key })
    if (after) await bar.select({ key: 'handoff-after', value: after })
    await bar.press({ key: 'handoff-go' })
    await bar.unmount()
  }

  function handoffEngine(on: On, said: { role: string; text: string }[] = []) {
    mock.store(on)
    mock.env(on, {})
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: said }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const forked: string[] = []
    on('model.fork', (_$, e) => {
      forked.push(e.prompt)
      return { value: { isAnswered: true, text: 'Goal: quick.', usage: USAGE } } as never
    })
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    return { forked, ran, submitted }
  }

  test('⇥ opens the handoff bar; it says what happens and starts nothing until Go', async ($, on) => {
    const { forked } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    await clickable(bar, 'handoff-actions')
    expect(await drawn(bar)).toContain('Handoff')
    expect(await drawn(bar)).toContain('A few seconds')
    await bar.select({ key: 'handoff-after', value: 'copy' })
    expect(await drawn(bar)).toContain('"value":"copy"')
    await mocked.advance(2500)
    expect(forked).toEqual([])
    await bar.press({ key: 'handoff-close' })
    await bar.unmount()
    const after = await $.ui.mount(DESK_BAND)
    expect(await after.find({ key: 'handoff-go' })).toBeUndefined()
    await after.unmount()
    await footer.unmount()
  })

  test('on a cold cache, Quick is written by Haiku from the transcript, not a fork that rereads the chat', async ($, on) => {
    const { forked, submitted } = handoffEngine(on, [
      { role: 'user', text: 'build the thing' },
      { role: 'assistant', text: 'built it' },
    ])
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(String(e.model))
      return { value: { isAnswered: true as const, text: `Goal: from Haiku. ${'x'.repeat(120)}`, usage: USAGE } }
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.command.run({ command: 'context-lens', args: 'cold' } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer, ['handoff-quick'])
    await mocked.advance(2500)
    expect(forked).toEqual([])
    expect(asked.some(m => m.includes('haiku'))).toBe(true)
    expect(submitted.some(t => t.includes('Goal: from Haiku'))).toBe(true)
    await footer.unmount()
  })

  test('hotVisible: closed, the band stays away for its window and comes back once at 95%', () => {
    const heat = { kind: 'five_hour', percent: 82, resetsAt: '2026-10-10T20:00:00Z' }
    expect(hotVisible(heat, null)).toBe(true)
    const closed = { window: 'five_hour ' + Math.round(new Date(heat.resetsAt).getTime() / 900_000), percent: 82 }
    expect(hotVisible({ ...heat, percent: 91 }, closed)).toBe(false)
    expect(hotVisible({ ...heat, percent: 96 }, closed)).toBe(true)
    expect(hotVisible({ ...heat, percent: 96 }, { ...closed, percent: 96 })).toBe(false)
    expect(hotVisible({ ...heat, resetsAt: '2026-10-11T01:00:00Z' }, closed)).toBe(true)
  })

  test(
    'with a skill set, Quick forks and Full runs the skill',
    { options: { handoffSkill: 'session-handoff' } } as never,
    async ($, on) => {
      const { forked, ran, submitted } = handoffEngine(on)
      const mocked = mock.clock(on)
      await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
      const footer = await $.ui.mount(FOOTER)
      await handOff($, footer, ['handoff-quick'])
      await mocked.advance(2500)
      expect(forked).toEqual([HANDOFF_PROMPT])
      expect(ran).not.toContain('session-handoff')
      expect(ran).toContain('clear')
      await handOff($, footer, ['handoff-full'])
      await mocked.advance(1000)
      expect(ran).toContain('session-handoff')
      expect(forked).toHaveLength(1)
      // The skill's last words only say it saved the handoff: the new chat is told to read what it saved.
      await $.turn.complete({
        turnId: 't2',
        answer: "I've saved the handoff.",
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
      } as never)
      await mocked.advance(2500)
      expect(submitted.at(-1)).toContain('First read the handoff /session-handoff saved')
      await footer.unmount()
    },
  )

  test(
    'the bar opens on the choice made last',
    { options: { handoffSkill: 'session-handoff' } } as never,
    async ($, on) => {
      handoffEngine(on)
      const mocked = mock.clock(on)
      await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
      const footer = await $.ui.mount(FOOTER)
      await handOff($, footer, ['handoff-full'], 'confirm')
      await mocked.advance(1000)
      await $.turn.complete({
        turnId: 't1',
        answer: 'Goal: full.',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
      } as never)
      await mocked.advance(1500)
      await footer.press({ key: 'handoff' })
      const bar = await $.ui.mount(DESK_BAND)
      expect(await drawn(bar)).toContain('"/session-handoff"')
      expect(await drawn(bar)).toContain('"value":"confirm"')
      await bar.unmount()
      await footer.unmount()
    },
  )

  test("without a skill, Full is context-lens's own: a turn that checks git and saves HANDOFF.md, no fork", async ($, on) => {
    const { forked, submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    await bar.press({ key: 'handoff-full' })
    expect(await drawn(bar)).toContain('Saves HANDOFF.md')
    await bar.press({ key: 'handoff-go' })
    await mocked.advance(2500)
    expect(forked).toEqual([])
    expect(submitted.some(t => t.includes('Rewrite HANDOFF.md'))).toBe(true)
    await bar.unmount()
    await footer.unmount()
  })

  test('Keep chat & copy copies the handoff and clears nothing', async ($, on) => {
    const { ran, submitted } = handoffEngine(on)
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer, [], 'copy')
    await mocked.advance(2500)
    expect(copied).toHaveLength(1)
    expect(copied[0]).toContain('Goal: quick.')
    expect(copied[0]).toContain('Continue with the next step.')
    expect(ran).not.toContain('clear')
    expect(submitted).toEqual([])
    await footer.unmount()
  })

  test('a handoff card shows above the prompt, not under the reply: handing off, then landed, gone after the next message', async ($, on) => {
    handoffEngine(on)
    on('ui.copy', () => ({ value: { isCopied: true } }) as never)
    on('ui.render', { component: 'AssistantMessage' }, (h, e) => {
      const { Text } = h.ui.resolve(e)
      return Text({ children: e.props.text } as never) as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const reply = (text: string) =>
      ({
        plugin: 'context-lens',
        surface: 'desktop',
        component: 'AssistantMessage',
        props: { text, isFirstOfReply: true },
      }) as never
    await $.turn.complete({
      turnId: 't1',
      answer: 'Last reply.',
      durationMs: 1,
      isAborted: false,
      reason: 'answer',
    } as never)
    const footer = await $.ui.mount(FOOTER)
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    await bar.select({ key: 'handoff-after', value: 'copy' })
    await bar.press({ key: 'handoff-go' })
    await bar.unmount()
    // The first-run guide comes before the card: closed here.
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    const under = await $.ui.mount(reply('Last reply.'))
    expect(await under.find({ key: 'reply-handoff' })).toBeUndefined()
    await under.unmount()
    const during = await $.ui.mount(DESK_BAND)
    expect(await drawn(during)).toContain('Handing off')
    await during.unmount()
    await mocked.advance(2500)
    const landed = await $.ui.mount(DESK_BAND)
    expect(await drawn(landed)).toContain('Handoff copied')
    expect(await landed.find({ key: 'card-close' })).toBeDefined()
    await landed.unmount()
    await $.prompt.submit({ text: 'next', wait: false, origin: { kind: 'composer' } })
    await $.turn.complete({
      turnId: 't2',
      answer: 'Next reply.',
      durationMs: 1,
      isAborted: false,
      reason: 'answer',
    } as never)
    // The card is gone: the band draws whatever else it has, or nothing.
    const after = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(after ? await after.find({ key: 'reply-handoff' }) : undefined).toBeUndefined()
    await after?.unmount()
    await footer.unmount()
  })

  test('if the clipboard refuses, the handoff goes in the prompt box', async ($, on) => {
    const { ran } = handoffEngine(on)
    on('ui.copy', () => ({ value: { isCopied: false, reason: 'no clipboard' } }) as never)
    const filled: string[] = []
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })
    on('ui.toast', () => ({ value: undefined }) as never)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer, [], 'copy')
    await mocked.advance(2500)
    expect(filled.join('')).toContain('Goal: quick.')
    expect(ran).not.toContain('clear')
    await footer.unmount()
  })

  test('the handoff is written by a fork: no turn in the chat, then cleared and sent', async ($, on) => {
    mock.store(on)
    mock.env(on, {})
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const forked: string[] = []
    on('model.fork', (_$, e) => {
      forked.push(e.prompt)
      return { value: { isAnswered: true, text: 'Goal: fork it. Next: ship.', usage: USAGE } } as never
    })
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer)
    await mocked.advance(1000)
    expect(forked).toEqual([HANDOFF_PROMPT])
    expect(submitted).not.toContain(HANDOFF_PROMPT)
    await mocked.advance(1500)
    expect(ran).toContain('clear')
    expect(submitted.at(-1)).toContain('Goal: fork it. Next: ship.')
    await footer.unmount()
  })

  test('without a fork (no reply yet, or it failed) the handoff is written as a turn, then cleared and sent', async ($, on) => {
    // engine() without its prompt.submit, so this test can see what the mod sends.
    mock.store(on)
    mock.env(on, {})
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer)
    await mocked.advance(1000)
    expect(submitted.at(-1)).toBe(HANDOFF_PROMPT)
    await $.turn.complete({
      turnId: 't9',
      answer: 'Goal: ship it. Next: tests.',
      durationMs: 1,
      isAborted: false,
      reason: 'answer',
    } as never)
    await mocked.advance(1500)
    expect(ran).toContain('clear')
    expect(submitted.at(-1)).toContain('Goal: ship it. Next: tests.')
    expect(submitted.at(-1)).toContain('Continue with the next step.')
    await footer.unmount()
  })

  test('a fork that writes nothing says why: in a toast and in /context-lens debug, and the turn takes over', async ($, on) => {
    mock.store(on)
    mock.env(on, {})
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on(
      'model.fork',
      () =>
        ({
          value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE },
        }) as never,
    )
    on('command.run', () => ({ text: 'ok' }))
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer)
    await mocked.advance(1000)
    expect(submitted.at(-1)).toBe(HANDOFF_PROMPT)
    expect(toasts.join(' ')).toContain('api-error 529 overloaded')
    const debug = String((await $.command.run({ command: 'context-lens', args: 'debug' } as never)).text)
    expect(debug).toContain('last fork: api-error 529 overloaded')
    await footer.unmount()
  })

  test('the fork outcome names the reason, or what an answer cost', () => {
    expect(forkOutcome({ isAnswered: false, reason: 'nothing-to-fork' }, 0)).toBe('nothing-to-fork (0.0s)')
    expect(forkOutcome({ isAnswered: false, reason: 'aborted', usage: USAGE }, 2500)).toBe('aborted (2.5s)')
    expect(
      forkOutcome({ isAnswered: false, reason: 'api-error', status: null, error: 'unknown', usage: USAGE }, 0),
    ).toBe('api-error no response unknown (0.0s)')
    expect(forkOutcome(new Error('refused from a timer'), 100)).toBe('threw: refused from a timer (0.1s)')
    const usage = { input_tokens: 10, output_tokens: 700, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 }
    expect(forkOutcome({ isAnswered: true, text: 'Goal', usage }, 4000)).toBe('answered, 700 out, 90% cached (4.0s)')
    expect(forkOutcome({ isAnswered: true, text: '  ', usage }, 0)).toBe('answered with blank text (0.0s)')
  })
})

describe('swamp band and setup entry', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('the swamp band waits for the threshold set: 21% of a 1M window is not swamped at the default 70%', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 208_000, window: 1_000_000, percent: 21 } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    // Nothing to draw above the prompt: the engine has no band to mount.
    const band = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(band ? await drawn(band) : '').not.toContain('Chat is getting swamped')
    await band?.unmount()
  })

  test('at a 20% threshold the same chat is swamped', { options: { swampAt: '20' } } as never, async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 208_000, window: 1_000_000, percent: 21 } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Chat is getting swamped')
    await band.unmount()
  })

  test(
    'a reload with no session start still runs the timers: the first draw starts them',
    { options: { swampAt: '20' } } as never,
    async ($, on) => {
      engine(on)
      const mocked = mock.clock(on)
      let tokens = 208_000
      on(
        'session.usage',
        () => ({ value: { context: { tokens, window: 1_000_000, percent: tokens / 10_000 } } }) as never,
      )
      const first = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
      await mocked.advance(100)
      const swamped = await $.ui.mount(DESK_BAND)
      expect(await drawn(swamped)).toContain('Chat is getting swamped')
      await swamped.unmount()
      // Only the ticker reads the usage again: the band drops away once the next tick sees a smaller context.
      tokens = 50_000
      await mocked.advance(15_000)
      await first.unmount()
      await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
    },
  )

  test('a session start after a draw-only load does not double the tickers', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let usageReads = 0
    on('session.usage', () => {
      usageReads++
      return { value: { context: { tokens: 50_000, window: 1_000_000, percent: 5 } } } as never
    })
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const first = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await mocked.advance(100)
    await $.session.start({ cwd: '.', surface: 'terminal', isInteractive: true } as never)
    await mocked.advance(100)
    const before = usageReads
    await mocked.advance(15_000)
    expect(usageReads - before).toBe(1)
    await first.unmount()
  })

  test(
    'the swamp band shows the context percent rounded when the app leaves it out',
    { options: { swampAt: '20' } } as never,
    async ($, on) => {
      engine(on)
      const mocked = mock.clock(on)
      on('session.usage', () => ({ value: { context: { tokens: 208_000, window: 1_000_000 } } }) as never)
      await start($, on)
      const guide = await $.ui.mount(DESK_BAND)
      await guide.press({ key: 'setup-close' })
      await guide.unmount()
      await mocked.advance(16_000)
      const band = await $.ui.mount(DESK_BAND)
      expect(await drawn(band)).toContain('21% of context')
      expect(await drawn(band)).not.toContain('20.8')
      await band.unmount()
    },
  )

  test('a swamped context shows Compact and Handoff above the prompt; closing hides it until the context grows', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let tokens = 180_000
    on(
      'session.usage',
      () => ({ value: { context: { tokens, window: 250_000, percent: Math.round(tokens / 2_500) } } }) as never,
    )
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Chat is getting swamped')
    expect(await drawn(band)).toContain('180k tokens')
    expect(await band.find({ key: 'swamp-compact' })).toBeDefined()
    expect(await band.find({ key: 'swamp-handoff' })).toBeDefined()
    await band.press({ key: 'swamp-close' })
    await band.unmount()
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
    tokens = 240_000
    await mocked.advance(16_000)
    const again = await $.ui.mount(DESK_BAND)
    expect(await drawn(again)).toContain('240k tokens')
    await again.unmount()
  })

  test('the swamp band waits while a turn runs and comes back when it ends', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('turn.complete', () => ({ text: '' }) as never)
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 250_000, percent: 80 } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    await $.prompt.submit({ text: '/status', wait: false, origin: { kind: 'composer' } })
    const busy = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(busy ? await drawn(busy) : '').not.toContain('Chat is getting swamped')
    await busy?.unmount()
    await $.turn.complete({ turnId: 't1', answer: 'Done.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    const after = await $.ui.mount(DESK_BAND)
    expect(await drawn(after)).toContain('Chat is getting swamped')
    await after.unmount()
  })

  test('while compacting, the swamp band steps aside: the card under the reply says it', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let release = () => {}
    on('command.run', (_$, e) => {
      if (e.command !== 'compact') return { text: 'ok' }
      return new Promise(resolve => {
        release = () => resolve({ text: 'ok' })
      }) as never
    })
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 250_000, percent: 80 } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'swamp-compact' })
    const pressed = band.press({ key: 'compact-go' })
    await mocked.advance(100)
    const during = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(during ? await drawn(during) : '').not.toContain('Chat is getting swamped')
    expect(await during?.find({ key: 'swamp-compact' })).toBeUndefined()
    release()
    await pressed
    await during?.unmount()
    await band.unmount()
  })

  test('Compact shows its card above the prompt at once: Compacting while it runs, then Compact complete until the next reply', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let release = () => {}
    on('command.run', (_$, e) => {
      if (e.command !== 'compact') return { text: 'ok' }
      return new Promise(resolve => {
        release = () => resolve({ text: 'ok' })
      }) as never
    })
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 250_000, percent: 80 } } }) as never)
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    on('ui.render', { component: 'AssistantMessage' }, (h, e) => {
      const { Text } = h.ui.resolve(e)
      return Text({ children: e.props.text } as never) as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    await $.turn.complete({
      turnId: 't1',
      answer: 'Last reply.',
      durationMs: 1,
      isAborted: false,
      reason: 'answer',
    } as never)
    const reply = () =>
      $.ui.mount({
        plugin: 'context-lens',
        surface: 'desktop',
        component: 'AssistantMessage',
        props: { text: 'Last reply.', isFirstOfReply: true },
      } as never)
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'swamp-compact' })
    const pressed = band.press({ key: 'compact-go' })
    await mocked.advance(100)
    expect(await drawn(band)).toContain('Compacting…')
    // Not under the old reply: after a compact no reply sits past the boundary.
    const during = await reply()
    expect(await during.find({ key: 'reply-handoff' })).toBeUndefined()
    await during.unmount()
    release()
    await pressed
    expect(await drawn(band)).toContain('Compact complete')
    await band.unmount()
    // The first reply after it takes it away.
    await $.turn.complete({
      turnId: 't2',
      answer: 'Next reply.',
      durationMs: 1,
      isAborted: false,
      reason: 'answer',
    } as never)
    const later = await $.ui.mount(DESK_BAND)
    expect(await drawn(later)).not.toContain('Compact complete')
    await later.unmount()
  })

  test('a swamped chat draws no card under the reply: the band above the prompt says it', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 250_000, percent: 80 } } }) as never)
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    // The app's own drawing of a reply block, beneath the plugin.
    on('ui.render', { component: 'AssistantMessage' }, (h, e) => {
      const { Text } = h.ui.resolve(e)
      return Text({ children: e.props.text } as never) as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    await $.turn.complete({
      turnId: 't1',
      answer: 'First answer.',
      durationMs: 1,
      isAborted: false,
      reason: 'answer',
    } as never)
    const reply = await $.ui.mount({
      plugin: 'context-lens',
      surface: 'desktop',
      component: 'AssistantMessage',
      props: { text: 'First answer.', isFirstOfReply: true },
    } as never)
    expect(await reply.find({ key: 'reply-warn' })).toBeUndefined()
    expect(await drawn(reply)).not.toContain('swamped')
    await reply.unmount()
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Chat is getting swamped')
    await band.unmount()
  })

  test('/context-lens save switches save mode on and off', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    expect(String((await $.command.run({ command: 'context-lens', args: 'save' } as never)).text)).toContain(
      'save mode on',
    )
    expect(String((await $.command.run({ command: 'context-lens', args: 'save' } as never)).text)).toContain(
      'save mode off',
    )
  })

  test('save mode paints the footer level ember; off again, it is purple', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await $.command.run({ command: 'context-lens', args: 'save' } as never)
    const footer = await $.ui.mount(FOOTER)
    expect(await drawn(footer)).toContain('"color":"#f08a3c"')
    await $.command.run({ command: 'context-lens', args: 'save' } as never)
    await footer.unmount()
    const again = await $.ui.mount(FOOTER)
    const text = await drawn(again)
    expect(text).not.toContain('"color":"#f08a3c"')
    expect(text).toContain('"color":"#a79cf7"')
    await again.unmount()
  })

  test('the setup can be closed with the cross; it stays closed, and /context-lens setup opens it again', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
    // Closed for good: the footer shows the gear, not Setup.
    const footer = await $.ui.mount(FOOTER)
    expect(await footer.find({ key: 'setup' })).toBeUndefined()
    expect(await footer.find({ key: 'settings' })).toBeDefined()
    await $.command.run({ command: 'context-lens', args: 'setup' } as never)
    const reopened = await $.ui.mount(DESK_BAND)
    expect(await reopened.find({ key: 'setup-bias2' })).toBeDefined()
    await reopened.press({ key: 'setup-close' })
    await reopened.unmount()
    // Once set up, the same place is a gear that opens the settings panel.
    await footer.press({ key: 'settings' })
    const panel = await $.ui.mount(DESK_BAND)
    expect(await drawn(panel)).toContain('"key":"settings-title"')
    await panel.unmount()
    await footer.unmount()
  })
})

describe('running hot and judge down', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('save mode caps at medium, and reset times read short', () => {
    expect(capped('xhigh', true)).toBe('medium')
    expect(capped('low', true)).toBe('low')
    expect(capped('xhigh', false)).toBe('xhigh')
    const now = new Date('2026-10-06T10:00:00').getTime()
    expect(resetLabel('2026-10-06T14:20:00', now)).toBe('14:20')
    expect(resetLabel(null, now)).toBe('')
  })

  test('a limit past 80% shows the running-hot band; save mode can be switched on', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on(
      'session.usage',
      () =>
        ({
          value: {
            context: { tokens: 1000, window: 200_000, percent: 1 },
            rateLimits: [
              { kind: 'five_hour', percentUsed: 84, resetsAt: '2026-10-06T14:20:00Z' },
              { kind: 'seven_day', percentUsed: 40 },
            ],
          },
        }) as never,
    )
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Running hot')
    expect(await drawn(band)).toContain('84% of your 5h limit used')
    await band.press({ key: 'hot-save' })
    expect(said.join(' ')).toContain('save mode on')
    await band.unmount()
  })

  test('a running-hot band closed in an earlier chat stays closed, with no write while drawing', async ($, on) => {
    const resetsAt = '2026-10-06T14:20:00Z'
    // Closed in an earlier chat: the store has it, this chat's state does not.
    engine(on, {}, undefined, [], {
      hotClosed: { window: `five_hour ${Math.round(new Date(resetsAt).getTime() / 900_000)}`, percent: 84 },
    })
    const mocked = mock.clock(on)
    on(
      'session.usage',
      () =>
        ({
          value: {
            context: { tokens: 1000, window: 200_000, percent: 1 },
            rateLimits: [
              { kind: 'five_hour', percentUsed: 84, resetsAt },
              { kind: 'seven_day', percentUsed: 40 },
            ],
          },
        }) as never,
    )
    on('ui.toast', () => ({ value: undefined }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)

    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()

    const debug = (await $.command.run({ command: 'context-lens', args: 'debug' } as never)) as { text?: string }
    expect(debug.text).toContain('band error: none')
  })

  test('a failing judge shows the judge-down band until it answers again', async ($, on) => {
    engine(on)
    mock.clock(on)
    let answered = false
    on(
      'model.complete',
      () =>
        ({
          value: answered
            ? { isAnswered: true as const, text: '{"model":"opus","effort":"high","why":"x"}', usage: USAGE }
            : { isAnswered: false as const, reason: 'api-error', status: 402, error: 'billing_error', usage: USAGE },
        }) as never,
    )
    on('ui.toast', () => ({ value: undefined }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Judge down')
    expect(await drawn(band)).toContain('out of credits')
    // The band has no settings to open: it goes once Haiku answers a later prompt.
    expect(await band.find({ key: 'down-settings' })).toBeUndefined()
    answered = true
    await band.unmount()
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
  })

  test('an aborted or empty judge reply is no failure: no band, no toast', async ($, on) => {
    engine(on)
    mock.clock(on)
    const toasts: string[] = []
    on('model.complete', () => ({ value: { isAnswered: false as const, reason: 'aborted', usage: USAGE } }) as never)
    on('ui.toast', (_$, e) => {
      toasts.push(String(e))
      return { value: undefined } as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
    expect(toasts).toEqual([])
  })
})

describe('settings panel', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('the slider tips only close calls; floor and ceiling clamp', () => {
    expect(tipped('medium', 0.6, 1)).toBe('high')
    expect(tipped('medium', 0.9, 1)).toBe('medium')
    expect(tipped('medium', 0.8, 1)).toBe('medium')
    expect(tipped('medium', 0.8, 2)).toBe('high')
    expect(tipped('medium', 0.6, -1)).toBe('low')
    expect(tipped('low', 0.3, -2)).toBe('low')
    expect(tipped('medium', undefined, 2)).toBe('medium')
    expect(bounded('low', 'medium', 'max')).toBe('medium')
    expect(bounded('max', 'low', 'high')).toBe('high')
    expect(parseVerdict('{"model":"opus","effort":"high","sure":0.7,"why":"x"}')?.sure).toBe(0.7)
  })

  test('Open settings opens the panel; the slider and range are saved from it', async ($, on) => {
    engine(on, { USERPROFILE: 'C:/Users/x' })
    const mocked = mock.clock(on)
    const set: { key: string; value: unknown }[] = []
    on('config.set', (_$, e) => {
      set.push({ key: e.key, value: e.value })
      return { value: e.value } as never
    })
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.command.run({ command: 'context-lens', args: 'settings' } as never)
    const panel = await $.ui.mount(DESK_BAND)
    expect(await drawn(panel)).toContain('"key":"settings-title"')
    // The panel opens on the four cards; each opens its own controls, Back returns.
    expect(await panel.find({ key: 'settings-card-auto' })).toBeDefined()
    expect(await panel.find({ key: 'bias3' })).toBeUndefined()
    await panel.press({ key: 'settings-card-auto' })
    await panel.press({ key: 'bias3' })
    await panel.select({ key: 'settings-floor', value: 'medium' })
    expect(await drawn(panel)).toContain('Never below')
    expect(await panel.find({ key: 'settings-hold-offer-switch' })).toBeDefined()
    await panel.press({ key: 'settings-back' })

    // Subagents: both switches in one card; the model one waits on the effort one.
    await panel.press({ key: 'settings-card-subagents' })
    expect(await drawn(panel)).toContain('Effort for subagents off')
    expect(await drawn(panel)).toContain('Needs Effort for subagents')
    await panel.press({ key: 'settings-subagents-switch' })
    expect(await drawn(panel)).toContain('Effort for subagents on')
    expect(await drawn(panel)).not.toContain('Needs Effort for subagents')
    await panel.press({ key: 'settings-subagent-model-switch' })
    await panel.press({ key: 'settings-back' })

    // Context: the alert, compacting and the handoff. The alert's Off and the button's Hidden switch those parts off.
    await panel.press({ key: 'settings-card-context' })
    await panel.select({ key: 'settings-skill', value: 'session-handoff' })
    expect(await panel.find({ key: 'settings-compact-with' })).toBeDefined()
    await panel.select({ key: 'settings-swamp', value: 'off' })
    await panel.select({ key: 'settings-handoff-button', value: 'hidden' })
    await panel.press({ key: 'settings-back' })

    // The cards say what is set, unsaved changes included.
    expect(await drawn(panel)).toContain('Smarter · medium to max · held offers')
    expect(await drawn(panel)).toContain('Effort and cheaper model')
    expect(await drawn(panel)).toContain('Alert off · Haiku · /session-handoff')

    // Look: the parts that show, the alerts among them.
    await panel.press({ key: 'settings-card-look' })
    await panel.press({ key: 'show-box-timer' })
    expect(await panel.find({ key: 'show-box-hot' })).toBeDefined()
    expect(await panel.find({ key: 'show-box-cold' })).toBeDefined()
    expect(await panel.find({ key: 'show-box-swamp' })).toBeUndefined()
    expect(set).toEqual([])
    await panel.press({ key: 'settings-save' })
    const hide = set.find(s => s.key === 'context-lens.hide')?.value
    expect(String(hide).split(',').sort()).toEqual(['handoff', 'swamp', 'timer'])
    expect(set).toContainEqual({ key: 'context-lens.handoffSkill', value: 'session-handoff' })
    expect(set).toContainEqual({ key: 'context-lens.effortBias', value: '1' })
    expect(set).toContainEqual({ key: 'context-lens.effortFloor', value: 'medium' })
    expect(set).toContainEqual({ key: 'context-lens.subagents', value: 'on' })
    expect(set).toContainEqual({ key: 'context-lens.subagentModel', value: 'on' })
    await panel.unmount()
    // A plain card says it was saved, then goes.
    const saved = await $.ui.mount(DESK_BAND)
    expect(await drawn(saved)).toContain('Settings saved')
    await saved.unmount()
    await mocked.advance(3000)
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
  })
})

describe('switching parts off', () => {
  test('readConfig keeps only parts that can be switched off; the judge-down alert is not among them', () => {
    expect(readConfig({ hide: 'swamp, handoff,bogus,down,progress,sounds' }).hide).toEqual(['swamp', 'handoff'])
  })

  test(
    'a hidden handoff button is not in the footer; a switched-off context alert does not show',
    { options: { hide: 'handoff,swamp' } } as never,
    async ($, on) => {
      on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
      on('command.register', () => ({ value: undefined }) as never)
      engine(on)
      const mocked = mock.clock(on)
      on('session.usage', () => ({ value: { context: { tokens: 600_000, window: 1_000_000, percent: 60 } } }) as never)
      await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
      const guide = await $.ui.mount(DESK_BAND)
      await guide.press({ key: 'setup-close' })
      await guide.unmount()
      await mocked.advance(16_000)
      // Nothing above the prompt: the swamp band was the only thing to draw.
      await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
      const footer = await $.ui.mount(FOOTER)
      expect(await footer.find({ key: 'handoff' })).toBeUndefined()
      await footer.unmount()
    },
  )
})

describe('the command file', () => {
  test('/context-lens:context-lens, as the app may name the command file, is answered by the mod', async ($, on) => {
    engine(on)
    mock.clock(on)
    const answer = await $.command.run({ command: 'context-lens:context-lens', args: 'settings' } as never)
    expect(String((answer as { text?: string }).text)).toContain('settings are open')
  })
})

describe('thinking dots', () => {
  test("three dots, in the theme's accent", () => {
    expect(thinkingSvg().match(/<circle/g)).toHaveLength(3)
    try {
      setTheme('orange')
      expect(thinkingSvg()).toContain(`fill="${tintHex('#a79cf7')}"`)
      expect(thinkingSvg()).not.toContain('#a79cf7')
    } finally {
      setTheme('violet')
    }
  })
})

describe('terminal art', () => {
  test('a frame is 16 by 2 cells of ▀, faded in from the left', () => {
    // 32 cells of three 4-byte words: 384 bytes, 512 base64 characters.
    expect(artFrame('swamp', 0)).toHaveLength(512)
    for (const kind of ['cold', 'swamp', 'hot', 'down', 'brand', 'calm', 'compacting', 'done'] as const) {
      expect(artPixel(kind, 3, 0, 1)).toBe(artPixel(kind, 9, 0, 1))
    }
  })

  test('moving kinds change over time; still ones do not', () => {
    const frames = (kind: Parameters<typeof artFrame>[0]) =>
      new Set(Array.from({ length: 30 }, (_, t) => artFrame(kind, t))).size
    for (const kind of MOVING) expect(frames(kind)).toBeGreaterThan(1)
    expect(frames('brand')).toBe(1)
    expect(frames('calm')).toBe(1)
    expect(frames('done')).toBe(1)
  })

  test('the brand art follows the theme: orange turns its violet pixels', () => {
    const violet = artPixel('brand', 0, 15, 3)
    try {
      setTheme('orange')
      expect(artPixel('brand', 0, 15, 3)).not.toBe(violet)
    } finally {
      setTheme('violet')
    }
    expect(artPixel('brand', 0, 15, 3)).toBe(violet)
  })
})

describe('terminal bands', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'terminal', isInteractive: true } as never)
  }
  const at = (columns: number) =>
    ({
      plugin: 'context-lens',
      surface: 'terminal',
      ...BAND,
      props: { ...BAND.props, bodyColumns: columns, maxRows: 14 },
    }) as never

  for (const kind of ['swamp', 'cold', 'hot', 'down'] as const) {
    test(`${kind}: art on the right when wide, none at 80 columns; the effort row stays under it`, async ($, on) => {
      engine(on)
      mock.clock(on)
      await start($, on)
      const guide = await $.ui.mount(at(120))
      await guide.press({ key: 'setup-close' })
      await guide.unmount()
      await $.command.run({ command: 'context-lens', args: kind } as never)
      const wide = await $.ui.mount(at(120))
      const text = await drawn(wide)
      expect(text).toContain('"type":"Raster"')
      expect(text).toContain('"children":["Effort"]')
      await wide.unmount()
      const narrow = await $.ui.mount(at(80))
      const small = await drawn(narrow)
      expect(small).not.toContain('"type":"Raster"')
      expect(small).toContain('"children":["Effort"]')
      await narrow.unmount()
    })
  }

  test('Settings in a narrow terminal: cards keep their text, the header wraps', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    const guide = await $.ui.mount(at(36))
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.command.run({ command: 'context-lens', args: 'settings' } as never)
    const panel = await $.ui.mount(at(36))
    const text = await drawn(panel)
    // No blank buttons laid over the cards: a terminal paints their spaces over the title and summary.
    expect(text).not.toContain(' '.repeat(800))
    expect(text).toContain('Auto ›')
    // Title and buttons are in the flow, so a narrow window wraps them instead of drawing one over the other.
    expect(text).not.toMatch(/"key":"settings-(title|actions)"[^}]*"position":"absolute"/)
    expect(text).not.toContain('"href"')
    await panel.press({ key: 'settings-card-subagents' })
    expect(await drawn(panel)).toContain('○ Effort for subagents')
    expect(await drawn(panel)).not.toContain('\u00a0'.repeat(40))
    // Short choices are buttons, not a dropdown that opens inside the row: one press picks.
    await panel.press({ key: 'settings-back' })
    await panel.press({ key: 'settings-card-look' })
    expect(await panel.find({ key: 'settings-theme' })).toBeDefined()
    await panel.press({ key: 'settings-theme-rose' })
    expect(await drawn(panel)).toContain('unsaved changes')
    expect(JSON.stringify(await panel.find({ key: 'settings-theme-rose' }))).toContain('"variant":"secondary"')
    await panel.unmount()
  })
})

describe('dashboard', () => {
  const DASH = { options: { layout: 'default' } } as never
  const start = async ($: Engine, on: On, surface: 'desktop' | 'terminal' = 'desktop') => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface, isInteractive: true } as never)
  }
  const closeSetup = async ($: Engine, band: unknown) => {
    const guide = await $.ui.mount(band as never)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
  }

  test('light appearance: surfaces come out pale, text reads on them, alpha and hue are kept', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1, 7), 16)
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
      return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255)
    }
    const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    // Edges stay a visible step darker than the panels they frame.
    for (const edge of ['#2a2a2f', '#4a3f80']) expect(lum(lightHex(edge, 'surface'))).toBeGreaterThan(0.45)
    for (const dark of ['#141416', '#15121f', '#0e1820', '#111710', '#1a110c', '#0f1c15']) {
      const pale = lightHex(dark, 'surface')
      expect(lum(pale)).toBeGreaterThan(0.6)
    }
    const surfaces = ['#141416', '#15121f', '#0e1820', '#111710', '#1a110c', '#0f1c15', '#12141b'].map(h =>
      lightHex(h, 'surface'),
    )
    for (const text of [
      '#d4d4d8',
      '#8b8b93',
      '#a79cf7',
      '#7c6cf0',
      '#7cc4ff',
      '#a7c98f',
      '#f08a3c',
      '#7fe0a4',
      '#ffffff',
      '#6b6b73',
      '#e0a33a',
      '#e5534b',
    ])
      for (const bg of surfaces) expect(contrast(lightHex(text, 'text'), bg)).toBeGreaterThanOrEqual(4.5)
    // Main text stays darker than dim text, and a colour stays its hue.
    expect(lum(lightHex('#d4d4d8', 'text'))).toBeLessThan(lum(lightHex('#8b8b93', 'text')))
    expect(lightHex('#7fe0a4', 'text')).toMatch(/^#[0-9a-f]{2}[0-9a-f]{2}[0-9a-f]{2}$/)
    const green = parseInt(lightHex('#7fe0a4', 'text').slice(3, 5), 16)
    const red = parseInt(lightHex('#7fe0a4', 'text').slice(1, 3), 16)
    expect(green).toBeGreaterThan(red)
    expect(lightHex('#14141680', 'surface').endsWith('80')).toBe(true)
  })

  test('light appearance: Box, Text and Button props are turned, hover too; dark leaves the apps own parts alone', () => {
    const Box = (p: Record<string, unknown>) => p
    const Text = (p: Record<string, unknown>) => p
    const Button = (p: Record<string, unknown>) => p
    const els = { Box, Text, Button, Svg: (p: Record<string, unknown>) => p }
    expect(themedEls(els).Box).toBe(Box)
    try {
      setLight(true)
      const lit = themedEls(els) as typeof els
      expect(lit.Box).not.toBe(Box)
      const box = lit.Box({
        backgroundColor: '#141416',
        borderColor: '#2a2a2f',
        hover: { backgroundColor: '#1c1c20' },
        flexDirection: 'row',
      })
      expect(box.backgroundColor).toBe(lightHex('#141416', 'surface'))
      expect(box.borderColor).toBe(lightHex('#2a2a2f', 'surface'))
      expect((box.hover as { backgroundColor: string }).backgroundColor).toBe(lightHex('#1c1c20', 'surface'))
      expect(box.flexDirection).toBe('row')
      expect(lit.Text({ color: '#d4d4d8', bold: true }).color).toBe(lightHex('#d4d4d8', 'text'))
      expect(lit.Text({ color: 'red' }).color).toBe('red')
      expect(lit.Button({ hover: { backgroundColor: '#00000000' } }).hover).toEqual({
        backgroundColor: lightHex('#00000000', 'surface'),
      })
      expect(lightProps({ color: '#fff' }).color).toBe('#fff')
    } finally {
      setLight(false)
    }
    expect(isLight()).toBe(false)
  })

  test('light appearance: drawn art turns pale, with the sparkles still petals in rose', () => {
    const art =
      '<svg><style>.sp{fill:#fff}</style><rect fill="#15121f" width="9" height="9"/><rect fill="#7c6cf0" width="9" height="9"/><path class="sp" style="transform-origin:168px 8px;animation-duration:4.2s;animation-delay:0.3s" d="M168 6.4 L168.34 7.66 Z"/></svg>'
    try {
      setLight(true)
      const violet = tint(art)
      expect(violet).not.toContain('#15121f')
      expect(violet).toContain(lightHex('#15121f'))
      expect(violet).toContain('class="sp"')
      setTheme('rose')
      const rose = tint(art)
      expect(rose).toContain('class="pt"')
      expect(rose).not.toContain('#ffb3cf')
    } finally {
      setTheme('violet')
      setLight(false)
    }
  })

  test(
    'light appearance, set in the settings: the band is drawn pale',
    { options: { layout: 'default', appearance: 'light' } } as never,
    async ($, on) => {
      engine(on)
      mock.clock(on)
      await start($, on)
      await closeSetup($, DESK_BAND)
      const band = await $.ui.mount(DESK_BAND)
      const text = await drawn(band)
      expect(text).toContain(lightHex('#141416', 'surface'))
      expect(text).not.toContain('"backgroundColor":"#141416"')
      await band.unmount()
    },
  )

  test(
    "auto appearance follows Claude Code's own theme row: light turns it pale, dark turns it back",
    { options: { layout: 'default' } } as never,
    async ($, on) => {
      engine(on)
      const mocked = mock.clock(on)
      let claudeTheme = 'light'
      on(
        'config.list',
        () =>
          ({
            value: [
              {
                key: 'theme',
                label: 'Theme',
                kind: 'choice',
                value: claudeTheme,
                provider: { kind: 'engine' },
                isLocked: false,
              },
            ],
          }) as never,
      )
      await start($, on)
      await closeSetup($, DESK_BAND)
      // The first draw reads the row; the redraw it asks for is pale.
      let band = await $.ui.mount(DESK_BAND)
      await band.unmount()
      await mocked.advance(100)
      band = await $.ui.mount(DESK_BAND)
      expect(await drawn(band)).toContain(lightHex('#141416', 'surface'))
      await band.unmount()
      // Claude Code goes dark: within a few seconds the panels follow.
      claudeTheme = 'dark'
      await mocked.advance(5000)
      band = await $.ui.mount(DESK_BAND)
      await band.unmount()
      await mocked.advance(100)
      band = await $.ui.mount(DESK_BAND)
      expect(await drawn(band)).toContain('"backgroundColor":"#141416"')
      await band.unmount()
    },
  )

  test('a new chat: Low picked by hand in another chat does not beat the effort the app is on when the first prompt goes', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
    on('prompt.fill', () => ({ isFilled: true }) as never)
    const sent = recordSteps(on)
    await start($, on)
    await closeSetup($, DESK_BAND)
    // The other chat: Low picked by hand in context-lens, so Auto went off and the pick is kept for the next chat.
    const rows = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND } as never)
    await rows.press({ key: 'e-low' })
    await rows.unmount()
    // A new chat starts from that; the person sets the app to Extra before the first prompt goes.
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.prompt.submit({ text: 'plan the architecture of the trainer', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent.at(-1)!.effort).toBe('xhigh')
  })

  test('picking an effort in the app turns Auto off and says so', async ($, on) => {
    engine(on)
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    const sent = recordSteps(on)
    await step($, 'high')
    await step($, 'low')
    expect(sent.at(-1)!.effort).toBe('low')
    expect(said.join(' ')).toContain('Auto is off. You picked Low')
    expect(String((await $.command.run({ command: 'context-lens', args: 'auto' } as never)).text)).toContain('Auto on')
  })

  test('/context-lens debug says what the app asked for and what was sent', async ($, on) => {
    engine(on)
    const sent = recordSteps(on)
    const debug = async () => String((await $.command.run({ command: 'context-lens', args: 'debug' } as never)).text)
    expect(await debug()).toContain('last request: none yet')
    await $.command.run({ command: 'context-lens', args: 'auto' } as never)
    await step($, 'xhigh')
    expect(sent.at(-1)!.effort).toBe('xhigh')
    expect(await debug()).toContain(
      'last request: app asked claude-opus-5-5 at xhigh, sent claude-opus-5-5 at xhigh (unchanged)',
    )
    // The model that ran is also on a line of its own.
    expect((await debug()).split(String.fromCharCode(10)).at(-1)).toBe('model used: claude-opus-5-5 at xhigh')
  })

  test('the bench report says whether low confidence predicts a miss, and which models the judges picked', () => {
    const cases = [
      {
        id: 'a',
        kind: 'k',
        current: { model: 'sonnet', effort: 'medium', why: '', by: 'manual' },
        message: 'x',
        ok: ['low'],
      },
      {
        id: 'b',
        kind: 'k',
        current: { model: 'sonnet', effort: 'medium', why: '', by: 'manual' },
        message: 'y',
        ok: ['high'],
      },
      {
        id: 'c',
        kind: 'k',
        current: { model: 'sonnet', effort: 'medium', why: '', by: 'manual' },
        message: 'z',
        ok: ['medium'],
      },
    ] as never
    const report = benchReport(cases, [
      { id: 'a', judge: 'haiku', effort: 'low', sure: 0.95, model: 'haiku', ms: 1, tokens: 1 },
      { id: 'b', judge: 'haiku', effort: 'low', sure: 0.5, model: 'sonnet', ms: 1, tokens: 1 },
      { id: 'c', judge: 'haiku', effort: 'medium', sure: 0.9, model: 'sonnet', ms: 1, tokens: 1 },
    ] as never)
    expect(report).toContain('| haiku (3 with a score) | 93% | 50% | 1 of 1 | 1 of 1 | 1 | 1 |')
    expect(report).toContain('| haiku | 1 | 2 | 0 | 0 |')
  })

  test("its lines: the effort, cache and context; the judge's reason", () => {
    const base = {
      auto: true,
      paused: false,
      judging: false,
      effort: 'medium' as const,
      cacheNow: 42,
      contextPercent: 18,
      reason: 'Why: a small fix',
    }
    expect(dashboardLines(base).head).toBe(`✦ Medium · cache ${cacheLabel(42)} · 18% context`)
    expect(dashboardLines(base).detail).toBe('Why: a small fix')
    expect(dashboardLines({ ...base, model: 'Opus 5.5' }).head).toBe(
      `✦ Opus 5.5 · Medium · cache ${cacheLabel(42)} · 18% context`,
    )
    expect(dashboardLines({ ...base, model: 'Opus 5.5' }).pair).toBe('Opus 5.5 · Medium')
    expect(dashboardLines({ ...base, model: 'Opus 5.5' }).rest).toBe(` · cache ${cacheLabel(42)} · 18% context`)
    expect(dashboardLines({ ...base, auto: false }).head).toBe(`✦ Off · cache ${cacheLabel(42)} · 18% context`)
    expect(dashboardLines({ ...base, cacheNow: null, contextPercent: null }).head).toBe('✦ Medium')
    expect(
      weighted({ input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 1000, cache_creation_input_tokens: 4 }),
    ).toBe(10 + 10 + 100 + 5)
    // A write to the 1-hour cache costs 2x, one to the 5-minute cache 1.25x; a reply's three requests, measured on a real session.
    const hour = (w: number) => ({ cache_creation_input_tokens: w, cache_creation: { ephemeral_1h_input_tokens: w } })
    const reply = [
      { input_tokens: 2, output_tokens: 268, cache_read_input_tokens: 83_991, ...hour(14_092) },
      { input_tokens: 2, output_tokens: 1025, cache_read_input_tokens: 98_083, ...hour(2_799) },
      { input_tokens: 2, output_tokens: 1006, cache_read_input_tokens: 100_882, ...hour(2_946) },
    ]
    expect(Math.round(reply.reduce((n, u) => n + weighted(u), 0) * 10) / 10).toBe(79_470.6)
    expect(
      weighted({
        output_tokens: 0,
        cache_creation_input_tokens: 100,
        cache_creation: { ephemeral_1h_input_tokens: 40 },
      }),
    ).toBe(40 * 2 + 60 * 1.25)
    expect(turnLineFor({ '1000': 'a', '5000': 'b' }, 1400)).toBe('a')
    expect(turnLineFor({ '1000': 'a', '5000': 'b' }, 3000)).toBeUndefined()
  })

  test('a footer drawn before its turn is saved shows what that reply ran on, not the setting after it', async ($, on) => {
    engine(on)
    mock.clock(on)
    recordSteps(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('turn.complete', () => ({ text: '' }))
    on('prompt.fill', () => ({ isFilled: true }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await step($, 'low')
    // The setting moves on (a click, or the next message's pick) before this reply's footer is drawn.
    const rows = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND } as never)
    await rows.press({ key: 'e-high' })
    await rows.unmount()
    const footer = (ms: number) =>
      $.ui.mount({
        plugin: 'context-lens',
        surface: 'desktop',
        component: 'TurnDuration',
        props: { word: 'Baked', durationMs: ms },
      } as never)
    const early = await footer(17_000)
    expect((await early.find({ key: 'turn-line' }))?.text).toContain('✦ Opus 5.5 · Low')
    await early.unmount()
    await $.turn.complete({
      turnId: 't1',
      answer: 'Done.',
      durationMs: 17_000,
      isAborted: false,
      reason: 'answer',
    } as never)
    await step($, 'high')
    const late = await footer(17_000)
    expect((await late.find({ key: 'turn-line' }))?.text).toContain('Low')
    await late.unmount()
  })

  test('a resumed chat draws each footer from the store, and a footer nothing knows shows no effort or model', async ($, on) => {
    engine(on, {}, 'claude-opus-5-5', [], {
      turnLines: { s1: { '17000': { effort: 'low', model: 'opus', cost: 1200 } } },
    })
    mock.clock(on)
    on('session.id', () => ({ value: 's1' }) as never)
    const footer = (ms: number) =>
      $.ui.mount({
        plugin: 'context-lens',
        surface: 'desktop',
        component: 'TurnDuration',
        props: { word: 'Baked', durationMs: ms },
      } as never)

    const saved = await footer(17_000)
    expect((await saved.find({ key: 'turn-line' }))?.text).toContain('✦ Opus 5.5 · Low')
    await saved.unmount()

    const unknown = await footer(40_000)
    const text = (await unknown.find({ key: 'turn-line' }))?.text ?? ''
    expect(text).toContain('Baked 40s')
    expect(text).not.toContain('✦')
    expect(text).not.toContain('Opus')
    await unknown.unmount()
  })

  test('a finished turn saves its footer in the store under the session', async ($, on) => {
    const writes: Record<string, unknown> = {}
    on('store.set', { key: 'turnLines' } as never, (_$, e, next) => {
      writes[e.key] = e.value
      return next(e)
    })
    engine(on)
    mock.clock(on)
    recordSteps(on)
    on('session.id', () => ({ value: 's1' }) as never)
    on('turn.complete', () => ({ text: '' }))
    await step($, 'low')
    await $.turn.complete({
      turnId: 't1',
      answer: 'Done.',
      durationMs: 9_000,
      isAborted: false,
      reason: 'answer',
    } as never)

    const all = writes.turnLines as Record<string, Record<string, { effort?: string; model?: string }>>
    expect(all.s1?.['9000']).toMatchObject({ effort: 'low', model: 'opus' })
  })

  test('the effort word and the figures after it are drawn apart, so the figures can be cut and the word stays whole', () => {
    const base = {
      auto: true,
      paused: false,
      judging: false,
      effort: 'low' as const,
      cacheNow: 42,
      contextPercent: null,
      reason: '',
    }
    expect(dashboardLines(base).what).toBe('Low')
    expect(dashboardLines(base).rest).toBe(` · cache ${cacheLabel(42)}`)
    expect(dashboardLines({ ...base, cacheNow: null }).rest).toBe('')
  })

  test('a new effort glows violet, then turns the band white in one redraw', () => {
    expect(flashColor(0)).toBe('#9b7bff')
    expect(flashColor(999)).toBe('#9b7bff')
    expect(new Set([1000, 1160, 1320, 1480, 1640].map(flashColor)).size).toBe(5)
    expect(flashColor(1400)).not.toBe('#9b7bff')
    expect(flashColor(1400)).not.toBe('#d4d4d8')
    expect(flashColor(null)).toBe('#d4d4d8')
    expect(flashColor(1800)).toBe('#d4d4d8')
  })

  test('desktop: Auto switched off does not light the word up: it turns Off in white', DASH, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
    on('prompt.fill', () => ({ isFilled: true }) as never)
    await start($, on)
    await closeSetup($, DESK_BAND)
    const first = await $.ui.mount(DESK_BAND)
    await first.unmount()
    // Picking an effort by hand turns Auto off, so the word becomes Off: the switch says so, no flash.
    const rows = await $.ui.mount({ plugin: 'context-lens', surface: 'terminal', ...BAND })
    await rows.press({ key: 'e-low' })
    await rows.unmount()
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toMatch(/"color":"#d4d4d8"[^{}]*\},"children":\["(?:[^"]* · )?Off"\]/)
    await band.unmount()
  })

  test(
    "desktop: the band above the prompt at rest, with Auto, Handoff and settings; the footer is the app's own",
    DASH,
    async ($, on) => {
      engine(on)
      const mocked = mock.clock(on)
      on('session.usage', () => ({ value: { context: { tokens: 180_000, window: 1_000_000, percent: 18 } } }) as never)
      await start($, on)
      await closeSetup($, DESK_BAND)
      await mocked.advance(16_000)
      const band = await $.ui.mount(DESK_BAND)
      // The title with the controls, then the detail line. With no lens row yet, the title says
      // the context in words.
      expect(await band.find({ key: 'dash-title' })).toBeDefined()
      expect(await band.find({ key: 'dash-detail' })).toBeDefined()
      expect(await band.find({ key: 'dash-ring' })).toBeUndefined()
      expect(await band.find({ key: 'dash-tail' })).toBeUndefined()
      expect(await drawn(band)).toContain('18% context')
      expect(await band.find({ key: 'dash-auto' })).toBeDefined()
      expect(await band.find({ key: 'dash-settings' })).toBeDefined()
      // A drawn icon on desktop, not the word.
      expect(await band.find({ key: 'dash-settings-icon' })).toBeDefined()
      expect(await drawn(band)).not.toContain('"label":"Settings"')
      // The mark stands in for the ✦ on desktop.
      expect(await band.find({ key: 'dash-mark' })).toBeDefined()
      await band.press({ key: 'dash-auto' })
      expect(await drawn(band)).toContain('Auto effort off')
      expect(await drawn(band)).toContain('Auto model off')
      await band.press({ key: 'dash-auto-model' })
      expect(await drawn(band)).toContain('Auto model on')
      // One button: Compact on a fresh chat. It opens the compact card, which can switch to Handoff.
      await band.press({ key: 'dash-handoff' })
      expect(await drawn(band)).toContain('compact-bar')
      await band.press({ key: 'compact-to-handoff' })
      expect(await drawn(band)).toContain('⇥ Handoff')
      await band.unmount()
      await expect($.ui.mount(FOOTER)).rejects.toThrow()
    },
  )

  test(
    'Handoff button set to always: Handoff from the start, calm, no glow, with Compact beside it',
    { options: { layout: 'default', handoffButton: 'always' } } as never,
    async ($, on) => {
      engine(on)
      recordSteps(on)
      const mocked = mock.clock(on)
      on('session.usage', () => ({ value: { context: { tokens: 100_000, window: 1_000_000, percent: 10 } } }) as never)
      await start($, on)
      await closeSetup($, DESK_BAND)
      await mocked.advance(16_000)
      const band = await $.ui.mount(DESK_BAND)
      expect(await band.find({ key: 'dash-handoff' })).toBeDefined()
      expect(await band.find({ key: 'dash-glow' })).toBeUndefined()
      expect(await band.find({ key: 'dash-handoff-h' })).toBeUndefined()
      const text = await drawn(band)
      expect(text).toContain('Handoff')
      // Compact stays beside it as quiet text, so both are a press away.
      expect(await band.find({ key: 'dash-compact' })).toBeDefined()
      await band.unmount()
    },
  )

  test('readConfig keeps handoffButton to advised or always', () => {
    expect(readConfig({}).handoffButton).toBe('advised')
    expect(readConfig({ handoffButton: 'always' }).handoffButton).toBe('always')
    expect(readConfig({ handoffButton: 'sometimes' }).handoffButton).toBe('advised')
  })

  test(
    'one button: Compact until the Haiku check says a handoff would suit; then Handoff, lit, with the reason',
    DASH,
    async ($, on) => {
      engine(on)
      recordSteps(on)
      const mocked = mock.clock(on)
      on('session.usage', () => ({ value: { context: { tokens: 400_000, window: 1_000_000, percent: 40 } } }) as never)
      let handoff: string | null = null
      const systems: string[] = []
      on('model.complete', (_$, e) => {
        systems.push(String((e as { system?: string }).system ?? '').slice(0, 30))
        const text = String((e as { system?: string }).system ?? '').includes(
          'decide whether the person should hand off',
        )
          ? JSON.stringify({ handoff })
          : '{"model":"opus","effort":"high","why":"big refactor"}'
        return { value: { isAnswered: true as const, text, usage: USAGE } }
      })
      await start($, on)
      await closeSetup($, DESK_BAND)
      await mocked.advance(16_000)
      // A fairly full chat, no advice: no glow, no H key, one button, and it says Compact.
      let band = await $.ui.mount(DESK_BAND)
      expect(await band.find({ key: 'dash-handoff' })).toBeDefined()
      expect(await band.find({ key: 'dash-compact' })).toBeUndefined()
      expect(await band.find({ key: 'dash-handoff-h' })).toBeUndefined()
      expect(await band.find({ key: 'dash-glow' })).toBeUndefined()
      expect(await drawn(band)).toContain('Compact')
      await band.unmount()
      // The check runs every second message from 30%. Haiku says a handoff would suit.
      handoff = 'Task done, new topic'
      await $.prompt.submit({
        text: 'completely different: help me plan a trip to Lisbon',
        wait: false,
        origin: { kind: 'composer' },
      })
      await step($)
      await $.prompt.submit({
        text: 'and which neighbourhood should I stay in for the first night',
        wait: false,
        origin: { kind: 'composer' },
      })
      await step($)
      band = await $.ui.mount(DESK_BAND)
      expect((await band.find({ key: 'dash-handoff-h' }))?.props).toMatchObject({ hotkey: 'h' })
      expect(await band.find({ key: 'dash-glow' })).toBeDefined()
      expect(await drawn(band)).toContain('Handoff would suit: Task done, new topic')
      await band.unmount()
      // A later check that says no clears it again.
      handoff = null
      await $.prompt.submit({
        text: 'now make the Lisbon plan a three day one with a budget',
        wait: false,
        origin: { kind: 'composer' },
      })
      await step($)
      await $.prompt.submit({
        text: 'add the cost of the tram tickets to the budget as well',
        wait: false,
        origin: { kind: 'composer' },
      })
      await step($)
      band = await $.ui.mount(DESK_BAND)
      expect(await band.find({ key: 'dash-glow' })).toBeUndefined()
      expect(await drawn(band)).not.toContain('Handoff would suit')
      await band.unmount()
    },
  )

  test('the handoff check reads the purpose, the trail, the last reply, the fill and the cache; an unclear answer is no', () => {
    const messages = [
      { role: 'user', text: 'build the settings page' },
      { role: 'assistant', text: 'done, anything else?' },
      { role: 'user', text: 'also fix the footer' },
      { role: 'assistant', text: 'footer fixed' },
    ]
    const text = handoffEvidence(messages, 'plan a trip to Lisbon', 42, true)
    expect(text).toContain('build the settings page')
    expect(text).toContain('footer fixed')
    expect(text).toContain('plan a trip to Lisbon')
    expect(text).toContain('42%')
    expect(text).toContain('cache is cold')
    expect(parseHandoffAnswer('{"handoff":"Task done"}')).toBe('Task done')
    expect(parseHandoffAnswer('{"handoff":null}')).toBeNull()
    expect(parseHandoffAnswer('{"handoff":"  "}')).toBeNull()
    expect(parseHandoffAnswer('maybe')).toBeNull()
  })

  test('parseVerdict keeps only a real handoff reason', () => {
    const base = '"model":"opus","effort":"high","why":"x"'
    expect(parseVerdict(`{${base},"handoff":"Task done"}`)?.handoff).toBe('Task done')
    expect(parseVerdict(`{${base},"handoff":"   "}`)?.handoff).toBeUndefined()
    expect(parseVerdict(`{${base},"handoff":false}`)?.handoff).toBeUndefined()
    expect(parseVerdict(`{${base}}`)?.handoff).toBeUndefined()
  })

  test('parseVerdict keeps only a known number of steps', () => {
    const base = '"model":"opus","effort":"high","why":"x"'
    expect(parseVerdict(`{${base},"steps":"few"}`)?.steps).toBe('few')
    expect(parseVerdict(`{${base},"steps":"lots"}`)?.steps).toBeUndefined()
    expect(parseVerdict(`{${base}}`)?.steps).toBeUndefined()
  })

  test('the Handoff glow steps up every 10% from 30%', () => {
    expect([0, 29, 30, 39, 40, 55, 69, 70, 95].map(handoffGlowStep)).toEqual([0, 0, 1, 1, 2, 3, 4, 5, 5])
  })

  test("an alert takes the dashboard's place, and the dashboard comes back after it", DASH, async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await closeSetup($, DESK_BAND)
    await $.command.run({ command: 'context-lens', args: 'hot' } as never)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Running hot')
    expect(await band.find({ key: 'dash-auto' })).toBeUndefined()
    await band.press({ key: 'hot-close' })
    expect(await band.find({ key: 'dash-auto' })).toBeDefined()
    await band.unmount()
  })

  test('terminal: the same band with the effort row under it', DASH, async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on, 'terminal')
    const at = {
      plugin: 'context-lens',
      surface: 'terminal',
      ...BAND,
      props: { ...BAND.props, bodyColumns: 120, maxRows: 14 },
    } as never
    await closeSetup($, at)
    const band = await $.ui.mount(at)
    const text = await drawn(band)
    // Auto for effort sits on the Effort picker, beside the Model picker's own.
    expect(await band.find({ key: 'dash-auto' })).toBeUndefined()
    const before = (await band.find({ key: 'auto' }))?.text
    expect(before).toContain('Auto')
    await band.press({ key: 'auto' })
    expect((await band.find({ key: 'auto' }))?.text).toContain('Manual')
    expect(await band.find({ key: 'dash-handoff' })).toBeDefined()
    expect(text).toContain('"children":["Effort"]')
    // No still sparkles at rest: 16 by 4 pixels of them read as noise in a terminal.
    expect(text).not.toContain('"type":"Raster"')
    await band.unmount()
  })

  test(
    "the minimal look draws no band and keeps the footer's buttons",
    { options: { layout: 'minimal' } } as never,
    async ($, on) => {
      engine(on)
      mock.clock(on)
      await start($, on)
      await closeSetup($, DESK_BAND)
      await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
      const footer = await $.ui.mount(FOOTER)
      expect(await footer.find({ key: 'auto' })).toBeDefined()
      await footer.unmount()
    },
  )
})

describe('a chat opened again', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('classic.SessionStart', () => ({}) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }
  const closeSetup = async ($: Engine) => {
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
  }

  test('two hours after its last response: the cache shows cold at once', async ($, on) => {
    engine(on)
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 1_000_000, percent: 20 } } }) as never)
    mock.clock(on)
    await start($, on)
    await closeSetup($)
    await $.classic.SessionStart({
      source: 'resume',
      seconds_since_last_response: 7200,
      prompt_cache_likely_expired: true,
    } as never)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Chat went cold')
    await band.unmount()
  })

  test('a small chat that went cold shows no band: rereading it costs too little', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 30_000, window: 1_000_000, percent: 3 } } }) as never)
    await start($, on)
    await closeSetup($)
    await $.classic.SessionStart({
      source: 'resume',
      seconds_since_last_response: 7200,
      prompt_cache_likely_expired: true,
    } as never)
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
  })

  test('ten minutes after: the countdown goes on from where it was, no cold band', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await closeSetup($)
    await $.classic.SessionStart({
      source: 'resume',
      seconds_since_last_response: 600,
      prompt_cache_likely_expired: false,
    } as never)
    await expect($.ui.mount(DESK_BAND)).rejects.toThrow()
    const footer = await $.ui.mount(FOOTER)
    expect(await drawn(footer)).toMatch(/"(49|50)m"/)
    await footer.unmount()
  })
})

describe('handoff look', () => {
  test('no box at 0%, the grey box at 15%, white at 30% where the glow starts, a step each percent', () => {
    expect(handoffLook(0).opacity).toBe(0)
    expect(handoffLook(15)).toMatchObject({ opacity: 1, fill: '#2b2b2f' })
    expect(handoffLook(30)).toMatchObject({ fill: '#ececf0', label: '#141416' })
    expect(handoffLook(80)).toEqual(handoffLook(30))
    expect(new Set(Array.from({ length: 31 }, (_, p) => JSON.stringify(handoffLook(p)))).size).toBe(31)
  })
})

describe('a message typed while a turn runs', () => {
  /** The judge answers with whatever `says.effort` holds at the time. */
  function judgeSaysNow(on: On, says: { effort: string }) {
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(e.prompt)
      return {
        value: {
          isAnswered: true as const,
          text: `{"model":"opus","effort":"${says.effort}","why":"x"}`,
          usage: USAGE,
        },
      }
    })
    return asked
  }
  /** One request of turn `turnId` at request `index`. */
  async function stepOf($: Engine, turnId: string, index: number) {
    for await (const _ of $.turn.step({ turnId, index, model: 'claude-opus-5-5', effort: 'high', messageCount: 1 })) {
      // drain
    }
  }

  test('a lower verdict never lowers the running turn; it takes the next one', async ($, on) => {
    engine(on)
    const says = { effort: 'high' }
    const asked = judgeSaysNow(on, says)
    const sent = recordSteps(on)
    mock.clock(on)
    on('turn.complete', () => ({ text: '' }) as never)

    await $.prompt.submit({
      text: 'refactor the whole auth module across the app',
      wait: false,
      origin: { kind: 'composer' },
    })
    await stepOf($, 't1', 0)
    says.effort = 'low'
    await $.prompt.submit({
      text: 'also rename the subagent you made',
      wait: false,
      turnId: 't1',
      origin: { kind: 'composer' },
    } as never)
    await stepOf($, 't1', 1)
    await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'completed' } as never)
    await stepOf($, 't2', 0)

    expect(asked.length).toBe(2)
    // The judge is told the message came in while the task ran.
    expect(asked[1]).toContain('still working')
    expect(sent.map(s => s.effort)).toEqual(['high', 'high', 'low'])
  })

  test('a higher verdict raises the running turn at once', async ($, on) => {
    engine(on)
    const says = { effort: 'low' }
    judgeSaysNow(on, says)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'fix the typo in the readme', wait: false, origin: { kind: 'composer' } })
    await stepOf($, 't1', 0)
    says.effort = 'high'
    await $.prompt.submit({
      text: 'actually go through every doc and fix them all',
      wait: false,
      turnId: 't1',
      origin: { kind: 'composer' },
    } as never)
    await stepOf($, 't1', 1)

    expect(sent.map(s => s.effort)).toEqual(['low', 'high'])
  })

  test('Auto switched off or on mid-turn leaves the running turn at its effort', async ($, on) => {
    engine(on)
    const says = { effort: 'high' }
    judgeSaysNow(on, says)
    const sent = recordSteps(on)
    const auto = () => $.command.run({ command: 'context-lens', args: 'auto' } as never)

    await $.prompt.submit({
      text: 'refactor the whole auth module across the app',
      wait: false,
      origin: { kind: 'composer' },
    })
    await stepOf($, 't1', 0)
    expect(String((await auto()).text)).toContain('Auto off')
    await stepOf($, 't1', 1)
    expect(String((await auto()).text)).toContain('Auto on')
    await stepOf($, 't1', 2)

    expect(sent.map(s => s.effort)).toEqual(['high', 'high', 'high'])
  })
})

describe('updates', () => {
  const DESK = { options: { layout: 'default' } } as never
  /** A session with `installed` on disk and `latest` on main; records what the mod runs. */
  function world(
    on: On,
    v: {
      installed: string
      latest: string
      fails?: string
      git?: string
      installPath?: string
      noCli?: (bin: string) => boolean
      env?: Record<string, string>
    },
  ) {
    engine(on, v.env)
    const clock = mock.clock(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('fs.read', (_$, e) => {
      if (String(e.path).replaceAll('\\', '/').endsWith('.claude-plugin/plugin.json'))
        return { value: JSON.stringify({ version: v.installed }) } as never
      if (v.installPath && String(e.path).replaceAll('\\', '/').endsWith('installed_plugins.json'))
        return {
          value: JSON.stringify({ plugins: { 'context-lens@context-lens': [{ installPath: v.installPath }] } }),
        } as never
      if (String(e.path).replaceAll('\\', '/').endsWith('marketplaces/context-lens/public.json'))
        return { value: JSON.stringify([{ version: v.latest, note: 'Quick and Full as one switch.' }]) } as never
      return { value: '' } as never
    })
    on('http.fetch', (_$, e) => {
      if (String(e.url).includes('public.json'))
        return {
          value: {
            status: 200,
            ok: true,
            headers: {},
            text: JSON.stringify([{ version: v.latest, date: '2026-10-07', note: 'Quick and Full as one switch.' }]),
          },
        } as never
      return { value: { status: 404, ok: false, headers: {}, text: '' } } as never
    })
    const ran: string[] = []
    const envs: (Record<string, string> | undefined)[] = []
    on('process.run', (_$, e) => {
      // No claude where the app looks: the engine refuses to start it, as it does for a desktop-only user.
      if (v.noCli?.(e.argv[0] ?? ''))
        return {
          deny: `$.process.run(${e.argv[0]}) failed to start: ENOENT: Command '${e.argv[0]}' not found or is in an unsafe location (current directory)`,
        } as never
      ran.push(e.argv.join(' '))
      envs.push(e.init?.env)
      // git show answers with public.json as it is on stable, when the test gives one.
      const stdout = e.argv[0] === 'git' && e.argv.includes('show') ? (v.git ?? '') : ''
      return {
        value: v.fails ? { exitCode: 1, stdout: '', stderr: v.fails } : { exitCode: 0, stdout, stderr: '' },
      } as never
    })
    const commands: string[] = []
    const commandArgs: string[] = []
    on('command.run', (_$, e) => {
      commands.push(`/${e.command}`)
      if (e.args) commandArgs.push(`/${e.command} ${e.args}`)
      return { text: 'ok' }
    })
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push((e as { text: string }).text)
      return { value: { isCopied: true as const } } as never
    })
    return { clock, ran, envs, commands, commandArgs, copied }
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 30))
  /** Through the setup guide a first session opens, which takes the band before any card. */
  async function pastSetup(ui: {
    find: (q: { key: string }) => Promise<unknown>
    press: (q: { key: string }) => Promise<unknown>
  }) {
    for (let i = 0; i < 6 && (await ui.find({ key: 'setup-close' })); i++) await ui.press({ key: 'setup-close' })
  }
  const start = ($: Engine) => $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)

  test('the one button says Compact, opens the compact step, and stays on a narrow bar', DESK, async ($, on) => {
    world(on, { installed: '1.0.1', latest: '1.0.1' })
    await start($)
    await settle()
    const wide = await $.ui.mount({ plugin: 'context-lens', surface: 'desktop', ...BAND })
    await pastSetup(wide)
    expect(await wide.find({ key: 'dash-compact' })).toBeUndefined()
    expect(await wide.find({ key: 'dash-handoff' })).toBeDefined()
    await wide.press({ key: 'dash-handoff' })
    await settle()
    expect(await drawn(wide)).toContain('compact-bar')
    await wide.press({ key: 'compact-close' })
    await settle()
    await wide.unmount()
    const narrow = await $.ui.mount({
      plugin: 'context-lens',
      surface: 'desktop',
      component: 'AbovePrompt',
      props: { ...BAND.props, bodyColumns: 60 },
    } as never)
    await pastSetup(narrow)
    expect(await narrow.find({ key: 'dash-handoff' })).toBeDefined()
    await narrow.unmount()
  })

  test('Uninstall in Look asks for a second press, then uninstalls and reloads', DESK, async ($, on) => {
    const w = world(on, { installed: '1.0.1', latest: '1.0.1' })
    on('ui.toast', () => ({ value: undefined }) as never)
    await start($)
    await settle()
    const ui = await $.ui.mount({ plugin: 'context-lens', surface: 'desktop', ...BAND })
    await pastSetup(ui)
    await ui.press({ key: 'dash-settings' })
    await ui.press({ key: 'settings-card-look' })
    expect(await drawn(ui)).toContain('Look')
    w.ran.length = 0
    await ui.press({ key: 'settings-uninstall' })
    expect(w.ran).toEqual([])
    expect(await drawn(ui)).toContain('Press again to uninstall')
    await ui.press({ key: 'settings-uninstall' })
    await settle()
    expect(w.ran).toEqual(['claude plugin uninstall context-lens@context-lens'])
    expect(w.commands).toContain('/reload-plugins')
    await ui.unmount()
  })

  test('claude is looked for on PATH, then where the Windows and Mac installers put it', () => {
    expect(claudeCandidates('C:/Users/friend')).toEqual(['claude', 'C:/Users/friend/.local/bin/claude.exe'])
    expect(claudeCandidates('/Users/friend')).toEqual(['claude', '/Users/friend/.local/bin/claude'])
    expect(claudeCandidates(undefined)).toEqual(['claude'])
    expect(
      noClaudeHint(
        "$.process.run(claude) failed to start: ENOENT: Command 'claude' not found or is in an unsafe location (current directory)",
        'C:/Users/friend',
      ),
    ).toContain('install.ps1')
    expect(noClaudeHint('spawn claude ENOENT', '/Users/friend')).toContain('install.sh')
    expect(noClaudeHint('network down', '/Users/friend')).toBeUndefined()
  })
})

describe('subagent effort', () => {
  const start = async ($: Engine, on: On) => {
    engine(on)
    mock.clock(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('classic.SessionStart', () => ({}) as never)
    on('ui.open', () => ({ value: { isPlaced: true } }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test(
    "with Subagents on, the judge picks a subagent's effort at its spawn and every request of it runs at that",
    { options: { subagents: 'on' } } as never,
    async ($, on) => {
      const asked = judgeSays(on, '{"model":"opus","effort":"low","why":"quick search"}')
      on('agent.spawn', () => ({ agentId: 'h1', model: 'claude-opus-5-5' }) as never)
      on('turn.complete', () => ({ text: '' }))
      const sent = recordSteps(on)
      await start($, on)
      await $.agent.spawn({
        prompt: 'list the files under hooks',
        description: 'find files',
        subagentType: 'Explore',
      } as never)
      expect(asked.some(p => p.includes('Explore subagent'))).toBe(true)
      for (const index of [0, 1]) {
        for await (const _ of $.turn.step({
          turnId: 't1',
          index,
          model: 'claude-opus-5-5',
          effort: 'high',
          messageCount: 1,
          agentId: 'h1',
        } as never)) {
          // drain
        }
      }
      // Subagents start at medium: a low verdict comes up to it.
      expect(sent.map(s => s.effort)).toEqual(['medium', 'medium'])
    },
  )

  const subagentRun = async ($: Engine, on: On, verdict: string, given: string, opts?: { agentId?: string }) => {
    judgeSays(on, verdict)
    on('agent.spawn', () => ({ agentId: 'h1', model: given }) as never)
    on('turn.complete', () => ({ text: '' }))
    const sent = recordSteps(on)
    await start($, on)
    await $.agent.spawn({
      prompt: 'list the files under hooks',
      description: 'find files',
      subagentType: 'Explore',
    } as never)
    for await (const _ of $.turn.step({
      turnId: 't1',
      index: 0,
      model: given,
      effort: 'high',
      messageCount: 1,
      agentId: opts?.agentId ?? 'h1',
    } as never)) {
      // drain
    }
    return sent
  }

  test(
    'subagent model: a subagent the judge is sure is simple runs on a cheaper model than it was given',
    { options: { subagents: 'on', subagentModel: 'on' } } as never,
    async ($, on) => {
      const sent = await subagentRun(
        $,
        on,
        '{"model":"haiku","effort":"low","sure":0.9,"why":"quick search"}',
        'claude-opus-5-5',
      )
      expect(sent[0]?.model).toBe('claude-haiku-5-5')
    },
  )

  test(
    'subagent model: never above the model it was given, and an unsure verdict leaves it alone',
    { options: { subagents: 'on', subagentModel: 'on' } } as never,
    async ($, on) => {
      // The judge names Opus for a Sonnet subagent: it keeps Sonnet.
      const up = await subagentRun(
        $,
        on,
        '{"model":"opus","effort":"high","sure":0.95,"why":"hard"}',
        'claude-sonnet-5-5',
      )
      expect(up[0]?.model).toBe('claude-sonnet-5-5')
    },
  )

  test(
    'subagent model: unsure, it keeps the model it was given',
    { options: { subagents: 'on', subagentModel: 'on' } } as never,
    async ($, on) => {
      const sent = await subagentRun(
        $,
        on,
        '{"model":"haiku","effort":"low","sure":0.4,"why":"maybe small"}',
        'claude-opus-5-5',
      )
      expect(sent[0]?.model).toBe('claude-opus-5-5')
    },
  )

  test(
    'subagent model: with its switch off the effort is picked and the model stays',
    { options: { subagents: 'on' } } as never,
    async ($, on) => {
      const sent = await subagentRun(
        $,
        on,
        '{"model":"haiku","effort":"low","sure":0.9,"why":"quick search"}',
        'claude-opus-5-5',
      )
      expect(sent[0]?.model).toBe('claude-opus-5-5')
      expect(sent[0]?.effort).toBe('medium')
    },
  )

  test('subagentSteerable: what a subagent inherits may change; its definition only with Override on; its call never', () => {
    const chat = { model: 'opus' as const, effort: 'medium' }
    // Inherited: the parent's model and the chat's effort.
    expect(subagentSteerable({ model: 'opus', effort: 'medium' }, chat, undefined, false)).toEqual({
      model: true,
      effort: true,
    })
    // Set by its definition: kept, unless Override definitions is on.
    expect(subagentSteerable({ model: 'sonnet', effort: 'high' }, chat, undefined, false)).toEqual({
      model: false,
      effort: false,
    })
    expect(subagentSteerable({ model: 'sonnet', effort: 'high' }, chat, undefined, true)).toEqual({
      model: true,
      effort: true,
    })
    // Named by its Agent call: kept even then.
    expect(subagentSteerable({ model: 'sonnet', effort: 'high' }, chat, { model: true, effort: true }, true)).toEqual({
      model: false,
      effort: false,
    })
    // The chat's effort not seen yet: taken as inherited.
    expect(subagentSteerable({ model: 'opus', effort: 'high' }, { model: 'opus' }, undefined, false)).toEqual({
      model: true,
      effort: true,
    })
  })

  // A main request first, so the chat's own effort is known; then a subagent's first request as its definition sets it.
  const definedRun = async (
    $: Engine,
    on: On,
    request: { model: string; effort: string },
    spawn: Record<string, unknown> = {},
    call?: Record<string, unknown>,
  ) => {
    judgeSays(on, '{"model":"haiku","effort":"low","sure":0.9,"why":"quick search"}')
    on('agent.spawn', () => ({ agentId: 'd1', model: request.model }) as never)
    on('turn.complete', () => ({ text: '' }))
    const sent = recordSteps(on)
    if (call) on('tool.call', () => ({ result: {} }) as never)
    await start($, on)
    for await (const _ of $.turn.step({
      turnId: 't0',
      index: 0,
      model: 'claude-opus-5-5',
      effort: 'medium',
      messageCount: 1,
    } as never)) {
      // drain
    }
    if (call) await $.tool.call({ tool: 'Agent', description: 'review', prompt: 'review the diff', ...call } as never)
    await $.agent.spawn({
      prompt: 'review the diff',
      description: 'review',
      subagentType: 'reviewer',
      parentModel: 'claude-opus-5-5',
      ...spawn,
    } as never)
    for await (const _ of $.turn.step({
      turnId: 't1',
      index: 0,
      ...request,
      messageCount: 1,
      agentId: 'd1',
    } as never)) {
      // drain
    }
    return sent.slice(1)
  }
  const ALL_ON = { subagents: 'on', subagentModel: 'on' }

  test('a subagent keeps the model and effort its definition sets', { options: ALL_ON } as never, async ($, on) => {
    const sent = await definedRun($, on, { model: 'claude-sonnet-5-5', effort: 'high' })
    expect(sent[0]).toEqual({ model: 'claude-sonnet-5-5', effort: 'high' })
  })

  test(
    "with Override definitions on, the judge's picks replace a definition's model and effort",
    { options: { ...ALL_ON, overrideDefinitions: 'on' } } as never,
    async ($, on) => {
      const sent = await definedRun($, on, { model: 'claude-sonnet-5-5', effort: 'high' })
      expect(sent[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'medium' })
    },
  )

  test(
    "a subagent that inherits the chat's model and effort is still steered",
    { options: ALL_ON } as never,
    async ($, on) => {
      const sent = await definedRun($, on, { model: 'claude-opus-5-5', effort: 'medium' })
      expect(sent[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'medium' })
    },
  )

  test(
    'a model the Agent call names stays, even with Override definitions on',
    { options: { ...ALL_ON, overrideDefinitions: 'on' } } as never,
    async ($, on) => {
      const sent = await definedRun($, on, { model: 'claude-sonnet-5-5', effort: 'medium' }, { model: 'sonnet' })
      expect(sent[0]).toEqual({ model: 'claude-sonnet-5-5', effort: 'medium' })
    },
  )

  test(
    'an effort the Agent call names stays, even with Override definitions on',
    { options: { ...ALL_ON, overrideDefinitions: 'on' } } as never,
    async ($, on) => {
      const sent = await definedRun(
        $,
        on,
        { model: 'claude-opus-5-5', effort: 'high' },
        { tool_use_id: 'tu1' },
        { tool_use_id: 'tu1', effort: 'high' },
      )
      // The model is inherited and may change; the effort the call named goes out as it is.
      expect(sent[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'high' })
    },
  )

  test('with Subagents off, a subagent of a judged turn keeps the effort its definition sets', async ($, on) => {
    engine(on)
    on('model.complete', () => ({
      value: { isAnswered: true as const, text: '{"model":"opus","effort":"xhigh","why":"hard"}', usage: USAGE },
    }))
    on('agent.spawn', () => ({ agentId: 'd2', model: 'claude-opus-5-5' }) as never)
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'find why the relay drops messages', wait: false, origin: { kind: 'composer' } })
    for await (const _ of $.turn.step({
      turnId: 't0',
      index: 0,
      model: 'claude-opus-5-5',
      effort: 'medium',
      messageCount: 1,
    } as never)) {
      // drain
    }
    await $.agent.spawn({
      prompt: 'read relay/worker.js',
      description: 'read relay',
      subagentType: 'scout',
      parentModel: 'claude-opus-5-5',
    } as never)
    for await (const _ of $.turn.step({
      turnId: 't0',
      index: 0,
      model: 'claude-opus-5-5',
      effort: 'low',
      messageCount: 1,
      agentId: 'd2',
    } as never)) {
      // drain
    }
    // The main request runs at the turn's xhigh; the subagent keeps the low its definition set.
    expect(sent.map(s => s.effort)).toEqual(['xhigh', 'low'])
  })

  test('subagentModelFor: only cheaper than the given model, never Fable', () => {
    expect(subagentModelFor('haiku', 'opus')).toBe('haiku')
    expect(subagentModelFor('sonnet', 'opus')).toBe('sonnet')
    expect(subagentModelFor('opus', 'opus')).toBeNull()
    expect(subagentModelFor('opus', 'sonnet')).toBeNull()
    expect(subagentModelFor('fable', 'fable')).toBeNull()
    expect(subagentModelFor(undefined, 'opus')).toBeNull()
  })

  test(
    "a subagent's first request before its spawn resolves still gets the picked effort",
    { options: { subagents: 'on' } } as never,
    async ($, on) => {
      judgeSays(on, '{"model":"opus","effort":"low","why":"quick search"}')
      const sent = recordSteps(on)
      on(
        'agent.list',
        () => ({ value: [{ id: 'h2', description: 'find files', type: 'Explore', status: 'running' }] }) as never,
      )
      // The engine's own spawn: the subagent's first request goes out before the spawn answers with its id.
      let early: Promise<void> | null = null
      on('agent.spawn', async () => {
        early = (async () => {
          for await (const _ of $.turn.step({
            turnId: 't1',
            index: 0,
            model: 'claude-opus-5-5',
            effort: 'high',
            messageCount: 1,
            agentId: 'h2',
          } as never)) {
            // drain
          }
        })()
        await early
        return { agentId: 'h2', model: 'claude-opus-5-5' } as never
      })
      await start($, on)
      await $.agent.spawn({
        prompt: 'list the files under hooks',
        description: 'find files',
        subagentType: 'Explore',
      } as never)
      expect(sent.map(s => s.effort)).toEqual(['medium'])
    },
  )

  test("subagentFloor: medium, the person's Min when higher, never above their Max", () => {
    expect(subagentFloor('low', 'max')).toBe('medium')
    expect(subagentFloor('high', 'max')).toBe('high')
    expect(subagentFloor('low', 'low')).toBe('low')
  })

  test("with Subagents off, a subagent runs at the chat's effort and the judge is not asked", async ($, on) => {
    const asked = judgeSays(on, '{"model":"opus","effort":"low","why":"quick search"}')
    on('agent.spawn', () => ({ agentId: 'h3', model: 'claude-opus-5-5' }) as never)
    const sent = recordSteps(on)
    await start($, on)
    await $.agent.spawn({ prompt: 'list the files', description: 'find files', subagentType: 'Explore' } as never)
    for await (const _ of $.turn.step({
      turnId: 't1',
      index: 0,
      model: 'claude-opus-5-5',
      effort: 'high',
      messageCount: 1,
      agentId: 'h3',
    } as never)) {
      // drain
    }
    expect(asked.some(p => p.includes('subagent'))).toBe(false)
    expect(sent.map(s => s.effort)).toEqual(['high'])
  })

  test("with Subagents off, a subagent of a judged turn runs at the turn's effort, never below medium", async ($, on) => {
    engine(on)
    let verdict = '{"model":"opus","effort":"xhigh","why":"hard"}'
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(e.prompt)
      return { value: { isAnswered: true as const, text: verdict, usage: USAGE } }
    })
    on('agent.spawn', () => ({ agentId: 'h4', model: 'claude-opus-5-5' }) as never)
    const sent = recordSteps(on)
    const sub = async () => {
      for await (const _ of $.turn.step({
        turnId: 't1',
        index: 0,
        model: 'claude-opus-5-5',
        effort: 'medium',
        messageCount: 1,
        agentId: 'h4',
      } as never)) {
        // drain
      }
    }
    await $.prompt.submit({ text: 'find why the relay drops messages', wait: false, origin: { kind: 'composer' } })
    await $.agent.spawn({ prompt: 'read relay/worker.js', description: 'read relay', subagentType: 'Explore' } as never)
    await sub()
    verdict = '{"model":"opus","effort":"low","why":"small"}'
    await $.prompt.submit({ text: 'list the files in hooks', wait: false, origin: { kind: 'composer' } })
    await sub()
    // No judge call for the subagent itself; it follows the turn, raised to medium at least.
    expect(asked.some(p => p.includes('subagent'))).toBe(false)
    expect(sent.map(s => s.effort)).toEqual(['xhigh', 'medium'])
  })
})

describe('theme', () => {
  test('readConfig reads orange and falls back to violet', () => {
    expect(readConfig({ theme: 'orange' }).theme).toBe('orange')
    expect(readConfig({ theme: ' orange ' }).theme).toBe('orange')
    expect(readConfig({ theme: 'pink' }).theme).toBe('violet')
    expect(readConfig({}).theme).toBe('violet')
  })

  test('orange turns the violets and leaves greys, greens, blues and yellows alone', () => {
    try {
      setTheme('orange')
      const hue = (hex: string) => {
        const n = parseInt(hex.slice(1), 16)
        const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
        const max = Math.max(r, g, b),
          d = max - Math.min(r, g, b)
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
        return (h * 60 + 360) % 360
      }
      for (const violet of ['#a79cf7', '#b9a7ff', '#7c6cf0', '#4a3f80', '#15121f', '#9b7bff', '#e4dfff'])
        expect(Math.abs(hue(tintHex(violet)) - 15) < 4).toBe(true)
      for (const same of [
        '#ffffff',
        '#000000',
        '#141416',
        '#d4d4d8',
        '#8b8b93',
        '#2c2c31',
        '#7fe0a4',
        '#e0a33a',
        '#7cc4ff',
        '#e5534b',
        '#5d6a86',
      ])
        expect(tintHex(same)).toBe(same)
      expect(tint('<stop stop-color="#a79cf7"/><path fill="#ffffff"/>')).toBe(
        `<stop stop-color="${tintHex('#a79cf7')}"/><path fill="#ffffff"/>`,
      )
    } finally {
      setTheme('violet')
    }
  })

  test('rose turns the violets pink, leaves the signal colours alone, and draws the sparkles as falling petals', () => {
    expect(readConfig({ theme: 'rose' }).theme).toBe('rose')
    try {
      setTheme('rose')
      const hue = (hex: string) => {
        const n = parseInt(hex.slice(1), 16)
        const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
        const max = Math.max(r, g, b),
          d = max - Math.min(r, g, b)
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
        return (h * 60 + 360) % 360
      }
      for (const violet of ['#a79cf7', '#b9a7ff', '#7c6cf0', '#4a3f80', '#9b7bff'])
        expect(Math.abs(hue(tintHex(violet)) - 340) < 4).toBe(true)
      for (const same of ['#ffffff', '#141416', '#7fe0a4', '#e0a33a', '#7cc4ff', '#e5534b'])
        expect(tintHex(same)).toBe(same)
      const art =
        '<svg><style>.sp{fill:#fff}</style><rect fill="#7c6cf0" width="9" height="9"/><path class="sp" style="transform-origin:168px 8px;animation-duration:4.2s;animation-delay:0.3s" d="M168 6.4 L168.34 7.66 Z"/></svg>'
      const petals = tint(art)
      expect(petals).toContain('class="pt"')
      expect(petals).toContain('<g transform="translate(168 0)">')
      expect(petals).toContain('@keyframes fall')
      expect(petals).not.toContain('class="sp"')
      // Art with no violet in it (the green Done card) keeps its sparkles.
      const green =
        '<svg><style>.sp{fill:#fff}</style><rect fill="#2fae62" width="9" height="9"/><path class="sp" style="transform-origin:168px 8px;animation-duration:4.2s;animation-delay:0.3s" d="M168 6.4 L168.34 7.66 Z"/></svg>'
      expect(tint(green)).toContain('class="sp"')
      expect(tint(green)).not.toContain('class="pt"')
      // Orange keeps the sparkles.
      setTheme('orange')
      expect(tint(art)).toContain('class="sp"')
    } finally {
      setTheme('violet')
    }
  })

  test('violet changes nothing and the Svg is left as it is', () => {
    setTheme('violet')
    const Svg = (p: Record<string, unknown>) => p
    expect(tint('#a79cf7')).toBe('#a79cf7')
    expect(themedSvg(Svg)).toBe(Svg)
    try {
      setTheme('orange')
      const wrapped = themedSvg(Svg) as typeof Svg
      expect(wrapped({ source: '<g fill="#a79cf7"/>' }).source).toBe(`<g fill="${tintHex('#a79cf7')}"/>`)
      expect(wrapped({ source: 42 }).source).toBe(42)
    } finally {
      setTheme('violet')
    }
  })
})

describe('mobile', () => {
  const MOBILE = { plugin: 'context-lens', surface: 'mobile', ...BAND } as never

  test('the settings panel has no dropdown there: each list is a row of buttons', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'mobile', isInteractive: true } as never)
    await $.command.run({ command: 'context-lens', args: 'settings' } as never)

    const panel = await $.ui.mount(MOBILE)
    await panel.press({ key: 'settings-card-auto' })

    expect(await panel.find({ key: 'settings-floor-low' })).toBeDefined()
    expect(await drawn(panel)).not.toContain('"type":"Select"')
    await panel.unmount()
  })
})
