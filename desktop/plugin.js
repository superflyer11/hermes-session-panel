// Session panel for Hermes Desktop: a right-rail pane with the focused
// session's environment, context use, connectors, outputs and background
// tasks in one place. SDK surface only (no DOM queries, no core overrides).
import { host, useValue } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const POLL_MS = 5000

const s = {
  root: { height: '100%', overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  card: { border: '1px solid var(--border, #2c2c2c)', borderRadius: '10px', padding: '10px 12px' },
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

let pluginCtx = null

// Poll an async source while the pane is mounted; `key` changes refetch at once.
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

const STATUS_MARK = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U' }
const fmt = n => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const base = p => (p ? p.split('/').filter(Boolean).pop() : '')

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
  const project = usePoll(() => (cwd ? host.request('projects.for_cwd', { cwd }) : null), cwd, 30000)
  const breakdown = usePoll(
    () => (sessionId ? host.request('session.context_breakdown', { session_id: sessionId }) : null),
    `${sessionId}:${usage?.context_used ?? 0}`,
    60000
  )
  const changes = usePoll(
    () => (cwd && pluginCtx ? pluginCtx.rest(`/changes?path=${encodeURIComponent(cwd)}`) : null),
    cwd,
    10000
  )

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
        title: 'Folders',
        aside: project?.branch || null,
        children: (() => {
          const folders = project?.project?.folders ?? []

          if (folders.length === 0) {
            return jsx('div', { style: s.dim, children: cwd ? shortPath(cwd) : 'No folder' })
          }

          return [...folders]
            .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
            .map((f, i) => Row(f.is_primary ? 'Primary' : f.label || base(f.path), shortPath(f.path), f.path, `f${i}`))
        })()
      }),
      jsx(Card, {
        title: 'Changes',
        aside: changes?.repo ? `${changes.total} file${changes.total === 1 ? '' : 's'}` : null,
        children: !changes?.repo
          ? jsx('div', { style: s.dim, children: changes ? 'Not a git folder' : '—' })
          : changes.total === 0
            ? jsx('div', { style: s.dim, children: 'No uncommitted changes' })
            : [
                ...changes.files.slice(0, 8).map((f, i) =>
                  jsxs('div', {
                    key: `c${i}`,
                    style: s.row,
                    title: f.path,
                    children: [
                      jsx('span', { style: { ...s.val, textAlign: 'left' }, children: `${STATUS_MARK[f.status] ?? '•'}  ${f.path}` }),
                      jsxs('span', {
                        style: { flexShrink: 0, fontSize: '12px' },
                        children: [
                          jsx('span', { style: { color: '#7fb77e' }, children: f.added ? `+${f.added} ` : '' }),
                          jsx('span', { style: { color: '#e06c75' }, children: f.removed ? `−${f.removed}` : '' })
                        ]
                      })
                    ]
                  })
                ),
                changes.total > 8 ? jsx('div', { key: 'more', style: s.dim, children: `and ${changes.total - 8} more` }) : null,
                jsx('div', { key: 'hint', style: { ...s.dim, marginTop: '6px' }, children: 'Ctrl+G opens Review' })
              ]
      }),
      jsx(Card, {
        title: 'Context',
        aside: pct === null ? '—' : `${pct}%`,
        children: [
          jsx('div', { key: 'bar', style: s.track, children: jsx('div', { style: { width: `${pct ?? 0}%`, height: '100%', background: 'var(--midground, var(--ring))' } }) }),
          usage?.context_used
            ? jsx('div', { key: 'n', style: { ...s.dim, marginTop: '6px' }, children: `${usage.context_used.toLocaleString()} of ${(usage.context_max ?? 0).toLocaleString()} tokens` })
            : null,
          ...(breakdown?.categories ?? []).map((c, i) =>
            jsxs('div', {
              key: `k${i}`,
              style: s.row,
              children: [
                jsxs('span', {
                  style: s.key,
                  children: [jsx('span', { style: { display: 'inline-block', width: '7px', height: '7px', borderRadius: '2px', background: c.color || 'var(--ui-text-tertiary)', marginRight: '6px' } }), c.label]
                }),
                jsx('span', { style: s.val, children: fmt(c.tokens ?? 0) })
              ]
            })
          ),
          (() => {
            const loaded = (breakdown?.context_files ?? []).filter(f => f.loaded)

            return loaded.length
              ? jsx('div', { key: 'files', style: { ...s.dim, marginTop: '6px' }, title: loaded.map(f => f.path).join('\n'), children: `Instruction files: ${loaded.map(f => base(f.path) || f.label).join(', ')}` })
              : null
          })()
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
