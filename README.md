# Session panel for Hermes Desktop

A right-rail **Session** pane that collects what you otherwise look up in
several places, for the chat you are focused on:

- **Environment**: profile, working folder, model and gateway state
- **Context**: how much of the context window is used
- **Connectors**: how many toolsets are on, with a link to manage them
- **Outputs**: a link to the Artifacts view
- **Background tasks**: background processes for the chat (polled every 5 s) and how many chats are working

Desktop-only. It uses the plugin SDK only: no agent tools, hooks, middleware,
environment variables or DOM access.

## Install (local)

Copy `desktop/plugin.js` to `~/.hermes/desktop-plugins/session-panel/plugin.js`.
Hermes loads it within a few seconds. Open it with **Ctrl+J** if the right
rail is hidden.

## Notes

The pane declares `maxWidth`. On Hermes 0.22.2 and earlier a right-rail pane
without one squeezes the chat to 28 px when the terminal rail is minimized.
`upstream/` holds the drafted bug reports and the feature request.

Upstream: bug reports NousResearch/hermes-agent#140632 and #140633, fix PR #140634, feature request #140637.
