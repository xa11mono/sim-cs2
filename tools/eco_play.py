"""Как T играют раунд по типу закупа (v556, В76): 92 демки Ancient. Тип — по оружию T в первые 30 с (ct_cmp.rtype; эко с одной
винтовкой / AWP — «эко+хиро»). Плант, первый фраг, когда трое T впервые на сайте (≤ 260 px от средней точки планта), потери до 25 с,
разброс T на 20-й секунде. Запуск (из tools/): python3 eco_play.py out.json"""
import sys, os, json, collections
import numpy as np, pandas as pd
sys.path.insert(0, '/home/user/sim-cs2/tools')
from demos import DEMOS, demo_names, rounds_of, ticks_of, event
from ct_cmp import rtype
from eco_est import ALIAS, PRICE
PIST = {'GLOCK','USP','P250','FIVE7','TEC9','CZ','DEAGLE','ELITE','R8'}
RIF = ('AK','M4','M4S','AWP','FAMAS','GALIL','AUG','SG','SSG')
def key(w): return ALIAS.get(str(w).lower().replace('weapon_',''))
names = demo_names()
# site centres from plants
P = collections.defaultdict(list); RR = {}
for d in names:
    RR[d] = rounds_of(d)
    for r in RR[d]:
        if r.get('plantXY') and r.get('site'): P[r['site']].append(r['plantXY'])
C = {k: np.mean(np.array(v, float), axis=0) for k, v in P.items()}
SR = 260
st = collections.defaultdict(lambda: collections.defaultdict(list))
for d in names:
    raw = pd.read_csv(os.path.join(DEMOS, d + '_ticks.csv.gz'), usecols=['tick','steamid','team_num','active_weapon_name','is_alive','is_warmup_period'])
    raw = raw[(raw.is_alive == True) & (raw.is_warmup_period != True)]
    tk = ticks_of(d); tk = tk[tk.side == 'T']
    dth = event(d, 'player_death')
    for r in RR[d]:
        if r['num'] >= 24: continue
        t0 = r['t0']
        w = raw[(raw.tick >= t0) & (raw.tick < t0 + 30*64) & (raw.team_num == 2)]
        best = []
        for sid, g in w.groupby('steamid'):
            ks = [key(x) for x in g.active_weapon_name.unique()]; ks = [k for k in ks if k]
            pr = [k for k in ks if k not in PIST and k in PRICE and k not in ('HE','MOLOTOV','ZEUS')]
            p1 = max(pr, key=lambda k: PRICE[k]) if pr else None
            best.append(2 if p1 in RIF else (1 if p1 else 0))
        if len(best) < 4: continue
        typ = 'пистолетка' if r['num'] in (0, 12) else rtype(best)
        if typ == 'эко' and sum(1 for b in best if b == 2) == 1: typ = 'эко+хиро'
        S = st[typ]; S['n'].append(1)
        S['plant'].append(1 if r.get('tplant') else 0)
        if r.get('tplant'): S['tplant'].append((r['tplant'] - t0)/64)
        dd = dth[(dth.tick > t0) & (dth.tick < r['t1'])]
        S['fk'].append((dd.tick.min() - t0)/64 if len(dd) else 999)
        S['ctdead25'].append(int(((dd.tick < t0 + 25*64) & (dd.user_team_num == 3)).sum()))
        S['tdead25'].append(int(((dd.tick < t0 + 25*64) & (dd.user_team_num == 2)).sum()))
        # first moment >=3 T within SR of a site centre
        rt = tk[(tk.tick >= t0) & (tk.tick < r['t1'])]
        commit = None; spread20 = None
        for tt, g in rt[rt.tick % 32 == 0].groupby('tick'):
            xy = g[['x','y']].values
            n = max(int((np.hypot(xy[:,0]-c[0], xy[:,1]-c[1]) < SR).sum()) for c in C.values())
            if commit is None and n >= 3: commit = (tt - t0)/64
            if spread20 is None and tt - t0 >= 20*64:
                # how many T are far from the group centroid (>600 px): spread
                cen = xy.mean(axis=0); spread20 = int((np.hypot(xy[:,0]-cen[0], xy[:,1]-cen[1]) > 500).sum())
        S['commit'].append(commit if commit is not None else 999)
        S['spread20'].append(spread20 if spread20 is not None else -1)
out = {}
for typ, S in st.items():
    n = len(S['n']); cm = np.array(S['commit']); fk = np.array(S['fk'])
    out[typ] = {'раундов': n, 'плант %': round(100*np.mean(S['plant'])), 'плант медиана с': round(float(np.median(S['tplant'])),1) if S['tplant'] else None,
      'первый фраг медиана с': round(float(np.median(fk)),1), 'первый фраг <15 с %': round(100*np.mean(fk < 15)),
      '3+ T на сайте к 25 с % (раш/быстро)': round(100*np.mean(cm <= 25)), '3+ T на сайте 25–50 с %': round(100*np.mean((cm > 25) & (cm <= 50))),
      '3+ T на сайте позже 50 с или никогда %': round(100*np.mean(cm > 50)),
      'CT убито до 25 с (среднее)': round(float(np.mean(S['ctdead25'])),2), 'T убито до 25 с': round(float(np.mean(S['tdead25'])),2),
      'T вдали от группы на 20 с (среднее)': round(float(np.mean([x for x in S['spread20'] if x >= 0])),2)}
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
