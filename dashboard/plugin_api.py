"""Read-only git summary for the Session pane's Changes card.

Runs `git status` and `git diff --numstat` in a folder the desktop passes in.
Nothing is written; folders that are not git work trees return an empty list.
"""
import asyncio
import os

from fastapi import APIRouter, HTTPException

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
