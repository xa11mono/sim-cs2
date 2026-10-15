#!/usr/bin/env python3
"""Точки спавна из демок (v321, М19): где стоят игроки в конце freeze time → map.json набора, поле spawnSpots.

python3 tools/spawns_bake.py --map <карта>
В CS2 у каждой стороны фиксированный набор точек спавна, игроки попадают на них случайно каждый раунд (от точки зависят
ранняя агрессия и тайминги). Точка — место, где игрок стоял в первый тик после freeze time (двигаться во время закупа
нельзя), сгруппированное по 6 ед. карты и объединённое в точку до 12 ед.; берутся точки, где стояли хотя бы в 1 % раундов стороны (проектное число).
"""
import json, os, sys
from collections import Counter

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
import demos as D  # noqa: E402

CELL, MIN_SHARE, MERGE = 6, 0.01, 12   # клетка и «та же точка» — ед. карты; доля раундов — проектные числа


def main():
    C = {'CT': Counter(), 'T': Counter()}
    S = {'CT': {}, 'T': {}}
    nr = 0
    for demo in D.demo_names():
        R = D.rounds_of(demo)
        if not R:
            continue
        t = D.ticks_of(demo)
        for r in R:
            s = t[(t.tick >= r['t0']) & (t.tick < r['t0'] + 32)].drop_duplicates('steamid')
            if len(s) < 8:
                continue
            nr += 1
            for side, x, y in zip(s.side.values, s.x.values, s.y.values):
                k = (int(round(x / CELL)), int(round(y / CELL)))
                C[side][k] += 1
                S[side].setdefault(k, []).append((x, y))
    out = {}
    for side in ('CT', 'T'):
        # клетки → точки: жадно, от самой частой, всё ближе MERGE к ней — та же точка спавна
        cells = sorted(C[side].items(), key=lambda kv: (-kv[1], kv[0]))
        used, spots = set(), []
        for k, n in cells:
            if k in used:
                continue
            grp = [(k2, n2) for k2, n2 in cells if k2 not in used and np.hypot(k2[0] - k[0], k2[1] - k[1]) * CELL <= MERGE]
            pts = [p for k2, _ in grp for p in S[side][k2]]
            used |= {k2 for k2, _ in grp}
            if len(pts) >= MIN_SHARE * nr:
                spots.append([round(float(np.mean([p[0] for p in pts])), 1), round(float(np.mean([p[1] for p in pts])), 1)])
        out[side] = spots
    f = mapdir.path(D.MAPNAME, 'map.json')
    M = json.load(open(f, encoding='utf-8'))
    M['spawnSpots'] = out
    open(f, 'w', encoding='utf-8').write(json.dumps(M, ensure_ascii=False, indent=1) + '\n')
    print('map.json: точки спавна из %d раундов — CT %d, T %d' % (nr, len(out['CT']), len(out['T'])))


if __name__ == '__main__':
    main()
