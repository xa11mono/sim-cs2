"""В144: подсадки у про (все демки карты, позиции ~4 раза в секунду): один стоит на тиммейте — над ним по плоскости ≤ 8 px карты (20 ед.),
выше на 50–80 ед. Подсадка — непрерывный отрезок; место — сетка 25 px. Запуск: python3 -I tools/measure/motion/pro_boost.py --map mirage"""
import sys, os, collections
import numpy as np
sys.path.insert(0, 'tools'); import demos, mapdir  # noqa: E402
CO = mapdir.callouts(demos.MAPNAME); nm = lambda x, y: min(CO, key=lambda c: (c[1] - x) ** 2 + (c[2] - y) ** 2)[0] if CO else '?'
EV = []; rounds = 0
for dm in demos.demo_names():
    T = demos.ticks_of(dm); R = demos.rounds_of(dm); rounds += len(R)
    T = T[T.Z.notna()]; open_ = {}
    for tk, g in T.groupby('tick'):
        P = g[['steamid', 'side', 'x', 'y', 'Z']].values; seen = set()
        for i in range(len(P)):
            for j in range(len(P)):
                a, b = P[i], P[j]
                if i == j or a[1] != b[1]: continue
                if np.hypot(a[2] - b[2], a[3] - b[3]) <= 8 and 50 <= a[4] - b[4] <= 80:
                    k = (a[0], b[0]); seen.add(k)
                    if k in open_: open_[k]['t1'] = tk
                    else: open_[k] = dict(t0=tk, t1=tk, x=a[2], y=a[3], side=a[1], dm=dm)
        for k in list(open_):
            if k not in seen and tk - open_[k]['t1'] > 32: EV.append(open_.pop(k))
    EV.extend(open_.values())
EV = [e for e in EV if e['t1'] - e['t0'] >= 32]   # стоял на тиммейте ≥ 0,5 с
print('демок %d, раундов %d, подсадок (≥ 0,5 с) %d — %.3f за раунд' % (len(demos.demo_names()), rounds, len(EV), len(EV) / max(1, rounds)))
G = collections.defaultdict(list)
for e in EV: G[(round(e['x'] / 25), round(e['y'] / 25), e['side'])].append(e)
for k, L in sorted(G.items(), key=lambda kv: -len(kv[1]))[:15]:
    x = np.mean([e['x'] for e in L]); y = np.mean([e['y'] for e in L]); d = [(e['t1'] - e['t0']) / 64 for e in L]
    print('  %-3s %-14s (%4.0f,%4.0f) n=%2d из %2d демок, %.3f за раунд, стоит наверху с %s' % (k[2], nm(x, y), x, y, len(L), len({e['dm'] for e in L}), len(L) / rounds,
          [round(float(v), 1) for v in np.percentile(d, [25, 50, 75])]))
