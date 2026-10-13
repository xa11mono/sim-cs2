#!/usr/bin/env python3
"""(v272, пункт 1) Ранние выходы CT за инфой: в каких зонах CT бывают в первые 35 с раунда (% раундов, где хоть один CT
побывал в зоне) и когда впервые — про (88 демок) и боты (tools/measure/runs/<метка>/rec_*.json).
python3 tools/measure/audit/ct_early.py <метка>…"""
import sys, os, glob
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); M = os.path.dirname(HERE); sys.path.insert(0, M); os.chdir(M)
import metrics as MX
Z = ['A Main', 'Main Hall', 'A Hall', 'A Stairs', 'Mid', 'Lower Mid', 'Ramp', 'Cave']
def stat(R, P):
    R = R.set_index('rid'); P = P[P.alive & (P.team == 'CT')].copy()
    P['sec'] = (P.tick - P.rid.map(R.t0)) / 64; P = P[(P.sec >= 0) & (P.sec < 35)]
    P['z'] = MX.zone_of(P.x.values, P.y.values)
    n = P.rid.nunique(); out = {}
    for z in Z:
        q = P[P.z == z]
        if not len(q): out[z] = '0 %'; continue
        f = q.groupby('rid').sec.min()
        out[z] = f'{100*len(f)/n:.1f} % (впервые на {f.median():.1f} с)'
    return out
if __name__ == '__main__':
    pk = '/home/claude/audit3/pro_RKP.pkl'
    R, K, P = pd.read_pickle(pk) if os.path.exists(pk) else MX.load_pro()
    print('про', stat(R, P))
    for lab in sys.argv[1:]:
        R, K, P = MX.load_bot(sorted(glob.glob(os.path.join(M, 'runs', lab, 'rec_*.json'))))
        print(lab, stat(R, P))
