"""Сквозь какую толщину стены кидают про (v373): от места бросающего (за время полёта до разрыва) до точки разрыва — самый длинный
кусок прямой внутри стены карты (walls.json), px радара. Это мерка для правила «своя граната не сквозь здание» (NADE_WALL_MAX):
порог — из того, как реально кидают про, а не на глаз. Время полёта — проектные числа (флешка, HE — запал 1,6 с; смок ~2 с; молотов ~1,2 с).
Запуск: python3 tools/nade_walls_pro.py --map mirage"""
import sys, os, json
import numpy as np, pandas as pd
from matplotlib.path import Path
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from demos import MAPNAME, DEMOS, demo_names, event  # noqa: E402
import mapdir  # noqa: E402

FUSE = {'flashbang_detonate': 1.6, 'hegrenade_detonate': 1.6, 'smokegrenade_detonate': 2.0, 'inferno_startburn': 1.2}
W = [Path(np.array(p)) for p in json.load(open(mapdir.path(MAPNAME, 'walls.json'), encoding='utf-8'))['polys']]
tr = mapdir.game_to_map(MAPNAME)


def run_in_wall(x1, y1, x2, y2):
    d = np.hypot(x2 - x1, y2 - y1); n = max(2, int(d / 2)); t = np.arange(1, n) / n
    P = np.stack([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], 1)
    inside = np.zeros(len(P), bool)
    for w in W: inside |= w.contains_points(P)
    best = run = 0
    for v in inside:
        run = run + d / n if v else 0; best = max(best, run)
    return best


res = {k: [] for k in FUSE}
for demo in demo_names():
    t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'X', 'Y', 'is_alive'], low_memory=False)
    t = t[t.is_alive == True]  # noqa: E712
    by = {int(s): g.sort_values('tick') for s, g in t.groupby('steamid')}
    for k, fuse in FUSE.items():
        e = event(demo, k)
        if not len(e) or 'user_steamid' not in e: continue
        for tk, sid, ex, ey in zip(e.tick, e.user_steamid, e.x, e.y):
            if pd.isna(sid) or int(sid) not in by: continue
            g = by[int(sid)]; i = np.searchsorted(g.tick.values, tk - fuse * 64)
            if i >= len(g): continue
            x1, y1 = tr(g.X.values[i], g.Y.values[i]); x2, y2 = tr(ex, ey)
            res[k].append(run_in_wall(float(x1), float(y1), float(x2), float(y2)))
out = {k: {'n': len(v), 'доля с прострелом стены >0': round(float(np.mean(np.array(v) > 0)), 3),
           'p50': round(float(np.percentile(v, 50)), 1), 'p90': round(float(np.percentile(v, 90)), 1),
           'p95': round(float(np.percentile(v, 95)), 1), 'p98': round(float(np.percentile(v, 98)), 1)} for k, v in res.items() if v}
allv = np.concatenate([np.array(v) for v in res.values() if v])
out['все'] = {'n': len(allv), 'p90': round(float(np.percentile(allv, 90)), 1), 'p95': round(float(np.percentile(allv, 95)), 1), 'p98': round(float(np.percentile(allv, 98)), 1)}
json.dump(out, open(os.path.join(HERE, 'measure', 'results', 'nade_walls_pro_%s.json' % MAPNAME), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# (v373) в набор карты: pro.json → nadeWallP90 {flash, he, molly, smoke} — 90-й процентиль толщины стены на пути броска у про
import re
NM = {'flashbang_detonate': 'flash', 'hegrenade_detonate': 'he', 'smokegrenade_detonate': 'smoke', 'inferno_startburn': 'molly'}
pp = mapdir.path(MAPNAME, 'pro.json'); src = open(pp, encoding='utf-8').read()
line = '"nadeWallP90": ' + json.dumps({NM[k]: out[k]['p90'] for k in NM if k in out}) + ','
src = re.sub(r'"nadeWallP90": \{[^\n]*?\},\n?', '', src)
i = src.index('{') + 1; nl = '\n' if src[i:i+1] == '\n' else ''
open(pp, 'w', encoding='utf-8').write(src[:i] + nl + line + '\n' + src[i+len(nl):])
print(json.dumps(out, ensure_ascii=False, indent=1))
