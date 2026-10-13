#!/usr/bin/env python3
"""(v272, пункт 3) Носитель по пути на плант: за 10 с до планта — был ли свой ≤350 px от того, кто поставил (только моменты,
когда кто-то из своих жив). Про — 88 демок (ставящий из bomb_planted), боты — tools/measure/runs/<метка>/rec_*.json.
python3 tools/measure/audit/carrier_plant.py <метка>…"""
import sys, os, glob, json
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); M = os.path.dirname(HERE); ROOT = os.path.dirname(os.path.dirname(M))
def stat(R, P, planter):   # planter: rid -> id
    P = P[P.alive & (P.team == 'T')]; G = {k: g for k, g in P.groupby('rid')}
    sh = []; win = []
    for r in R[R.plant.notna()].itertuples():
        pid = planter.get(r.rid); g = G.get(r.rid)
        if pid is None or g is None: continue
        w = g[(g.tick >= r.plant - 10*64) & (g.tick < r.plant)]
        me = w[w.id == pid]; ot = w[w.id != pid]
        if not len(me) or not len(ot): continue
        al = []
        for t, x, y in zip(me.tick, me.x, me.y):
            o = ot[(ot.tick > t - 16) & (ot.tick <= t + 16)]
            if len(o): al.append(np.hypot(o.x - x, o.y - y).min() > 350)
        if al: sh.append(np.mean(al)); win.append(al[-1])
    return {'плантов': len(sh), 'носитель один (нет своего ≤350) % времени за 10 с до планта': round(100*np.mean(sh), 1),
            'один в момент планта %': round(100*np.mean(win), 1)}
if __name__ == '__main__':
    R, K, P = pd.read_pickle('/home/claude/audit3/pro_RKP.pkl')
    D = os.path.join(ROOT, 'data', 'demos'); pl = {}
    for r in R[R.plant.notna()].itertuples():
        demo = r.rid.split('|')[0]
        f = os.path.join(D, demo + '_bomb_planted.csv.gz')
        if demo not in pl: pl[demo] = pd.read_csv(f) if os.path.exists(f) else None
    planter = {}
    for r in R[R.plant.notna()].itertuples():
        b = pl.get(r.rid.split('|')[0])
        if b is None: continue
        q = b[b.tick == r.plant]
        if len(q): planter[r.rid] = float(q.user_steamid.iloc[0])
    P = P.assign(id=P.id.astype(float))
    print('про', stat(R, P, planter))
    sys.path.insert(0, M); os.chdir(M); import metrics as MX
    for lab in sys.argv[1:]:
        files = sorted(glob.glob(os.path.join(M, 'runs', lab, 'rec_*.json')))
        R, K, P = MX.load_bot(files); planter = {}; PL = {}
        for r in R[R.plant.notna()].itertuples():
            q = P[(P.rid == r.rid) & (P.team == 'T') & P.alive & (P.tick <= r.plant) & (P.tick > r.plant - 32)]
            fn = [f for f in files if f.split('/')[-1] == r.rid.split('|')[0]][0]
            d = PL.get(fn) or PL.setdefault(fn, json.load(open(fn))['plants'])
            pp = [p for p in d if p[0] == r.plant]
            if len(q) and pp: planter[r.rid] = q.iloc[np.hypot(q.x - pp[0][2], q.y - pp[0][3]).argmin()].id
        print(lab, stat(R, P, planter))
