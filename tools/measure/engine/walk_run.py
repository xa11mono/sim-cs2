#!/usr/bin/env python3
"""(шаг 0а) прогон матчей с обычным сторожем (audit/watch.js) и сторожем ходьбы (engine/walk_watch.js).
python3 tools/measure/engine/walk_run.py <метка> --sim=<sim.html> [--matches=3,7,...] [--par=2]
Пишет tools/measure/runs/<метка>/rec_<m>.json в том же виде, что measure.py (+ поле walk), так что потом работает
measure.py <метка> --no-build --no-play --sim=…  Игру не меняет (только обёртки-записи)."""
import sys, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); MEAS = os.path.dirname(HERE); ROOT = os.path.dirname(os.path.dirname(MEAS))
args = [a for a in sys.argv[1:] if not a.startswith('--')]; label = args[0]
matches = [3, 7, 11, 13, 17, 19, 23, 29]; sim = None; par = 2
for a in sys.argv[1:]:
    if a.startswith('--matches='): matches = [int(x) for x in a.split('=')[1].split(',')]
    if a.startswith('--sim='): sim = os.path.abspath(a.split('=', 1)[1])
    if a.startswith('--par='): par = int(a.split('=')[1])
OUT = os.path.join(MEAS, 'runs', label); os.makedirs(OUT, exist_ok=True)
tpl = open(os.path.join(MEAS, 'rec2.js'), encoding='utf-8').read()
watch = open(os.path.join(MEAS, 'audit', 'watch.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'walk_watch.js'), encoding='utf-8').read()
A = "if(typeof WATCH!=='undefined') WATCH.tick();"; B = "if(typeof WATCH!=='undefined') REC.watch=WATCH.report();"
assert A in tpl and B in tpl
tpl = tpl.replace(A, A + " WALK.tick();").replace(B, B + " REC.walk=WALK.report();")
for i in range(0, len(matches), par):
    ps = []
    for m in matches[i:i+par]:
        src = tpl.replace('__M__', str(m)).replace('__T__', '200000').replace('/*@@WATCH@@*/', watch)
        fo = open(os.path.join(OUT, f'rec_{m}.json'), 'w', encoding='utf-8')
        ps.append((subprocess.Popen(['node', 'src/q.js', sim, src], cwd=ROOT, stdout=fo), fo, m))   # без `timeout`: на Windows его нет
    for p, fo, m in ps:
        try: p.wait(timeout=2400)
        except subprocess.TimeoutExpired: p.kill(); p.wait()
        fo.close(); print('match', m, 'rc', p.returncode, os.path.getsize(os.path.join(OUT, f'rec_{m}.json')), flush=True)
print('done')
