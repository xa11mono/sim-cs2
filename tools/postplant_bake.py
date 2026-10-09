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
CELL, MERGE, MAXN, MIN_SHARE = 30, 60, 30, 0.005   # v230: было 12 мест и 1 % — покрывали ~половину снимков, и всё у бомбы
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
# v230 (правка владельца 5): где T стоят — зависит от того, где лежит бомба (у бомбы на «дефолтном» планте стоят
# не так, как при планте в углу). Из тиков всех демок: раунды с плантом, T живые и стоящие (сдвиг < 3 px за 0,25 с)
# после планта, раз в 0,5 с; бомба — место планта (bomb_planted). Планты сайта — кучки (BOMB_R px, ≥ BOMB_MIN
# раундов); для каждой кучки — доля стоящих снимков T на каждом месте (ближе MERGE): spot['byBomb'] = [доля по кучкам]
BOMB_R, BOMB_MIN = 90, 25
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import ancient_demos as AD
SITE_XY = {'A': (630, 518), 'B': (1533, 845)}
def tr(X, Y): return ((np.asarray(X) + 2953) / 5 * 2, (2164 - np.asarray(Y)) / 5 * 2)
rows = {'A': [], 'B': []}   # (bx, by, [(x, y), ...]) по раундам
import glob
for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'demos', '*_ticks.csv.gz'))):
    base = f[:-len('_ticks.csv.gz')]
    try:
        bp = pd.read_csv(base + '_bomb_planted.csv.gz'); re_ = pd.read_csv(base + '_round_end.csv.gz')
    except FileNotFoundError:
        continue
    if not len(bp):
        continue
    t = pd.read_csv(f, usecols=['tick', 'steamid', 'X', 'Y', 'team_num', 'is_alive', 'is_warmup_period'])
    t = t[(~t.is_warmup_period) & t.is_alive & (t.team_num == 2) & (t.tick % 16 == 0)].sort_values(['steamid', 'tick'])
    t['x'], t['y'] = tr(t.X.values, t.Y.values)
    for b in bp.itertuples():
        bx, by = tr(b.user_X, b.user_Y); bx, by = float(bx), float(by)
        site = min(SITE_XY, key=lambda k: math.hypot(SITE_XY[k][0] - bx, SITE_XY[k][1] - by))
        e = re_[re_.tick > b.tick].tick.min()
        g = t[(t.tick > b.tick) & (t.tick <= (e if e == e else b.tick + 40 * 64))]
        pts = []
        for sid, q in g.groupby('steamid'):
            tk, x, y = q.tick.values, q.x.values, q.y.values
            ok = (tk[1:] - tk[:-1] == 16) & (np.hypot(x[1:] - x[:-1], y[1:] - y[:-1]) < 3) & (tk[1:] % 32 == 0)
            pts += list(zip(x[1:][ok], y[1:][ok]))
        if pts:
            rows[site].append((bx, by, pts))
for site in ('A', 'B'):
    R = rows[site]; clusters = []
    for bx, by, pts in sorted(R, key=lambda r: 0):
        c = next((c for c in clusters if math.hypot(c['x'] - bx, c['y'] - by) < BOMB_R), None)
        if c is None:
            c = {'x': bx, 'y': by, 'r': []}; clusters.append(c)
        c['r'].append((bx, by, pts))
    clusters = [c for c in clusters if len(c['r']) >= BOMB_MIN]
    for c in clusters:
        c['x'] = round(float(np.median([r[0] for r in c['r']])), 1); c['y'] = round(float(np.median([r[1] for r in c['r']])), 1)
    for sp in out[site]:
        sp['byBomb'] = []
    for c in clusters:
        P = np.array([p for r in c['r'] for p in r[2]])
        for sp in out[site]:
            sp['byBomb'].append(round(float((np.hypot(P[:, 0] - sp['x'], P[:, 1] - sp['y']) < MERGE).mean()), 3))
    out[site + '_bombs'] = [{'x': c['x'], 'y': c['y'], 'rounds': len(c['r'])} for c in clusters]
    print(site, 'раундов с плантом', len(R), 'кучек бомбы', [(c['x'], c['y'], len(c['r'])) for c in clusters])
about = [__doc__.strip().split('\n')[0], 'Делает tools/postplant_bake.py из data/pro/pro_samples.csv.gz; читает 12_t_default.js (пост-плант T).',
         'spots: x, y — место (медиана), share — доля стоящих после планта снимков T этого сайта, look — средний взгляд, zone — зона;',
         'byBomb — та же доля, но в раундах, где бомба лежала в кучке A_bombs/B_bombs[i] (v230).']
json.dump({'_about': about, 'A': out['A'], 'B': out['B'], 'A_bombs': out['A_bombs'], 'B_bombs': out['B_bombs']}, open(os.path.join(ROOT, 'src', 'data', 'postplant.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
for k in ('A', 'B'):
    print(k, len(out[k]), [(s['zone'], s['share']) for s in out[k]])
