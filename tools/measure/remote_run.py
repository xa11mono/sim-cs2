#!/usr/bin/env python3
"""Прогоны замера на ПК владельца (исполнитель GitHub, .github/workflows/measure.yml). Игру не меняет.
Задание — tools/measure/request.json в ветке measure/<что-угодно>:
  {"par": 6, "jobs": [{"label": "b1fix_anc", "ref": "b1-walk-who", "map": "ancient", "matches": [3,7,11,13,17,19,23,29]}, ...]}
ref — ветка или коммит, чью игру играть; инструменты замера (сторож, раннер) берутся из текущей ветки measure/…
Для каждого задания: сборка игры ref во временную папку → walk_run.py (сторож ходьбы + обычный сторож) → tools/measure/runs/<label>/.
Папку runs исполнитель выкладывает артефактом. Запуск руками: python tools/measure/remote_run.py [путь к request.json]"""
import sys, os, json, subprocess, shutil, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
PY = sys.executable

def sh(args, **kw):
    print('>', ' '.join(str(a) for a in args), flush=True)
    subprocess.run(args, check=True, **kw)

def ensure_playwright():
    # playwright — вне папки репо, чтобы чистка рабочей папки исполнителем его не стирала
    home = os.path.join(os.path.expanduser('~'), '.simcs2_node')
    if not os.path.isdir(os.path.join(home, 'node_modules', 'playwright')):
        os.makedirs(home, exist_ok=True)
        npm = shutil.which('npm') or shutil.which('npm.cmd')
        sh([npm, 'install', '--prefix', home, 'playwright'])
        npx = shutil.which('npx') or shutil.which('npx.cmd')
        sh([npx, 'playwright', 'install', 'chromium'], cwd=home)
    os.environ['NODE_PATH'] = os.path.join(home, 'node_modules')

def build(ref, mapname, out):
    tmp = tempfile.mkdtemp(prefix='simbuild_')
    try:
        sh(['git', 'fetch', '--quiet', 'origin', ref], cwd=ROOT)
        sh(['git', '-c', 'core.autocrlf=false', 'worktree', 'add', '--quiet', '--detach', '--force', tmp, 'FETCH_HEAD'], cwd=ROOT)
        # без CRLF: Git для Windows по умолчанию меняет концы строк — сборка была бы не та, что в облаке
        sh([PY, os.path.join(tmp, 'src', 'build.py'), '--map', mapname, out], cwd=tmp)
    finally:
        subprocess.run(['git', 'worktree', 'remove', '--force', tmp], cwd=ROOT)

def main():
    req = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'request.json'), encoding='utf-8'))
    ensure_playwright()
    par = int(req.get('par', 6)); sims = os.path.join(ROOT, 'tools', 'measure', 'runs', '_sims'); os.makedirs(sims, exist_ok=True)
    for j in req['jobs']:
        sim = os.path.join(sims, j['label'] + '.html')
        build(j['ref'], j.get('map', 'ancient'), sim)
        m = ','.join(str(x) for x in j.get('matches', [3, 7, 11, 13, 17, 19, 23, 29]))
        sh([PY, os.path.join(HERE, 'engine', 'walk_run.py'), j['label'], '--sim=' + sim, '--matches=' + m, '--par=%d' % par], cwd=ROOT)
    print('all done', flush=True)

if __name__ == '__main__':
    main()
