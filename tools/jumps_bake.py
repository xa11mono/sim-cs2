#!/usr/bin/env python3
"""Места прыжка-чека про (v334, М58): <pro_dir>/jumps.json → pro.json, поле jumps.

python3 tools/jumps_bake.py --map <карта>
Прыжок на месте: высота растёт больше чем на JUMP_DZ ед. и через ~0,5 с возвращается (±8), а по полу почти не двигался
(< 80 ед./с) — так про «чекают прыжком» из-за укрытия. Только живой раунд (после фризтайма, до конца раунда).
Кластер — сетка CELL ед. карты; место берётся, если прыжков там ≥ MIN_SHARE раундов и из ≥ MIN_MATCHES матчей.
Пишет [{x, y, side, rate}] — rate: прыжков на раунд (сколько раз в раунде про прыгают там в среднем).
"""
import json, os, sys
from collections import defaultdict

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
import demos as D  # noqa: E402

JUMP_DZ, CELL, MIN_SHARE, MIN_MATCHES = 25, 40, 0.03, 8   # проектные числа (порог отбора)


def main():
    cl = defaultdict(lambda: {'n': 0, 'm': set(), 'x': 0.0, 'y': 0.0, 'side': defaultdict(int)})
    rounds = 0
    for dm in D.demo_names():
        R = D.rounds_of(dm)
        if not R:
            continue
        rounds += len(R)
        t = pd.read_csv(os.path.join(D.DEMOS, dm + '_ticks.csv.gz'), low_memory=False,
                        usecols=['tick', 'X', 'Y', 'Z', 'name', 'team_num', 'is_alive'])
        t = t[t.is_alive == True]  # noqa: E712
        live = np.zeros(len(t), bool)
        tk = t.tick.values
        for r in R:
            live |= (tk >= r['t0']) & (tk < r['t1'])
        t = t[live]
        for _, g in t.groupby('name'):
            g = g.sort_values('tick')
            Z, X, Y, T, S = g.Z.values, g.X.values, g.Y.values, g.tick.values, g.team_num.values
            for i in range(1, len(Z) - 2):
                if T[i + 2] - T[i - 1] > 48:
                    continue
                h = np.hypot(X[i + 2] - X[i - 1], Y[i + 2] - Y[i - 1]) / ((T[i + 2] - T[i - 1]) / 64)
                if Z[i] - Z[i - 1] > JUMP_DZ and abs(Z[i + 2] - Z[i - 1]) < 8 and h < 80:
                    x, y = D.tr(np.array([X[i]]), np.array([Y[i]]))
                    k = (round(float(x[0]) / CELL), round(float(y[0]) / CELL))
                    c = cl[k]
                    c['n'] += 1; c['m'].add(dm); c['x'] += float(x[0]); c['y'] += float(y[0])
                    c['side']['CT' if S[i] == 3 else 'T'] += 1
        print(dm, file=sys.stderr)
    out = []
    for k, c in sorted(cl.items(), key=lambda kv: -kv[1]['n']):
        if c['n'] < MIN_SHARE * rounds or len(c['m']) < MIN_MATCHES:
            continue
        side = max(c['side'], key=c['side'].get)
        out.append({'x': round(c['x'] / c['n'], 1), 'y': round(c['y'] / c['n'], 1), 'side': side,
                    'rate': round(c['side'][side] / rounds, 3), 'n': c['n'], 'matches': len(c['m'])})
    f = os.path.join(mapdir.pro_dir(D.MAPNAME), 'jumps.json')
    json.dump({'rounds': rounds, 'spots': out}, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for o in out:
        print('  %s (%.0f, %.0f) — %.2f прыжка за раунд, %d матчей' % (o['side'], o['x'], o['y'], o['rate'], o['matches']))


if __name__ == '__main__':
    main()
