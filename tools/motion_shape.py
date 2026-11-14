"""В147 (14.11.2026, владелец: «проценты близко — разница в ВИЗУАЛЕ»): форма движения точки и конуса — одна мерка для про и ботов.

Считается только то, что видно на радаре: позиция (ед. игры) и взгляд (yaw, °) каждый тик (64 Гц), выстрел, «в воздухе». Клавиши не
нужны: стрейф, выглядывание, прыжок — по самому движению (одинаково у про и ботов).
Куски (контекст «перестрелка» — свой выстрел ±1,5 с):
  strafe   — нога стрейфа в перестрелке (скорость ≤ 160 ед./с): поперечная к взгляду скорость одного знака > 20 ед./с подряд —
             длина (ед.), время (тики), пик (ед./с); смены в минуту перестрелки
  turn     — поворот конуса: подряд |Δyaw| > 0,3°/тик (≥ 2 тиков) — угол, время, пик °/тик, перелёт (обратное движение в 8 тиков
             после), число рывков внутри (локальные пики); отдельно в перестрелке и вне; покой — доля тиков |Δyaw| < 0,05°
  peek     — выглядывание: стоял (≤ 15 ед./с ≥ 0,5 с) → отошёл и вернулся к месту (≤ 20 ед.) за ≤ 3 с — вынос (ед.), время выхода /
             возврата (тики), поворот взгляда за выход (°)
  air      — прыжок (в воздухе ≥ 6 тиков): поворот взгляда за полёт (сумма |Δyaw| и итог), пауза до следующего прыжка и поворот между
  run      — бег (> 200 ед./с, вне перестрелки): угол взгляда к ходу (°), поворот хода на 100 ед. пути (°)
Сравнение — квантили 10/25/50/75/90 каждого признака; разница % = среднее |q_бот − q_про| / (|q_про| + ε) по пяти квантилям.
Запуск:
  python3 tools/motion_shape.py --map mirage --pro                      → tools/shadow/shape_pro_<карта>.json (+ печать)
  python3 tools/motion_shape.py --map mirage --bots <папка bshape_*.json> → таблица про / бот / разница
Боты — запись каждого тика tools/measure/motion/bot_shape.js.txt (облако), формат: {bot: {t, x, y, z, f, s, a}} (px радара, рад)."""
import sys, os, json, glob, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
MAP = mapdir.current()
HERE = os.path.dirname(os.path.abspath(__file__))
Q = [10, 25, 50, 75, 90]


def series_pro():
    import pandas as pd
    D = os.path.join(mapdir.path(MAP, ''), 'demos')
    for f in sorted(glob.glob(os.path.join(D, '*_motion.csv.gz'))):
        d = pd.read_csv(f, usecols=lambda c: c in ('tick', 'steamid', 'X', 'Y', 'Z', 'yaw', 'is_alive', 'shots_fired', 'velocity_Z'), low_memory=False)
        yield from series_df(d)


def series_df(d):
    """куски непрерывного движения живых игроков из таблицы тиков демки (поля tick, steamid, X, Y, yaw, is_alive, shots_fired, velocity_Z)"""
    if True:
        d = d[d.is_alive == True].sort_values(['steamid', 'tick'])  # noqa: E712
        for sid, g in d.groupby('steamid'):
            tk = g.tick.values
            cut = np.where(np.diff(tk) != 1)[0] + 1   # непрерывные куски
            for a, b in zip(np.r_[0, cut], np.r_[cut, len(tk)]):
                if b - a < 64: continue
                sf = g.shots_fired.fillna(0).values[a:b]
                vz = g.velocity_Z.fillna(0).values[a:b]; air = np.zeros(b - a, bool); up = False
                for i in range(b - a):   # прыжок: старт — скорость вверх > 150 ед./с, конец — снова на земле (|vz| < 1); лестницы и склоны — не прыжок
                    if not up and vz[i] > 150: up = True
                    elif up and abs(vz[i]) < 1: up = False
                    air[i] = up
                yield {'x': g.X.values[a:b].astype(float), 'y': g.Y.values[a:b].astype(float), 'yaw': g.yaw.values[a:b].astype(float),
                       'shot': np.r_[False, np.diff(sf) > 0], 'air': air}


def series_bots(folder):
    for f in sorted(glob.glob(os.path.join(folder, 'bshape_*.json'))):
        J = json.load(open(f)); k = J.get('pxu', 2.5)
        for key, s in J['bots'].items():
            t = np.array(s['t']); cut = np.where(np.diff(t) != 1)[0] + 1
            for a, b in zip(np.r_[0, cut], np.r_[cut, len(t)]):
                if b - a < 64: continue
                yield {'x': np.array(s['x'][a:b]) * k, 'y': -np.array(s['y'][a:b]) * k, 'yaw': -np.degrees(np.array(s['f'][a:b])),
                       'shot': np.array(s['s'][a:b]) > 0, 'air': np.array(s['a'][a:b]) > 0}


def runs(mask):
    """(начало, конец) подряд идущих True"""
    m = np.r_[False, mask, False].astype(int); d = np.diff(m)
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def features(SER, clips=None, per=8):
    """clips — список, куда сложить эталонные куски для страницы сравнения (до per каждого вида): {k, x, y, yaw} каждый тик, ±0,5 с"""
    F = collections.defaultdict(list); T = collections.Counter(); CN = collections.Counter()
    def clip(kind, a, b, s):
        if clips is None or CN[kind] >= per or T['_seq'] % 7: return
        lo, hi = max(0, a - 32), min(len(s['x']), b + 32)
        if hi - lo > 320: return
        CN[kind] += 1; clips.append({'k': kind, 'x': [round(float(v), 1) for v in s['x'][lo:hi]], 'y': [round(float(v), 1) for v in s['y'][lo:hi]],
                                     'yaw': [round(float(v), 1) for v in s['yaw'][lo:hi]], 'air': [int(v) for v in s['air'][lo:hi]]})
    for s in SER:
        x, y, yaw, shot, air = s['x'], s['y'], s['yaw'], s['shot'], s['air']
        n = len(x)
        vx = np.r_[0, np.diff(x)] * 64; vy = np.r_[0, np.diff(y)] * 64; v = np.hypot(vx, vy)
        dyaw = np.r_[0, (np.diff(yaw) + 180) % 360 - 180]
        fight = np.zeros(n, bool)
        for i in np.where(shot)[0]: fight[max(0, i - 96):i + 96] = True
        ar = np.radians(yaw); vlat = -np.sin(ar) * vx + np.cos(ar) * vy   # поперёк взгляда
        T['ticks'] += n; T['fight'] += int(fight.sum())
        # стрейф
        okS = fight & (v <= 160) & ~air
        for sg in (1, -1):
            for a, b in runs(okS & (vlat * sg > 20)):
                if b - a < 2: continue
                F['strafe_len'].append(float(np.abs(vlat[a:b]).sum() / 64)); F['strafe_ticks'].append(b - a); F['strafe_peak'].append(float(np.abs(vlat[a:b]).max()))
                T['legs'] += 1; T['_seq'] += 1; clip('strafe', a, b, s)
        # поворот конуса
        ad = np.abs(dyaw); T['still'] += int((ad < 0.05).sum())
        for a, b in runs(ad > 0.3):
            if b - a < 2: continue
            ctx = 'f' if fight[a:b].any() else 'n'
            seg = dyaw[a:b]; sgn = np.sign(seg.sum()) or 1
            post = dyaw[b:b + 8]; over = float(-(post[post * sgn < 0]).sum() * sgn) if len(post) else 0.0
            sub = int(((ad[a + 1:b - 1] > ad[a:b - 2]) & (ad[a + 1:b - 1] >= ad[a + 2:b])).sum()) if b - a > 2 else 1
            F['turn_ang_' + ctx].append(float(abs(seg.sum()))); F['turn_ticks_' + ctx].append(b - a); F['turn_peak_' + ctx].append(float(ad[a:b].max()))
            F['turn_over_' + ctx].append(over); F['turn_sub_' + ctx].append(max(1, sub)); T['_seq'] += 1; clip('turn_' + ctx, a, b, s)
        # выглядывание
        st = v <= 15 * 1.0
        i = 0
        while i < n - 32:
            if st[i:i + 32].all():
                j = i + 32
                while j < n and st[j]: j += 1
                x0, y0 = x[j - 1], y[j - 1]; k = j; mx = 0.0; kmax = j
                while k < min(n, j + 192):
                    dd = np.hypot(x[k] - x0, y[k] - y0)
                    if dd > mx: mx, kmax = dd, k
                    if mx > 25 and dd <= 20:
                        F['peek_out'].append(float(mx)); F['peek_tout'].append(kmax - j); F['peek_tback'].append(k - kmax)
                        F['peek_yaw'].append(float(np.abs(dyaw[j:kmax + 1]).sum())); clip('peek', j, k, s); break
                    k += 1
                i = max(k, j)
            else: i += 1
        # прыжки
        AR = [(a, b) for a, b in runs(air) if b - a >= 6]
        for idx, (a, b) in enumerate(AR):
            F['air_yawsum'].append(float(np.abs(dyaw[a:b]).sum())); F['air_yawnet'].append(float(abs(dyaw[a:b].sum()))); T['_seq'] += 1; clip('air', a, b, s)
            if idx + 1 < len(AR) and AR[idx + 1][0] - b < 128:
                F['air_gap'].append(int(AR[idx + 1][0] - b)); F['air_between'].append(float(abs(dyaw[b:AR[idx + 1][0]].sum())))
        # бег
        okR = (v > 200) & ~fight & ~air
        hd = np.degrees(np.arctan2(vy, vx))
        dif = np.abs((hd - yaw + 180) % 360 - 180)
        F['run_lookoff'] += list(dif[okR][::8].astype(float))
        for a, b in runs(okR):
            if b - a < 32: continue
            path = float(v[a:b].sum() / 64); turn = float(np.abs(np.diff(np.unwrap(np.radians(hd[a:b])))).sum() * 57.3)
            if path > 100: F['run_turn100'].append(turn / path * 100)
    T['mins_fight'] = T['fight'] / 64 / 60
    F['_strafe_per_min'] = [T['legs'] / max(1e-6, T['mins_fight'])]; F['_still_share'] = [T['still'] / max(1, T['ticks'])]
    return F


def qs(F):
    return {k: [float(np.percentile(v, q)) for q in Q] + [len(v)] for k, v in F.items() if len(v)}


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    pf = os.path.join(HERE, 'shadow', 'shape_pro_%s.json' % MAP)
    pcd = next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--pcd=')), None)
    if pcd:   # признаки с ПК (tools/demo_events_pc.py, режим motion + shape): все демки карты, все раунды, каждый тик
        import gzip
        F = collections.defaultdict(list); nd = 0
        for f in glob.glob(os.path.join(pcd, '**', '*-%s_shape.json.gz' % MAP), recursive=True):
            J = json.load(gzip.open(f, 'rt', encoding='utf-8')); nd += 1
            for k, v in J.items():
                if not k.startswith('_'): F[k] += v
        print('про: демок %d' % nd); P = qs(F); json.dump(P, open(pf, 'w'))
    elif '--pro' in sys.argv or not os.path.exists(pf):
        P = qs(features(series_pro())); json.dump(P, open(pf, 'w'))
    P = json.load(open(pf))
    B = qs(features(series_bots(a[0]))) if a else None
    print('%-16s %-40s %-40s %s' % ('признак', 'про q10/25/50/75/90 (n)', 'бот', 'разница'))
    tot = []
    for k in sorted(P):
        p = P[k]; line = '%-16s %-40s' % (k, ' '.join('%.3g' % v for v in p[:5]) + ' (%d)' % p[5])
        if B and k in B:
            b = B[k]; d = np.mean([abs(b[i] - p[i]) / (abs(p[i]) + 1e-3 + 0.05 * abs(p[2])) for i in range(5)]) * 100; tot.append(d)
            line += ' %-40s %3.0f %%' % (' '.join('%.3g' % v for v in b[:5]) + ' (%d)' % b[5], d)
        print(line)
    if tot: print('средняя разница формы: %.0f %%' % np.mean(tot))


if __name__ == '__main__':
    main()
