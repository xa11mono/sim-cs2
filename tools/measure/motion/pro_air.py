"""В144: прыжки, спрыгивания, подсадки, уход за укрытие у про (12 демок Mirage, каждый тик). Запуск: python3 -I tools/measure/motion/pro_air.py --map mirage"""
import sys, os, glob, collections
import numpy as np, pandas as pd
sys.path.insert(0, 'tools'); import demos  # noqa: E402
Q = lambda a, p=(10, 25, 50, 75, 90): [round(float(x), 2) for x in np.percentile(a, p)] if len(a) else None
J = collections.defaultdict(list); C = collections.Counter(); mins = 0.0; DR = collections.defaultdict(list); BO = []; CV = collections.defaultdict(list)
for f in sorted(glob.glob(os.path.join(demos.DEMOS, '*_motion.csv.gz'))):
    d = pd.read_csv(f, low_memory=False, usecols=['tick', 'steamid', 'is_alive', 'X', 'Y', 'Z', 'velocity_X', 'velocity_Y', 'velocity_Z', 'yaw', 'pitch',
                                                    'LEFT', 'RIGHT', 'FORWARD', 'BACK', 'ducking', 'is_walking', 'shots_fired', 'team_num'])
    d = d[d.is_alive == True].sort_values(['steamid', 'tick'])  # noqa: E712
    # подсадка: стоит на тиммейте — над ним (≤ 20 ед. по плоскости, 45–80 выше), оба почти неподвижны
    byt = d.groupby('tick')
    for sid, g in d.groupby('steamid'):
        tk = g.tick.values; n = len(tk); mins += n / 3840; cont = np.r_[False, np.diff(tk) == 1]
        vz = g.velocity_Z.fillna(0).values; v = np.hypot(g.velocity_X.fillna(0).values, g.velocity_Y.fillna(0).values); Z = g.Z.values
        yaw = g.yaw.values.astype(float); pit = g.pitch.values.astype(float); dk = g.ducking.fillna(False).values.astype(bool)
        L = g.LEFT.values.astype(bool); R = g.RIGHT.values.astype(bool); F = g.FORWARD.values.astype(bool); B = g.BACK.values.astype(bool)
        sf = g.shots_fired.fillna(0).values; X = g.X.values; Y = g.Y.values
        dyaw = np.abs((np.diff(yaw, prepend=yaw[0]) + 180) % 360 - 180) * 64
        air = np.abs(vz) > 1
        i = 1; lastland = -999
        while i < n:
            if not cont[i]: i += 1; continue
            if vz[i] > 200 and vz[i - 1] < 50:   # отрыв прыжком (импульс 302 ед./с)
                j = i
                while j < n and cont[j] and (air[j] or j - i < 3): j += 1
                dur = (j - i) / 64; s0 = v[i - 1]
                if dur < 0.3: lastland = j; i = j; continue   # ступенька / лестница, не прыжок
                J['скорость до'].append(s0); J['в воздухе, с'].append(dur)
                C['прыжков'] += 1
                if i - lastland <= 8: C['распрыжка (≤ 0,125 с после приземления)'] += 1
                if dk[i:j].any(): C['с приседом в воздухе'] += 1
                if (L[i:j] | R[i:j]).any() and not F[i:j].all(): C['A/D в воздухе'] += 1
                if F[i:j].any(): C['W в воздухе'] += 1
                if (L[i:j] | R[i:j]).any() and (dyaw[i:j] > 90).mean() > 0.3: C['стрейф в воздухе с поворотом (A/D + мышь > 90 °/с)'] += 1
                J['поворот камеры за прыжок, °'].append(abs((yaw[min(j, n - 1)] - yaw[i - 1] + 180) % 360 - 180))
                J['скорость поворота в воздухе, °/с'].append(np.median(dyaw[i:j]) if j > i else 0)
                J['наклон в воздухе (pitch, + вниз)'].append(np.median(pit[i:j]))
                J['подъём Z после'].append(Z[min(j, n - 1)] - Z[i - 1])
                C['запрыгнул выше (≥ 20 ед.)'] += Z[min(j, n - 1)] - Z[i - 1] >= 20
                C['спрыгнул ниже (≤ −20)'] += Z[min(j, n - 1)] - Z[i - 1] <= -20
                if (np.abs(sf[max(0, i - 128):j + 64] - sf[max(0, i - 129)]) > 0).any() or (np.diff(sf[max(0, i - 128):j + 64]) > 0).any(): C['стрелял ±2 с'] += 1
                lastland = j; i = j; continue
            if vz[i] < -250 and vz[i - 1] > -250 and i - lastland > 20:   # падение без прыжка — спрыгнул
                j = i
                while j < n and cont[j] and vz[j] < -1: j += 1
                h = Z[max(0, i - 12)] - Z[min(j, n - 1)]
                if h > 40:
                    C['спрыгиваний'] += 1; DR['высота, ед.'].append(h); DR['скорость до'].append(v[max(0, i - 12)])
                    DR['наклон при падении'].append(np.median(pit[max(0, i - 12):j])); DR['наклон до'].append(np.median(pit[max(0, i - 40):i - 12]) if i > 40 else 0)
                    C['присел перед приземлением'] += dk[max(i, j - 12):j].any(); C['шифт перед падением'] += g.is_walking.values[max(0, i - 12)] == True  # noqa: E712
                    DR['поворот за падение, °'].append(abs((yaw[min(j, n - 1)] - yaw[max(0, i - 12)] + 180) % 360 - 180))
                lastland = j; i = j; continue
            i += 1
        # уход после очереди: от последней пули (пауза ≥ 0,5 с после) — когда скорость > 100 и куда (назад от взгляда / вбок / вперёд)
        sh = np.where((np.diff(sf, prepend=sf[0]) > 0) & cont)[0]
        for a, b in zip(sh, list(sh[1:]) + [10 ** 9]):
            if b - a < 32 or a + 64 >= n: continue
            k = a
            while k < min(n - 1, a + 64) and v[k] < 100: k += 1
            if v[k] >= 100:
                CV['время до хода > 100, с'].append((k - a) / 64)
                mv = np.degrees(np.arctan2(Y[min(n - 1, k + 8)] - Y[k], X[min(n - 1, k + 8)] - X[k])); rel = abs((mv - yaw[a] + 180) % 360 - 180)
                C['после очереди: ' + ('вперёд' if rel < 45 else ('назад' if rel > 135 else 'вбок'))] += 1
            else: C['после очереди: стоит ≥ 1 с'] += 1
    # подсадки
    T2 = d[['tick', 'steamid', 'X', 'Y', 'Z', 'team_num', 'velocity_Z']].copy(); T2 = T2[T2.tick % 16 == 0]
    for tk, g in T2.groupby('tick'):
        if len(g) < 2: continue
        P = g.values
        for a in P:
            for b in P:
                if a[1] != b[1] and a[5] == b[5] and np.hypot(a[2] - b[2], a[3] - b[3]) < 20 and 45 < a[4] - b[4] < 80 and abs(a[6]) < 5: BO.append(tk)
print('минут живых игроков: %.0f' % mins)
print('прыжков в минуту: %.2f' % (C['прыжков'] / mins))
for k, v in C.items():
    if k != 'прыжков' and not k.startswith('после') and not k.startswith('спрыг') and not k.startswith('присел') and not k.startswith('шифт'): print('  %s: %.0f%%' % (k, 100 * v / C['прыжков']))
for k, v in J.items(): print('  %s, кв 10/25/50/75/90: %s' % (k, Q(v)))
print('спрыгиваний в минуту: %.2f; присел перед приземлением %.0f%%, шифт %.0f%%' % (C['спрыгиваний'] / mins, 100 * C['присел перед приземлением'] / max(1, C['спрыгиваний']), 100 * C['шифт перед падением'] / max(1, C['спрыгиваний'])))
for k, v in DR.items(): print('  %s: %s' % (k, Q(v)))
print('подсадок (тиков по 0,25 с, стоит на тиммейте): %d — %.2f мин на 100 мин' % (len(BO), 100 * len(BO) / 4 / 60 / mins))
tot = sum(v for k, v in C.items() if k.startswith('после очереди'))
print('после очереди (≥ 0,5 с паузы):', {k[15:]: '%.0f%%' % (100 * v / tot) for k, v in C.items() if k.startswith('после очереди')}, '| время до хода > 100:', Q(CV['время до хода > 100, с']))
