"""Сколько гранат про бросают за раунд (v357): по демкам карты, на команду, по стороне и типу закупа.
Тип закупа — как в buy_pro.py / ct_cmp.py (rtype по оружию в руках за первые 30 с). Броски — события разрыва
(smokegrenade_detonate, flashbang_detonate, hegrenade_detonate, inferno_startburn) по бросившему.
Запуск: python3 tools/nades_pro.py --map mirage [out.json]"""
import sys, os, json, collections
import pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from demos import DEMOS, demo_names, rounds_of  # noqa: E402
from ct_cmp import rtype  # noqa: E402
from eco_est import ALIAS, PRICE  # noqa: E402
PIST = {'GLOCK', 'USP', 'P250', 'FIVE7', 'TEC9', 'CZ', 'DEAGLE', 'ELITE', 'R8'}
EV = {'smoke': 'smokegrenade_detonate', 'flash': 'flashbang_detonate', 'he': 'hegrenade_detonate', 'molly': 'inferno_startburn'}
sumN = collections.defaultdict(collections.Counter)
nteam = collections.Counter()
for demo in demo_names():
    t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'active_weapon_name', 'is_alive', 'is_warmup_period'], low_memory=False)
    t = t[(t.is_alive == True) & (t.is_warmup_period != True)]  # noqa: E712
    ev = {}
    for k, e in EV.items():
        f = os.path.join(DEMOS, demo + '_' + e + '.csv.gz')
        ev[k] = pd.read_csv(f, usecols=['tick', 'user_steamid']) if os.path.exists(f) else pd.DataFrame(columns=['tick', 'user_steamid'])
    for r in rounds_of(demo):
        if r['num'] >= 24: continue
        w = t[(t.tick >= r['t0']) & (t.tick < r['t0'] + 30 * 64)]
        side_of = {}
        for side, g in w.groupby('team_num'):
            sd = 'CT' if side == 3 else 'T'
            best = []
            for sid, gp in g.groupby('steamid'):
                side_of[int(sid)] = sd
                ks = [ALIAS.get(str(x).lower().replace('weapon_', '')) for x in gp.active_weapon_name.unique()]
                pr = [k for k in ks if k and k not in PIST and k in PRICE and k not in ('HE', 'MOLOTOV', 'ZEUS')]
                p1 = max(pr, key=lambda k: PRICE[k]) if pr else None
                best.append(2 if p1 in ('AK', 'M4', 'M4S', 'AWP', 'FAMAS', 'GALIL', 'AUG', 'SG', 'SSG') else (1 if p1 else 0))
            if len(best) < 4: continue
            typ = 'пистолетка' if r['num'] in (0, 12) else rtype(best)
            nteam[(sd, typ)] += 1
            side_of[(sd, 'typ')] = typ
        for k, e in ev.items():
            x = e[(e.tick >= r['t0']) & (e.tick < r['t1'])]
            for sid in x.user_steamid:
                sd = side_of.get(int(sid)) if pd.notna(sid) else None
                if sd and (sd, 'typ') in side_of: sumN[(sd, side_of[(sd, 'typ')])][k] += 1
res = {}
for key, n in sorted(nteam.items()):
    c = sumN[key]
    res[' / '.join(key)] = dict({k: round(c[k] / n, 2) for k in EV}, всего=round(sum(c.values()) / n, 2), раундов=n)
txt = json.dumps(res, ensure_ascii=False, indent=1)
if len(sys.argv) > 1: open(sys.argv[1], 'w').write(txt)
print(txt)
