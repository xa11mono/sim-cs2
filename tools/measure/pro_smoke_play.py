#!/usr/bin/env python3
"""(док 6, п.17) играют ли про «под свой смок»: python3 tools/measure/pro_smoke_play.py --map mirage
Смок своей команды до планта: свои, кто был в 300–900 ед. карты от него в момент разрыва, — через 8 с ближе 250 к нему (подошли под смок)?
Отдельно T и CT. Только смоки до 40-й с раунда (ранний контроль)."""
import os, sys, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import demos as D  # noqa
res = collections.defaultdict(lambda: [0, 0, 0])   # side -> [смоков, игроков рядом, подошли]
for demo in D.demo_names():
    R = D.rounds_of(demo)
    if not R: continue
    t = D.ticks_of(demo); ri = D.round_index(R, t.tick.values); t = t[ri >= 0].assign(ri=ri[ri >= 0])
    e = D.event(demo, 'smokegrenade_detonate')
    if not len(e): continue
    side = {(int(a), int(b)): c for (a, b), c in t.groupby(['ri', 'steamid']).side.first().items()}
    for q in e.itertuples():
        k = [i for i, r in enumerate(R) if r['t0'] <= q.tick < r['t1']]
        if not k: continue
        r = R[k[0]]
        if q.tick > r['t0'] + 40 * D.TICK or (r['tplant'] and q.tick > r['tplant']): continue
        sd = side.get((k[0], int(q.user_steamid)))
        if not sd: continue
        sx, sy = D.tr(np.array([float(q.x)]), np.array([float(q.y)])); sx, sy = float(sx[0]), float(sy[0])
        for who in ('CT', 'T'):
          key = who + (' свой смок' if who == sd else ' смок врага')
          a = t[(t.ri == k[0]) & (t.side == who) & (abs(t.tick - q.tick) <= 16)].groupby('steamid').first()
          b = t[(t.ri == k[0]) & (t.side == who) & (abs(t.tick - (q.tick + 8 * D.TICK)) <= 16)].groupby('steamid').first()
          res[key][0] += 1
          for sid, p in a.iterrows():
            d0 = np.hypot(p.x - sx, p.y - sy)
            if not (300 <= d0 <= 900) or sid not in b.index: continue
            res[key][1] += 1
            if np.hypot(b.loc[sid].x - sx, b.loc[sid].y - sy) < 250: res[key][2] += 1
for sd, (n, m, k) in res.items():
    print(sd, '· смоков до 40 с:', n, '· своих в 300–900 от смока:', m, '· через 8 с подошли ближе 250:', k, '(%.0f %%)' % (100 * k / max(m, 1)))
