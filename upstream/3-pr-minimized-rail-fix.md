# Pull request — opened 17 Oct 2026: https://github.com/NousResearch/hermes-agent/pull/140634

**Branch:** `fix/desktop-minimized-rail-pins-main-column` (local checkout:
`~/dev/hermes-agent-fix`, one commit on main at 18c525b6)

**Title:** fix(desktop): a minimized bottom rail no longer pins the main column to 1.75rem

## Summary

Fixes #140632. `fixedTrackSize` counted a minimized zone as a 1.75rem
track on both axes. With the terminal minimized under the chat (Basic
layout), the main column became a fixed 1.75rem track across the row axis,
so any uncapped right-rail pane became the absorber and the chat collapsed
to 28px. The cross-axis max now skips minimized children.

## Changes

- `track-model.ts`: cross-axis sizing ignores minimized groups.
- `track-model-minimized.test.ts`: new unit tests (strip along its own axis,
  main column stays flex across, minimized side rail still sized).

## Testing

- New test fails on main and passes with the fix.
- Ran the pane-shell `.ts` tests with and without the change: identical
  results apart from the new test. Not yet run under the project's full
  vitest config (needs a fresh dependency install); CI will cover that.
- Live repro (v0.22.2): with the plugin pane in the right rail, the chat
  measured 28px; removing the pane restored 1002px.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
