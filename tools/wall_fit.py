#!/usr/bin/env python3
"""(М140, В2) Стены набора не заходят туда, где стоят про: правка walls.json по демкам.

python3 tools/wall_fit.py --map ancient [--keep=31,…] [--dry] [--report=путь.json]

Правило (физика игры, не статистика): центр игрока не бывает ближе 16 ед. (полкорпуса, 6,4 px радара) к стене. Значит, где
про на земле стояли (демки: tools/measure/engine/demo_prep.py → runs/e0a_vis/<карта>_hgt.json), стены нет на 16 ед. вокруг.
Стена набора, которая туда заходит, обрезается ровно по этой границе; там, где про не бывали, стена не трогается, новых
стен не появляется. «На земле» — высота точки у пола навмеша рядом (±30 ед.): кто стоит на ящике / бусте сверху, стену не режет
(там возвышение, а не проход). Одиночные точки (сбой записи, прыжок у стены) — не в счёт: нужно ≥ OCC_MIN точек про в
круге OCC_R px. --keep — номера стен, которые не трогать (решение владельца: Boost у выхода из A Main).
Отчёт — по каждой стене: сколько срезано и где (подпись Simple Radar); картинки до/после — tools/measure/engine/wallfit_shots.py."""
import sys, os, json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import contourpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402

BODY_U = 16.0   # полкорпуса игрока CS2, ед. игры (хитбокс-корпус 32 × 32)
OCC_R = 2       # px радара: круг, где считаются точки про
OCC_MIN = 3     # точек про в круге — «здесь стоят» (меньше — одиночный выброс) — проектное число
GROUND_DZ = 30  # ед. игры: точка «на земле», если пол навмеша рядом на этой высоте
NAV_R = 12      # px: пол навмеша ищется не дальше (навмеш отступает от стен на полкорпуса)
SIMPLIFY = 0.6  # px: упрощение контура обрезанной стены (меньше клетки сетки видимости)
S = 2           # растр 0,5 px


def simplify(P, eps):
    def dp(pts):
        if len(pts) < 3:
            return pts
        (x0, y0), (x1, y1) = pts[0], pts[-1]
        L = math.hypot(x1 - x0, y1 - y0) or 1e-9
        best, bi = -1, 0
        for i in range(1, len(pts) - 1):
            d = abs((x1 - x0) * (y0 - pts[i][1]) - (x0 - pts[i][0]) * (y1 - y0)) / L
            if d > best:
                best, bi = d, i
        if best <= eps:
            return [pts[0], pts[-1]]
        return dp(pts[:bi + 1])[:-1] + dp(pts[bi:])
    far = max(range(len(P)), key=lambda i: (P[i][0] - P[0][0]) ** 2 + (P[i][1] - P[0][1]) ** 2)
    return dp(P[:far + 1])[:-1] + dp(P[far:] + [P[0]])[:-1]


def area(P):
    return abs(sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))) / 2


def main():
    name = mapdir.current()
    opt = {a.split('=')[0][2:]: (a.split('=', 1)[1] if '=' in a else True) for a in sys.argv[1:] if a.startswith('--')}
    keep = {int(x) for x in str(opt.get('keep', '')).split(',') if x.strip()}
    upx = json.load(open(mapdir.path(name, 'map.json')))['pxUnits']
    body = BODY_U / upx
    WP = mapdir.path(name, 'walls.json'); polys = json.load(open(WP))['polys']
    H = np.array(json.load(open(os.path.join(mapdir.ROOT, 'tools', 'measure', 'runs', 'e0a_vis', f'{name}_hgt.json'))))
    N = 2048 * S
    # пол навмеша: верхний и нижний, ближайший участок не дальше NAV_R
    top = np.full((N, N), np.nan, np.float32); low = np.full((N, N), np.nan, np.float32)
    # участки навмеша на самих препятствиях (верх ящика / буста внутри стены набора) — не «земля»: кто стоит там, стену не режет
    from matplotlib.path import Path as _P
    WPATH = [_P(np.array(q)) for q in polys]
    def on_wall(a):
        P = [(q['x'], q['y']) for q in a['points']]; c = (sum(x for x, _ in P) / len(P), sum(y for _, y in P) / len(P))
        return any(w.contains_point(c) for w in WPATH)
    navs = [a for a in mapdir.load_nav(name) if not on_wall(a)]
    for a in navs:
        P = [(p['x'] * S, p['y'] * S) for p in a['points']]
        xs = [p[0] for p in P]; ys = [p[1] for p in P]
        x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)) + 2, int(max(ys)) + 2
        mm = Image.new('L', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(mm).polygon([(x - x0, y - y0) for x, y in P], fill=1, outline=1)
        mk = np.asarray(mm).astype(bool); z = a['z']
        t = top[y0:y1, x0:x1]; l = low[y0:y1, x0:x1]
        t[mk & ~(t >= z)] = z; l[mk & ~(l <= z)] = z
    for R in (top, low):
        miss = np.isnan(R)
        d, (iy, ix) = ndimage.distance_transform_edt(miss, return_indices=True)
        R[:] = R[iy, ix]; R[d > NAV_R * S] = np.nan
    i = (H[:, 1] * S).astype(int).clip(0, N - 1); j = (H[:, 0] * S).astype(int).clip(0, N - 1)
    gz = (np.abs(H[:, 2] - top[i, j]) < GROUND_DZ) | (np.abs(H[:, 2] - low[i, j]) < GROUND_DZ)
    occ = np.zeros((N, N), np.int32)
    np.add.at(occ, (i[gz], j[gz]), 1)
    r = OCC_R * S; yy, xx = np.ogrid[-r:r + 1, -r:r + 1]; disk = (xx * xx + yy * yy) <= r * r
    cnt = ndimage.convolve(occ, disk.astype(np.int32), mode='constant')
    stand = cnt >= OCC_MIN
    free = ndimage.distance_transform_edt(~stand) < body * S        # ближе полкорпуса к месту, где стоят про
    print(f'{name}: точек про на земле {gz.sum()} из {len(H)}; «здесь стоят» {stand.sum() / S / S:.0f} px²')
    CO = mapdir.callouts(name)
    place = lambda x, y: min(CO, key=lambda c: (c[1] - x) ** 2 + (c[2] - y) ** 2)[0]
    out, rep = [], []
    for wi, p in enumerate(polys):
        if wi in keep:
            out.append(p); continue
        xs = [q[0] for q in p]; ys = [q[1] for q in p]
        x0, y0 = max(0, int(min(xs) * S) - 2), max(0, int(min(ys) * S) - 2)
        x1, y1 = min(N, int(max(xs) * S) + 3), min(N, int(max(ys) * S) + 3)
        mm = Image.new('L', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(mm).polygon([(x * S - x0, y * S - y0) for x, y in p], fill=1, outline=0)
        wm = np.asarray(mm).astype(bool); cut = wm & free[y0:y1, x0:x1]
        if cut.sum() < 4 * S * S:     # меньше 4 px² — не правка
            out.append(p); continue
        rest = ndimage.binary_fill_holes(wm & ~cut)        # про внутри стены, не у края (островок) — стена остаётся
        lab, nl = ndimage.label(rest)
        cy, cx = np.argwhere(cut).mean(0)
        pieces = []
        for k in range(1, nl + 1):
            z = np.zeros((rest.shape[0] + 2, rest.shape[1] + 2)); z[1:-1, 1:-1] = lab == k
            for pts, offs in zip(*contourpy.contour_generator(z=z, line_type='SeparateCode', fill_type='OuterOffset').filled(0.5, 2.0)):
                P = [((float(x) - 1 + x0) / S, (float(y) - 1 + y0) / S) for x, y in pts[offs[0]:offs[1]][:-1]]
                P = simplify(P, SIMPLIFY)
                if len(P) >= 3 and area(P) >= 8:
                    pieces.append([[round(x, 1), round(y, 1)] for x, y in P])
        out.extend(pieces)
        rep.append({'wall': wi, 'place': place((cx + x0) / S, (cy + y0) / S), 'cut_px2': round(float(cut.sum()) / S / S),
                    'pieces': len(pieces), 'bbox': [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))]})
    for r_ in sorted(rep, key=lambda r_: -r_['cut_px2']):
        print(f"  стена {r_['wall']:3d} ({r_['place']}): срезано {r_['cut_px2']} px², кусков {r_['pieces']}")
    print(f'стен было {len(polys)}, стало {len(out)}; правлено {len(rep)}')
    if opt.get('report'):
        json.dump(rep, open(opt['report'], 'w'), ensure_ascii=False, indent=1)
    if not opt.get('dry'):
        open(WP, 'w', encoding='utf-8').write('{\n"polys": ' + json.dumps(out, separators=(',', ':')) + '\n}\n')
        print('записано', os.path.relpath(WP, mapdir.ROOT))


if __name__ == '__main__':
    main()
