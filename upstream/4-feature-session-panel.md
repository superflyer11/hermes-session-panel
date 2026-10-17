# Draft issue 4 (feature request) — not posted

**Title:** desktop: a session context panel (environment, context, connectors, outputs, background tasks)

**Feature type:** Desktop UI · **Scope:** small to medium

## Problem or Use Case

When several chats run at once, the facts about the focused chat are spread
out: the folder and model sit in the composer and status bar, context use in
the status bar, connectors under Capabilities, outputs under Artifacts, and
background processes in the composer status. There is no single place to
check "what is this chat working with right now".

## Proposed Solution

An optional right-rail **Session** pane, one card per topic, for the focused
chat:

- **Environment**: profile, working folder, model, gateway state
- **Context**: context window use (bar and token count)
- **Connectors**: enabled toolsets and MCP servers, with live status
- **Outputs**: files and artifacts this chat produced
- **Background tasks**: background processes and subagents, with state

A working plugin version (SDK only) is at <repo link>. It shows that
Environment, Context and Background tasks are reachable through the current
SDK. Connectors and Outputs need SDK access to the MCP server list and the
Artifacts index for the focused session; today the plugin can only link to
those pages.

## Alternatives Considered

- Keep it as a catalog plugin only. That works, given SDK hooks for MCP
  servers and per-session artifacts.
- Put the same facts in the status bar. Less room, and it is hidden in
  Simple mode.

## Contribution

- [x] I can help: the plugin exists and I can submit the SDK hooks if wanted.
