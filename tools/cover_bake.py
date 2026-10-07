#!/usr/bin/env python3
"""Высота укрытий: src/data/walls.json + navmesh.json → src/data/cover.json.

python3 tools/cover_bake.py [--report]

Что считает (повторяемо — один и тот же вход даёт тот же файл):
  * укрытие — препятствие внутри игровой зоны: каждая отдельная стена
    (многоугольник walls.json, кроме больших кусков внешнего контура), и
    ящик без стены — поднятый участок навмеша (выше пола рядом на 20+), который
    на картинке радара серый (так радар рисует ящики);
  * выступы большого внешнего контура отдельно не выделяются: навмеш на них —
    только узкие полоски у лестниц и склонов (проверено глазами 07.10), то есть
    верхов ящиков там нет; такой выступ — часть стены, «выше головы». Если
    выступ на деле ниже — владелец рисует кусок прямоугольником во вкладке
    «укрытия», и ему ставит высоту;
  * высота над полом рядом, в единицах игры: если на препятствии есть участок
    навмеша (верх ящика) — z верха − z пола вокруг; если навмеша сверху нет —
    «выше головы» по умолчанию (высота не измерена);
  * пол вокруг — участки навмеша в 4–14 ед. карты снаружи от края препятствия
    (кроме верхов ящиков); берётся самый низкий пол, у которого не меньше 20 %
    точек вокруг (у ящика между ямой и площадкой — высота со стороны ямы,
    другая сторона пишется в floors и note);
  * если на одной стене верх на разных высотах (ступенька из ящиков) — каждая
    ступень отдельным укрытием-куском.
Привязка к стенам (чтобы правка стен не ломала укрытия): у укрытия есть точка
pt внутри препятствия. shape "wall" — форма укрытия = та стена, внутри которой
сейчас лежит pt (стену двигают — укрытие едет с ней; удалили — укрытия нет);
shape "piece" — своя форма poly (кусок большой стены или ступень ящика).
id — из координат pt ("c1055_1168"); правки владельца хранят и id, и pt, и
если после пересчёта id сменился, правка находит укрытие по pt.
Правки владельца (вкладка «укрытия», документ map/cover) вписывает в поле own
tools/map_pull.py; при пересчёте этим скриптом поле own сохраняется.
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from heights_bake import point_in, area, centroid, namer   # noqa: E402

NAV = os.path.join(ROOT, 'src', 'data', 'navmesh.json')
WALLS = os.path.join(ROOT, 'src', 'data', 'walls.json')
OUT = os.path.join(ROOT, 'src', 'data', 'cover.json')

# Рост в CS2 (единицы игры): стоя 72 (глаза 64), присев 54 (глаза 46).
STAND, STAND_EYE, CROUCH, CROUCH_EYE = 72, 64, 54, 46
HIGH = STAND          # «выше головы»: h ≥ 72 — стоящего не видно целиком
CHEST = CROUCH_EYE    # «по грудь»: 46 ≤ h < 72 — стоя голову видно, присев — нет
#                       «низкая»: h < 46 — присевший видит поверх; закрывает только ноги/ничего
TOP_MIN = 20          # участок навмеша на стене — верх препятствия, если выше пола рядом на 20+
RADAR = os.path.join(ROOT, 'src', 'data', 'radar.png')
BIG_WALL = 60000      # стена больше этой площади (ед. карты²) — кусок внешнего контура, не отдельное препятствие
LEVEL_DZ = 10         # верхи на одной стене с разницей больше 10 — разные ступени
FLOOR_SHARE = 0.2     # пол «рядом» — не меньше 20 % точек вокруг


def cat_of(h):
    if h is None or h >= HIGH:
        return 'high'
    return 'chest' if h >= CHEST else 'low'


def hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts
    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def grow(P, d):
    """выпуклый многоугольник, раздутый на d (сдвиг рёбер наружу, углы — пересечения)"""
    n = len(P)
    if sum(P[i][0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * P[i][1] for i in range(n)) < 0:
        P = P[::-1]
    L = []
    for i in range(n):
        (x0, y0), (x1, y1) = P[i], P[(i + 1) % n]
        l = math.hypot(x1 - x0, y1 - y0) or 1
        nx, ny = (y1 - y0) / l, -(x1 - x0) / l
        L.append(((x0 + nx * d, y0 + ny * d), (x1 + nx * d, y1 + ny * d)))
    out = []
    for i in range(n):
        (a, b), (c, e) = L[i - 1], L[i]
        den = (a[0] - b[0]) * (c[1] - e[1]) - (a[1] - b[1]) * (c[0] - e[0])
        if abs(den) < 1e-9:
            out.append(c); continue
        t = ((a[0] - c[0]) * (c[1] - e[1]) - (a[1] - c[1]) * (c[0] - e[0])) / den
        out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    return out


def inner_point(P):
    """точка внутри многоугольника (центр, если он внутри; иначе — середина самой широкой хорды по центру)"""
    c = centroid(P)
    if point_in(P, c[0], c[1]):
        return c
    xs = []
    n = len(P)
    for i in range(n):
        (x0, y0), (x1, y1) = P[i], P[(i + 1) % n]
        if (y0 > c[1]) != (y1 > c[1]):
            xs.append(x0 + (c[1] - y0) * (x1 - x0) / (y1 - y0))
    xs.sort()
    best = max(((xs[i + 1] - xs[i], (xs[i] + xs[i + 1]) / 2) for i in range(0, len(xs) - 1, 2)), default=(0, c[0]))
    return (best[1], c[1])


def main():
    nav = json.load(open(NAV, encoding='utf-8'))
    walls = [[tuple(q) for q in W] for W in json.load(open(WALLS, encoding='utf-8'))]
    old = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    for a in nav:
        a['P'] = [(p['x'], p['y']) for p in a['points']]
        a['c'] = centroid(a['P'])
        xs = [p[0] for p in a['P']]; ys = [p[1] for p in a['P']]
        a['bb'] = (min(xs), min(ys), max(xs), max(ys))
    by = {a['id']: a for a in nav}
    grid = {}
    for a in nav:
        for gx in range(int(a['bb'][0] // 32), int(a['bb'][2] // 32) + 1):
            for gy in range(int(a['bb'][1] // 32), int(a['bb'][3] // 32) + 1):
                grid.setdefault((gx, gy), []).append(a)

    def nav_at(x, y):
        for a in grid.get((int(x // 32), int(y // 32)), []):
            if a['bb'][0] <= x <= a['bb'][2] and a['bb'][1] <= y <= a['bb'][3] and point_in(a['P'], x, y):
                return a
        return None

    # участки навмеша, чей центр внутри стены, — кандидаты в верх препятствия
    on_wall = {}
    for a in nav:
        for i, W in enumerate(walls):
            if point_in(W, a['c'][0], a['c'][1]):
                on_wall.setdefault(i, []).append(a); break
    cand = {a['id'] for L in on_wall.values() for a in L}

    def floor_around(P):
        """высоты пола вокруг контура P: точки снаружи на 4..14 ед. карты, первая найденная"""
        n = len(P)
        s = sum(P[i][0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * P[i][1] for i in range(n))
        zs = []
        for i in range(n):
            (x0, y0), (x1, y1) = P[i], P[(i + 1) % n]
            L = math.hypot(x1 - x0, y1 - y0)
            if L < 1e-6:
                continue
            nx, ny = (y1 - y0) / L, -(x1 - x0) / L
            if s < 0:
                nx, ny = -nx, -ny
            k = max(1, int(L / 3))
            for j in range(k):
                t = (j + .5) / k
                bx, by_ = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                for d in (4, 7, 10, 14):
                    a = nav_at(bx + nx * d, by_ + ny * d)
                    if a and a['id'] not in cand:
                        zs.append(a['z']); break
        return zs

    def floor_pick(zs):
        """самый низкий пол, у которого ≥ 20 % точек; и все такие полы"""
        if not zs:
            return None, []
        zs = sorted(zs); groups = []
        for z in zs:
            if groups and z - groups[-1][-1] <= 12:
                groups[-1].append(z)
            else:
                groups.append([z])
        big = [g for g in groups if len(g) >= FLOOR_SHARE * len(zs)] or [max(groups, key=len)]
        fl = [round(sorted(g)[len(g) // 2]) for g in big]
        return fl[0], fl

    def levels(areas, fz):
        """верхи (участки выше пола на TOP_MIN+), собранные в ступени по высоте и соседству"""
        tops = [a for a in areas if fz is not None and a['z'] - fz >= TOP_MIN]
        grp = []
        for a in sorted(tops, key=lambda a: -area(a['P'])):
            for g in grp:
                if abs(g[0]['z'] - a['z']) <= LEVEL_DZ:
                    g.append(a); break
            else:
                grp.append([a])
        return grp

    items = []
    name = namer()

    def add(shape, P, pt, top, fz, floors, src, wall, note=None):
        if top is not None:
            # «пол» на высоте самого верха — это край того же верха, вылезший за стену, а не пол
            floors = [f for f in floors if abs(f - top) > 8] or [fz]
        h = None if top is None else round(top - fz)
        it = {'id': 'c%d_%d' % (round(pt[0]), round(pt[1])), 'name': name(*pt), 'shape': shape,
              'pt': [round(pt[0], 1), round(pt[1], 1)], 'wall': wall,
              'top': None if top is None else round(top, 1), 'floor': fz, 'h': h, 'cat': cat_of(h), 'src': src}
        if shape == 'piece':
            it['poly'] = [[round(q[0], 1), round(q[1], 1)] for q in P]
        if len(floors) > 1:
            it['floors'] = floors
            if top is not None:
                note = (note + '; ' if note else '') + 'пол вокруг разный: ' + ', '.join(
                    '%d (оттуда %d)' % (f, round(top - f)) for f in floors)
            else:
                note = (note + '; ' if note else '') + 'пол вокруг разный: ' + ', '.join(str(f) for f in floors)
        if note:
            it['note'] = note
        items.append(it)

    for i, W in enumerate(walls):
        if area(W) > BIG_WALL:
            continue              # кусок внешнего контура (см. «выступы» в начале файла)
        areas = on_wall.get(i, [])
        fz, floors = floor_pick(floor_around(W))
        if fz is None:
            continue          # вокруг нет пола — препятствие вне игровой зоны
        lv = levels(areas, fz)
        if len(lv) <= 1:
            top = max((a['z'] for a in lv[0]), default=None) if lv else None
            pt = max(lv[0], key=lambda a: area(a['P']))['c'] if lv else inner_point(W)
            if lv and not point_in(W, pt[0], pt[1]):
                pt = inner_point(W)
            add('wall', W, pt, top, fz, floors, 'nav' if lv else 'default', i)
        else:
            # ступени: каждая — кусок стены вокруг своего верха
            for g in sorted(lv, key=lambda g: -g[0]['z']):
                P = grow(hull([q for a in g for q in a['P']]), 3)
                top = max(a['z'] for a in g)
                pt = max(g, key=lambda a: area(a['P']))['c']
                add('piece', P, pt, top, fz, floors, 'nav', i, 'ступень ящика')

    # ящики без стены: поднятые участки навмеша вне стен, серые на радаре
    from PIL import Image
    rad = Image.open(RADAR).convert('RGB')

    def gray(x, y):
        r, g, b = rad.getpixel((min(1023, max(0, int(x / 2))), min(1023, max(0, int(y / 2)))))
        return abs(r - g) < 10 and abs(g - b) < 10 and r > 80

    boxy = {a['id'] for a in nav if a['id'] not in cand and gray(*a['c'])}
    done = set()
    for a in sorted((by[i] for i in boxy), key=lambda a: (-area(a['P']), a['id'])):
        if a['id'] in done:
            continue
        st = [a]; g = []; done.add(a['id'])
        while st:
            x = st.pop(); g.append(x)
            for y in sorted(x['conn']):
                if y in boxy and y not in done and abs(by[y]['z'] - x['z']) <= LEVEL_DZ:
                    done.add(y); st.append(by[y])
        if sum(area(b['P']) for b in g) < 150:
            continue
        H = grow(hull([q for b in g for q in b['P']]), 3)
        cand |= {b['id'] for b in g}
        fz, floors = floor_pick(floor_around(H))
        top = max(b['z'] for b in g)
        if fz is None or top - fz < TOP_MIN:
            continue
        pt = max(g, key=lambda b: area(b['P']))['c']
        add('piece', H, pt, top, fz, floors, 'nav', None, 'стены нет: в игре сейчас сквозь него видно и ходят')

    items.sort(key=lambda it: (it['pt'][1], it['pt'][0]))
    own = old.get('own') if isinstance(old.get('own'), list) else []
    out = {
        '_about': [
            'Высота укрытий Ancient. Делает tools/cover_bake.py из src/data/walls.json и navmesh.json; правки владельца — поле own.',
            'Рост в CS2 (единицы игры): стоя 72, глаза 64; присев 54, глаза 46.',
            'h — высота препятствия над полом рядом, ед. игры: z верха (навмеш на препятствии) − z пола вокруг; null — навмеша сверху нет, не измерено.',
            'Категории (cat): high «выше головы» — h ≥ 72 или не измерено (стоящего не видно целиком);',
            '                 chest «по грудь» — 46 ≤ h < 72: стоя голову видно (при h < 64 стоя можно стрелять поверх, 64–72 — видна только макушка),',
            '                       присев — не видно (при 46–54 глаза присевшего ниже края, макушка чуть выше);',
            '                 low «низкая» — h < 46: присевший видит поверх; закрывает только ноги или ничего.',
            'items: id (из pt), name (ближайший колл), shape: "wall" — форма = стена из walls.json, внутри которой лежит pt (wall — её номер сейчас),',
            '       "piece" — своя форма poly (выступ большой стены или ступень ящика); top, floor — z верха и пола; floors — если пол вокруг разный;',
            '       src: nav — измерено по навмешу, default — навмеша сверху нет, «выше головы» по умолчанию; note — пояснение.',
            'own: правки владельца (вкладка «укрытия» редактора карты, документ map/cover; вписывает tools/map_pull.py):',
            '     [{id, pt, cat? | h?, poly?}] — cat high/chest/low или h (число, ед. игры); с poly — новый кусок, нарисованный владельцем.',
            '     Правка находит укрытие по id, а если id после пересчёта сменился — по точке pt.',
            'Координаты — как в walls.json (0..2048, картинка радара ×2), 1 ед. карты = 2,5 ед. игры.'],
        'items': items,
        'own': own,
    }
    write(out)
    n = {c: sum(1 for it in items if it['cat'] == c) for c in ('high', 'chest', 'low')}
    print('записано %s: укрытий %d — выше головы %d (из них не измерено %d), по грудь %d, низких %d; правок владельца %d' % (
        os.path.relpath(OUT, ROOT), len(items), n['high'], sum(1 for it in items if it['src'] == 'default'), n['chest'], n['low'], len(own)))
    if '--report' in sys.argv:
        for it in items:
            print('  %-12s %-14s %-5s %-6s h=%-5s top=%-6s floor=%-5s %s %s' % (
                it['id'], it['name'], it['shape'], it['cat'], it['h'], it['top'], it['floor'], it['src'], it.get('note', '')))


def write(out):
    """cover.json: каждое укрытие — одной строкой (файл читается глазами и сравнивается в git)"""
    def one(v):
        return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    txt = '{\n"_about": ' + json.dumps(out['_about'], ensure_ascii=False, indent=1) + ',\n'
    txt += '"items": [\n' + ',\n'.join(one(it) for it in out['items']) + '\n],\n'
    txt += '"own": ' + ('[\n' + ',\n'.join(one(e) for e in out['own']) + '\n]' if out['own'] else '[]') + '\n}\n'
    open(OUT, 'w', encoding='utf-8').write(txt)


if __name__ == '__main__':
    main()
