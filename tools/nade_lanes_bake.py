"""Откуда про кидают гранаты и куда они падают (v373): все броски из демок карты — пары «место бросающего → место разрыва»
(px радара, округлено до 10). Игра проверяет свою гранату через стену по ним: так кидать можно, если про кидали отсюда (≤ 60 px)
почти туда же (≤ 80 px); иначе — идти на место, откуда про кидали в эту точку. Замер (tools/nade_walls_pro.py): у про 79 %
бросков прямая проходит сквозь стену радара (через крыши, над ящиками) — толщиной стены «можно / нельзя» не отличить.
Место бросающего — за время полёта до разрыва (флешка, HE 1,6 с; смок ~2 с; молотов ~1,2 с — проектные числа).
Выход: data/maps/<карта>/nadelanes.json → MAP.nadelanes = {lanes: [sx, sy, ex, ey, …]}. Запуск: python3 tools/nade_lanes_bake.py --map mirage"""
import sys, os, json
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from demos import MAPNAME, DEMOS, demo_names, event  # noqa: E402
import mapdir  # noqa: E402

FUSE = {'flashbang_detonate': 1.6, 'hegrenade_detonate': 1.6, 'smokegrenade_detonate': 2.0, 'inferno_startburn': 1.2}
tr = mapdir.game_to_map(MAPNAME)
lanes = set()
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
            lanes.add((int(round(float(x1) / 10)) * 10, int(round(float(y1) / 10)) * 10, int(round(float(x2) / 10)) * 10, int(round(float(y2) / 10)) * 10))
flat = [v for l in sorted(lanes) for v in l]
json.dump({'lanes': flat}, open(mapdir.path(MAPNAME, 'nadelanes.json'), 'w', encoding='utf-8'), separators=(',', ':'))
print('%s: бросков-пар %d' % (MAPNAME, len(lanes)))
