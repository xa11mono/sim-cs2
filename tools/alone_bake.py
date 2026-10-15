"""Смерть до планта: был ли свой ближе 350 ед. карты (как метрика «смерть до планта: рядом был свой») — по 92 демкам
про, отдельно T и CT. Дописывает в src/data/trades.json поля alone_T / alone_CT (доля смертей, где свой БЫЛ рядом).
Запуск: python3 tools/alone_bake.py"""
import sys, os, glob, math
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from demos import DEMOS, tr, demo_names, rounds_of
near = tot = 0; ns = {2:[0,0],3:[0,0]}
for demo in demo_names():
    rounds = rounds_of(demo)
    plants = {r['num']: r['tplant'] for r in rounds}
    d = pd.read_csv(os.path.join(DEMOS, demo+'_player_death.csv.gz'))
    d = d[(d.attacker_team_num != d.user_team_num) & d.attacker_steamid.notna()]
    if not len(d): continue
    t = pd.read_csv(os.path.join(DEMOS, demo+'_ticks.csv.gz'), usecols=['tick','steamid','team_num','X','Y','is_alive'])
    t = t[t.is_alive == True]
    byt = {k: g for k, g in t.groupby('tick')}
    ticks = np.array(sorted(byt))
    for tk, us, ut, ux, uy, rn in zip(d.tick, d.user_steamid, d.user_team_num, d.user_X, d.user_Y, d.total_rounds_played):
        r = [x for x in rounds if x['t0'] <= tk <= x['t1']]
        if not r or (r[0]['tplant'] and tk >= r[0]['tplant']): continue
        i = np.searchsorted(ticks, tk) - 1
        if i < 0: continue
        g = byt[ticks[i]]; g = g[(g.team_num == ut) & (g.steamid != us)]
        vx, vy = tr(ux, uy)
        dd = [math.hypot(a-vx, b-vy) for a, b in zip(*tr(g.X.values, g.Y.values))]
        tot += 1; ns[int(ut)][1]+=1
        if dd and min(dd) <= 350: near += 1; ns[int(ut)][0]+=1
import json
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'trades.json')
J = json.load(open(F)); J['mate_near_T'] = ns[2][0]/ns[2][1]; J['mate_near_CT'] = ns[3][0]/ns[3][1]; J['mate_near_all'] = near/tot
json.dump(J, open(F, 'w'), ensure_ascii=False, indent=1); print(tot, J['mate_near_all'], J['mate_near_T'], J['mate_near_CT'])
