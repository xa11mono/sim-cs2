#!/usr/bin/env python3
"""(шаг 0а) прогон матчей с обычным сторожем (audit/watch.js), сторожем ходьбы (engine/walk_watch.js) и (Б2) знания/стрельбы (engine/know_watch.js).
python3 tools/measure/engine/walk_run.py <метка> --sim=<sim.html> [--matches=3,7,...] [--par=2]
несколько версий одной очередью: --job=<метка>,<sim.html> --job=… (матчи и par — общие)
Пишет tools/measure/runs/<метка>/rec_<m>.json в том же виде, что measure.py (+ поле walk), так что потом работает
measure.py <метка> --no-build --no-play --sim=…  Игру не меняет (только обёртки-записи)."""
import sys, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); MEAS = os.path.dirname(HERE); ROOT = os.path.dirname(os.path.dirname(MEAS))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
matches = [3, 7, 11, 13, 17, 19, 23, 29]; sim = None; par = 2; jobs = []
# (05.11) снимки раундов: --snaps=<метка>,… — базовый прогон пишет снимок в конце каждого раунда в SNAPDIR/<метка>/m<M>.json.gz (вне
# репозитория: checkout чистит неотслеживаемое; в pc-results не идут — большие). --replay=<метка>:<база>:<раунды> — новая версия
# переигрывает только выбранные раунды с теми же снимками (раунды: all | eco (эко и пистолетки T) | ct:eco | tac:<префикс> | 3,7,12)
SNAPDIR = os.environ.get('SIMCS2_SNAPDIR') or os.path.join(os.path.expanduser('~'), 'simcs2_snaps'); SNAPS = set(); REPLAY = {}; TICKS = '200000'
for a in sys.argv[1:]:
    if a.startswith('--matches='): matches = [int(x) for x in a.split('=')[1].split(',')]
    if a.startswith('--sim='): sim = os.path.abspath(a.split('=', 1)[1])
    if a.startswith('--par='): par = int(a.split('=')[1])
    if a.startswith('--job='): l, f = a.split('=', 1)[1].split(',', 1); jobs.append((l, os.path.abspath(f)))
    if a.startswith('--ticks='): TICKS = a.split('=')[1]   # проверка: короткий матч
    if a.startswith('--snaps='): SNAPS.update(a.split('=', 1)[1].split(','))
    if a.startswith('--replay='): l, base, rr = a.split('=', 1)[1].split(':', 2); REPLAY[l] = (base, rr)
if args: jobs.insert(0, (args[0], sim))
for l, f in jobs: os.makedirs(os.path.join(MEAS, 'runs', l), exist_ok=True)
tpl = open(os.path.join(MEAS, 'rec2.js'), encoding='utf-8').read()
watch = open(os.path.join(MEAS, 'audit', 'watch.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'walk_watch.js'), encoding='utf-8').read() \
    + '\n' + open(os.path.join(HERE, 'know_watch.js'), encoding='utf-8').read() \
    + '\n' + open(os.path.join(HERE, 'g_watch.js'), encoding='utf-8').read()   # (Б2) сторож знания и стрельбы; (04.11) счётчики плана 00_PLAN
A = "if(typeof WATCH!=='undefined') WATCH.tick();"; B = "if(typeof WATCH!=='undefined') REC.watch=WATCH.report();"
assert A in tpl and B in tpl
tpl = tpl.replace(A, A + " WALK.tick(); KNOWW.tick(); GWATCH.tick();").replace(B, B + " REC.walk=WALK.report(); REC.know=KNOWW.report(); REC.gw=GWATCH.report();")
# очередь: новый матч начинается сразу, как освободилось место (раньше — пачками по par, пачка ждала самый долгий матч)
import time
import json, gzip, shutil
def pick_rounds(rounds, rr):
    if rr == 'all': return [r['r'] for r in rounds]
    if rr == 'eco': return [r['r'] for r in rounds if r.get('tType') in ('eco', 'pistol')]
    if rr.startswith('ct:'): return [r['r'] for r in rounds if r.get('ctType') in rr[3:].split('+')]
    if rr.startswith('tac:'): return [r['r'] for r in rounds if str(r.get('tac', '')).startswith(rr[4:])]
    return [int(x) for x in rr.split('+') if x]
todo = []
for l, f in jobs:
    for m in matches:
        if l not in REPLAY: todo.append((l, f, m, 0)); continue
        base, rr = REPLAY[l]; sp = os.path.join(SNAPDIR, base, f'm{m}.json.gz')
        if not os.path.exists(sp): print('нет снимков', sp, flush=True); continue
        rounds = json.load(gzip.open(sp, 'rt', encoding='utf-8'))['rounds']
        todo += [(l, f, m, R) for R in pick_rounds(rounds, rr)]
run = []; total = len(todo); fin = 0
def start(l, f, m, R=0):
    src = tpl.replace('__M__', str(m)).replace('__T__', TICKS).replace('/*@@WATCH@@*/', watch)
    if l in SNAPS: src = src.replace('/*@@SNAPS@@*/', 'SNAP_ON = 1;')
    if R:   # переигровка раунда R: снимок конца раунда R−1 (для R = 1 — начало матча)
        snaps = json.load(gzip.open(os.path.join(SNAPDIR, REPLAY[l][0], f'm{m}.json.gz'), 'rt', encoding='utf-8'))['snaps']
        rest = ('mkRestore(mkUnpack(__SNAPTXT)); ' if str(R) in snaps else 'freshMatch(%d); ' % m) + 'R_END=%d;' % R
        src = ('var __SNAPTXT=' + json.dumps(snaps[str(R)]['s']) + ';\n' if str(R) in snaps else '') + src.replace('freshMatch(%d);' % m, rest, 1)
        js = os.path.join(MEAS, 'runs', l, f'_rec_{m}_r{R}.js'); open(js, 'w', encoding='utf-8').write(src)
        fo = open(os.path.join(MEAS, 'runs', l, f'rec_{m}_r{R}.json'), 'w', encoding='utf-8')
        return [subprocess.Popen(['node', 'src/q.js', f, '@' + js], cwd=ROOT, stdout=fo), fo, l, m, time.time(), R]
    # (Б2) код матча — файлом («@путь»): со сторожем знания он длиннее предела командной строки Windows (32 767 знаков)
    js = os.path.join(MEAS, 'runs', l, f'_rec_{m}.js'); open(js, 'w', encoding='utf-8').write(src)
    fo = open(os.path.join(MEAS, 'runs', l, f'rec_{m}.json'), 'w', encoding='utf-8')
    return [subprocess.Popen(['node', 'src/q.js', f, '@' + js], cwd=ROOT, stdout=fo), fo, l, m, time.time(), 0]   # без `timeout`: на Windows его нет
def split_snaps(l, m):
    # снимки — из записи в SNAPDIR (с раундами — для выбора при переигровке), запись — без них
    fn = os.path.join(MEAS, 'runs', l, f'rec_{m}.json')
    try: d = json.load(open(fn, encoding='utf-8'))
    except Exception: return
    sn = d.pop('snaps', None)
    if sn is None: return
    os.makedirs(os.path.join(SNAPDIR, l), exist_ok=True)
    with gzip.open(os.path.join(SNAPDIR, l, f'm{m}.json.gz'), 'wt', encoding='utf-8') as g: json.dump({'rounds': d.get('rounds', []), 'snaps': sn}, g)
    json.dump(d, open(fn, 'w', encoding='utf-8'))
# место на диске: хранить снимки последних SNAP_KEEP базовых прогонов
SNAP_KEEP = 4
if SNAPS and os.path.isdir(SNAPDIR):
    old_l = sorted((os.path.getmtime(os.path.join(SNAPDIR, d)), d) for d in os.listdir(SNAPDIR) if d not in SNAPS)
    for _, d in old_l[:max(0, len(old_l) - (SNAP_KEEP - len(SNAPS)))]: shutil.rmtree(os.path.join(SNAPDIR, d), ignore_errors=True)
T0 = time.time()
print(f'матчей в очереди: {total}, одновременно: {par}', flush=True)
while todo or run:
    while todo and len(run) < par: run.append(start(*todo.pop(0)))
    time.sleep(1)
    for r in run[:]:
        p, fo, l, m, t0, R = r
        if p.poll() is None and time.time() - t0 < 2400: continue
        if p.poll() is None: p.kill(); p.wait()
        fo.close(); run.remove(r)
        fin += 1
        if l in SNAPS and not R: split_snaps(l, m)
        rf = os.path.join(MEAS, 'runs', l, f'rec_{m}_r{R}.json' if R else f'rec_{m}.json')
        # (05.11, ранний стоп) половина готова — промежуточная выкладка (pc-results/<N>-half): можно сравнить и, если явно хуже, отменить прогон
        if fin == total // 2 and total >= 8 and os.environ.get('GITHUB_TOKEN'):
            subprocess.run([sys.executable, os.path.join(MEAS, 'publish_results.py'), '--part=half'], cwd=ROOT)
        print(l, 'match', m, ('round %d ' % R) if R else '', 'rc', p.returncode, os.path.getsize(rf),
              f'— готово {fin}/{total}, {round((time.time() - T0)/60)} мин', flush=True)
print('done')
