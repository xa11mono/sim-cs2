"""Детектор (v248): размены и «по одному в тот же угол» у ботов — так же, как tools/trade_bake.py у про.
Запуск: python3 tools/measure/trade_chain.py <run> [<run> …]"""
import json, sys, os, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
n = traded = chain = 0; dist = []
for run in sys.argv[1:]:
    for f in sorted(os.listdir(os.path.join(HERE, 'runs', run))):
        if not f.startswith('rec_'): continue
        K = [k for k in json.load(open(os.path.join(HERE, 'runs', run, f)))['kills'] if k[1] and k[2] != k[6]]
        K.sort(key=lambda k: k[0])
        for i, k in enumerate(K):
            t, a, at, ax, ay, u, ut, ux, uy = k[:9]; n += 1
            for k2 in K[i+1:]:
                if k2[0] - t > 5*64: break
                if k2[5] == a and k2[0] - t <= 3*64:
                    traded += 1; dist.append(math.hypot(k2[3]-ux, k2[4]-uy)); break
            for k2 in K[i+1:]:
                if k2[0] - t > 5*64: break
                if k2[1] == a and k2[6] == ut:
                    if math.hypot(k2[7]-ux, k2[8]-uy) <= 300: chain += 1
                    break
pro = json.load(open(os.path.join(HERE, '..', '..', 'src', 'data', 'trades.json')))
print(f"разменяно за 3 с: про {pro['traded']:.1%} | боты {traded/n:.1%}")
print(f"второй погиб от того же убийцы за 5 с рядом (по одному в тот же угол): про {pro['chain']:.1%} | боты {chain/n:.1%}")
print(f"разменявший — от места смерти своего, медиана / 80 %: про {pro['trader_dist_median']:.0f} / {pro['trader_dist_p80']:.0f} | боты {np.median(dist):.0f} / {np.percentile(dist,80):.0f}")
