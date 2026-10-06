#!/usr/bin/env python3
"""(v196) Взгляд стоя: в стену и в спину своим — по записям прогона measure.py.
python3 tools/measure/lookwall.py <папка прогона> [...]
Берутся живые боты, стоящие (сдвиг < 3 px за 0,25 с) в бою и вне боя одинаково:
  - «в стену»: по направлению взгляда стена ближе 50 px (стены data/walls.json);
  - «в спину своему»: по направлению взгляда (±15°) в 60–500 px стоит свой и он
    не дальше стены по этому лучу.
Доли — % замеров стоя по стороне."""
import sys, os, json, glob, math
import numpy as np
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W = np.array(json.load(open(os.path.join(ROOT, 'data', 'walls.json')))['w'], dtype=float)
def ray(x, y, a, R=600):
    dx, dy = math.cos(a), math.sin(a)
    sx = W[:, 2]-W[:, 0]; sy = W[:, 3]-W[:, 1]; den = dx*sy - dy*sx
    qx = W[:, 0]-x; qy = W[:, 1]-y
    with np.errstate(divide='ignore', invalid='ignore'):
        t = (qx*sy - qy*sx)/den; u = (qx*dy - qy*dx)/den
    ok = (np.abs(den) > 1e-9) & (t > 0) & (u >= 0) & (u <= 1)
    return float(t[ok].min()) if ok.any() else R
for d in sys.argv[1:]:
    st = {'CT': [0, 0, 0], 'T': [0, 0, 0]}
    for f in sorted(glob.glob(os.path.join(d, 'rec_*.json'))):
        R = json.load(open(f)); last = {}; byt = {}
        for r in R['pos']: byt.setdefault(r[0], []).append(r)
        for t in sorted(byt):
            rows = byt[t]
            for r in rows:
                _, bid, ct, x, y, al, fa = r[:7]; prev = last.get(bid); last[bid] = (t, x, y)
                if not al or not prev or t - prev[0] != 16 or math.hypot(x-prev[1], y-prev[2]) >= 3: continue
                if (t // 16) % 4: continue          # каждый 4-й замер (1 с) — ради скорости
                s = 'CT' if ct == 1 else 'T'; st[s][0] += 1
                L = ray(x, y, fa)
                if L < 50: st[s][1] += 1
                for o in rows:
                    if o[1] == bid or not o[5] or o[2] != ct: continue
                    dd = math.hypot(o[3]-x, o[4]-y)
                    if 60 < dd < 500 and dd < L and abs(math.atan2(math.sin(math.atan2(o[4]-y, o[3]-x)-fa), math.cos(math.atan2(o[4]-y, o[3]-x)-fa))) < 0.26:
                        st[s][2] += 1; break
    for s in ('CT', 'T'):
        n = max(1, st[s][0])
        print('%s %s: замеров стоя %d · в стену (<50 px) %.1f%% · в спину своему %.1f%%' % (os.path.basename(d.rstrip('/')), s, st[s][0], 100*st[s][1]/n, 100*st[s][2]/n))
