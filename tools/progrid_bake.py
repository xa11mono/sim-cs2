#!/usr/bin/env python3
"""Сетки «где стоят и куда смотрят про» для игры (v318: --map, формат v166 — MAP.pro.prior / look / spots).

python3 tools/progrid_bake.py --map <карта>  → <pro_dir>/progrid.json (tools/demos_bake.py кладёт поля в pro.json набора)
Вход — <pro_dir>/pro_samples.csv.gz (tools/pro.py). Слои: сторона | фаза — early (< 20 с), setup (< 50 с), late (до планта),
postA / postB (после планта на A / B) — как ppLayer в игре; места (spots) — pre (до планта) / post.
  prior — где стоят: доля снимков «стоит» (скорость < 25 ед./с) в клетке 32×32 (n 64), сглаживание 3×3, максимум слоя = 1;
          в файле — [номер клетки (cy·n + cx), значение ×1000], клетки меньше 10 не пишутся (как у Ancient).
  look  — куда смотрят стоящие: клетка 48×48 (n 42, номер cy·42 + cx — как читает игра), средний взгляд [dx, dy], его
          собранность R (0..1, клетки с R < 0,3 не пишутся) и число снимков (до 999); клетка — от 12 снимков.
  spots — места, где стоят: максимумы плотности «стоит» (клетка 16, сглаживание 3×3, окно 3×3), в каждом —
          [x, y, раундов, угол взгляда (рад, atan2(dy, dx)), доля взгляда, (второй угол, доля)]; от 5 раундов.
Пороги spots и look — проектные числа (подобраны так, чтобы объём был как у Ancient v166).
Раньше (v237) скрипт писал src/data/progrid.json ветки rebuild-v238 (другая сетка, CELL 24) — заменено.
"""
import json, math, os, sys

import numpy as np
import pandas as pd
from scipy.ndimage import maximum_filter, uniform_filter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402

MAPNAME = mapdir.current()
PRIOR_C, PRIOR_N = 32, 64
LOOK_C, LOOK_N = 48, 42
LOOK_MIN, LOOK_R = 12, 0.3
SPOT_C, SPOT_MIN = 16, 5
MODE_W = math.radians(30)     # взгляд «туда же» — в пределах ±30° от моды — проектное число
MODE2_SEP, MODE2_SHARE = math.radians(60), 0.15   # второй взгляд — дальше 60° от первого и не реже 15 % — проектное число


def layers(P):
    for side in ('CT', 'T'):
        for ph in ('early', 'setup', 'late'):
            yield '%s|%s' % (side, ph), P[(P.side == side) & (P.phase == ph)]
        for site in ('A', 'B'):
            yield '%s|post%s' % (side, site), P[(P.side == side) & (P.phase == 'post') & (P.site == site)]


def prior(P):
    out = {}
    for k, d in layers(P):
        s = d[d.still]
        g = np.zeros((PRIOR_N, PRIOR_N))
        np.add.at(g, (np.clip((s.y // PRIOR_C).astype(int), 0, PRIOR_N - 1), np.clip((s.x // PRIOR_C).astype(int), 0, PRIOR_N - 1)), 1)
        g = uniform_filter(g, 3)
        if g.max() > 0:
            g = g / g.max()
        v = np.round(g * 1000).astype(int)
        out[k] = [[int(i), int(v.flat[i])] for i in np.nonzero(v.ravel() >= 10)[0]]
    return out


def look(P):
    out = {}
    for k, d in layers(P):
        s = d[d.still]
        cx = (s.x // LOOK_C).astype(int).values; cy = (s.y // LOOK_C).astype(int).values
        ok = (cx < LOOK_N) & (cy < LOOK_N)
        idx = cy[ok] * LOOK_N + cx[ok]
        cnt = np.bincount(idx, minlength=LOOK_N * LOOK_N)
        sx = np.bincount(idx, weights=s.dx.values[ok], minlength=LOOK_N * LOOK_N)
        sy = np.bincount(idx, weights=s.dy.values[ok], minlength=LOOK_N * LOOK_N)
        L = []
        for i in np.nonzero(cnt >= LOOK_MIN)[0]:
            R = math.hypot(sx[i], sy[i]) / cnt[i]
            if R < LOOK_R:
                continue
            L.append([int(i), round(sx[i] / cnt[i] / R, 2), round(sy[i] / cnt[i] / R, 2), round(R, 2), int(min(999, cnt[i]))])
        out[k] = L
    return out


def modes(ang):
    """1–2 направления взгляда: [(угол, доля)]"""
    if not len(ang):
        return []
    res = []
    left = np.ones(len(ang), bool)
    for _ in range(2):
        a = ang[left]
        if not len(a):
            break
        h, e = np.histogram(a, bins=24, range=(-math.pi, math.pi))
        c = (e[h.argmax()] + e[h.argmax() + 1]) / 2
        near = np.abs((ang - c + math.pi) % (2 * math.pi) - math.pi) < MODE_W
        m = near & left
        mu = math.atan2(np.sin(ang[m]).mean(), np.cos(ang[m]).mean())
        sh = m.sum() / len(ang)
        if res and (sh < MODE2_SHARE or abs((mu - res[0][0] + math.pi) % (2 * math.pi) - math.pi) < MODE2_SEP):
            break
        res.append((mu, sh))
        left &= ~near
    return res


def spots(P):
    out = {}
    n = 2048 // SPOT_C + 1
    for side in ('CT', 'T'):
        for ph, sel in (('pre', P.phase != 'post'), ('post', P.phase == 'post')):
            s = P[(P.side == side) & sel & P.still]
            ix = np.clip((s.x // SPOT_C).astype(int).values, 0, n - 1); iy = np.clip((s.y // SPOT_C).astype(int).values, 0, n - 1)
            g = np.zeros((n, n)); np.add.at(g, (iy, ix), 1)
            gs = uniform_filter(g, 3) * 9
            pk = (gs == maximum_filter(gs, 3)) & (gs >= SPOT_MIN * 4)
            X, Y, A, RID = s.x.values, s.y.values, np.arctan2(s.dy.values, s.dx.values), s.rid.values
            L = []
            for i, j in zip(*np.nonzero(pk)):
                cx, cy = j * SPOT_C + SPOT_C / 2, i * SPOT_C + SPOT_C / 2
                m = (np.abs(X - cx) < SPOT_C * 1.5) & (np.abs(Y - cy) < SPOT_C * 1.5)
                r = len(set(RID[m]))
                if r < SPOT_MIN:
                    continue
                md = modes(A[m])
                row = [round(float(np.median(X[m])), 1), round(float(np.median(Y[m])), 1), r]
                for mu, sh in md:
                    row += [round(mu, 3), round(sh, 2)]
                L.append(row)
            L.sort(key=lambda q: (-q[2], q[0], q[1]))
            out['%s|%s' % (side, ph)] = L
    return out


def main():
    f = os.path.join(mapdir.pro_dir(MAPNAME), 'pro_samples.csv.gz')
    P = pd.read_csv(f, usecols=['x', 'y', 'dx', 'dy', 'side', 'phase', 'still', 'site', 'rid'])
    P['still'] = P.still.astype(bool)
    nd = P.rid.str.split('|').str[0].nunique()
    out = {'prior': {'cell': PRIOR_C, 'n': PRIOR_N, 'layers': prior(P),
                     'src': '%d про-демок %s, только моменты "стоит" (скорость < 25 ед. карты/с), сглаживание 3x3, max=1 на слой' % (nd, mapdir.title(MAPNAME))},
           'look': {'cell': LOOK_C, 'n': LOOK_N, 'layers': look(P)},
           'spots': spots(P)}
    o = os.path.join(mapdir.pro_dir(MAPNAME), 'progrid.json')
    json.dump(out, open(o, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('записано %s: prior %s; look %s; spots %s' % (os.path.relpath(o, mapdir.ROOT),
          {k: len(v) for k, v in out['prior']['layers'].items()}, sum(len(v) for v in out['look']['layers'].values()),
          {k: len(v) for k, v in out['spots'].items()}))


if __name__ == '__main__':
    main()
