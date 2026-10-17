// Session panel for Hermes Desktop: a right-rail pane with the focused
// session's environment, context use, connectors, outputs and background
// tasks in one place. SDK surface only (no DOM queries, no core overrides).
import { host, useValue } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const POLL_MS = 5000

const s = {
  root: { height: '100%', overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  card: { border: '1px solid var(--ui-border, var(--border))', borderRadius: '10px', padding: '10px 12px' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--ui-text-primary)' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px', padding: '2px 0', minWidth: 0 },
  key: { color: 'var(--ui-text-tertiary)', flexShrink: 0 },
  val: { color: 'var(--ui-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' },
  dim: { color: 'var(--ui-text-tertiary)', fontSize: '12.5px' },
  link: { background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--ui-text-tertiary)', fontSize: '12px' },
  track: { height: '4px', borderRadius: '2px', background: 'var(--ui-bg-tertiary, var(--muted))', marginTop: '4px', overflow: 'hidden' }
}

const shortPath = p => (p ? p.replace(/^\/home\/[^/]+/, '~').replace(/^\/Users\/[^/]+/, '~') : '—')

function Card({ title, aside, children }) {
  return jsxs('section', {
    style: s.card,
    children: [jsxs('div', { style: s.head, children: [jsx('span', { children: title }), aside ? jsx('span', { style: s.dim, children: aside }) : null] }), children]
  })
}

const Row = (k, v, title, key = k) =>
  jsxs('div', { key, style: s.row, children: [jsx('span', { style: s.key, children: k }), jsx('span', { style: s.val, title: title ?? v, children: v || '—' })] })

const Link = (label, route) => jsx('button', { type: 'button', style: s.link, onClick: () => host.navigate(route), children: label })

function useToolsetCount(profile) {
  const [count, setCount] = useState(null)

  useEffect(() => {
    let live = true

    host.toolsets
      .list()
      .then(list => live && setCount(Array.isArray(list) ? list.filter(t => t && t.enabled).length : null))
      .catch(() => live && setCount(null))

    return () => {
      live = false
    }
  }, [profile])

  return count
}

function useProcesses(sessionId) {
  const [procs, setProcs] = useState([])

  useEffect(() => {
    if (!sessionId) {
      setProcs([])

      return undefined
    }

    let live = true

    const poll = () =>
      host
        .request('process.list', { session_id: sessionId })
        .then(r => live && setProcs(Array.isArray(r?.processes) ? r.processes : []))
        .catch(() => live && setProcs([]))

    poll()
    const timer = setInterval(poll, POLL_MS)

    return () => {
      live = false
      clearInterval(timer)
    }
  }, [sessionId])

  return procs
}

function SessionPanel() {
  const focusedProfile = useValue(host.state.focusedSessionProfile)
  const activeProfile = useValue(host.state.profile)
  const profile = focusedProfile || activeProfile
  const cwd = useValue(host.state.cwd)
  const model = useValue(host.state.model)
  const gateway = useValue(host.state.gateway)
  const usage = useValue(host.state.focusedUsage)
  const sessionId = useValue(host.state.focusedSessionId)
  const busyBySession = useValue(host.state.busyBySession) || {}
  const toolsets = useToolsetCount(profile)
  const procs = useProcesses(sessionId)

  const pct = typeof usage?.context_percent === 'number' ? Math.round(usage.context_percent) : null
  const running = procs.filter(p => p.status !== 'exited')
  const busyChats = Object.values(busyBySession).filter(Boolean).length

  return jsxs('div', {
    style: s.root,
    children: [
      jsx(Card, {
        title: 'Environment',
        children: [Row('Profile', profile), Row('Folder', shortPath(cwd), cwd), Row('Model', model), Row('Gateway', gateway)]
      }),
      jsx(Card, {
        title: 'Context',
        aside: pct === null ? '—' : `${pct}%`,
        children: [
          jsx('div', { key: 'bar', style: s.track, children: jsx('div', { style: { width: `${pct ?? 0}%`, height: '100%', background: 'var(--midground, var(--ring))' } }) }),
          usage?.context_used
            ? jsx('div', { key: 'n', style: { ...s.dim, marginTop: '6px' }, children: `${usage.context_used.toLocaleString()} of ${(usage.context_max ?? 0).toLocaleString()} tokens` })
            : null
        ]
      }),
      jsx(Card, {
        title: 'Connectors',
        aside: toolsets === null ? '—' : `${toolsets} toolsets on`,
        children: Link('Manage connectors', '/capabilities')
      }),
      jsx(Card, { title: 'Outputs', children: Link('Open artifacts', '/artifacts') }),
      jsx(Card, {
        title: 'Background tasks',
        aside: `${running.length} running`,
        children: [
          ...procs.slice(0, 6).map((p, i) =>
            Row(p.status === 'exited' ? (p.exit_code ? 'failed' : 'done') : 'running', (p.command || 'process').split('\n')[0], p.command, `p${i}`)
          ),
          procs.length === 0 ? jsx('div', { key: 'none', style: s.dim, children: 'None for this session' }) : null,
          busyChats > 0 ? jsx('div', { key: 'busy', style: { ...s.dim, marginTop: '6px' }, children: `${busyChats} chat${busyChats === 1 ? '' : 's'} working` }) : null
        ]
      })
    ]
  })
}

export default {
  id: 'session-panel',
  name: 'Session panel',
  register(ctx) {
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
