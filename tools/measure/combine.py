#!/usr/bin/env python3
"""Сводка по нескольким прогонам и разброс между матчами.
python3 tools/measure/combine.py <версияA:прогон1,прогон2> <версияB:прогон1,прогон2> [...]
Например: combine.py v168:v168_base,v168_n8 v169:v169_knowledge,v169_n8
Печатает метрики по всем матчам версии вместе и для ключевых метрик —
разброс между матчами: среднее по матчам ± стандартная ошибка, и
«шум или нет»: разница версий больше двух стандартных ошибок разницы."""
import sys, os, json, glob
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
G = {}
for f in ('metrics.py', 'extra.py', 'mech.py'):
    src = '\n'.join(l for l in open(f).read().split('\n') if not l.startswith("exec(open('metrics.py')"))
    exec(src.split("\nif __name__")[0], G)
exec(open('stack.py').read(), G)
KEY = ['CT выиграли раундов %', 'раундов с 3+ фрагами у одного %', 'CT: смертей до 45 с (до планта)',
       'T: смертей до 45 с (до планта)', 'разменяли за 3 с %', 'смерть до планта: рядом (≤350px) был свой %',
       'клатч выигран %', 'время планта, медиана с']
def nades_ct(files):
    n = r = 0
    for f in files:
        d = json.load(open(f)); n += sum(1 for x in d['nades'] if x[1] == 'CT'); r += len([x for x in d['rounds'] if 't1' in x])
    return n / max(1, r)
def look_flick(files):
    # «взгляд туда-обратно >45° в минуту» — та же метрика, что в отчёте
    try: return G['smooth'](G['bot_yaw'](files)).get('взгляд туда-обратно >45° (на минуту)')
    except Exception: return None
for f in ('smooth.py',):
    src = '\n'.join(l for l in open(f).read().split('\n') if not l.startswith("exec(open('metrics.py')"))
    exec(src.split("\nif __name__")[0], G)
def per(files):
    R, K, P = G['load_bot'](files)
    M = G['metrics'](R, K, P, 'bot'); M.update(G['extra'](R, K, P)); M.update(G['stack_react'](R, P))
    M['гранат за раунд: CT'] = round(nades_ct(files), 2)
    M['взгляд туда-обратно >45° (на минуту)'] = look_flick(files)
    return M
KEY += ['гранат за раунд: CT', 'взгляд туда-обратно >45° (на минуту)', 'стак: CT уходят от сайта за 5 с %', 'стак: CT на сайте через 5 с']
res = {}
for arg in sys.argv[1:]:
    name, runs = arg.split(':')
    files = sorted(sum([glob.glob(os.path.join(HERE, 'runs', r, 'rec_*.json')) for r in runs.split(',')], []))
    files = [f for f in files if os.path.getsize(f) > 0]
    allM = per(files)
    pm = [per([f]) for f in files]
    res[name] = (len(files), allM, pm)
names = list(res)
print(f"{'метрика':48s}" + ''.join(f"{n+' ('+str(res[n][0])+' м.)':>22s}" for n in names) + '   шум?')
for k in KEY:
    row = f"{k[:48]:48s}"; ms = []
    for n in names:
        vals = [m.get(k) for m in res[n][2] if isinstance(m.get(k), (int, float)) and m.get(k) == m.get(k)]
        se = np.std(vals, ddof=1) / np.sqrt(len(vals)) if len(vals) > 1 else float('nan')
        ms.append((np.mean(vals) if vals else float('nan'), se))
        row += f"{str(res[n][1].get(k)):>10s} (±{se:5.2f})    "
    if len(ms) >= 2:
        d = ms[-1][0] - ms[0][0]; sd = np.hypot(ms[-1][1], ms[0][1])
        row += ('не шум' if abs(d) > 2 * sd else 'в пределах разброса') + f" (разница {d:+.2f}, 2σ={2*sd:.2f})"
    print(row)
