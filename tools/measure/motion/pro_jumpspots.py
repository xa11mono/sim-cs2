"""В144: прыжки про по местам (12 демок Mirage, каждый тик): запрыги (≥ 40 ед. выше), по ровному (срез угла), со спрыгом.
По каждому месту: сколько, скорость до отрыва и после приземления, присед в воздухе, A/D в воздухе, поворот камеры в воздухе, поворот хода
(срез угла: направление хода до отрыва → после приземления). Запуск: python3 -I tools/measure/motion/pro_jumpspots.py --map mirage"""
import sys, os, glob, collections, json
import numpy as np, pandas as pd
sys.path.insert(0, 'tools'); import demos, mapdir  # noqa: E402
g2m = mapdir.game_to_map(demos.MAPNAME); CO = mapdir.callouts(demos.MAPNAME)
def name(x, y): return min(CO, key=lambda c: (c[1] - x) ** 2 + (c[2] - y) ** 2)[0] if CO else '?'
def ad(a, b): return abs((a - b + 180) % 360 - 180)
E_ = []
for f in sorted(glob.glob(os.path.join(demos.DEMOS, '*_motion.csv.gz'))):
    d = pd.read_csv(f, low_memory=False, usecols=['tick', 'steamid', 'is_alive', 'X', 'Y', 'Z', 'velocity_X', 'velocity_Y', 'velocity_Z', 'yaw',
                                                    'LEFT', 'RIGHT', 'FORWARD', 'ducking', 'team_num'])
    d = d[d.is_alive == True].sort_values(['steamid', 'tick'])  # noqa: E712
    for sid, g in d.groupby('steamid'):
        tk = g.tick.values; n = len(tk); cont = np.r_[False, np.diff(tk) == 1]
        vx = g.velocity_X.fillna(0).values; vy = g.velocity_Y.fillna(0).values; vz = g.velocity_Z.fillna(0).values; v = np.hypot(vx, vy)
        Z = g.Z.values; X = g.X.values; Y = g.Y.values; yaw = g.yaw.values.astype(float); dk = g.ducking.fillna(False).values.astype(bool)
        L = g.LEFT.values.astype(bool); R = g.RIGHT.values.astype(bool); tm = g.team_num.values
        i = 8
        while i < n - 8:
            if cont[i] and vz[i] > 200 and vz[i - 1] < 50:
                j = i
                while j < n and cont[j] and (abs(vz[j]) > 1 or j - i < 3): j += 1
                if (j - i) / 64 >= 0.3 and j + 6 < n:
                    h0 = np.degrees(np.arctan2(vy[i - 2], vx[i - 2])); h1 = np.degrees(np.arctan2(vy[j + 4], vx[j + 4]))
                    mx, my = g2m(X[i], Y[i]); dz = Z[j] - Z[i - 1]
                    E_.append(dict(x=mx, y=my, dz=dz, sp0=v[i - 2], sp1=v[j + 4], air=(j - i) / 64, duck=bool(dk[i:j].any()), duck0=bool(dk[i - 4:i].any()),
                                   ad=bool((L[i:j] | R[i:j]).any()), cam=ad(yaw[j], yaw[i - 1]), mv=ad(h1, h0) if v[i - 2] > 50 and v[j + 4] > 50 else None,
                                   lead=ad(yaw[i - 1], h0) if v[i - 2] > 50 else None, side='T' if tm[0] == 2 else 'CT'))
                i = max(i + 1, j); continue
            i += 1
print('прыжков (полёт ≥ 0,3 с):', len(E_))
def kind(e): return 'запрыг' if e['dz'] >= 40 else ('спрыг' if e['dz'] <= -40 else 'по ровному')
def summ(L):
    q = lambda a: [round(float(x)) for x in np.percentile(a, [25, 50, 75])] if len(a) else None
    mv = [e['mv'] for e in L if e['mv'] is not None]; ld = [e['lead'] for e in L if e['lead'] is not None]
    return 'n=%d скорость до %s → после %s | присед в воздухе %d%% (перед отрывом %d%%) | A/D %d%% | камера %s° | ход повернул %s° (≥ 30°: %d%%) | взгляд от хода при отрыве %s°' % (
        len(L), q([e['sp0'] for e in L]), q([e['sp1'] for e in L]), 100 * np.mean([e['duck'] for e in L]), 100 * np.mean([e['duck0'] for e in L]),
        100 * np.mean([e['ad'] for e in L]), q([e['cam'] for e in L]), q(mv), 100 * np.mean(np.array(mv) >= 30) if mv else 0, q(ld))
K = collections.defaultdict(list)
for e in E_: K[kind(e)].append(e)
for k, L in K.items(): print('%-10s %s' % (k, summ(L)))
G = collections.defaultdict(list)
for e in E_: G[(kind(e), round(e['x'] / 40), round(e['y'] / 40))].append(e)
print('\nместа (≥ 15 прыжков):')
for key, L in sorted(G.items(), key=lambda kv: -len(kv[1])):
    if len(L) < 15: break
    x = np.mean([e['x'] for e in L]); y = np.mean([e['y'] for e in L])
    print('  %-10s %-14s (%4.0f,%4.0f) T %d%% %s' % (key[0], name(x, y), x, y, 100 * np.mean([e['side'] == 'T' for e in L]), summ(L)))
json.dump([dict(e, kind=kind(e)) for e in E_], open('/tmp/pro_jumps.json', 'w'))
