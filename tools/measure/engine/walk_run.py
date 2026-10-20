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
for a in sys.argv[1:]:
    if a.startswith('--matches='): matches = [int(x) for x in a.split('=')[1].split(',')]
    if a.startswith('--sim='): sim = os.path.abspath(a.split('=', 1)[1])
    if a.startswith('--par='): par = int(a.split('=')[1])
    if a.startswith('--job='): l, f = a.split('=', 1)[1].split(',', 1); jobs.append((l, os.path.abspath(f)))
if args: jobs.insert(0, (args[0], sim))
for l, f in jobs: os.makedirs(os.path.join(MEAS, 'runs', l), exist_ok=True)
tpl = open(os.path.join(MEAS, 'rec2.js'), encoding='utf-8').read()
watch = open(os.path.join(MEAS, 'audit', 'watch.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'walk_watch.js'), encoding='utf-8').read() \
    + '\n' + open(os.path.join(HERE, 'know_watch.js'), encoding='utf-8').read()   # (Б2) сторож знания и стрельбы
A = "if(typeof WATCH!=='undefined') WATCH.tick();"; B = "if(typeof WATCH!=='undefined') REC.watch=WATCH.report();"
assert A in tpl and B in tpl
tpl = tpl.replace(A, A + " WALK.tick(); KNOWW.tick();").replace(B, B + " REC.walk=WALK.report(); REC.know=KNOWW.report();")
# очередь: новый матч начинается сразу, как освободилось место (раньше — пачками по par, пачка ждала самый долгий матч)
import time
todo = [(l, f, m) for l, f in jobs for m in matches]; run = []; total = len(todo); fin = 0
def start(l, f, m):
    src = tpl.replace('__M__', str(m)).replace('__T__', '200000').replace('/*@@WATCH@@*/', watch)
    fo = open(os.path.join(MEAS, 'runs', l, f'rec_{m}.json'), 'w', encoding='utf-8')
    return [subprocess.Popen(['node', 'src/q.js', f, src], cwd=ROOT, stdout=fo), fo, l, m, time.time()]   # без `timeout`: на Windows его нет
T0 = time.time()
print(f'матчей в очереди: {total}, одновременно: {par}', flush=True)
while todo or run:
    while todo and len(run) < par: run.append(start(*todo.pop(0)))
    time.sleep(1)
    for r in run[:]:
        p, fo, l, m, t0 = r
        if p.poll() is None and time.time() - t0 < 2400: continue
        if p.poll() is None: p.kill(); p.wait()
        fo.close(); run.remove(r)
        fin += 1
        print(l, 'match', m, 'rc', p.returncode, os.path.getsize(os.path.join(MEAS, 'runs', l, f'rec_{m}.json')),
              f'— готово {fin}/{total}, {round((time.time() - T0)/60)} мин', flush=True)
print('done')
