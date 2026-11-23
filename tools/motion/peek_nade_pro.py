"""Д30 (18.11, владелец: «короткий пик, только с гранатой»): что делают про вокруг броска гранаты — по демкам с каждым тиком (*_motion.csv.gz)
и броскам (weapon_fire_full). За 2 с до броска: стоял ли (скорость < 20 ед./с хотя бы 0,3 с), был ли короткий пик (вышел вбок A/D ≤ 40 ед. и
вернулся), сдвиг в момент броска от места стойки; за 1 с после — ушёл ли назад (к месту стойки / дальше от точки броска). Запуск:
python3 tools/motion/peek_nade_pro.py [--map mirage]"""
import sys, os, glob, math, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import demos as D  # noqa: E402
NADE = {'weapon_molotov': 'молотов', 'weapon_incgrenade': 'молотов', 'weapon_flashbang': 'флешка', 'weapon_smokegrenade': 'смок', 'weapon_hegrenade': 'HE'}
C = collections.defaultdict(collections.Counter); MOV = collections.defaultdict(list)
for f in sorted(glob.glob(os.path.join(D.DEMOS, '*_motion.csv.gz'))):
    demo = os.path.basename(f).replace('_motion.csv.gz', '')
    wf = glob.glob(os.path.join(D.DEMOS, demo + '_weapon_fire_full.csv.gz'))
    if not wf: continue
    th = pd.read_csv(wf[0], usecols=['tick', 'user_steamid', 'weapon']); th = th[th.weapon.isin(NADE)]
    d = pd.read_csv(f, usecols=['tick', 'steamid', 'LEFT', 'RIGHT', 'FORWARD', 'BACK', 'X', 'Y', 'velocity_X', 'velocity_Y', 'is_alive'], low_memory=False)
    d = d[d.is_alive == True]  # noqa: E712
    G = {s: g.sort_values('tick') for s, g in d.groupby('steamid')}
    for _, t in th.iterrows():
        g = G.get(int(t.user_steamid))
        if g is None: continue
        w = g[(g.tick >= t.tick - 128) & (g.tick <= t.tick + 64)]
        if len(w) < 150: continue
        tk = w.tick.values; x = w.X.values; y = w.Y.values; sp = np.hypot(w.velocity_X.fillna(0), w.velocity_Y.fillna(0)).values
        L = w.LEFT.values.astype(bool); R = w.RIGHT.values.astype(bool); Fw = (w.FORWARD.values | w.BACK.values).astype(bool)
        i0 = np.searchsorted(tk, t.tick); kind = NADE[t.weapon]
        pre = slice(0, i0)
        stood = any(sp[k:k + 20].max() < 20 for k in range(0, max(1, i0 - 20), 4))
        lat = (L[pre] ^ R[pre]) & ~Fw[pre]
        # короткий пик до броска: от последней стойки — вбок ≤ 40 ед. и обратно
        jig = False
        st = [k for k in range(0, max(1, i0 - 20)) if sp[k:k + 20].max() < 20]
        if st:
            k0 = st[-1] + 20; x0, y0 = x[min(k0, i0)], y[min(k0, i0)]
            mx = max((math.hypot(x[k] - x0, y[k] - y0) for k in range(min(k0, i0), i0 + 1)), default=0)
            jig = lat.any() and mx <= 40
            MOV[kind].append(math.hypot(x[i0] - x0, y[i0] - y0))
        v_thr = sp[i0]
        moving = v_thr > 60
        back = False
        if st and i0 + 64 < len(x):
            back = math.hypot(x[i0 + 60] - x0, y[i0 + 60] - y0) < math.hypot(x[i0] - x0, y[i0] - y0) - 5
        c = C[kind]; c['n'] += 1; c['стоял до броска'] += stood; c['A/D до броска'] += bool(lat.any()); c['короткий пик (≤40 и назад)'] += jig
        c['бросил на ходу (>60 ед./с)'] += moving; c['после броска ушёл назад'] += back
for k, c in C.items():
    n = c['n']; m = MOV[k]
    print('%s: бросков %d | %s | сдвиг от места стойки в момент броска (ед.): медиана %.0f' % (k, n, ', '.join('%s %.0f%%' % (q, 100 * v / n) for q, v in c.items() if q != 'n'), np.median(m) if m else -1))
