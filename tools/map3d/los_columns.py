#!/usr/bin/env python3
"""А3: проверка «столбиков» (columns.py) по убийствам демок — то же, что А1 (los_check.py) по треугольникам, но лучом по сетке VIS.
python3 tools/map3d/los_columns.py [--map mirage]   (нужен tools/measure/engine/demo_prep.py) → печатает доли «закрыто»."""
import sys, os, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa
from columns import Columns  # noqa
MAP = mapdir.current(); R = mapdir.radar(MAP); S2 = R['scale'] / 2.0
m2g = lambda x, y: (x * S2 + R['pos_x'], R['pos_y'] - y * S2)
C = Columns(MAP)
K = json.load(open(os.path.join(mapdir.ROOT, 'tools', 'measure', 'runs', 'e0a_vis', f'{MAP}_kills.json')))
def clear(A, za, B, zb, eyes, tg, side):
    d = np.array([B[0] - A[0], B[1] - A[1]]); L = np.hypot(*d) or 1.0; pn = np.array([-d[1], d[0]]) / L
    for e in eyes:
        for t in tg:
            for s in side:
                if C.ray((A[0], A[1], za + e), (B[0] + pn[0] * s, B[1] + pn[1] * s, zb + t)) is None: return True
    return False
res = []
for k in K:
    name, tick, rnd, ax, ay, za, vx, vy, zv, wpn, a_air, v_air, pen, smoke, dist = k
    A = m2g(ax, ay); B = m2g(vx, vy)
    st = clear(A, za, B, zv, (64.0,), (62.0, 44.0), (0.0,))
    full = st or clear(A, za, B, zv, (64.0, 46.0), (62.0, 44.0, 30.0), (0.0, 12.0, -12.0))
    res.append((pen, st, full, ax, ay, vx, vy))
base = [r for r in res if r[0] == 0]; pen = [r for r in res if r[0] > 0]
pc = lambda a, b: round(100.0 * a / max(b, 1), 1)
out = {'kills': len(base), 'closed_stand_%': pc(sum(1 for r in base if not r[1]), len(base)),
       'closed_all_%': pc(sum(1 for r in base if not r[2]), len(base)),
       'pen_closed_stand_%': pc(sum(1 for r in pen if not r[1]), len(pen)), 'pen_closed_all_%': pc(sum(1 for r in pen if not r[2]), len(pen)),
       'closed_all': [[round(v, 1) for v in r[3:]] for r in base if not r[2]]}
json.dump(out, open(mapdir.path(MAP, 'geom3d', 'los_columns.json'), 'w'))
print({k: v for k, v in out.items() if k != 'closed_all'})
