// Session panel for Hermes Desktop: a right-rail pane with the focused chat's
// environment and folders, context use, connectors, outputs, changes and
// background tasks, as collapsible cards. SDK surface only (no DOM queries,
// no core overrides); the Changes card reads this plugin's own dashboard route.
import { Codicon, host, useValue } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const POLL_MS = 5000
const ADDED = '#7fb77e'
const REMOVED = '#e06c75'

const s = {
  root: { height: '100%', overflow: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' },
  card: { border: '1px solid var(--border, #2c2c2c)', borderRadius: '10px', padding: '8px 10px' },
  head: { display: 'flex', alignItems: 'center', gap: '4px', width: '100%', background: 'none', border: 0, padding: '2px 0', cursor: 'pointer', color: 'var(--ui-text-primary)', fontSize: '13px', fontWeight: 500, textAlign: 'left' },
  aside: { marginLeft: 'auto', color: 'var(--ui-text-tertiary)', fontWeight: 400, fontSize: '12px' },
  body: { marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '1px' },
  line: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, padding: '2px 0', color: 'var(--ui-text-secondary)' },
  icon: { color: 'var(--ui-text-tertiary)', flexShrink: 0, width: '14px', textAlign: 'center' },
  text: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  dim: { color: 'var(--ui-text-tertiary)' },
  num: { marginLeft: 'auto', color: 'var(--ui-text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  pct: { width: '3.6em', textAlign: 'right', color: 'var(--ui-text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  swatch: { width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0 },
  bar: { display: 'flex', height: '4px', borderRadius: '2px', background: 'var(--ui-bg-tertiary, #272726)', overflow: 'hidden', margin: '4px 0 6px' },
  link: { background: 'none', border: 0, padding: '2px 0', cursor: 'pointer', color: 'var(--ui-text-tertiary)', fontSize: '12px', textAlign: 'left' },
  button: { alignSelf: 'flex-start', marginTop: '6px', background: 'var(--ui-bg-secondary, #20201f)', border: '1px solid var(--border, #2c2c2c)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: 'var(--ui-text-secondary)', fontSize: '12px' }
}

let pluginCtx = null

const shortPath = p => (p ? p.replace(/^\/home\/[^/]+/, '~').replace(/^\/Users\/[^/]+/, '~') : '')
const base = p => (p ? p.split('/').filter(Boolean).pop() : '')
const parent = p => shortPath(p ? p.split('/').slice(0, -1).join('/') : '')
const fmt = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n))
const pctOf = (n, max) => (max ? `${((n / max) * 100).toFixed(1)}%` : '')

// Poll an async source while mounted; a `key` change refetches at once.
function usePoll(fetcher, key, ms = POLL_MS) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let live = true
    const run = () =>
      Promise.resolve()
        .then(fetcher)
        .then(d => live && setData(d ?? null))
        .catch(() => live && setData(null))

    run()
    const timer = setInterval(run, ms)

    return () => {
      live = false
      clearInterval(timer)
    }
  }, [key])

  return data
}

// Collapsed state per card, remembered across restarts.
function useOpen(id) {
  const [open, setOpen] = useState(() => pluginCtx?.storage.get(`open.${id}`, true) ?? true)

  return [
    open,
    () => {
      setOpen(!open)
      pluginCtx?.storage.set(`open.${id}`, !open)
    }
  ]
}

function Card({ id, title, aside, children }) {
  const [open, toggle] = useOpen(id)

  return jsxs('section', {
    style: s.card,
    children: [
      jsxs('button', {
        type: 'button',
        style: s.head,
        onClick: toggle,
        'aria-expanded': open,
        children: [
          jsx('span', { children: title }),
          jsx(Codicon, { name: open ? 'chevron-down' : 'chevron-right', size: 12, style: s.dim }),
          aside != null ? jsx('span', { style: s.aside, children: aside }) : null
        ]
      }),
      open ? jsx('div', { style: s.body, children }) : null
    ]
  })
}

const Line = (key, icon, children, title) =>
  jsxs('div', { key, style: s.line, title, children: [icon ? jsx(Codicon, { name: icon, size: 13, style: s.icon }) : null, children] })

const Text = (children, extra) => jsx('span', { style: { ...s.text, ...extra }, children })

const Link = (key, label, route) => jsx('button', { key, type: 'button', style: s.link, onClick: () => host.navigate(route), children: label })

function SessionPanel() {
  const focusedProfile = useValue(host.state.focusedSessionProfile)
  const activeProfile = useValue(host.state.profile)
  const profile = focusedProfile || activeProfile
  const cwd = useValue(host.state.cwd)
  const gateway = useValue(host.state.gateway)
  const usage = useValue(host.state.focusedUsage)
  const sessionId = useValue(host.state.focusedSessionId)
  const busyBySession = useValue(host.state.busyBySession) || {}
  const [compacting, setCompacting] = useState(false)

  const project = usePoll(() => (cwd ? host.request('projects.for_cwd', { cwd }) : null), cwd, 30000)
  const breakdown = usePoll(
    () => (sessionId ? host.request('session.context_breakdown', { session_id: sessionId }) : null),
    `${sessionId}:${usage?.context_used ?? 0}:${compacting}`,
    60000
  )
  const changes = usePoll(() => (cwd && pluginCtx ? pluginCtx.rest(`/changes?path=${encodeURIComponent(cwd)}`) : null), cwd, 10000)
  const toolsets = usePoll(() => host.toolsets.list(), profile, 60000)
  const procs =
    usePoll(() => (sessionId ? host.request('process.list', { session_id: sessionId }).then(r => r?.processes ?? []) : []), sessionId) ?? []

  // Environment: primary folder first (bold), then the project's other folders.
  const folders = [...(project?.project?.folders ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
  const primary = folders.find(f => f.is_primary)?.path || cwd

  // Context: used/max header, coloured bar, rows with their share of the window.
  const max = breakdown?.context_max || usage?.context_max || 0
  const used = breakdown?.context_used ?? usage?.context_used ?? 0
  const cats = (breakdown?.categories ?? []).filter(c => c.tokens > 0)
  const free = max ? Math.max(0, max - used) : 0

  const compact = () => {
    if (!sessionId || compacting) {
      return
    }

    setCompacting(true)
    host
      .request('session.compress', { session_id: sessionId })
      .then(() => host.notify({ kind: 'info', message: 'Session compacted' }))
      .catch(err => host.notifyError(err, 'Could not compact the session'))
      .finally(() => setCompacting(false))
  }

  const enabledToolsets = (Array.isArray(toolsets) ? toolsets : []).filter(t => t?.enabled)
  const running = procs.filter(p => p.status !== 'exited')
  const busyChats = Object.values(busyBySession).filter(Boolean).length

  const folderLine = (key, path, label, isPrimary) =>
    Line(
      key,
      'folder',
      [
        Text(label || base(path), { fontWeight: isPrimary ? 600 : 400, color: isPrimary ? 'var(--ui-text-primary)' : undefined, flexShrink: 0 }),
        Text(`· ${parent(path)}`, s.dim)
      ],
      path
    )

  return jsxs('div', {
    style: s.root,
    children: [
      jsx(Card, {
        id: 'environment',
        title: 'Environment',
        children: [
          Line('profile', 'device-desktop', Text(profile || '—')),
          ...(folders.length
            ? folders.map((f, i) => folderLine(`f${i}`, f.path, f.label, f.is_primary))
            : primary
              ? [folderLine('cwd', primary, '', true)]
              : [Line('nofolder', 'folder', Text('No folder', s.dim))]),
          project?.branch ? Line('branch', 'git-branch', Text(project.branch)) : null,
          Line('gateway', 'radio-tower', [Text('Gateway'), jsx('span', { style: s.num, children: gateway || '—' })])
        ]
      }),
      jsx(Card, {
        id: 'context',
        title: 'Context',
        children: [
          jsxs('div', {
            key: 'sum',
            style: s.line,
            children: [Text(max ? `${Math.round((used / max) * 100)}% used` : '—'), jsx('span', { style: s.num, children: max ? `${fmt(used)} / ${fmt(max)}` : '' })]
          }),
          jsx('div', {
            key: 'bar',
            style: s.bar,
            children: cats.map((c, i) => jsx('div', { key: i, style: { width: `${max ? (c.tokens / max) * 100 : 0}%`, background: c.color } }))
          }),
          ...cats.map((c, i) =>
            jsxs('div', {
              key: `c${i}`,
              style: s.line,
              children: [
                jsx('span', { style: { ...s.swatch, background: c.color } }),
                Text(c.label),
                jsx('span', { style: s.num, children: fmt(c.tokens) }),
                jsx('span', { style: s.pct, children: pctOf(c.tokens, max) })
              ]
            })
          ),
          max
            ? jsxs('div', {
                key: 'free',
                style: s.line,
                children: [
                  jsx('span', { style: { ...s.swatch, border: '1px solid var(--border, #2c2c2c)' } }),
                  Text('Free space'),
                  jsx('span', { style: s.num, children: fmt(free) }),
                  jsx('span', { style: s.pct, children: pctOf(free, max) })
                ]
              })
            : null,
          (() => {
            const loaded = (breakdown?.context_files ?? []).filter(f => f.loaded)

            return loaded.length
              ? jsx('div', {
                  key: 'files',
                  style: { ...s.dim, marginTop: '4px' },
                  title: loaded.map(f => f.path).join('\n'),
                  children: `Instruction files: ${loaded.map(f => base(f.path) || f.label).join(', ')}`
                })
              : null
          })(),
          sessionId
            ? jsx('button', { key: 'compact', type: 'button', style: s.button, disabled: compacting, onClick: compact, children: compacting ? 'Compacting…' : 'Compact session' })
            : null
        ]
      }),
      jsx(Card, {
        id: 'connectors',
        title: 'Connectors',
        aside: toolsets ? `${enabledToolsets.length} on` : null,
        children: [
          ...enabledToolsets.slice(0, 8).map((t, i) => Line(`t${i}`, 'plug', Text(t.label || t.name), t.description)),
          enabledToolsets.length > 8 ? jsx('div', { key: 'more', style: s.dim, children: `and ${enabledToolsets.length - 8} more` }) : null,
          Link('manage', 'Manage connectors', '/capabilities')
        ]
      }),
      jsx(Card, { id: 'outputs', title: 'Outputs', children: Link('artifacts', 'Open artifacts', '/artifacts') }),
      jsx(Card, {
        id: 'changes',
        title: 'Changes',
        aside: changes?.repo ? `${changes.total} file${changes.total === 1 ? '' : 's'}` : null,
        children: !changes?.repo
          ? jsx('div', { style: s.dim, children: changes ? 'Not a git folder' : '—' })
          : changes.total === 0
            ? jsx('div', { style: s.dim, children: 'No uncommitted changes' })
            : [
                ...changes.files.slice(0, 8).map((f, i) =>
                  Line(
                    `d${i}`,
                    f.status === 'untracked' || f.status === 'added' ? 'diff-added' : f.status === 'deleted' ? 'diff-removed' : 'diff-modified',
                    [
                      Text(base(f.path)),
                      jsxs('span', {
                        style: s.num,
                        children: [
                          f.added ? jsx('span', { style: { color: ADDED }, children: `+${f.added} ` }) : null,
                          f.removed ? jsx('span', { style: { color: REMOVED }, children: `−${f.removed}` }) : null
                        ]
                      })
                    ],
                    f.path
                  )
                ),
                changes.total > 8 ? jsx('div', { key: 'more', style: s.dim, children: `and ${changes.total - 8} more` }) : null,
                jsx('div', { key: 'hint', style: { ...s.dim, marginTop: '4px' }, children: 'Ctrl+G opens Review' })
              ]
      }),
      jsx(Card, {
        id: 'background',
        title: 'Background tasks',
        aside: `${running.length} running`,
        children: [
          ...procs
            .slice(0, 6)
            .map((p, i) =>
              Line(`p${i}`, p.status === 'exited' ? (p.exit_code ? 'error' : 'check') : 'loading', Text((p.command || 'process').split('\n')[0]), p.command)
            ),
          procs.length === 0 ? jsx('div', { key: 'none', style: s.dim, children: 'None for this chat' }) : null,
          busyChats > 0 ? jsx('div', { key: 'busy', style: { ...s.dim, marginTop: '4px' }, children: `${busyChats} chat${busyChats === 1 ? '' : 's'} working` }) : null
        ]
      })
    ]
  })
}

export default {
  id: 'session-panel',
  name: 'Session panel',
  register(ctx) {
    pluginCtx = ctx
    ctx.onDispose(() => {
      pluginCtx = null
    })
    ctx.register({
      id: 'panel',
      area: 'panes',
      title: 'Session',
      // Dock as a tab beside Files: placement alone can land the pane in the
      // sessions sidebar. maxWidth keeps the zone a capped track; without it the
      // zone becomes the layout's leftover absorber and, on Hermes <= 0.22.2,
      // squeezes the chat.
      data: { placement: 'right', dock: { pane: 'files', pos: 'center' }, width: '280px', minWidth: '14rem', maxWidth: '40rem' },
      render: () => jsx(SessionPanel, {})
    })
  }
}
