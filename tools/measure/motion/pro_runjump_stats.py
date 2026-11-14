"""В144: прыжки на бегу по ровному у про (12 демок Mirage) — цели для ботов: поворот хода за полёт (по корзинам и квантили), поворот камеры,
A/D в воздухе (в сторону поворота / против / обе), скорость после / до, полёт. Запуск: python3 -I tools/measure/motion/pro_runjump_stats.py --map mirage"""
import sys, os, glob, collections
import numpy as np, pandas as pd
sys.path.insert(0, 'tools'); import demos  # noqa: E402
B = [0, 15, 30, 60, 90, 180]; R = collections.defaultdict(list); C = collections.Counter()
for f in sorted(glob.glob(os.path.join(demos.DEMOS, '*_motion.csv.gz'))):
    d = pd.read_csv(f, low_memory=False, usecols=['tick', 'steamid', 'is_alive', 'Z', 'velocity_X', 'velocity_Y', 'velocity_Z', 'yaw', 'LEFT', 'RIGHT'])
    d = d[d.is_alive == True].sort_values(['steamid', 'tick'])  # noqa: E712
    for sid, g in d.groupby('steamid'):
        tk = g.tick.values; n = len(tk); cont = np.r_[False, np.diff(tk) == 1]
        vx = g.velocity_X.fillna(0).values; vy = g.velocity_Y.fillna(0).values; vz = g.velocity_Z.fillna(0).values; v = np.hypot(vx, vy); Z = g.Z.values
        yaw = g.yaw.values.astype(float); L = g.LEFT.values.astype(bool); Rr = g.RIGHT.values.astype(bool); hd = np.degrees(np.arctan2(vy, vx))
        i = 8
        while i < n - 8:
            if cont[i] and vz[i] > 200 and vz[i - 1] < 50:
                j = i
                while j < n and cont[j] and (abs(vz[j]) > 1 or j - i < 3): j += 1
                if (j - i) / 64 >= 0.3 and j + 6 < n and abs(Z[j] - Z[i - 1]) <= 20 and v[i - 2] > 150:
                    mv = (hd[j + 4] - hd[i - 2] + 180) % 360 - 180 if v[j + 4] > 50 else 0.0   # знак: + влево (против часовой в координатах игры)
                    cam = (yaw[j] - yaw[i - 1] + 180) % 360 - 180
                    R['mv'].append(abs(mv)); R['cam'].append(abs(cam)); R['keep'].append(v[j + 4] / v[i - 2]); R['air'].append((j - i) / 64)
                    b = next(k for k in range(len(B) - 1) if abs(mv) <= B[k + 1]); C[b] += 1
                    l = L[i:j].any(); r = Rr[i:j].any(); C['ad'] += l or r; C['both'] += l and r
                    if abs(mv) >= 15 and (l or r) and not (l and r): C['turn1'] += 1; C['toward'] += (mv > 0 and l) or (mv < 0 and r)   # A — влево
                    C['n'] += 1; R['adfrac'].append(((L[i:j] | Rr[i:j]).mean()))
                    R['camsame'].append(np.sign(cam) == np.sign(mv) if abs(mv) >= 15 and abs(cam) >= 5 else None)
                i = max(i + 1, j); continue
            i += 1
q = lambda a: [round(float(x), 2) for x in np.percentile(a, [10, 25, 50, 75, 90])]
print('прыжков на бегу по ровному:', C['n'])
print('поворот хода за полёт по корзинам %s:' % B, [round(100 * C[k] / C['n']) for k in range(len(B) - 1)])
for k in ('mv', 'cam', 'keep', 'air', 'adfrac'): print('  %s: %s' % (k, q(R[k])))
print('  A/D в воздухе: %d%%, обе стороны за полёт: %d%%; при одной стороне и повороте ≥ 15° — в сторону поворота %d%%' % (100 * C['ad'] / C['n'], 100 * C['both'] / C['n'], 100 * C['toward'] / max(1, C['turn1'])))
cs = [x for x in R['camsame'] if x is not None]; print('  камера в ту же сторону, что ход (поворот ≥ 15°, камера ≥ 5°): %d%% из %d' % (100 * np.mean(cs), len(cs)))
