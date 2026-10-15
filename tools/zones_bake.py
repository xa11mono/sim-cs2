#!/usr/bin/env python3
"""Зоны карты — нарезка навмеша по подписям радара (v318): navmesh.json + callouts рецепта → zones.json набора.

python3 tools/zones_bake.py --map <карта> [--report]

Как режется (повторяемо — один и тот же вход даёт тот же файл):
  * у каждой подписи радара (рецепт карты, callouts: название и середина надписи; источник — sources.callouts) —
    участок навмеша под надписью (зерно); если там несколько этажей — верхний, или нижний, если в рецепте
    callouts[i][3] == "low";
  * каждый участок навмеша отходит к зерну, до которого ближе всего ПО ПОЛУ (Дейкстра по связям навмеша: длина шага —
    расстояние между серединами участков в плане + перепад высоты ×2), а не по прямой — сквозь стену зона не растёт;
  * зона = все её участки, нарисованные на картинке 2048×2048 (верхний этаж поверх нижнего), внешний контур самого
    большого куска, упрощённый до ~4 ед. карты; оторванные кусочки отдаются соседней зоне, с которой больше связей;
  * переходы (portals) — пары зон, у участков которых есть связь в навмеше; stairs — если перепад высот > 40 ед.;
  * середина зоны (centers) — самая глубокая точка внутри зоны, где под/над ней нет другого этажа (игра берёт её вместо
    среднего углов: у изогнутой зоны оно вылетает наружу и на чужой этаж);
  * роли зон (name): CTspawn, Tspawn, Asite, Bsite — у подписей из recipe.roles; точки (points) — середины этих подписей.
  * названия (names) — подписи радара; synonyms пустые (в источнике вариантов нет).
Спорные места печатает --report (и map_build): зона дальше 260 ед. карты от своей подписи, зоны-соседи с одним
названием, очень маленькие зоны.
"""
import heapq, json, math, os, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mapdir  # noqa: E402

MAPNAME = mapdir.current()
SIMPLIFY = 4.0     # упрощение контура зоны, ед. карты — проектное число
DZ_W = 2.0         # перепад высоты в длине шага (ед. игры → ед. карты ×2) — проектное число
FAR = 260          # «далеко от подписи» для отчёта о спорных зонах, ед. карты (≈ 650 ед. игры) — проектное число
SMALL = 1500       # «маленькая зона» для отчёта, ед. карты² — проектное число


def centroid(P):
    return (sum(p[0] for p in P) / len(P), sum(p[1] for p in P) / len(P))


def point_in(P, x, y):
    c = False
    for i in range(len(P)):
        (x0, y0), (x1, y1) = P[i], P[i - 1]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            c = not c
    return c


def main():
    from map_build import _simplify, _area
    import numpy as np
    from PIL import Image, ImageDraw
    from scipy import ndimage
    import contourpy

    R = mapdir.recipe(MAPNAME)
    nav = mapdir.load_nav(MAPNAME)
    A = {}
    for a in nav:
        P = [(p['x'], p['y']) for p in a['points']]
        A[a['id']] = {'id': a['id'], 'z': a['z'], 'P': P, 'c': centroid(P), 'conn': a['conn']}
    nb = defaultdict(set)
    for a in A.values():
        for b in a['conn']:
            if b in A:
                nb[a['id']].add(b); nb[b].add(a['id'])

    # зёрна
    calls = R['callouts']
    seeds = []
    for k, c in enumerate(calls):
        nm, x, y = c[0], c[1], c[2]
        low = len(c) > 3 and c[3] == 'low'
        under = [a for a in A.values() if point_in(a['P'], x, y)]
        if not under:
            under = [min(A.values(), key=lambda a: math.hypot(a['c'][0] - x, a['c'][1] - y))]
        s = min(under, key=lambda a: a['z']) if low else max(under, key=lambda a: a['z'])
        seeds.append((k, s['id']))

    # Дейкстра от всех зёрен сразу
    dist = {}; own = {}
    pq = [(0.0, k, aid) for k, aid in seeds]
    heapq.heapify(pq)
    while pq:
        d, k, aid = heapq.heappop(pq)
        if aid in dist:
            continue
        dist[aid] = d; own[aid] = k
        a = A[aid]
        for b in sorted(nb[aid]):
            if b in dist:
                continue
            B = A[b]
            step = math.hypot(a['c'][0] - B['c'][0], a['c'][1] - B['c'][1]) + abs(a['z'] - B['z']) / mapdir.radar(MAPNAME)['scale'] * DZ_W
            heapq.heappush(pq, (d + step, k, b))
    lost = [aid for aid in A if aid not in own]     # участки без связи с зёрнами (верх ящика без связей) — по ближайшему
    for aid in lost:
        a = A[aid]
        best = min((x for x in own), key=lambda x: math.hypot(A[x]['c'][0] - a['c'][0], A[x]['c'][1] - a['c'][1]))
        own[aid] = own[best]; dist[aid] = dist[best]

    # картинка зон: верхний этаж поверх нижнего, 1 px = 1 ед. карты
    def paint(owner):
        im = Image.new('I', (2048, 2048), -1)
        d = ImageDraw.Draw(im)
        for a in sorted(A.values(), key=lambda a: (a['z'], a['id'])):
            d.polygon(a['P'], fill=owner[a['id']], outline=owner[a['id']])
        return np.asarray(im)

    def contours(mask):
        """[(площадь, контур)] кусков маски; контур — внешний"""
        lab, n = ndimage.label(mask)
        out = []
        for i in range(1, n + 1):
            m = ndimage.binary_fill_holes(lab == i)
            ys, xs = np.nonzero(m)
            y0, x0 = max(0, ys.min() - 2), max(0, xs.min() - 2)
            sub = np.zeros((ys.max() - y0 + 4, xs.max() - x0 + 4)); sub[ys - y0, xs - x0] = 1
            pts, offs = contourpy.contour_generator(z=sub, line_type='SeparateCode', fill_type='OuterOffset').filled(0.5, 2.0)
            ring = max(((p[o[0]:o[1]]) for p, o in zip(pts, offs)), key=len)
            out.append((int(m.sum()), [(float(x) + x0, float(y) + y0) for x, y in ring[:-1]], m))
        return sorted(out, key=lambda t: -t[0])

    # оторванные кусочки зоны — соседу (несколько проходов: кусок мог оторваться и у соседа)
    for _ in range(3):
        img = paint(own)
        moved = 0
        for k in range(len(calls)):
            mine = [aid for aid in A if own[aid] == k]
            if not mine:
                continue
            parts = contours(img == k)
            if len(parts) <= 1:
                continue
            keep = parts[0][2]
            for aid in mine:
                cx, cy = A[aid]['c']
                if 0 <= int(cy) < 2048 and 0 <= int(cx) < 2048 and keep[int(cy), int(cx)]:
                    continue
                cnt = Counter(own[b] for b in nb[aid] if own[b] != k)
                if cnt:
                    own[aid] = cnt.most_common(1)[0][0]; moved += 1
        if not moved:
            break

    img = paint(own)
    # где пол в два этажа: пиксели, над/под которыми есть участок с другой высотой (середина зоны туда не ставится)
    floors = np.zeros((2048, 2048), np.int8)
    zlow = np.full((2048, 2048), np.inf, np.float32); zhigh = np.full((2048, 2048), -np.inf, np.float32)
    for a in A.values():
        xs = [p[0] for p in a['P']]; ys = [p[1] for p in a['P']]
        x0, y0 = max(0, int(min(xs))), max(0, int(min(ys))); x1, y1 = min(2047, int(max(xs)) + 1), min(2047, int(max(ys)) + 1)
        if x1 < x0 or y1 < y0:
            continue
        sub = Image.new('L', (x1 - x0 + 1, y1 - y0 + 1), 0)
        ImageDraw.Draw(sub).polygon([(p[0] - x0, p[1] - y0) for p in a['P']], fill=1, outline=1)
        m = np.asarray(sub).astype(bool)
        zl = zlow[y0:y1 + 1, x0:x1 + 1]; zh = zhigh[y0:y1 + 1, x0:x1 + 1]
        zl[m] = np.minimum(zl[m], a['z']); zh[m] = np.maximum(zh[m], a['z'])
    two = (zhigh - zlow) > 60     # «уровень над уровнем» — разница больше роста (как OVER_DZ в heights_bake)
    zones, names, roles, centers = [], {}, R.get('roles', {}), {}
    zid = {}
    for k, c in enumerate(calls):
        parts = contours(img == k)
        if not parts:
            print('  ! у подписи «%s» нет зоны (её участки забрали соседи)' % c[0])
            continue
        P = _simplify(parts[0][1], SIMPLIFY)
        zid[k] = 'zone%d' % (k + 1)
        # середина зоны — самая глубокая точка внутри неё (дальше всего от края), по возможности на одном этаже
        own_m = (img == k) & parts[0][2]
        one = own_m & ~two
        dt = ndimage.distance_transform_edt(one if one.sum() >= 0.2 * own_m.sum() else own_m)
        cy, cx = np.unravel_index(int(np.argmax(dt)), dt.shape)
        if point_in([(x, y) for x, y in P], cx + 0.5, cy + 0.5):
            centers[zid[k]] = {'x': int(cx), 'y': int(cy)}
        z = {'id': zid[k], 'z': 0, 'points': [{'x': round(x), 'y': round(y)} for x, y in P]}
        if c[0] in roles:
            z['name'] = roles[c[0]]
        zones.append(z)
        names[zid[k]] = c[0]
    # порталы
    pairs = {}
    for a in A.values():
        for b in nb[a['id']]:
            ka, kb = own[a['id']], own[b]
            if ka == kb or ka not in zid or kb not in zid:
                continue
            key = (min(ka, kb), max(ka, kb))
            dz = abs(a['z'] - A[b]['z'])
            pairs[key] = max(pairs.get(key, 0), 0) if dz <= 40 else max(pairs.get(key, 0), 1)
    portals = [{'a': zid[a], 'b': zid[b], 'type': 'stairs' if t else 'walk'} for (a, b), t in sorted(pairs.items())]
    # точки: роли (спавны, сайты) — середина подписи
    points = []
    for k, c in enumerate(calls):
        if c[0] in roles:
            points.append({'name': '%s_%d' % (roles[c[0]], len(points) + 1), 'x': round(c[1]), 'y': round(c[2]), 'z': 0})
    out = {'source': 'tools/zones_bake.py --map %s: нарезка навмеша по подписям радара; названия — %s' % (
               MAPNAME, R.get('sources', {}).get('callouts', 'рецепт карты, callouts')),
           'zonemap': {'map': MAPNAME, 'zones': zones, 'points': points, 'portals': portals, 'walls': []},
           'centers': centers, 'shapes': {}, 'names': names, 'synonyms': {}, 'props': {}}
    open(mapdir.path(MAPNAME, 'zones.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('записано %s: зон %d, переходов %d, точек %d' % (os.path.relpath(mapdir.path(MAPNAME, 'zones.json'), mapdir.ROOT),
                                                            len(zones), len(portals), len(points)))

    # спорные места
    far = defaultdict(float)
    for aid, k in own.items():
        far[k] = max(far[k], dist[aid])
    areas = {k: _area([(p['x'], p['y']) for p in z['points']]) for k, z in zip(zid, zones)}
    dispute = []
    for k in zid:
        why = []
        if far[k] > FAR:
            why.append('тянется на %.0f ед. карты от подписи' % far[k])
        if areas[k] < SMALL:
            why.append('маленькая (%.0f ед.²)' % areas[k])
        if why:
            dispute.append((calls[k][0], zid[k], '; '.join(why)))
    json.dump({'disputed': dispute, 'far': {zid[k]: round(far[k]) for k in zid}},
              open(mapdir.path(MAPNAME, '_zones_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('спорных зон: %d (data/maps/%s/_zones_report.json)' % (len(dispute), MAPNAME))
    if '--report' in sys.argv:
        for d in dispute:
            print('  %-14s %-7s %s' % d)


if __name__ == '__main__':
    main()
