#!/usr/bin/env python3
"""Выложить результаты прогона на ПК в ветку pc-results/<номер прогона> (один коммит, сжато), чтобы их можно было забрать из
облака (артефакты GitHub из облака недоступны). Запускает .github/workflows/measure.yml после прогона. Игру не меняет.
Забрать: git fetch origin pc-results/<N> && git archive FETCH_HEAD | tar -x -C <папка>; файлы — <метка>/rec_<m>.json.gz"""
import os, sys, json, gzip, shutil, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
req = json.load(open(os.path.join(HERE, 'request.json'), encoding='utf-8'))
run_no = os.environ.get('GITHUB_RUN_NUMBER', 'local'); repo = os.environ.get('GITHUB_REPOSITORY', 'xa11mono/sim-cs2')
tok = os.environ['GITHUB_TOKEN']
tmp = tempfile.mkdtemp(prefix='pcres_')
n = 0
for j in req.get('jobs', []) + req.get('shots', []):
    src = os.path.join(HERE, 'runs', j['label'])
    if not os.path.isdir(src): continue
    os.makedirs(os.path.join(tmp, j['label']))
    for f in sorted(os.listdir(src)):
        if f.endswith('.png') or f.endswith('.txt'):   # (v459) снимки экрана — как есть
            shutil.copy(os.path.join(src, f), os.path.join(tmp, j['label'], f)); n += 1
        elif f.endswith('.json'):
            with open(os.path.join(src, f), 'rb') as a, gzip.open(os.path.join(tmp, j['label'], f + '.gz'), 'wb') as b: shutil.copyfileobj(a, b); n += 1
shutil.copy(os.path.join(HERE, 'request.json'), tmp)
L = os.path.join(os.path.expanduser('~'), 'simcs2_run.log')
if os.path.exists(L): shutil.copy(L, os.path.join(tmp, 'run.log'))
g = lambda *a: subprocess.run(['git'] + list(a), cwd=tmp, check=True)
g('init', '-q'); g('-c', 'core.autocrlf=false', 'add', '-A')
g('-c', 'user.name=pc-runner', '-c', 'user.email=pc-runner@users.noreply.github.com', 'commit', '-q', '-m', 'результаты прогона %s (%d файлов)' % (run_no, n))
g('push', '-q', '--force', 'https://x-access-token:%s@github.com/%s' % (tok, repo), 'HEAD:refs/heads/pc-results/%s' % run_no)
print('pushed pc-results/%s, files %d' % (run_no, n))
