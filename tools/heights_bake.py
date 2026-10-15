#!/usr/bin/env python3
"""Высоты и этажи карты: navmesh.json набора (+ радары) → heights.json набора (data/maps/<карта>/).

python3 tools/heights_bake.py [--map ancient] [--simple-radar <папка с de_<карта>_radar*.png|.dds или сам файл>] [--report]
(v318: карта — ключом --map, файлы — в наборе карты; раньше — src/data/ ветки rebuild-v238)

Что считает (всё автоматически, повторяемо — один и тот же вход даёт тот же файл):
  * у каждого участка пола (полигона навмеша) — высота z (как в навмеше,
    единицы игры), уровень lvl (0 — обычный; 1 — участок, под которым есть
    другой проходимый пол: «уровень над уровнем»; нижний такой участок — 0),
    «крыто сверху» cov (1 — над полом крыша/потолок: штриховка Simple Radar;
    без папки Simple Radar берётся прошлый cov из heights.json);
  * лестницы и рампы: соседние участки с плавным перепадом высоты
    (наклон > ~7°, перепад на шаг ≤ 40 ед.), собранные в группы с общим
    подъёмом ≥ 24 ед.; стрелки «вверх» для рисования;
  * уступы: общий край соседних участков с перепадом > 50 ед. и крутизной
    больше 45° — запрыгнуть / только спрыгнуть / не пройти (по связям навмеша);
  * «уровень над уровнем»: пары участков, которые перекрываются в плане и
    разнесены по высоте больше чем на 60 ед. (человек ~72 ед.).
Правки владельца (вкладка «высоты» редактора карты, документ map/heights)
в этот файл вписывает tools/map_pull.py — поле "own"; при пересчёте этим
скриптом поле "own" сохраняется и накладывается поверх автоматического.

--simple-radar: распакованные радары Simple Radar (тот же масштаб и сдвиг,
что официальный radar.png, 1024×1024); штриховка (бирюзовые полосы) = крыто.
Можно дать несколько папок через запятую — участок крыт, если крыт по
большинству.
--report: напечатать, что найдено (по названиям зон).
"""
import json, math, os, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
MAPNAME = mapdir.current()
MAP_TITLE = mapdir.title(MAPNAME)
NAV = mapdir.path(MAPNAME, 'navmesh.json')
OUT = mapdir.path(MAPNAME, 'heights.json')

PX_UNITS = 2.5          # 1 единица карты (0..2048) ≈ 2,5 единицы игры
OVER_DZ = 60            # «уровень над уровнем»: разница высот больше роста человека без малого
OVER_AREA = 6.0         # и перекрытие в плане больше ~6 кв. единиц карты (≈ 6×6 ед. игры)
SLOPE_MIN = 0.12        # рампа/лестница: наклон > ~7°
STEP_MAX = 40           # перепад между соседями в рампе не больше 40 ед.
RAMP_RISE = 24          # группа считается рампой, если поднимает хотя бы на 24 ед.
LEDGE_DZ = 50           # уступ: перепад больше 50 ед.
LEDGE_GRAD = 1.0        # и круче 45° (перепад больше щели между участками)
LEDGE_GAP = 14          # щель между верхним и нижним участком до 14 ед. карты (35 ед. игры)
JUMP_UP = 64            # выше этого без помощи не запрыгнуть (CS2: ~66 с приседом)
COV_FRAC = 0.5          # крыт, если штриховка покрывает больше половины участка


# ---------------- геометрия ----------------
def centroid(P):
    a = cx = cy = 0.0
    for i in range(len(P)):
        x0, y0 = P[i]; x1, y1 = P[(i + 1) % len(P)]
        c = x0 * y1 - x1 * y0
        a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    if abs(a) < 1e-9:
        return (sum(p[0] for p in P) / len(P), sum(p[1] for p in P) / len(P))
    return (cx / (3 * a), cy / (3 * a))


def area(P):
    return abs(sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))) / 2


def ccw(P):
    s = sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))
    return P if s > 0 else P[::-1]


def clip(subject, clipper):
    """пересечение выпуклых многоугольников (Сазерленд–Ходжман)"""
    out = subject
    C = ccw(clipper)
    for i in range(len(C)):
        a, b = C[i], C[(i + 1) % len(C)]
        inp, out = out, []
        if not inp:
            break
        def inside(p):
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9
        def inter(p, q):
            x1, y1, x2, y2 = p[0], p[1], q[0], q[1]
            x3, y3, x4, y4 = a[0], a[1], b[0], b[1]
            d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
            if abs(d) < 1e-12:
                return q
            t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
            return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
        for j in range(len(inp)):
            p, q = inp[j], inp[(j + 1) % len(inp)]
            if inside(q):
                if not inside(p):
                    out.append(inter(p, q))
                out.append(q)
            elif inside(p):
                out.append(inter(p, q))
    return out


def shared_edges(A, B, tol=0.6):
    """общие куски краёв двух участков: [(x1,y1,x2,y2)]"""
    res = []
    for i in range(len(A)):
        a0, a1 = A[i], A[(i + 1) % len(A)]
        dx, dy = a1[0] - a0[0], a1[1] - a0[1]
        L = math.hypot(dx, dy)
        if L < 0.5:
            continue
        ux, uy = dx / L, dy / L
        for j in range(len(B)):
            b0, b1 = B[j], B[(j + 1) % len(B)]
            # оба конца b на прямой a?
            d0 = abs((b0[0] - a0[0]) * uy - (b0[1] - a0[1]) * ux)
            d1 = abs((b1[0] - a0[0]) * uy - (b1[1] - a0[1]) * ux)
            if d0 > tol or d1 > tol:
                continue
            t0 = (b0[0] - a0[0]) * ux + (b0[1] - a0[1]) * uy
            t1 = (b1[0] - a0[0]) * ux + (b1[1] - a0[1]) * uy
            lo, hi = max(0, min(t0, t1)), min(L, max(t0, t1))
            if hi - lo > 1.0:
                res.append((a0[0] + ux * lo, a0[1] + uy * lo, a0[0] + ux * hi, a0[1] + uy * hi))
    return res


def near_pairs(areas, gap):
    """пары участков, у которых рамки ближе gap"""
    srt = sorted(areas, key=lambda a: a['bb'][0])
    for i, A in enumerate(srt):
        for B in srt[i + 1:]:
            if B['bb'][0] > A['bb'][2] + gap:
                break
            if B['bb'][1] > A['bb'][3] + gap or A['bb'][1] > B['bb'][3] + gap:
                continue
            yield A, B


def facing_edge(H, L, gap):
    """край верхнего участка H, который смотрит на нижний L через щель ≤ gap:
    (x1,y1,x2,y2, щель) — кусок края, напротив которого лежит L; или None"""
    best = None
    cx = sum(p[0] for p in H) / len(H); cy = sum(p[1] for p in H) / len(H)
    for i in range(len(H)):
        a0, a1 = H[i], H[(i + 1) % len(H)]
        dx, dy = a1[0] - a0[0], a1[1] - a0[1]
        Ln = math.hypot(dx, dy)
        if Ln < 1.0:
            continue
        ux, uy = dx / Ln, dy / Ln
        # наружная нормаль (от центра H)
        nx, ny = uy, -ux
        if (a0[0] - cx) * nx + (a0[1] - cy) * ny < 0:
            nx, ny = -nx, -ny
        ts = []; ds = []
        for p in L:
            ts.append((p[0] - a0[0]) * ux + (p[1] - a0[1]) * uy)
            ds.append((p[0] - a0[0]) * nx + (p[1] - a0[1]) * ny)
        # L должен лежать снаружи края (по нормали) и рядом
        if max(ds) < -0.5 or min(ds) > gap:
            continue
        if min(ds) < -3:      # L заходит за край внутрь H — не напротив
            continue
        lo, hi = max(0.0, min(ts)), min(Ln, max(ts))
        if hi - lo < 2.0:
            continue
        g = max(0.0, min(ds))
        if best is None or g < best[4] - 0.3 or (abs(g - best[4]) <= 0.3 and hi - lo > best[5]):
            best = (a0[0] + ux * lo, a0[1] + uy * lo, a0[0] + ux * hi, a0[1] + uy * hi, g, hi - lo, nx, ny)
    return best if best else None


def seg_x(a, b, c, d):
    def o(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return (o(a, b, c) > 0) != (o(a, b, d) > 0) and (o(c, d, a) > 0) != (o(c, d, b) > 0)


def crosses_wall(walls, x0, y0, x1, y1):
    for W in walls:
        for i in range(len(W)):
            if seg_x((x0, y0), (x1, y1), W[i], W[(i + 1) % len(W)]):
                return True
        if point_in(W, (x0 + x1) / 2, (y0 + y1) / 2):
            return True
    return False


def point_in(P, x, y):
    ins = False
    j = len(P) - 1
    for i in range(len(P)):
        xi, yi = P[i]; xj, yj = P[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            ins = not ins
        j = i
    return ins


# ---------------- крыто сверху: штриховка Simple Radar ----------------
def hatch_mask(path):
    import numpy as np
    from PIL import Image
    im = np.asarray(Image.open(path).convert('RGB')).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    teal = (g > 85) & (b > 105) & (r < 70) & (b - r > 60)          # бирюзовые полосы штриховки
    floor = (abs(r - 40) < 12) & (abs(g - 50) < 12) & (abs(b - 72) < 14)   # тёмно-синий пол
    # полосы идут с шагом ~6 px: «размазать» бирюзу на 4 px в каждую сторону,
    # оставить только там, где пол или сама полоса
    m = teal.copy()
    for _ in range(4):
        n = m.copy()
        n[1:, :] |= m[:-1, :]; n[:-1, :] |= m[1:, :]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
        m = n
    return m & (floor | teal)


def covered(areas, dirs):
    files = []
    for d in dirs:
        if os.path.isfile(d):
            files.append(d); continue
        nm = 'de_%s_radar' % MAPNAME
        f = sorted(glob.glob(os.path.join(d, nm + '.png')) + glob.glob(os.path.join(d, nm + '.dds')))
        if not f:
            sys.exit('в папке %s нет %s.png/.dds' % (d, nm))
        files.append(f[0])
    masks = [hatch_mask(f) for f in files]
    res = {}
    for a in areas:
        P = a['P']
        xs = [p[0] for p in P]; ys = [p[1] for p in P]
        pts = []
        y = math.floor(min(ys)) + 0.5
        while y < max(ys):
            x = math.floor(min(xs)) + 0.5
            while x < max(xs):
                if point_in(P, x, y):
                    pts.append((x, y))
                x += 1.5
            y += 1.5
        if not pts:
            pts = [a['c']]
        votes = 0
        for m in masks:
            hit = sum(1 for x, y in pts if 0 <= int(y / 2) < 1024 and 0 <= int(x / 2) < 1024 and m[int(y / 2), int(x / 2)])
            if hit / len(pts) > COV_FRAC:
                votes += 1
        res[a['id']] = 1 if votes * 2 > len(masks) else 0
    return res


# ---------------- названия мест (для отчёта) ----------------
# названия мест по подписям Simple Radar (координаты карты 0..2048) — только для отчёта; v318: из рецепта карты
# (data/maps/<карта>/_build.json, поле callouts)
CALLOUTS = mapdir.callouts(MAPNAME)


def namer():
    def name(x, y):
        return min(CALLOUTS, key=lambda c: math.hypot(x - c[1], y - c[2]))[0]
    return name


def write(out):
    """heights.json: каждое поле одной строкой (файл читается глазами и сравнивается в git)"""
    txt = '{\n' + ',\n'.join('"%s": %s' % (k, json.dumps(v, ensure_ascii=False, separators=(',', ':'))) if k != '_about'
                             else '"_about": ' + json.dumps(v, ensure_ascii=False, indent=1)
                             for k, v in out.items()) + '\n}\n'
    open(OUT, 'w', encoding='utf-8').write(txt)


def main():
    args = sys.argv[1:]
    sr = None
    if '--simple-radar' in args:
        sr = args[args.index('--simple-radar') + 1].split(',')
    nav = json.load(open(NAV, encoding='utf-8'))['areas']
    areas = []
    for a in nav:
        P = [(p['x'], p['y']) for p in a['points']]
        areas.append({'id': a['id'], 'z': a['z'], 'P': P, 'c': centroid(P), 'conn': set(a['conn']),
                      'bb': (min(p[0] for p in P), min(p[1] for p in P), max(p[0] for p in P), max(p[1] for p in P))})
    by = {a['id']: a for a in areas}
    walls = mapdir.load_walls(MAPNAME)
    old = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}

    # пары участков, близких в плане (рамки касаются)
    pairs = list(near_pairs(areas, 1))

    # 1) уровень над уровнем
    over = []
    for A, B in pairs:
        if abs(A['z'] - B['z']) <= OVER_DZ:
            continue
        I = clip(A['P'], B['P'])
        if len(I) >= 3 and area(I) > OVER_AREA:
            hi, lo = (A, B) if A['z'] > B['z'] else (B, A)
            over.append({'top': hi['id'], 'bottom': lo['id'], 'dz': round(hi['z'] - lo['z']), 'area': round(area(I), 1),
                         'poly': [[round(p[0], 1), round(p[1], 1)] for p in I]})
    tops = {o['top'] for o in over}

    # 2) соседство по краю (геометрически), перепады
    nb = {a['id']: [] for a in areas}     # id → [(id соседа, общие края)]
    for A, B in pairs:
        E = shared_edges(A['P'], B['P'])
        if not E:
            E2 = shared_edges(B['P'], A['P'])
            E = E2
        if E or B['id'] in A['conn'] or A['id'] in B['conn']:
            nb[A['id']].append((B['id'], E)); nb[B['id']].append((A['id'], E))

    def grad(A, B):
        d = math.hypot(A['c'][0] - B['c'][0], A['c'][1] - B['c'][1]) * PX_UNITS
        return abs(A['z'] - B['z']) / max(d, 1.0)

    # 3) уступы. В навмеше игры край уступа — это щель: верхний участок
    # кончается у края, нижний начинается внизу, общего края у них нет
    # (связь — только «спрыгнуть» или «запрыгнуть»). Поэтому ищем пары
    # близких участков (щель ≤ LEDGE_GAP) с перепадом > LEDGE_DZ; линия
    # уступа — та часть края верхнего участка, что смотрит на нижний.
    ledges = []
    for A, B in near_pairs(areas, LEDGE_GAP):
        dz = abs(A['z'] - B['z'])
        if dz <= LEDGE_DZ:
            continue
        hi, lo = (A, B) if A['z'] > B['z'] else (B, A)
        seg = facing_edge(hi['P'], lo['P'], LEDGE_GAP)
        if not seg:
            continue
        gap = seg[4]
        # общий край и связь в обе стороны — это крутая рампа/лестница, а не уступ
        if gap < 0.5 and hi['id'] in lo['conn'] and lo['id'] in hi['conn']:
            continue
        # сразу за краем должен быть нижний участок или пустая щель, а не третий участок
        # (иначе это два несоседних куска одной лестницы, касающихся углом)
        mx, my = (seg[0] + seg[2]) / 2, (seg[1] + seg[3]) / 2
        d = max(0.5, gap / 2)
        px, py = mx + seg[6] * d, my + seg[7] * d
        if any(o['id'] not in (hi['id'], lo['id']) and o['bb'][0] <= px <= o['bb'][2] and o['bb'][1] <= py <= o['bb'][3]
               and point_in(o['P'], px, py) for o in areas):
            continue
        # между участками стена — это не уступ, а два прохода за стеной
        # (кроме верха ящика: он сам лежит на «стене»-ящике, его край — уступ)
        on_box = any(point_in(W, hi['c'][0], hi['c'][1]) for W in walls)
        mx, my = (seg[0] + seg[2]) / 2, (seg[1] + seg[3]) / 2
        if gap > 0.5 and not on_box and crosses_wall(walls, mx, my, mx + seg[6] * (gap + 1), my + seg[7] * (gap + 1)):
            continue
        # круче 45°: перепад больше, чем щель по горизонтали (иначе это скорее рампа)
        if dz < LEDGE_GRAD * max(gap, 0.5) * PX_UNITS:
            continue
        up = hi['id'] in lo['conn']; down = lo['id'] in hi['conn']
        kind = 'jump' if (up and dz <= JUMP_UP) else ('climb' if up else ('drop' if down else 'none'))
        ledges.append({'hi': hi['id'], 'lo': lo['id'], 'dz': round(dz), 'kind': kind,
                       'seg': [round(v, 1) for v in seg[:4]]})

    # 4) рампы и лестницы
    slope_nb = {a['id']: [] for a in areas}
    for A in areas:
        for bid, E in nb[A['id']]:
            B = by[bid]
            dz = abs(A['z'] - B['z'])
            if 3 <= dz <= STEP_MAX and grad(A, B) >= SLOPE_MIN and (bid in A['conn'] or A['id'] in B['conn']):
                slope_nb[A['id']].append(bid)
    comp = {}
    ramps = []
    for a in areas:
        if a['id'] in comp or not slope_nb[a['id']]:
            continue
        st = [a['id']]; grp = []
        comp[a['id']] = len(ramps)
        while st:
            x = st.pop(); grp.append(x)
            for y in slope_nb[x]:
                if y not in comp:
                    comp[y] = len(ramps); st.append(y)
        zs = [by[i]['z'] for i in grp]
        ramps.append({'ids': sorted(grp), 'z0': round(min(zs), 1), 'z1': round(max(zs), 1)})
    ramps = [r for r in ramps if r['z1'] - r['z0'] >= RAMP_RISE]
    ramp_of = {}
    for k, r in enumerate(ramps):
        for i in r['ids']:
            ramp_of[i] = k
    # направление «вверх» у каждого участка рампы: плоскость по нему и соседям-участкам той же рампы
    arrows = []
    for k, r in enumerate(ramps):
        for i in r['ids']:
            A = by[i]
            pts = [(A['c'][0], A['c'][1], A['z'])] + [(by[j]['c'][0], by[j]['c'][1], by[j]['z']) for j, _ in nb[i] if ramp_of.get(j) == k]
            if len(pts) < 2:
                continue
            gx = gy = 0.0
            for (x0, y0, z0) in pts[1:]:
                dx, dy, dz = x0 - A['c'][0], y0 - A['c'][1], z0 - A['z']
                L2 = dx * dx + dy * dy
                if L2 > 1e-6:
                    gx += dz * dx / L2; gy += dz * dy / L2
            L = math.hypot(gx, gy)
            if L < 1e-6:
                continue
            A['up'] = (gx / L, gy / L)
        # стрелки пореже: не ближе 22 ед. карты друг к другу, сначала крупные участки
        placed = []
        for i in sorted(r['ids'], key=lambda i: -area(by[i]['P'])):
            A = by[i]
            if 'up' not in A or area(A['P']) < 15:
                continue
            if any(math.hypot(A['c'][0] - p[0], A['c'][1] - p[1]) < 22 for p in placed):
                continue
            placed.append(A['c'])
            arrows.append([round(A['c'][0], 1), round(A['c'][1], 1), round(A['up'][0], 2), round(A['up'][1], 2), k])
        xs = [by[i]['c'][0] for i in r['ids']]; ys = [by[i]['c'][1] for i in r['ids']]
        r['c'] = [round(sum(xs) / len(xs), 1), round(sum(ys) / len(ys), 1)]

    # 5) крыто сверху
    if sr:
        cov = covered(areas, sr)
    else:
        cov = {}
        for row in old.get('areas', []):
            cov[row[0]] = row[3]

    # участки: [id, z, lvl, cov, рампа(номер или -1)]
    rows = []
    for a in areas:
        rows.append([a['id'], a['z'], 1 if a['id'] in tops else 0, cov.get(a['id'], 0), ramp_of.get(a['id'], -1)])

    out = {
        '_about': [
            'Высоты и этажи %s. Делает tools/heights_bake.py --map %s из navmesh.json набора карты и радаров Simple Radar.' % (MAP_TITLE, MAPNAME),
            'areas: [id участка навмеша, z — высота пола (единицы игры), lvl — уровень (0 обычный, 1 — над другим полом),',
            '        cov — крыто сверху (1/0), ramp — номер рампы/лестницы в ramps или -1].',
            'ramps: группы участков с плавным подъёмом: ids, z0..z1 (низ..верх), c — середина.',
            'arrows: стрелки «вверх» для радара [x, y, dx, dy, номер рампы].',
            'ledges: уступы — общий край соседей с перепадом > 50 и круче 45 град.: hi/lo — верхний/нижний участок,',
            '        dz, kind (jump — можно запрыгнуть, drop — только спрыгнуть, climb — подняться можно (по навмешу), none — не пройти), seg [x1,y1,x2,y2].',
            'over: «уровень над уровнем» — top над bottom (dz, площадь и многоугольник перекрытия).',
            'own: правки владельца из редактора карты (вкладка «высоты»): [{id, lvl?, cov?}] — накладываются поверх areas (вписывает tools/map_pull.py).',
            'Координаты — как в navmesh.json (0..2048, картинка радара ×2), 1 ед. карты = 2,5 ед. игры.'],
        'areas': rows,
        'ramps': ramps,
        'arrows': arrows,
        'ledges': ledges,
        'over': over,
        'own': old.get('own') if isinstance(old.get('own'), list) else [],
    }
    write(out)
    print('записано %s: участков %d, крытых %d, рамп %d (стрелок %d), уступов %d краёв, «над уровнем» %d пар' % (
        os.path.relpath(OUT, ROOT), len(rows), sum(r[3] for r in rows), len(ramps), len(arrows), len(ledges), len(over)))

    if '--report' in args:
        name = namer()
        print('\n== уровень над уровнем ==')
        for o in over:
            T, B = by[o['top']], by[o['bottom']]
            print('  %s z=%.0f над %s z=%.0f  dz=%d  площадь %.0f  (%.0f,%.0f)' % (name(*T['c']), T['z'], name(*B['c']), B['z'], o['dz'], o['area'], T['c'][0], T['c'][1]))
        print('\n== рампы/лестницы ==')
        for k, r in enumerate(ramps):
            print('  #%d %s: %d участков, z %.0f..%.0f (%.0f,%.0f)' % (k, name(*r['c']), len(r['ids']), r['z0'], r['z1'], r['c'][0], r['c'][1]))
        print('\n== уступы ==')
        from collections import defaultdict
        g = defaultdict(list)
        for l in ledges:
            x = (l['seg'][0] + l['seg'][2]) / 2; y = (l['seg'][1] + l['seg'][3]) / 2
            g[(name(x, y), l['kind'])].append((l['dz'], math.hypot(l['seg'][2] - l['seg'][0], l['seg'][3] - l['seg'][1]), x, y))
        for (n, kd), v in sorted(g.items()):
            print('  %s [%s]: %d краёв, длина %.0f, dz %d..%d  около (%.0f,%.0f)' % (n, kd, len(v), sum(t[1] for t in v), min(t[0] for t in v), max(t[0] for t in v), v[0][2], v[0][3]))
        print('\n== крыто ==')
        g = defaultdict(int)
        for a in areas:
            if cov.get(a['id']):
                g[name(*a['c'])] += 1
        for n, c in sorted(g.items(), key=lambda t: -t[1]):
            print('  %s: %d участков' % (n, c))


if __name__ == '__main__':
    main()
