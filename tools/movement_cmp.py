"""Движение про и ботов одной меркой (снимки раз в 16 тиков = 0,25 с, живые, от конца закупки до конца раунда): доля времени стоит / шагом /
бегом (px карты в секунду: < 10 / 10–60 / > 60; бег 250 ед./с ≈ 100 px/с, шаг 130 ≈ 52), сколько стоят на месте (эпизоды), смены
направления (разворот хода > 120° за 0,25 с при скорости > 20 px/с) в минуту, повороты взгляда (°/с). Запуск:
python3 tools/movement_cmp.py --map mirage <метка прогона ботов> [--demos=12]"""
import sys, os, json, glob, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demos  # noqa: E402
args = [a for a in sys.argv[1:] if not a.startswith('--')]; N = int(next((a.split('=')[1] for a in sys.argv[1:] if a.startswith('--demos=')), 12))


def stats(series):   # series: список траекторий [(t, x, y, ang)] одного игрока за раунд, шаг 16 тиков
    S = collections.Counter(); stand = []; rev = 0; alive = 0.0; yawv = []
    for tr in series:
        run = 0
        for i in range(1, len(tr)):
            t0, x0, y0, a0 = tr[i - 1]; t1, x1, y1, a1 = tr[i]
            if t1 - t0 != 16: run = 0; continue
            v = np.hypot(x1 - x0, y1 - y0) / 0.25; alive += 0.25
            S['стоит' if v < 10 else 'шагом' if v < 60 else 'бегом'] += 1
            if v < 10: run += 1
            else:
                if run >= 4: stand.append(run * 0.25)
                run = 0
            da = abs((a1 - a0 + np.pi) % (2 * np.pi) - np.pi); yawv.append(np.degrees(da) / 0.25)
            if i >= 2:
                tp, xp, yp, _ = tr[i - 2]
                if t0 - tp == 16:
                    vp = np.hypot(x0 - xp, y0 - yp) / 0.25
                    if v > 20 and vp > 20:
                        d = abs((np.arctan2(y1 - y0, x1 - x0) - np.arctan2(y0 - yp, x0 - xp) + np.pi) % (2 * np.pi) - np.pi)
                        if d > np.radians(120): rev += 1
        if run >= 4: stand.append(run * 0.25)
    tot = sum(S.values()) or 1; yawv = np.array(yawv); st = np.array(stand)
    return {'стоит %': round(100 * S['стоит'] / tot), 'шагом %': round(100 * S['шагом'] / tot), 'бегом %': round(100 * S['бегом'] / tot),
            'стоит на месте ≥1 с: медиана, с': round(float(np.median(st)), 1) if len(st) else None, 'из них ≥ 10 с, %': round(100 * float((st >= 10).mean())) if len(st) else None,
            'смен направления в минуту': round(rev / max(1, alive) * 60, 1), 'взгляд: медиана °/с': round(float(np.median(yawv))), 'взгляд: доля > 360°/с, %': round(100 * float((yawv > 360).mean()), 1)}


def pros():
    series = []
    for demo in demos.demo_names()[:N]:
        T = demos.ticks_of(demo)
        for r in demos.rounds_of(demo):
            W = T[(T.tick >= r['t0']) & (T.tick < r['t1'])]
            for sid, g in W.groupby('steamid'):
                g = g.sort_values('tick'); g = g[(g.tick - r['t0']) % 16 == 0]
                series.append(list(zip(g.tick.values.astype(int), g.x.values, g.y.values, np.radians(-g.yaw.values.astype(float)))))
    return stats(series)


def bots(label):
    series = []
    for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'measure', 'runs', label, 'rec_*.json'))):
        d = json.load(open(f)); R = d['rounds']; P = collections.defaultdict(list)
        for p in d['pos']:
            if p[5]: P[p[1]].append((p[0], p[3], p[4], p[6]))
        for i, r in enumerate(R):
            t1 = r.get('t1') or (R[i + 1]['t0'] if i + 1 < len(R) else 1e12)
            for pid, L in P.items():
                tr = [q for q in L if r['t0'] <= q[0] < t1]
                if tr: series.append(tr)
    return stats(series)


A = pros(); B = bots(args[0])
print('%-34s %10s %10s' % ('', 'про', 'боты'))
for k in A: print('%-34s %10s %10s' % (k, A[k], B[k]))
