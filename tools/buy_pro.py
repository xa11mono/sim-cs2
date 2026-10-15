"""Что покупают про (v271): оружие в руках за первые 30 с раунда по 92 демкам Ancient.
Тип закупа команды — как в ct_cmp.py (rtype). Пистолетки — раунды 1 и 13. На игрока: основное
(самое дорогое увиденное), пистолет (лучший увиденный). Запуск: python3 tools/buy_pro.py [out.json]"""
import sys, os, json, collections
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from demos import DEMOS, demo_names, rounds_of  # noqa: E402
from ct_cmp import wcls, rtype  # noqa: E402
from eco_est import ALIAS, PRICE  # noqa: E402
PIST = {'GLOCK', 'USP', 'P250', 'FIVE7', 'TEC9', 'CZ', 'DEAGLE', 'ELITE', 'R8'}
def key(w):
    w = str(w).lower().replace('weapon_', '')
    return ALIAS.get(w)
out = collections.defaultdict(collections.Counter)
nteam = collections.Counter()
for demo in demo_names():
    rounds = rounds_of(demo)
    t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'active_weapon_name', 'is_alive', 'is_warmup_period'])
    t = t[(t.is_alive == True) & (t.is_warmup_period != True)]  # noqa: E712
    for r in rounds:
        if r['num'] >= 24: continue   # овертайм — отдельные деньги
        w = t[(t.tick >= r['t0']) & (t.tick < r['t0'] + 30 * 64)]
        for side, g in w.groupby('team_num'):
            sd = 'CT' if side == 3 else 'T'
            prim, pist, best = [], [], []
            for sid, gp in g.groupby('steamid'):
                ks = [key(x) for x in gp.active_weapon_name.unique()]; ks = [k for k in ks if k]
                pr = [k for k in ks if k not in PIST and k in PRICE and k not in ('HE', 'MOLOTOV', 'ZEUS')]
                ps = [k for k in ks if k in PIST]
                p1 = max(pr, key=lambda k: PRICE[k]) if pr else None
                p2 = max(ps, key=lambda k: PRICE.get(k, 0)) if ps else None
                prim.append(p1); pist.append(p2)
                best.append(2 if p1 in ('AK', 'M4', 'M4S', 'AWP', 'FAMAS', 'GALIL', 'AUG', 'SG', 'SSG') else (1 if p1 else 0))
                if 'ZEUS' in ks: out[(sd, 'zeus')]['ZEUS'] += 1
            if len(best) < 4: continue
            typ = 'пистолетка' if r['num'] in (0, 12) else rtype(best)
            nteam[(sd, typ)] += 1
            for p1, p2 in zip(prim, pist):
                out[(sd, typ, 'основное')][p1 or '—'] += 1
                out[(sd, typ, 'пистолет')][p2 or '—'] += 1
            out[(sd, typ, 'AWP в команде')][sum(1 for p in prim if p == 'AWP')] += 1
res = {}
for k, c in sorted(out.items(), key=lambda kv: str(kv[0])):
    n = sum(c.values()); res[' / '.join(map(str, k))] = {str(a): round(100 * b / n, 1) for a, b in c.most_common(12)}
res['_команд'] = {' / '.join(k): v for k, v in nteam.items()}
txt = json.dumps(res, ensure_ascii=False, indent=1)
if len(sys.argv) > 1: open(sys.argv[1], 'w').write(txt)
print(txt)
