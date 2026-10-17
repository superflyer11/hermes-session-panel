# Session panel for Hermes Desktop

A right-rail **Session** pane that collects what you otherwise look up in
several places, for the chat you are focused on:

- **Environment**: profile, working folder, model and gateway state
- **Folders**: the project's primary folder and its other folders, with the git branch
- **Changes**: uncommitted files with added and removed line counts
- **Context**: how much of the context window is used, broken down by category, plus the instruction files loaded
- **Connectors**: how many toolsets are on, with a link to manage them
- **Outputs**: a link to the Artifacts view
- **Background tasks**: background processes for the chat (polled every 5 s) and how many chats are working

It uses the plugin SDK only: no agent tools, hooks, middleware, environment
variables or DOM access. A small read-only dashboard route (`dashboard/plugin_api.py`)
runs `git status` and `git diff --numstat` for the Changes card.

## Install (local)

Copy `desktop/plugin.js` to `~/.hermes/desktop-plugins/session-panel/plugin.js`.
For the Changes card, also copy `plugin.yaml`, `__init__.py` and `dashboard/` to
`~/.hermes/plugins/session-panel/`, run `hermes plugins enable session-panel`
and restart Hermes Desktop. Open it with **Ctrl+J** if the right
rail is hidden.

## Notes

The pane declares `maxWidth`. On Hermes 0.22.2 and earlier a right-rail pane
without one squeezes the chat to 28 px when the terminal rail is minimized.
`upstream/` holds the drafted bug reports and the feature request.

Upstream: bug reports NousResearch/hermes-agent#140632 and #140633, fix PR #140634, feature request #140637.
