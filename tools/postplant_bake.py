#!/usr/bin/env python3
"""Пост-плант T из демок про: где T стоят после планта на каждом сайте и куда смотрят.
python3 tools/postplant_bake.py  → src/data/postplant.json
Источник — data/pro/pro_samples.csv.gz (tools/pro.py): снимки игроков, phase=post — после планта,
site — сайт бомбы, still — стоит (скорость < 25), dx/dy — направление взгляда.
Место — клетка CELL ед. карты со стоящими T, соседние клетки ближе MERGE сливаются; берутся до MAXN
самых частых мест (не реже MIN_SHARE стоящих снимков сайта). share — доля стоящих снимков сайта,
look — средний взгляд стоящих там (единичный вектор), zone — зона-колл (zonemap)."""
import os, sys, json, math
import numpy as np, pandas as pd
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools')); sys.argv = sys.argv[:1]
import positions_bake as pb
CELL, MERGE, MAXN, MIN_SHARE = 30, 60, 12, 0.01
p = pd.read_csv(os.path.join(ROOT, 'data', 'pro', 'pro_samples.csv.gz'))
p = p[(p.side == 'T') & (p.phase == 'post') & p.still]
out = {}
for site in ('A', 'B'):
    d = p[p.site == site]
    n = len(d)
    cx, cy = np.round(d.x / CELL).astype(int), np.round(d.y / CELL).astype(int)
    cells = d.assign(cx=cx, cy=cy).groupby(['cx', 'cy'])
    cl = sorted(((len(g), g) for _, g in cells), key=lambda t: -t[0])
    spots = []
    for k, g in cl:
        x, y = float(g.x.median()), float(g.y.median())
        hit = [s for s in spots if math.hypot(s['_x'] - x, s['_y'] - y) < MERGE]
        if hit:
            s = hit[0]; s['_g'].append(g); s['_n'] += k
            continue
        if len(spots) >= MAXN * 3:
            continue
        spots.append({'_x': x, '_y': y, '_g': [g], '_n': k})
    res = []
    for s in sorted(spots, key=lambda s: -s['_n']):
        if s['_n'] / n < MIN_SHARE or len(res) >= MAXN:
            break
        g = pd.concat(s['_g'])
        lx, ly = float(g.dx.mean()), float(g.dy.mean()); L = math.hypot(lx, ly) or 1
        x, y = float(g.x.median()), float(g.y.median())
        res.append({'x': round(x, 1), 'y': round(y, 1), 'share': round(s['_n'] / n, 3),
                    'look': [round(lx / L, 3), round(ly / L, 3)], 'zone': pb.zone_at(x, y)['name']})
    out[site] = res
about = [__doc__.strip().split('\n')[0], 'Делает tools/postplant_bake.py из data/pro/pro_samples.csv.gz; читает 12_t_default.js (пост-плант T).',
         'spots: x, y — место (медиана), share — доля стоящих после планта снимков T этого сайта, look — средний взгляд, zone — зона.']
json.dump({'_about': about, 'A': out['A'], 'B': out['B']}, open(os.path.join(ROOT, 'src', 'data', 'postplant.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
for k in ('A', 'B'):
    print(k, len(out[k]), [(s['zone'], s['share']) for s in out[k]])
