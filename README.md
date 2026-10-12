# context-lens

A band above the prompt for Claude Code that does two things:

- **Picks the reasoning effort for you.** Haiku reads each prompt and sets the effort the model runs it at, so a rename runs at `low` and a refactor at `high`. It can also route a prompt to a cheaper model when that pays off, hand off or compact a long chat, and pick an effort for each subagent.
- **Shows what the chat costs to keep.** A row under the effort line carries the prompt-cache countdown (for the main chat, and for a subagent when you look at one), the context window by category, and the rate-limit windows with their reset times. A request that rewrites a still-warm cache is marked `re-cached`.

```
✦ High                                    [Auto on] [Handoff] [Settings]
● 38:12 │ ctx ██████████░░░░░░░ 152k/250k │ 5h ████░░░░ 46% 2h14m │ 7d ██░░ 21% 3d
```

## Install

```
/plugin marketplace add Dousea/context-lens
/plugin install context-lens@context-lens
```

Then `/context-lens settings`. The first run opens a short setup guide. `/context-lens auto` toggles Auto.

## Commands

| Command | |
|---|---|
| `/context-lens settings` | opens the settings panel |
| `/context-lens auto` | Auto effort on or off |
| `/context-lens handoff [full]` | writes a handoff for a fresh chat |
| `/context-lens stats` | what Auto steered and what it cost |
| `/context-lens bench` | runs the judge against the labelled prompts in `bench/` |
| `/context-lens cold`, `swamp`, `hot`, `down` | previews an alert band |

## Where it comes from

This is a fork of [HeyCubit/effortless](https://github.com/HeyCubit/effortless) (MIT), which provides the effort judge, the band, the handoff and compaction, and the settings. What is changed here:

- the cache timers, context bar and rate-limit row from the original context-lens are folded into the band (`hooks/model.ts` holds their arithmetic);
- the agent pane, the self-update machinery and the update cards are removed, so nothing here contacts the upstream repository (the optional Jev judge, which needs a TypeSafe key you set yourself, is the only other network call);
- the plugin, its state and its command are renamed `context-lens`, so it does not clash with an installed `effortless`. Disable one of the two: they would both draw above the prompt.

Upstream's tests run here too: `claude plugin test .`. Three of them (a Windows-style key path, a clipboard fallback and a key-file write) fail on upstream's own `stable` as well, so they were failing before the fork.

## License

MIT. See [LICENSE](LICENSE): it keeps the original copyright line.
