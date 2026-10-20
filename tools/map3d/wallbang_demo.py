#!/usr/bin/env python3
"""Прострелы про по геометрии (А2, запасной путь и проверка материалов): python3 tools/map3d/wallbang_demo.py [--map mirage]
Убийства с penetrated > 0 (demo_prep.py): луч «глаза 64 → грудь 44» по геометрии (raycast.py) — что пробито: точки входа / выхода,
толщина (сумма пути внутри блоков + расстояние между парами граней сетки), оружие. Места — кучки точек входа (≤ 120 ед.).
Пишет data/maps/<карта>/geom3d/wallbang_demo.json: {spots: [{p: точка (ед. игры), radar, n, оружие, толщина медиана, предметы}],
kills: [...]} и картинку docs/reports/map3d/wallbang_demo.png."""
import sys, os, json, collections
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa
from raycast import World  # noqa
MAP = mapdir.current(); ROOT = mapdir.ROOT
R = mapdir.radar(MAP); S2 = R['scale'] / 2.0
m2g = lambda x, y: (x * S2 + R['pos_x'], R['pos_y'] - y * S2); g2m = mapdir.game_to_map(MAP)
CALL = mapdir.callouts(MAP)
def place(x, y): return min(CALL, key=lambda c: (c[1] - x) ** 2 + (c[2] - y) ** 2)[0] if CALL else '?'
K = json.load(open(os.path.join(ROOT, 'tools', 'measure', 'runs', 'e0a_vis', f'{MAP}_kills.json')))
W = World(MAP)
z = W.z; HA = z['hull_attr'] if 'hull_attr' in z else None

def solids(A, B):
    """пересечения отрезка с геометрией: [(t, вид, номер)] по порядку, все (не только первое)"""
    out = []; a = np.asarray(A, float); b = np.asarray(B, float); L = np.linalg.norm(b - a); t0 = 0.0
    for _ in range(12):
        h = W.ray(a + (b - a) * t0, b)
        if h is None: break
        t = t0 + h[0] * (1 - t0); out.append((t * L, h[1], h[2], h[3])); t0 = t + 0.25 / L
        if t0 >= 1: break
    return out
rows = []
for i, k in enumerate(K):
    if not k[12]: continue
    A = m2g(k[3], k[4]); B = m2g(k[6], k[7]); a = (A[0], A[1], k[5] + 64); b = (B[0], B[1], k[8] + 44)
    s = solids(a, b)
    if not s: rows.append({'i': i, 'open': 1}); continue
    # толщина: блок — длина хорды (вход … выход того же блока); сетка — расстояние между соседними попаданиями (вход/выход стены)
    th = 0.0; j = 0
    while j < len(s):
        if j + 1 < len(s): th += s[j + 1][0] - s[j][0]; j += 2
        else: j += 1
    rows.append({'i': i, 'open': 0, 'p': [round(float(v), 1) for v in s[0][3]], 'surf': len(s), 'thick': round(th, 1),
                 'what': ['%s%d' % (x[1], x[2]) for x in s], 'weapon': k[9], 'pen': k[12]})
hit = [r for r in rows if not r['open']]
cl = []
for r in hit:
    p = np.array(r['p'])
    for c in cl:
        if np.linalg.norm(c['p'][:2] - p[:2]) < 120 and abs(c['p'][2] - p[2]) < 80: c['m'].append(r); break
    else: cl.append({'p': p, 'm': [r]})
cl.sort(key=lambda c: -len(c['m']))
spots = []
for c in cl:
    P = np.array([r['p'] for r in c['m']]).mean(0); rx, ry = g2m(P[0], P[1])
    spots.append({'p': P.round(1).tolist(), 'radar': [round(float(rx), 1), round(float(ry), 1)], 'место': place(rx, ry), 'n': len(c['m']),
                  'оружие': dict(collections.Counter(r['weapon'] for r in c['m']).most_common()),
                  'толщина_медиана': round(float(np.median([r['thick'] for r in c['m']])), 1),
                  'предметы': dict(collections.Counter(r['what'][0] for r in c['m']).most_common(4))})
S = {'прострелов': len(rows), 'геометрия закрывает': len(hit), 'линия открыта (пробит, видимо, игрок / мелочь)': len(rows) - len(hit),
     'толщина, ед. (медиана / 90 %)': [round(float(np.median([r['thick'] for r in hit])), 1), round(float(np.percentile([r['thick'] for r in hit], 90)), 1)],
     'поверхностей на луче (медиана)': float(np.median([r['surf'] for r in hit]))}
dst = mapdir.path(MAP, 'geom3d', 'wallbang_demo.json') if hasattr(mapdir, 'path') else None
json.dump({'S': S, 'spots': spots, 'kills': rows}, open(dst, 'w'), ensure_ascii=False, indent=0)
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
f, ax = plt.subplots(figsize=(10, 10)); ax.imshow(plt.imread(mapdir.path(MAP, 'radar.png')), extent=[0, 2048, 2048, 0]); ax.axis('off')
for r in hit:
    k = K[r['i']]; ax.plot([k[3], k[6]], [k[4], k[7]], color='#3b82f6', lw=0.6, alpha=0.5)
for s in spots:
    ax.scatter([s['radar'][0]], [s['radar'][1]], s=25 + 25 * s['n'], color='#f59e0b', edgecolor='k', zorder=4)
    if s['n'] >= 3: ax.text(s['radar'][0] + 12, s['radar'][1], '%d · %s ед.' % (s['n'], s['толщина_медиана']), fontsize=8, color='white', zorder=5)
ax.set_title(f'Прострелы про сквозь геометрию ({len(hit)}): точки входа (размер — сколько), подпись — число · толщина', fontsize=10)
f.tight_layout(); f.savefig(os.path.join(ROOT, 'docs', 'reports', 'map3d', 'wallbang_demo.png'), dpi=80)
print(json.dumps(S, ensure_ascii=False)); print([(s['место'], s['n'], s['толщина_медиана']) for s in spots[:12]])
