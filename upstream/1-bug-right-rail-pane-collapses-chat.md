# Draft issue 1 (bug) — not posted

**Title:** desktop: a right-rail plugin pane without maxWidth collapses the chat column to 28px when the terminal rail is minimized

**Affected component:** Other (Desktop app, pane layout)

## Bug Description

In the **Basic** layout (terminal minimized as a rail under the chat), adding
any desktop plugin pane to the right rail shrinks the chat column to a 28px
sliver. The right rail takes the whole window. Removing the plugin pane, or
giving it a `maxWidth`, brings the chat back.

## Steps to Reproduce

1. Layout editor (Ctrl+Shift+\) → Advanced → **Basic**.
2. Create `~/.hermes/desktop-plugins/repro/plugin.js`:

   ```js
   import { jsx } from 'react/jsx-runtime'
   export default {
     id: 'repro',
     register(ctx) {
       ctx.register({ id: 'pane', area: 'panes', title: 'Repro',
         data: { placement: 'right' }, render: () => jsx('div', { children: 'repro' }) })
     }
   }
   ```
3. Show the right rail (Ctrl+J).

## Expected Behavior

The chat keeps the leftover width; the right rail stays sidebar-sized.

## Actual Behavior

The chat column is 28px wide (`flex: 0 1 1.75rem` on its track) and the right
rail grows to fill the window (`flex: 1 1 …`).

## Root Cause Analysis

`fixedTrackSize` (apps/desktop/src/components/pane-shell/tree/renderer/track-model.ts)
returns `MINIMIZED_TRACK` for a minimized group on **both** axes. The main
column is a column split of [workspace, minimized terminal], so across the row
axis it resolves to `max(1.75rem)`: a fixed track. Every row track is then
fixed, and `allFixedAbsorberIndex` picks the last uncapped one. With only the
built-in panes (files/review declare `maxWidth: 20rem`) that is the main
column, so nothing visible goes wrong. An uncapped plugin pane makes the
right rail the absorber and the main column stays at 1.75rem.

## Proposed Fix

A minimized zone is a strip only along its own split's axis. In the
cross-axis branch of `fixedTrackSize`, skip minimized children. Branch with
fix and a unit test: `fix/desktop-minimized-rail-pins-main-column`
(PR to follow).

Workaround for plugin authors: declare `maxWidth` on right-rail panes.

## Environment

- Hermes Agent v0.22.2 (d923a5eb), stable, git install; also present on main at 18c525b6
- Electron 40.10.2
- CachyOS Linux, kernel 7.2.10, KDE Plasma 6.8.0 (Wayland)
- Python 3.14.7 (Hermes-managed)

## Debug Report

Not attached: `hermes debug share` uploads config and logs to a public paste
service. Happy to share specific log lines on request.

## Contribution

- [x] I'd like to submit a PR for this
