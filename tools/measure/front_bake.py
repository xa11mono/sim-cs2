#!/usr/bin/env python3
"""Кто из T гибнет первым: самый передний (ближе всех к сайту, где потом поставили бомбу) или нет — одно определение для
про и ботов (роли у про не размечены, поэтому сравнение по месту, а не по роли). Раунды с плантом, первая смерть T до
планта. Плюс: разменяли ли первую смерть T за 3 с и сколько T было в 350 px от погибшего.
python3 tools/measure/front_bake.py <метка бота>…"""
import sys, os, glob, json, pickle, collections
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); os.chdir(HERE)
import metrics as MX
SITE = {'A': (630, 518), 'B': (1533, 845)}
def bake(R, K, P):
    R = R.set_index('rid'); C = collections.Counter(); P = P[P.alive]
    G = {k: g for k, g in P.groupby('rid')}
    for rid, r in R.iterrows():
        if r.plant != r.plant or r.plant is None or r.site not in SITE: continue
        kk = K[(K.rid == rid) & (K.vicT == 'T') & (K.tick < r.plant)].sort_values('tick')
        if not len(kk) or rid not in G: continue
        k = kk.iloc[0]; g = G[rid]; tk = g.tick.values
        t = tk[tk <= k.tick].max() if (tk <= k.tick).any() else None
        if t is None: continue
        s = g[(g.tick == t) & (g.team == 'T')]
        if len(s) < 3 or k.vic not in set(s.id): continue
        d = np.hypot(s.x - SITE[r.site][0], s.y - SITE[r.site][1]).values; ids = list(s.id)
        rank = int((d < d[ids.index(k.vic)]).sum())
        C['n'] += 1; C['ранг %d' % min(rank, 2)] += 1
        v = s[s.id == k.vic].iloc[0]; near = ((np.hypot(s.x - v.x, s.y - v.y) <= 350).sum() - 1)
        C['рядом свой'] += near > 0
        tr = K[(K.rid == rid) & (K.vicT == 'CT') & (K.tick > k.tick) & (K.tick <= k.tick + 192) & (K.vic == k.att)]
        C['разменяли'] += len(tr) > 0
    n = max(1, C['n'])
    return {'первых смертей T (раунды с плантом)': C['n'], 'погиб самый передний %': round(100*C['ранг 0']/n, 1), 'второй %': round(100*C['ранг 1']/n, 1),
            'третий и дальше %': round(100*C['ранг 2']/n, 1), 'рядом (350 px) был свой %': round(100*C['рядом свой']/n, 1), 'убийцу разменяли за 3 с %': round(100*C['разменяли']/n, 1)}
if __name__ == '__main__':
    R, K, P = pickle.load(open('/home/claude/audit3/pro_RKP.pkl', 'rb')) if os.path.exists('/home/claude/audit3/pro_RKP.pkl') else MX.load_pro()
    out = {'про': bake(R, K, P)}
    for lab in sys.argv[1:]:
        out[lab] = bake(*MX.load_bot(sorted(glob.glob(os.path.join(HERE, 'runs', lab, 'rec_*.json')))))
    for k in out['про']: print(f'{k:40}', ' | '.join(f'{n} {out[n][k]}' for n in out))
