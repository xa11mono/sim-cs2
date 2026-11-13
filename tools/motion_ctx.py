"""В140: в каких ситуациях про качаются A ↔ D и как делают контрстрейф (выгрузка каждого тика, <демка>_motion.csv.gz).
Ситуации: перестрелка — свой выстрел за ±1,5 с; иначе по скорости: держит / медленно (< 100 ед./с), идёт (100–200), бежит (≥ 200).
Контрстрейф перед первой пулей винтовки: была нажата сторона, потом встречная — сколько тиков от нажатия встречной до выстрела, и скорость
в момент выстрела. Запуск: python3 tools/motion_ctx.py --map mirage"""
import sys, os, glob, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demos  # noqa: E402
RIFLES = ('AK-47', 'M4A4', 'M4A1-S', 'Galil AR', 'FAMAS', 'AUG', 'SG 553')


def main():
    T = collections.Counter(); SW = collections.Counter(); HL = collections.defaultdict(list); GAP = collections.defaultdict(list); cst = []; csv_ = []; amp = collections.defaultdict(list)
    for f in sorted(glob.glob(os.path.join(demos.DEMOS, '*_motion.csv.gz'))):
        d = pd.read_csv(f, low_memory=False, usecols=['tick', 'steamid', 'is_alive', 'LEFT', 'RIGHT', 'velocity_X', 'velocity_Y', 'shots_fired', 'active_weapon_name', 'X', 'Y', 'yaw'])
        d = d[d.is_alive == True].sort_values(['steamid', 'tick'])  # noqa: E712
        for sid, g in d.groupby('steamid'):
            tk = g.tick.values; v = np.hypot(g.velocity_X.fillna(0).values, g.velocity_Y.fillna(0).values); sf = g.shots_fired.fillna(0).values
            L = g.LEFT.values.astype(bool); R = g.RIGHT.values.astype(bool); w = g.active_weapon_name.astype(str).values; cont = np.r_[False, np.diff(tk) == 1]
            X = g.X.values; Y = g.Y.values; yaw = np.radians(g.yaw.values.astype(float))
            shot = np.where((np.diff(sf, prepend=sf[0]) > 0) & cont)[0]
            near = np.zeros(len(tk), bool)
            for i in shot: near[max(0, i - 96):i + 97] = True
            ctx = np.where(near, 'перестрелка', np.where(v < 100, 'держит / медленно', np.where(v < 200, 'идёт', 'бежит')))
            side = np.where(L & ~R, -1, np.where(R & ~L, 1, 0)); last = 0; lt = None; run = 0; rs = None; gs = None
            for i in range(len(tk)):
                c = ctx[i]; T[c] += 1
                if not cont[i]: last = 0; lt = None; run = 0; continue
                s = side[i]
                if s and s != last:
                    if last and lt is not None and tk[i] - lt < 40: SW[c] += 1
                    last = s; lt = tk[i]
                if s: 
                    if not run:
                        rs = i
                        if gs is not None and i - gs < 128: GAP[c].append(i - gs)
                    run += 1
                elif run:
                    HL[c].append(run)
                    # размах качания: смещение поперёк взгляда за нажатие (ед.)
                    a = yaw[rs]; dx = X[i] - X[rs]; dy = Y[i] - Y[rs]; amp[c].append(abs(-np.sin(a) * dx + np.cos(a) * dy)); run = 0; gs = i
            for i in shot:
                if w[i] not in RIFLES or sf[i] != 1: continue
                a = max(0, i - 20); seg = side[a:i]
                if (seg == 1).any() and (seg == -1).any():
                    # последняя смена стороны перед выстрелом
                    k = i - 1
                    while k > a and side[k] == 0: k -= 1
                    s0 = side[k]; j = k
                    while j > a and side[j] in (0, s0): j -= 1
                    cst.append(i - (j + 1)); csv_.append(v[i])
    print('Ситуация            доля времени   смен A↔D в мин   нажатие (медиана, с)   размах качания (медиана, ед.)')
    for c in ('держит / медленно', 'идёт', 'бежит', 'перестрелка'):
        mins = T[c] / 64 / 60
        print('  %-18s %5.1f%%   %8.1f   %10.2f   %10.0f' % (c, 100 * T[c] / sum(T.values()), SW[c] / max(1e-9, mins), np.median(HL[c]) / 64 if HL[c] else 0, np.median(amp[c]) if amp[c] else 0))
    for c0 in ('держит / медленно', 'идёт', 'перестрелка'):
        Hh = np.array(HL[c0]) / 64; Gg = np.array(GAP[c0]) / 64
        print('  «%s»: нажатие, с, квантили 10/25/50/75/90:' % c0, [round(float(x), 3) for x in np.percentile(Hh, [10, 25, 50, 75, 90])],
              '| пауза между нажатиями, с:', [round(float(x), 2) for x in np.percentile(Gg, [10, 25, 50, 75, 90])] if len(Gg) else None)
    for c0 in ('держит / медленно', 'перестрелка', 'идёт'):
        A = np.array(amp[c0]); A = A[A > 0.5]
        print('  размах качания «%s», квантили 10/25/50/75/90 %%, ед.:' % c0, [round(float(x), 1) for x in np.percentile(A, [10, 25, 50, 75, 90])])
    c = np.array(cst); cv = np.array(csv_)
    print('Контрстрейф перед первой пулей (%d): от нажатия встречной до выстрела — медиана %.0f мс (25–75 %%: %.0f–%.0f мс); скорость при выстреле медиана %.0f ед./с' % (
        len(c), np.median(c) / 64 * 1000, np.percentile(c, 25) / 64 * 1000, np.percentile(c, 75) / 64 * 1000, np.median(cv)))


if __name__ == '__main__':
    main()
