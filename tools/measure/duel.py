"""Детектор (v251): как быстро убивают боты — как tools/duel_bake.py у про (до планта, фраги из оружия).
Запуск: python3 tools/measure/duel.py <run> [<run> …]"""
import json, os, sys, collections
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
shots, ttk, first_k, hs, n = [], [], 0, 0, 0
for run in sys.argv[1:]:
    for f in sorted(os.listdir(os.path.join(HERE, 'runs', run))):
        if not f.startswith('rec_'): continue
        d = json.load(open(os.path.join(HERE, 'runs', run, f)))
        plants = [p[0] for p in d['plants']] if d['plants'] and isinstance(d['plants'][0], list) else []
        R = [(int(r['t0']), int(r['t1'])) for r in d['rounds'] if 't1' in r]
        F = collections.defaultdict(list)
        for s in d['shots']: F[s[1]].append(s[0])
        for k in d['kills']:
            tk, a, at, u, ut, w, h = k[0], k[1], k[2], k[5], k[6], str(k[9]), k[10]
            if not a or at == ut or w in ('HE', 'MOLOTOV', 'молотов', 'KNIFE'): continue
            rr = [r for r in R if r[0] <= tk <= r[1]]
            if not rr or any(rr[0][0] <= pt <= tk for pt in plants): continue
            fa = [t for t in F[a] if tk - 192 <= t <= tk]
            if not fa: continue
            n += 1; hs += bool(h); shots.append(len(fa)); ttk.append((tk - min(fa))/64)
            fu = [t for t in F[u] if tk - 192 <= t <= tk]
            if not fu or min(fa) <= min(fu): first_k += 1
pro = json.load(open(os.path.join(HERE, '..', '..', 'src', 'data', 'trades.json')))['duel']
bot = {'n': n, 'выстрелов на фраг, медиана': float(np.median(shots)), 'выстрелов на фраг, среднее': float(np.mean(shots)),
       'от первого выстрела до фрага, медиана с': float(np.median(ttk)), 'убийца начал перестрелку %': first_k/n, 'хэдшот %': hs/n}
for k in pro:
    print(f"{k:42} про {pro[k]:.2f} | боты {bot[k]:.2f}")
