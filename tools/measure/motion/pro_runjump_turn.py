"""В144: вероятность прыжка на бегу у про от поворота хода впереди (12 демок Mirage). Бег — скорость ≥ 200, по земле; поворот — направление
хода через 0,75 с минус сейчас; прыжок — отрыв в ближайшие 8 тиков с полётом ≥ 0,3 с. Запуск: python3 -I tools/measure/motion/pro_runjump_turn.py --map mirage"""
import sys, os, glob, collections
import numpy as np, pandas as pd
sys.path.insert(0, 'tools'); import demos  # noqa: E402
N = collections.Counter(); K = collections.Counter(); runmin = 0; jumps = 0
B = [0, 15, 30, 60, 90, 180]
for f in sorted(glob.glob(os.path.join(demos.DEMOS, '*_motion.csv.gz'))):
    d = pd.read_csv(f, low_memory=False, usecols=['tick', 'steamid', 'is_alive', 'velocity_X', 'velocity_Y', 'velocity_Z', 'Z', 'is_walking', 'shots_fired'])
    d = d[d.is_alive == True].sort_values(['steamid', 'tick'])  # noqa: E712
    for sid, g in d.groupby('steamid'):
        tk = g.tick.values; n = len(tk); cont = np.r_[False, np.diff(tk) == 1]
        vx = g.velocity_X.fillna(0).values; vy = g.velocity_Y.fillna(0).values; vz = g.velocity_Z.fillna(0).values; v = np.hypot(vx, vy); Z = g.Z.values
        hd = np.degrees(np.arctan2(vy, vx)); take = np.zeros(n, bool)
        sf = g.shots_fired.fillna(0).values; near = np.zeros(n, bool)   # свой выстрел за ±2 с — не «спокойный» бег (как у бота: 540, RUN_JUMP)
        for s in np.where(np.diff(sf, prepend=sf[0]) > 0)[0]: near[max(0, s - 128):s + 129] = True
        i = 1
        while i < n - 8:
            if cont[i] and vz[i] > 200 and vz[i - 1] < 50:
                j = i
                while j < n and cont[j] and (abs(vz[j]) > 1 or j - i < 3): j += 1
                if (j - i) / 64 >= 0.3 and abs(Z[min(j, n - 1)] - Z[i - 1]) <= 20: take[i] = True
                i = max(i + 1, j); continue
            i += 1
        for i in range(0, n - 56, 8):
            if not (v[i] >= 200 and abs(vz[i]) < 1 and tk[i + 48] - tk[i] == 48) or near[i]: continue
            runmin += 8 / 3840
            t = abs((hd[i + 48] - hd[i] + 180) % 360 - 180); b = next(k for k in range(len(B) - 1) if t <= B[k + 1])
            N[b] += 1; K[b] += take[i:i + 8].any()
print('бег по земле без своих выстрелов ±2 с: %.0f мин; прыжков на бегу (ровно, по началу окна): %d — %.2f в мин бега' % (runmin, sum(K.values()), sum(K.values()) / runmin))
for b in range(len(B) - 1): print('  поворот хода за 0,75 с %3d–%3d°: окон %6d, с прыжком %4d — %.2f%% (в мин бега %.2f)' % (B[b], B[b + 1], N[b], K[b], 100 * K[b] / max(1, N[b]), K[b] / max(1e-9, N[b] * 8 / 3840)))
