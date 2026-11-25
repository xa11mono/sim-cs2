"""(Р2.1, 25.11) Сборка, на которой записана отметка: старая отметка открывается своей сборкой (условие владельца к Р2 — «сохранить
старую сборку и возможность воспроизводить старые отметки»).

  python3 tools/marks/mark_build.py --src=<отпечаток> --map=<карта> [--out=файл] [--depth=400]
  python3 tools/marks/mark_build.py --commit=<коммит | метка, напр. pre-dmath> --map=<карта> [--out=файл]
  python3 tools/marks/mark_build.py --hash=<коммит>      — только отпечаток исходника игры этого коммита

Отпечаток (env.src отметки, MK_BUILD страницы, src/marks_build.py) — sha256 склейки исходника игры и модулей (.ts — без типов), первые
16 знаков. По --src ищется коммит с тем же отпечатком: сначала архив сборок (ветка origin/builds, index.json), потом история git
(коммиты, менявшие src/game или rebuild/modules.json). Сборка — src/build.py того коммита во временной папке git (как на ПК,
tools/measure/remote_run.py build): тот же исходник даёт тот же sim.html (кроме имени временной папки esbuild в комментариях, Р1-2).
"""
import hashlib, json, os, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PY = sys.executable


def git(*a, binary=False):
    r = subprocess.run(['git'] + list(a), cwd=ROOT, capture_output=True)
    if r.returncode: raise RuntimeError('git %s: %s' % (' '.join(a), r.stderr.decode('utf-8', 'replace')))
    return r.stdout if binary else r.stdout.decode('utf-8')


def strip_ts(data):
    with tempfile.NamedTemporaryFile(suffix='.ts', delete=False) as f: f.write(data); p = f.name
    try:
        r = subprocess.run(['node', os.path.join(ROOT, 'tools', 'rebuild', 'game_src.js'), 'strip', p], capture_output=True)
        if r.returncode: raise RuntimeError(r.stderr.decode('utf-8', 'replace'))
        return r.stdout
    finally: os.unlink(p)


def src_hash(commit):
    """Отпечаток исходника игры коммита — так же, как src/marks_build.py inject (game_source() + module_source())."""
    names = [l.split('\t', 1)[1] for l in git('ls-tree', commit, 'src/game/').splitlines() if '\t' in l]
    files = sorted(os.path.basename(n) for n in names if n.endswith(('.html', '.js', '.ts')))
    try: mods = json.loads(git('show', '%s:rebuild/modules.json' % commit)).get('modules', [])
    except Exception: mods = []
    def read(f):
        b = git('show', '%s:src/game/%s' % (commit, f), binary=True)
        return strip_ts(b) if f.endswith('.ts') else b
    game = b''.join(('/*@@MODINIT %s@@*/\n' % f).encode('utf-8') if f in mods else read(f) for f in files)
    mod = b''.join(read(f) for f in sorted(mods))
    return hashlib.sha256(game + mod).hexdigest()[:16]


def find(src, depth):
    try:
        idx = json.loads(git('show', 'origin/builds:index.json'))
        if src in idx: return idx[src]['commit']
    except Exception: pass
    seen = set()
    for c in git('log', '--all', '--format=%H', '-n', str(depth), '--', 'src/game', 'rebuild/modules.json').split():
        if c in seen: continue
        seen.add(c)
        try:
            if src_hash(c) == src: return c
        except Exception: continue
    return None


def build(commit, mapname, out):
    tmp = tempfile.mkdtemp(prefix='markbuild_')
    try:
        git('-c', 'core.autocrlf=false', 'worktree', 'add', '--quiet', '--detach', '--force', tmp, commit)
        nm = os.path.join(ROOT, 'tools', 'rebuild', 'node_modules'); nmw = os.path.join(tmp, 'tools', 'rebuild', 'node_modules')
        if os.path.isdir(nm) and not os.path.exists(nmw): os.symlink(nm, nmw, target_is_directory=True)
        r = subprocess.run([PY, os.path.join(tmp, 'src', 'build.py'), '--map', mapname, os.path.abspath(out)], cwd=tmp, capture_output=True)
        if r.returncode: raise RuntimeError('сборка %s: %s' % (commit, r.stderr.decode('utf-8', 'replace')[-600:]))
    finally:
        try: os.unlink(os.path.join(tmp, 'tools', 'rebuild', 'node_modules'))
        except OSError: pass
        subprocess.run(['git', 'worktree', 'remove', '--force', tmp], cwd=ROOT, capture_output=True)


if __name__ == '__main__':
    A = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    if 'hash' in A: print(src_hash(git('rev-parse', A['hash']).strip())); sys.exit(0)
    if not A.get('map') or not (A.get('src') or A.get('commit')): print(__doc__); sys.exit(2)
    commit = git('rev-parse', A['commit']).strip() if A.get('commit') else find(A['src'], int(A.get('depth', 400)))
    if not commit: print('коммит с отпечатком %s не найден (архив origin/builds и %s последних коммитов)' % (A['src'], A.get('depth', 400))); sys.exit(1)
    out = A.get('out') or os.path.join(tempfile.gettempdir(), 'sim_%s_%s.html' % (A['map'], commit[:10]))
    build(commit, A['map'], out)
    print('коммит %s, отпечаток %s → %s' % (commit[:12], src_hash(commit), out))
