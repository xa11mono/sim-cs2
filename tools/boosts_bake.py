#!/usr/bin/env python3
"""(v575, В144, владелец 14.11: «почему подсадки нет? мало, но должно быть») Подсадки про: <pro_dir>/boosts.json → pro.json, поле boosts.
По всем демкам карты (позиции ~4 раза в секунду): игрок стоит на тиммейте — над ним по плоскости ≤ 8 px карты (20 ед.), выше на 50–80 ед.,
дольше 0,5 с. Место — сетка CELL px и сторона; берётся, если подсадок ≥ MIN_N из ≥ MIN_DEMOS демок (у Mirage — 0,16 подсадки за раунд,
половина — в 5 местах). Пишет [{x, y, side, rate, dur, lift, t}]: rate — подсадок за раунд, dur — сколько стоит наверху (с, квантили
10/25/50/75/90), lift — насколько выше тиммейта (ед., медиана), t — когда от начала раунда (с, квантили).
Запуск: python3 -I tools/boosts_bake.py --map mirage"""
import sys, os, json, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demos, mapdir  # noqa: E402
CELL, MIN_N, MIN_DEMOS = 40, 10, 8


def main():
    EV = []; rounds = 0
    for dm in demos.demo_names():
        T = demos.ticks_of(dm); R = demos.rounds_of(dm); rounds += len(R); r0 = sorted(r['t0'] for r in R)
        T = T[T.Z.notna()]; op = {}
        for tk, g in T.groupby('tick'):
            P = g[['steamid', 'side', 'x', 'y', 'Z']].values; seen = set()
            for i in range(len(P)):
                for j in range(len(P)):
                    a, b = P[i], P[j]
                    if i != j and a[1] == b[1] and np.hypot(a[2] - b[2], a[3] - b[3]) <= 8 and 50 <= a[4] - b[4] <= 80:
                        k = (a[0], b[0]); seen.add(k)
                        if k in op: op[k]['t1'] = tk; op[k]['dz'].append(a[4] - b[4])
                        else:
                            st = max([t for t in r0 if t <= tk] or [tk])
                            op[k] = dict(t0=tk, t1=tk, x=a[2], y=a[3], side=a[1], dm=dm, dz=[a[4] - b[4]], rt=(tk - st) / 64)
            for k in list(op):
                if k not in seen and tk - op[k]['t1'] > 32: EV.append(op.pop(k))
        EV.extend(op.values())
    EV = [e for e in EV if e['t1'] - e['t0'] >= 32]
    G = collections.defaultdict(list)
    for e in EV: G[(round(e['x'] / CELL), round(e['y'] / CELL), e['side'])].append(e)
    out = []
    for k, L in sorted(G.items(), key=lambda kv: -len(kv[1])):
        if len(L) < MIN_N or len({e['dm'] for e in L}) < MIN_DEMOS: continue
        P = [10, 25, 50, 75, 90]
        out.append({'x': round(float(np.mean([e['x'] for e in L])), 1), 'y': round(float(np.mean([e['y'] for e in L])), 1), 'side': k[2],
                    'rate': round(len(L) / rounds, 4), 'n': len(L), 'demos': len({e['dm'] for e in L}),
                    'dur': [round(float(v), 2) for v in np.percentile([(e['t1'] - e['t0']) / 64 for e in L], P)],
                    'lift': round(float(np.median([np.median(e['dz']) for e in L]))),
                    't': [round(float(v), 1) for v in np.percentile([e['rt'] for e in L], P)]})
    f = os.path.join(mapdir.pro_dir(demos.MAPNAME), 'boosts.json')
    json.dump({'rounds': rounds, 'all': len(EV), 'spots': out}, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    pj = mapdir.path(demos.MAPNAME, 'pro.json'); P = json.load(open(pj, encoding='utf-8'))
    P['boosts'] = [{k: o[k] for k in ('x', 'y', 'side', 'rate', 'dur', 'lift', 't')} for o in out]
    open(pj, 'w', encoding='utf-8').write(json.dumps(P, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('раундов %d, подсадок %d (%.3f за раунд), мест %d (в них %d)' % (rounds, len(EV), len(EV) / rounds, len(out), sum(o['n'] for o in out)))
    for o in out: print('  %s (%4.0f,%4.0f) %.3f за раунд, наверху %s с, выше на %d, с начала раунда %s с' % (o['side'], o['x'], o['y'], o['rate'], o['dur'], o['lift'], o['t']))


if __name__ == '__main__':
    main()
