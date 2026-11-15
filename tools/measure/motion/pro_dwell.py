"""В147: сколько про держат взгляд между поворотами ≥ 5° (тики; квантили 10/25/50/75/90) — стоит / шагом / бегом / бой; для удержания точки
взгляда (270 smoothLookFilter). Пишет поле dwell в data/maps/<карта>/turnmodel.json. Запуск: python3 tools/measure/motion/pro_dwell.py --map mirage"""
import sys, os, json, collections
sys.path[:0] = [os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), g) for g in ('map', 'ct', 'pro', 'marks', 'logs', 'motion', 'page')]   # (15.11) модули tools/ разложены по группам
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import mapdir  # noqa: E402
MAP = mapdir.current()
import motion_shape as M  # noqa: E402
D = collections.defaultdict(list)
PATH_DEG = 25   # проектное число
for s in M.series_pro():
    x, y, yaw, shot = s['x'], s['y'], s['yaw'], s['shot']; v = np.r_[0, np.hypot(np.diff(x), np.diff(y))] * 64
    fight = np.zeros(len(x), bool)
    for i in np.where(shot)[0]: fight[max(0, i - 96):i + 96] = True
    dy = np.r_[0, (np.diff(yaw) + 180) % 360 - 180]; ad = np.abs(dy)
    m = np.r_[False, ad > 0.3, False].astype(int); d = np.diff(m)
    T = [(a, b) for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0]) if b - a >= 2 and abs(dy[a:b].sum()) >= 5]
    for (a1, b1), (a2, b2) in zip(T, T[1:]):
        g = a2 - b1; sp = np.median(v[b1:a2]) if a2 > b1 else v[b1]
        D['fight' if fight[b1:a2].any() else 'stand' if sp < 15 else 'walk' if sp < 170 else 'run'].append(g)
out = {k: [float(np.percentile(v, q)) for q in (10, 25, 50, 75, 90)] for k, v in D.items()}
print(out)
fp = os.path.join(mapdir.path(MAP, ''), 'turnmodel.json'); J = json.load(open(fp)); J['dwell'] = out
if '--json' in sys.argv: json.dump(J, open(fp, 'w'))
