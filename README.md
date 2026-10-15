# Context Lens

A band above the prompt for Claude Code that does two things:

- **Picks the reasoning effort, and the model if you let it.** Haiku reads each prompt and sets the effort the model runs it at, so a rename runs at `low` and a refactor at `high`. It can also hand off or compact a long chat, and pick an effort for each subagent. Model and effort each have their own Auto. When the judge names another model, cheaper or stronger, Auto model switches to it without asking; with the model on Manual, a prompt waits up to 8 s for your answer, counted down in the question. Each model keeps its own prompt cache, so the offer depends on what the switch would rewrite. A switch is offered in a new, small or cold chat, when going back to a model whose cache is still warm, or when a cheaper model pays back its first cache write within a few requests. Otherwise the offer is to hand the prompt to a subagent on that model (Hand off or Keep): the chat and its warm cache stay where they are. A switch lasts for the session only, never the app's default. Another setting (off by default) lets a subagent the judge is sure is simple run on a cheaper model. A subagent keeps a model or effort its definition sets, unless you turn on Override definitions, and always keeps one its Agent call names.
- **Shows what the chat costs to keep.** A row under the effort line carries the prompt-cache countdown (for the main chat, and for a subagent when you look at one), the context window by category, and the rate-limit windows with their reset times. A request that rewrites a still-warm cache is marked `re-cached`.

```
◉ High                                                      [Compact] [Settings]
● 38m │ ctx ██████████░░░░░░░ 152k/250k │ 5h ████░░░░ 46% 2h14m │ 7d ██░░ 21% 3d
```

## Install

```
/plugin marketplace add Dousea/context-lens
/plugin install context-lens@context-lens
```

Then `/context-lens settings`. The first run opens a short setup guide. `/context-lens auto` toggles Auto.

## Commands

| Command                                      |                                                         |
| -------------------------------------------- | ------------------------------------------------------- |
| `/context-lens settings`                     | opens the settings panel                                |
| `/context-lens auto`                         | Auto effort on or off                                   |
| `/context-lens handoff [full]`               | writes a handoff for a fresh chat                       |
| `/context-lens stats`                        | what Auto steered and what it cost                      |
| `/context-lens bench`                        | runs the judge against the labelled prompts in `bench/` |
| `/context-lens save`                         | save mode on or off                                     |
| `/context-lens switch`, `keep`               | takes or turns down a model offer                       |
| `/context-lens cold`, `swamp`, `hot`, `down` | previews an alert band                                  |

## Where it comes from

This is a fork of [HeyCubit/effortless](https://github.com/HeyCubit/effortless) (MIT), which provides the effort judge, the band, the handoff and compaction, and the settings. What is changed here:

- the cache timers, context bar and rate-limit row from the original context-lens are folded into the band (`hooks/model.ts` holds their arithmetic);
- the Jev judge and its TypeSafe key are removed (Haiku is the only judge), and so are the agent pane, the self-update machinery and the update cards, so nothing here contacts the upstream repository (the judge is Haiku, through your own Claude login: no key, no other service);
- the plugin, its state and its command are renamed `context-lens`, so it does not clash with an installed `effortless`. Disable one of the two: they would both draw above the prompt.

Upstream's tests run here too: `claude plugin test .` passes with no known failures.

## License

MIT. See [LICENSE](LICENSE): it keeps the original copyright line.
