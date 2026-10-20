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

# вне папки репо: открытый Get-Content -Wait держит файл, и GitHub не мог почистить папку перед следующим заданием
LOG = os.path.join(os.path.expanduser('~'), 'simcs2_run.log')   # смотреть на ПК: Get-Content $HOME\simcs2_run.log -Wait -Encoding UTF8
def log(line):
    print(line, flush=True)
    with open(LOG, 'a', encoding='utf-8') as f: f.write(line + '\n')
def sh(args, **kw):
    log('> ' + ' '.join(str(a) for a in args))
    p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', **kw)
    for line in p.stdout: log(line.rstrip())
    if p.wait(): raise subprocess.CalledProcessError(p.returncode, args)

PW_VER = '1.56.0'   # та же версия, что в облаке (Chromium 1194): другая версия браузера — другой движок JS, матчи расходятся
def ensure_playwright():
    # playwright — вне папки репо, чтобы чистка рабочей папки исполнителем его не стирала
    home = os.path.join(os.path.expanduser('~'), '.simcs2_node')
    pj = os.path.join(home, 'node_modules', 'playwright', 'package.json')
    have = json.load(open(pj, encoding='utf-8')).get('version') if os.path.exists(pj) else None
    if have != PW_VER:
        os.makedirs(home, exist_ok=True)
        npm = shutil.which('npm') or shutil.which('npm.cmd')
        sh([npm, 'install', '--prefix', home, 'playwright@' + PW_VER])
        npx = os.path.join(home, 'node_modules', '.bin', 'playwright.cmd' if os.name == 'nt' else 'playwright')
        sh([npx, 'install', 'chromium'], cwd=home)
    os.environ['NODE_PATH'] = os.path.join(home, 'node_modules')
    log('playwright ' + PW_VER)

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
    open(LOG, 'w', encoding='utf-8').close()
    req = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'request.json'), encoding='utf-8'))
    ensure_playwright()
    par = int(req.get('par', 6)); sims = os.path.join(ROOT, 'tools', 'measure', 'runs', '_sims'); os.makedirs(sims, exist_ok=True)
    # сначала собрать все версии, потом все матчи одной очередью (освободилось место — сразу следующий матч любой версии)
    jobargs = []; mset = None
    for j in req['jobs']:
        sim = os.path.join(sims, j['label'] + '.html')
        build(j['ref'], j.get('map', 'ancient'), sim); jobargs.append('--job=%s,%s' % (j['label'], sim))
        m = ','.join(str(x) for x in j.get('matches', [3, 7, 11, 13, 17, 19, 23, 29]))
        assert mset in (None, m), 'у всех заданий — одни и те же матчи'; mset = m
    sh([PY, os.path.join(HERE, 'engine', 'walk_run.py')] + jobargs + ['--matches=' + mset, '--par=%d' % par], cwd=ROOT)
    log('all done')

if __name__ == '__main__':
    main()
