"""Read-only data routes for the Session pane.

/changes runs `git status` and `git diff --numstat` in a folder the desktop
passes in; folders that are not git work trees return an empty list.
/profile-summary reads the active profile's config.yaml for its MCP servers
and compaction settings. Nothing is written.
"""
import asyncio
import os

from fastapi import APIRouter, HTTPException
import yaml

router = APIRouter()
MAX_FILES = 200


async def _git(cwd, *args):
    proc = await asyncio.create_subprocess_exec(
        'git', '-C', cwd, *args,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise HTTPException(504, 'git timed out')
    return proc.returncode, out.decode('utf-8', errors='replace')


def parse_status(text):
    """Porcelain v1 -z entries -> [{path, status}]; renames keep the new path."""
    files, parts, i = [], text.split('\0'), 0
    while i < len(parts):
        entry = parts[i]
        i += 1
        if len(entry) < 4:
            continue
        code, path = entry[:2], entry[3:]
        if 'R' in code or 'C' in code:
            i += 1  # skip the original path
        status = ('untracked' if code == '??' else 'added' if 'A' in code
                  else 'deleted' if 'D' in code else 'renamed' if 'R' in code else 'modified')
        files.append({'path': path, 'status': status})
    return files


def parse_numstat(text):
    counts = {}
    for line in text.splitlines():
        added, sep, rest = line.partition('\t')
        removed, sep2, path = rest.partition('\t')
        if sep and sep2:
            counts[path] = (int(added) if added.isdigit() else 0, int(removed) if removed.isdigit() else 0)
    return counts


@router.get('/changes')
async def changes(path: str = ''):
    cwd = os.path.realpath(os.path.expanduser(path)) if path else ''
    if not cwd or not os.path.isdir(cwd):
        return {'repo': False, 'files': []}
    code, _ = await _git(cwd, 'rev-parse', '--is-inside-work-tree')
    if code:
        return {'repo': False, 'files': []}
    _, status = await _git(cwd, 'status', '--porcelain=v1', '-z', '--untracked-files=normal')
    _, numstat = await _git(cwd, 'diff', 'HEAD', '--numstat')
    counts = parse_numstat(numstat)
    files = parse_status(status)
    for f in files:
        f['added'], f['removed'] = counts.get(f['path'], (0, 0))
    return {'repo': True, 'total': len(files), 'files': files[:MAX_FILES]}


def _profile_config():
    try:
        from hermes_constants import get_hermes_home
        home = str(get_hermes_home())
    except Exception:
        home = os.path.expanduser('~/.hermes')
    try:
        with open(os.path.join(home, 'config.yaml'), encoding='utf-8') as fh:
            return yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        return {}


def summarize(cfg):
    servers = []
    for name, spec in sorted((cfg.get('mcp_servers') or {}).items()):
        spec = spec if isinstance(spec, dict) else {}
        kind = 'remote' if spec.get('url') else 'local'
        servers.append({'name': name, 'enabled': spec.get('enabled', True) is not False, 'kind': kind})
    comp = cfg.get('compression') or {}
    threshold = comp.get('threshold', 0.5)
    tokens = comp.get('threshold_tokens')
    return {
        'mcp': servers,
        'compression': {
            'enabled': comp.get('enabled', True) is not False,
            'threshold': float(threshold) if isinstance(threshold, (int, float)) else 0.5,
            'threshold_tokens': int(tokens) if isinstance(tokens, int) and tokens > 0 else None,
        },
    }


@router.get('/profile-summary')
async def profile_summary():
    return summarize(_profile_config())
