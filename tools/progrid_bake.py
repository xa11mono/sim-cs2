#!/usr/bin/env python3
"""Сетка «где обычно стоят про» (v237, перенос proAt из v166): по data/pro/pro_samples.csv.gz — стоящие игроки до планта
(phase != post, still) по сторонам, клетка CELL px радара; значение — доля снимков в клетке, делённая на 95-й процентиль
непустых клеток (0..1, выше — 1). python3 tools/progrid_bake.py → src/data/progrid.json"""
import os, json
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL, N = 24, 86   # 86 × 24 ≈ 2064 px — вся карта
p = pd.read_csv(os.path.join(ROOT, 'data', 'pro', 'pro_samples.csv.gz'))
p = p[(p.phase != 'post') & p.still]
out = {'cell': CELL, 'n': N}
for side in ('CT', 'T'):
    d = p[p.side == side]
    cx = np.clip((d.x // CELL).astype(int), 0, N - 1); cy = np.clip((d.y // CELL).astype(int), 0, N - 1)
    g = np.zeros((N, N)); np.add.at(g, (cy.values, cx.values), 1)
    nz = g[g > 0]; ref = np.percentile(nz, 95) if len(nz) else 1
    out[side] = [round(float(v), 2) for v in np.minimum(1, g / ref).ravel()]
json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'progrid.json'), 'w'), separators=(',', ':'))
print('клеток', N * N, 'непустых CT', sum(1 for v in out['CT'] if v > 0), 'T', sum(1 for v in out['T'] if v > 0))
