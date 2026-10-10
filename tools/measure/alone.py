"""Детектор (v248): смерть до планта — был ли свой ближе 350 px, отдельно T и CT; про — tools/alone_bake.py (92 демки).
Запуск: python3 tools/measure/alone.py <run> [<run> …]"""
import json, sys, os, math, bisect, collections
HERE = os.path.dirname(os.path.abspath(__file__))
st = {'T': [0, 0], 'CT': [0, 0]}
for run in sys.argv[1:]:
    for f in sorted(os.listdir(os.path.join(HERE, 'runs', run))):
        if not f.startswith('rec_'): continue
        d = json.load(open(os.path.join(HERE, 'runs', run, f)))
        plants = [p[0] for p in d['plants']] if d['plants'] and isinstance(d['plants'][0], list) else []
        R = [(int(r['t0']), int(r['t1'])) for r in d['rounds'] if 't1' in r]
        pos = collections.defaultdict(list)
        for p in d['pos']: pos[p[0]].append(p)
        ticks = sorted(pos)
        for k in d['kills']:
            t, a, at, ax, ay, u, ut, ux, uy = k[:9]
            if not a or at == ut: continue
            rr = [r for r in R if r[0] <= t <= r[1]]
            if not rr or any(rr[0][0] <= pt <= t for pt in plants): continue
            i = bisect.bisect_right(ticks, t) - 1
            if i < 0: continue
            mates = [p for p in pos[ticks[i]] if p[5] and p[1] != u and ((p[2] == 1) == (ut == 'CT')) and math.hypot(p[3]-ux, p[4]-uy) <= 350]
            st[ut][1] += 1; st[ut][0] += bool(mates)
pro = json.load(open(os.path.join(HERE, '..', '..', 'src', 'data', 'trades.json')))
for s in ('T', 'CT'):
    print(f"смерть до планта, свой рядом (≤350): {s} — про {pro['mate_near_'+s]:.0%} | боты {st[s][0]/max(1,st[s][1]):.0%} (n={st[s][1]})")
