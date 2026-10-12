# Context Lens

A Claude Code mod that keeps the context window in view instead of behind `/context`.

One line above the prompt:

```
● 47m │ ctx ██▓▓▓█▓▓██▓▓▓▓▓▓░░░░░░░░░░ 84k/200k │ 5h ██████░░░░ 46% 2h14m │ 7d ██░░░░░░░░ 21% 3d
```

- **Cache:** the dot's colour is the main thread's prompt cache (green warm,
  yellow expiring, red cold, grey before the first request), followed by the
  time left. A yellow `re-cached` marks a request that rewrote a cache that
  was still warm (the prefix changed).
- **ctx:** one bar, each segment a context category in its `/context` colour,
  then free space (grey) and the autocompact buffer (amber): once the context
  reaches the amber stretch, the engine compacts.
- **5h / 7d:** the subscription's rate-limit windows, with the time to reset.
  They don't appear on an API key.
- **Subagents:** open one from the tasks list and the line shows its own cache
  timer and context instead.
- **Toasts** ten minutes before a large main-thread cache expires, and when it goes cold.

The line fills the band's width: the text takes what it needs and the bars
split the rest, half to the context bar and half shared by the usage bars. When
the bars get too short, the window size, the reset times, the usage bars and
then usage windows drop in turn; the token count always stays.

## Install

From this folder:

```bash
claude plugin marketplace add ~/Development/context-lens
claude plugin install context-lens@context-lens
```

Edits to the folder reach a running session with `/reload-plugins`.

## Notes

- The cache TTL is not reported to plugins. The mod takes it from the
  `promptCacheTtl` / `subagentPromptCacheTtl` settings or their environment
  variables, and otherwise assumes 1h for the main thread on a subscription
  (5m on an API key) and 5m for subagents. Usage overage, which drops the
  main thread to 5m, is not detected.
- The category split is the engine's local estimate, refreshed after every
  response and scaled to the token count the API reported.

## Develop

```bash
claude plugin validate .
claude plugin test .
```
