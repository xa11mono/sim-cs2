#!/usr/bin/env python3
"""Куда смотрят CT, стоя на точке (v228, правка владельца 6 / В17): для каждой CT-точки positions.json — направления,
которые про держат с неё по очереди, и доля времени на каждом. Из data/pro/pro_samples.csv.gz: стоящие CT до планта
(phase != post) ближе R px к точке; взгляды — гистограмма по 10°, сглаженная, пики ≥ MIN_SHARE, не ближе SEP° друг к
другу; доля пика — снимки в ±SEP/2 от него. Пишет в точку "looks": [[dx, dy, доля], …] (по убыванию доли).
python3 tools/ct_look_bake.py — меняет только строки CT-точек в src/data/positions.json."""
import os, json, math
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R, MIN_N, MIN_SHARE, SEP = 50, 40, 0.10, 40
p = pd.read_csv(os.path.join(ROOT, 'data', 'pro', 'pro_samples.csv.gz'))
p = p[(p.side == 'CT') & (p.phase != 'post') & p.still]
X, Y = p.x.values, p.y.values
A = np.degrees(np.arctan2(p.dy.values, p.dx.values)) % 360
path = os.path.join(ROOT, 'src', 'data', 'positions.json')
lines = open(path, encoding='utf-8').read().split('\n')
n_pt = n_multi = 0
for k, l in enumerate(lines):
    if not l.startswith('  {"id":"ct_'):
        continue
    trail = l.endswith(',')
    o = json.loads(l.rstrip(','))
    m = np.hypot(X - o['x'], Y - o['y']) <= R
    o.pop('looks', None)
    if m.sum() >= MIN_N:
        a = A[m]
        h = np.histogram(a, bins=36, range=(0, 360))[0].astype(float)
        hs = (np.roll(h, 1) + 2 * h + np.roll(h, -1)) / 4
        peaks = []
        for i in np.argsort(-hs):
            c = i * 10 + 5
            if any(abs((c - q + 180) % 360 - 180) < SEP for q in peaks):
                continue
            share = float((abs((a - c + 180) % 360 - 180) <= SEP / 2).mean())
            if share < MIN_SHARE:
                break
            peaks.append(c)
        looks = []
        for c in peaks:
            sel = a[abs((a - c + 180) % 360 - 180) <= SEP / 2]
            mc = math.degrees(math.atan2(np.sin(np.radians(sel)).mean(), np.cos(np.radians(sel)).mean()))
            looks.append([round(math.cos(math.radians(mc)), 3), round(math.sin(math.radians(mc)), 3), round(len(sel) / len(a), 2)])
        if looks:
            o['looks'] = looks
            n_pt += 1
            n_multi += len(looks) > 1
    lines[k] = json.dumps(o, ensure_ascii=False, separators=(',', ':')) + (',' if trail else '')
    lines[k] = '  ' + lines[k]
open(path, 'w', encoding='utf-8').write('\n'.join(lines))
print('CT-точек со взглядами:', n_pt, ', из них с 2+ направлениями:', n_multi)
