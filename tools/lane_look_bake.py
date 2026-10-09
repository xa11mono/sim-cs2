#!/usr/bin/env python3
"""Взгляд про на местах полос дефолта T (v224): для каждого места spots в setups.json → t[].default.lanes
средний взгляд стоящих T из data/pro/pro_samples.csv.gz (phase early/setup/late — до планта), ближе R ед. карты.
Пишет взгляд 4-м и 5-м числом места: [x, y, доля, dx, dy] (единичный вектор; нет снимков — место без взгляда).
python3 tools/lane_look_bake.py  — меняет только spots в src/data/setups.json, остальное не трогает."""
import os, json, math
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R, MIN_N = 50, 20
p = pd.read_csv(os.path.join(ROOT, 'data', 'pro', 'pro_samples.csv.gz'))
p = p[(p.side == 'T') & (p.phase != 'post') & p.still]
X, Y, DX, DY = p.x.values, p.y.values, p.dx.values, p.dy.values
path = os.path.join(ROOT, 'src', 'data', 'setups.json')
lines = open(path, encoding='utf-8').read().split('\n')
n_all = n_ok = 0
for k, l in enumerate(lines):
    if not l.startswith('  {"id":"t_exec_'):
        continue
    trail = l.endswith(',')
    o = json.loads(l.rstrip(','))
    for lane in (o.get('default') or {}).get('lanes', []):
        for sp in lane['spots']:
            n_all += 1
            m = np.hypot(X - sp[0], Y - sp[1]) <= R
            if m.sum() < MIN_N:
                del sp[3:]
                continue
            dx, dy = float(DX[m].mean()), float(DY[m].mean()); L = math.hypot(dx, dy) or 1
            sp[3:] = [round(dx / L, 3), round(dy / L, 3)]
            n_ok += 1
    lines[k] = '  ' + json.dumps(o, ensure_ascii=False, separators=(',', ':')) + (',' if trail else '')
open(path, 'w', encoding='utf-8').write('\n'.join(lines))
print('мест', n_all, 'со взглядом', n_ok)
