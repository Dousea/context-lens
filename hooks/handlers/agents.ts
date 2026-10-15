import { atom, type On, update } from 'claude-code'

import { config } from '../core/config'
import { EMPTY_SPENT } from '../core/constants'
import { proof } from '../core/env'
import { asSpent } from '../logic/spend'
import {
  callEfforts,
  setSubagentWaiting,
  type SpawnCall,
  SUBAGENT_MODEL_SURE,
  subagentEffort,
  type SubagentPick,
  subagentSpawns,
  subagentWaiting,
} from '../logic/subagents'
import { keyOf } from '../logic/switching'

const saved = atom({ plugin: 'context-lens', key: 'saved' } as const, EMPTY_SPENT)

export function registerAgentHooks(on: On) {
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (e.tool_use_id && typeof (e as { effort?: unknown }).effort === 'string') callEfforts.add(e.tool_use_id)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    // Effort for subagents: the judge reads the subagent's task before it starts (a fork shares the chat's context and
    // keeps its effort). Without a verdict it runs at the chat's effort, as with the setting off.
    const verdict =
      config.subagents === 'on' && !e.fork && !e.isTeammate && !e.workflow
        ? await subagentEffort($, e.prompt, e.subagentType).catch(() => null)
        : null
    // The model the judge named counts when Cheaper model for subagents is on and it was sure of the task.
    const named =
      verdict && config.subagentModel === 'on' && (verdict.sure === undefined || verdict.sure >= SUBAGENT_MODEL_SURE)
        ? verdict.model
        : undefined
    const pick: SubagentPick | undefined = verdict
      ? { effort: verdict.effort, ...(named ? { model: named } : {}) }
      : undefined
    const call: SpawnCall = {
      model: e.model !== undefined,
      effort: callEfforts.delete(e.tool_use_id),
      parentModel: e.parentModel ? keyOf(e.parentModel) : undefined,
    }
    const waiting = { description: e.description, type: e.subagentType, parentId: e.parentAgentId, pick, call }
    setSubagentWaiting([...subagentWaiting, waiting].slice(-20))
    const result = await next(e)
    setSubagentWaiting(subagentWaiting.filter(w => w !== waiting))
    const agentId = 'agentId' in result ? result.agentId : undefined
    if (agentId && !subagentSpawns.has(agentId)) subagentSpawns.set(agentId, { pick, call })
    if (agentId && pick) {
      await update($, saved, old => {
        const t = asSpent(old)
        return {
          ...t,
          subagents: {
            ...t.subagents,
            runs: { ...t.subagents.runs, [pick.effort]: (t.subagents.runs[pick.effort] ?? 0) + 1 },
          },
        }
      }).catch(() => undefined)
      void proof(
        $,
        `subagent ${e.subagentType} "${e.description}": ${pick.effort}${pick.model ? ` on ${pick.model} if cheaper` : ''} (${verdict?.why})`,
      )
    }
    return result
  })
}
