# (v176) Детекторы взгляда В8/В9/В10 по прогонам measure.py (поле ld в rec_*.json,
# считает rec2.js) + В10 у про (data/pro/pro_samples.csv.gz).
#   python3 tools/measure/lookdet.py <папка прогона> [<папка2> ...]
#   python3 tools/measure/lookdet.py pro
import sys, os, json, glob
import numpy as np
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SITES = {'A': (630, 518), 'B': (1533, 845)}
def pro():
    import pandas as pd
    d = pd.read_csv(os.path.join(ROOT, 'data', 'pro', 'pro_samples.csv.gz'))
    d = d[(d.phase == 'post') & (d.side == 'CT') & (d.still) & (d.site.isin(['A', 'B']))]
    sx = d.site.map(lambda s: SITES[s][0]); sy = d.site.map(lambda s: SITES[s][1])
    vx, vy = sx - d.x, sy - d.y; dist = np.hypot(vx, vy)
    m = (dist >= 450) & (dist <= 1400)
    cos = (vx * d.dx + vy * d.dy) / (dist * np.hypot(d.dx, d.dy)).clip(lower=1e-9)
    back = cos[m] < np.cos(np.radians(100))
    print(f"В10 у про (все CT после планта, сбор отдельно не выделить): CT в 450–1400 px от сайта стоит спиной к сайту: {back.mean()*100:.1f}% ({m.sum()} замеров)")
def bots(run):
    S = {'CT': {}, 'T': {}, 'rt': {}}
    for f in sorted(glob.glob(os.path.join(run, 'rec_*.json'))):
        L = json.load(open(f)).get('ld')
        if not L: continue
        for k in S:
            for kk, v in L[k].items():
                if kk != 'ex': S[k][kk] = S[k].get(kk, 0) + v
    p = lambda a, b: round(100 * a / b, 1) if b else None
    out = {}
    for t in ('CT', 'T'):
        s = S[t]; n = s.get('n', 0)
        out[f'В9 {t}: смотрит туда, куда враг сейчас дойти не может, % времени стоя'] = p(s.get('unreach', 0), n)
        out[f'В9 {t}: …хотя рядом видна зона, куда враг мог дойти, %'] = p(s.get('unreachAlt', 0), n)
        out[f'В8 {t}: смотрит на угол, открытый >20 с без инфы, %'] = p(s.get('stale', 0), n)
    out['В10 CT: сбор на ретейк, 450–1400 px от сайта, стоит спиной к сайту, %'] = p(S['rt'].get('back', 0), S['rt'].get('n', 0))
    return out
if __name__ == '__main__':
    if sys.argv[1] == 'pro': pro(); sys.exit()
    R = [bots(r) for r in sys.argv[1:]]
    for k in R[0]: print(f"{k[:75]:75s} " + " ".join(f"{str(r.get(k)):>7s}" for r in R))
