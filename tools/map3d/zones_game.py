#!/usr/bin/env python3
"""А5 (20.10.2026): зоны владельца (А4, geom3d/zones_owner.json) → zones.json набора в формате игры.
python3 tools/map3d/zones_game.py [--map mirage]   (шаг zones3d в tools/map_build.py; после zones_owner.py)

Что пишет (как tools/zones_bake.py, тот же формат — игра читает MAP.zones):
  zonemap.zones — зона: id, z (медиана пола зоны, ед. игры — по нему таблица «откуда простреливается» берёт этаж: Underpath
                  под Short), points — контур клеток зоны (все её этажи; больший связный кусок; ед. карты 0..2048),
                  level ('low' — нижний этаж), name — роль (спавны, сайты), как у zones_bake;
                  зоны нижнего этажа — в конце списка (плоский поиск зоны по точке берёт верхний этаж);
  names, centers — название и середина (у владельца — средняя точка этажей зоны; не внутри контура — самая глубокая точка);
  navZone — зона каждого участка навмеша: по этажу геометрии под серединой участка на его высоте (floor_zone А4) — так игра
            знает зону точки с высотой (zoneIdAt3), без растекания по навмешу;
  portals — соседние зоны по связям навмеша (перепад ≤ 40 ед. — walk, больше — stairs);
  points и sites — как были (точки ролей — середины подписей рецепта; границы сайтов — по плантам, demos_bake --assemble)."""
import sys, os, json, base64, zlib
import numpy as np
import contourpy
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import mapdir  # noqa: E402
from map_build import _simplify  # noqa: E402

SIMPLIFY = 1.5   # упрощение контура, ед. карты: клетки 2 px — углы прямоугольников остаются (проектное число)


def unb64(s, dt):
    return np.frombuffer(zlib.decompress(base64.b64decode(s)), dtype=dt)


def point_in(P, x, y):
    ins = False
    for i in range(len(P)):
        (x1, y1), (x2, y2) = P[i], P[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            ins = not ins
    return ins


def build(name):
    M = json.load(open(mapdir.path(name, 'map3d.json')))
    O = json.load(open(mapdir.path(name, 'geom3d', 'zones_owner.json'), encoding='utf-8'))
    OLD = json.load(open(mapdir.path(name, 'zones.json'), encoding='utf-8'))
    W, C = M['W'], M['cell']
    fn = unb64(M['floors']['n'], np.uint8); fz = unb64(M['floors']['z'], np.int16); fzone = unb64(O['floor_zone'], np.uint8)
    st = np.zeros(W * W + 1, np.int64); st[1:] = np.cumsum(fn)
    cell_of = np.repeat(np.arange(W * W), fn)
    Z = O['zones']; R = mapdir.recipe(name) or {}; roles = R.get('roles', {})
    order = sorted(range(len(Z)), key=lambda k: (Z[k]['level'] == 'low', k))   # нижний этаж — в конце
    zid = {k: 'zone%d' % (n + 1) for n, k in enumerate(order)}
    zones, names, centers = [], {}, {}
    for k in order:
        z = Z[k]
        m = np.zeros(W * W, bool); m[cell_of[fzone == k]] = True; m = m.reshape(W, W)
        lab, nl = ndimage.label(m)
        if not nl:
            print('  ! у зоны «%s» нет этажей' % z['name']); continue
        big = np.argmax(ndimage.sum(m, lab, range(1, nl + 1))) + 1
        part = lab == big
        sub = np.pad(part.astype(float), 1)
        pts, offs = contourpy.contour_generator(z=sub, line_type='SeparateCode', fill_type='OuterOffset').filled(0.5, 2.0)
        ring = max((p[o[0]:o[1]] for p, o in zip(pts, offs)), key=len)
        P = [((float(x) - 1 + 0.5) * C, (float(y) - 1 + 0.5) * C) for x, y in ring[:-1]]   # центр клетки i — (i + 0.5)·C
        P = _simplify(P, SIMPLIFY)
        rest = int(m.sum() - part.sum())
        if rest > 40:
            print('  %-18s оторванные куски: %d клеток (в контур не вошли; зона точки с высотой — по этажам, navZone)' % (z['name'], rest))
        e = {'id': zid[k], 'z': int(z['z'][1]), 'points': [{'x': round(x, 1), 'y': round(y, 1)} for x, y in P]}
        if z['level']: e['level'] = z['level']
        if z['name'] in roles: e['name'] = roles[z['name']]
        zones.append(e); names[zid[k]] = z['name']
        cx, cy = z['center']
        if not point_in(P, cx, cy):
            dt = ndimage.distance_transform_edt(part); j, i = np.unravel_index(int(np.argmax(dt)), dt.shape)
            cx, cy = (i + 0.5) * C, (j + 0.5) * C
        centers[zid[k]] = {'x': int(round(cx)), 'y': int(round(cy))}
    # зона участка навмеша: этаж геометрии под серединой участка, ближайший по высоте (в клетке и рядом)
    NV = json.load(open(mapdir.path(name, 'navmesh.json')))['areas']
    def zone_at(x, y, zz):
        i0, j0 = int(x // C), int(y // C); best = None
        for r in range(0, 4):
            for j in range(j0 - r, j0 + r + 1):
                for i in range(i0 - r, i0 + r + 1):
                    if max(abs(i - i0), abs(j - j0)) != r or not (0 <= i < W and 0 <= j < W): continue
                    c = j * W + i
                    for q in range(st[c], st[c + 1]):
                        if fzone[q] == 255: continue
                        d = abs(int(fz[q]) - zz) + r * 10
                        if best is None or d < best[0]: best = (d, int(fzone[q]))
            if best is not None and best[0] < 40: break
        return zid.get(best[1]) if best else None
    navZone, miss = {}, 0
    for a in NV:
        P = a['points']; cx = sum(p['x'] for p in P) / len(P); cy = sum(p['y'] for p in P) / len(P)
        zz = zone_at(cx, cy, a['z'])
        if zz: navZone[str(a['id'])] = zz
        else: miss += 1
    # переходы между зонами — по связям навмеша
    by = {a['id']: a for a in NV}; pairs = {}
    for a in NV:
        za = navZone.get(str(a['id']))
        for b in a.get('conn', []):
            zb = navZone.get(str(b))
            if not za or not zb or za == zb or b not in by: continue
            key = tuple(sorted((za, zb))); dz = abs(a['z'] - by[b]['z'])
            pairs[key] = max(pairs.get(key, 0), 0 if dz <= 40 else 1)
    portals = [{'a': a, 'b': b, 'type': 'stairs' if t else 'walk'} for (a, b), t in sorted(pairs.items())]
    out = {'source': 'tools/map3d/zones_game.py --map %s: зоны по подписям владельца (А4, geom3d/zones_owner.json) — этажи 3D-геометрии игры' % name,
           'zonemap': {'map': name, 'zones': zones, 'points': OLD['zonemap']['points'], 'portals': portals, 'walls': []},
           'centers': centers, 'shapes': {}, 'names': names, 'synonyms': {}, 'props': {}, 'sites': OLD.get('sites', {}),
           'navZone': navZone}
    open(mapdir.path(name, 'zones.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('записано zones.json: зон %d, переходов %d, участков навмеша с зоной %d (без зоны %d)' % (len(zones), len(portals), len(navZone), miss))


if __name__ == '__main__':
    build(mapdir.current())
