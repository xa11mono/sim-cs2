#!/usr/bin/env python3
"""(v272) Подмена/подтяжка после смерти: дошёл ли кто-то из своих до места смерти (≤400 px) за 3 / 15 с, до планта.
Про — 88 демок (metrics.load_pro), боты — tools/measure/runs/<метка>/rec_*.json. python3 tools/measure/audit/refill.py <метка>…"""
import sys, os, glob
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); M = os.path.dirname(HERE); sys.path.insert(0, M)
os.chdir(M)
import metrics as MX
def stat(R, K, P):
    R = R.set_index('rid'); K = K[K.attT != K.vicT].copy(); K['plant'] = K.rid.map(R.plant)
    K = K[K.plant.isna() | (K.tick < K.plant)]
    P = P[P.alive]; G = {k: g for k, g in P.groupby('rid')}
    out = {}
    for side in ('T', 'CT'):
        n = a3 = a15 = 0
        for r in K[K.vicT == side].itertuples():
            g = G.get(r.rid)
            if g is None: continue
            q = g[(g.team == side) & (g.id != r.vic) & (g.tick > r.tick - 16) & (g.tick <= r.tick + 15*64)]
            q = q[np.hypot(q.x - r.vx, q.y - r.vy) <= 400]
            if not len(g[(g.team == side) & (g.id != r.vic) & (g.tick > r.tick)]): continue   # своих живых не осталось
            n += 1; a15 += len(q) > 0; a3 += (q.tick <= r.tick + 3*64).any()
        out[side] = {'смертей': n, 'дошли за 3 с %': round(100*a3/max(1, n), 1), 'никто за 15 с %': round(100*(n-a15)/max(1, n), 1)}
    return out
if __name__ == '__main__':
    pk = '/home/claude/audit3/pro_RKP.pkl'
    R, K, P = pd.read_pickle(pk) if os.path.exists(pk) else MX.load_pro()
    print('про', stat(R, K, P))
    for lab in sys.argv[1:]:
        R, K, P = MX.load_bot(sorted(glob.glob(os.path.join(M, 'runs', lab, 'rec_*.json'))))
        print(lab, stat(R, K, P))
