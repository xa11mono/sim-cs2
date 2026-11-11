"""Свойства зон для тактик на любой карте (v561, этап 1 docs/tasks/PLAN_TACTICS_V2.md; что и зачем — docs/reports/MAP_ZONE_PROPS.md).

Граф зон (порталы) + центры зон → для каждой зоны: сторона карты (A / мид / B — по доле пути до сайтов), время T и CT от спавна (с, бегом
250 ед/с по графу центров — грубая оценка, проверка — REACH в игре), время первой встречи (tT − tCT: < 0 — T приходят раньше), глубина до
своего сайта (с), входы сайтов (зоны-соседи зон сайта со стороны спавна T). Из демок карты (если есть): доля времени T и CT в зоне на 5–25 с
(контроль), где стоят ≥ 2 T за 4–10 с до входа на сайт (сбор), где один T вдали от своих на 10–40 с (лёрк), где CT ходят между сторонами
(ротация). Пишет data/maps/<карта>/zoneprops.json (игра: MAP.zoneprops). Запуск: python3 tools/zone_props_bake.py --map mirage"""
import sys, os, json, heapq, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
from demos import TICK, MAPNAME  # noqa: E402

UNIT = mapdir.radar(MAPNAME)['scale'] / 2.0
RUN = 250.0
D = json.load(open(mapdir.path(MAPNAME, 'zones.json'), encoding='utf-8'))
Z = [z for z in D['zonemap']['zones'] if len(z['points']) >= 3]
NAME = D.get('names', {})
P = {p['name'].split('_')[0]: (p['x'], p['y']) for p in D['zonemap']['points']}


def cent(z):
    xs = [q['x'] for q in z['points']]; ys = [q['y'] for q in z['points']]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


C = {z['id']: cent(z) for z in Z}
POLY = {z['id']: [(q['x'], q['y']) for q in z['points']] for z in Z}
NB = collections.defaultdict(set)
for p in D['zonemap']['portals']:
    if p['a'] in C and p['b'] in C and p['a'] != p['b']: NB[p['a']].add(p['b']); NB[p['b']].add(p['a'])


def inside(Pl, x, y):
    c = False; j = len(Pl) - 1
    for i in range(len(Pl)):
        if (Pl[i][1] > y) != (Pl[j][1] > y) and x < (Pl[j][0] - Pl[i][0]) * (y - Pl[i][1]) / (Pl[j][1] - Pl[i][1]) + Pl[i][0]: c = not c
        j = i
    return c


def zone_of(x, y):
    hit = [k for k, Pl in POLY.items() if inside(Pl, x, y)]
    if hit: return hit[0]
    return min(C, key=lambda k: (C[k][0] - x) ** 2 + (C[k][1] - y) ** 2)


def dist_from(src):
    d = {k: float('inf') for k in C}; d[src] = 0; h = [(0, src)]
    while h:
        dd, u = heapq.heappop(h)
        if dd > d[u]: continue
        for v in NB[u]:
            nd = dd + np.hypot(C[u][0] - C[v][0], C[u][1] - C[v][1])
            if nd < d[v]: d[v] = nd; heapq.heappush(h, (nd, v))
    return d


def main():
    zT, zCT, zA, zB = zone_of(*P['Tspawn']), zone_of(*P['CTspawn']), zone_of(*P['Asite']), zone_of(*P['Bsite'])
    dT, dCT, dA, dB = dist_from(zT), dist_from(zCT), dist_from(zA), dist_from(zB)
    sec = lambda px: round(px * UNIT / RUN, 1) if px < float('inf') else None
    props = {}
    for k in C:
        side = 'A' if dA[k] < 0.6 * dB[k] else ('B' if dB[k] < 0.6 * dA[k] else 'M')
        tT, tCT = sec(dT[k]), sec(dCT[k])
        props[k] = {'name': NAME.get(k, ''), 'side': side, 'tT': tT, 'tCT': tCT,
                    'meet': round(tT - tCT, 1) if tT is not None and tCT is not None else None,
                    'depthA': sec(dA[k]), 'depthB': sec(dB[k])}
    # входы сайта: зоны в 1–2 шагах от зоны сайта, ближе к спавну T, чем сама зона сайта (по графу)
    entries = {}
    for s, zs in (('A', zA), ('B', zB)):
        ring = set(NB[zs]) | {v for u in NB[zs] for v in NB[u]}
        entries[s] = sorted([k for k in ring if k != zs and dT[k] < dT[zs] and props[k]['side'] in (s, 'M')], key=lambda k: dT[k])
    out = {'zones': props, 'entries': entries, 'spawnT': zT, 'spawnCT': zCT, 'siteA': zA, 'siteB': zB, 'demo': None}
    # --- из демок карты
    try:
        from demos import demo_names, rounds_of, ticks_of
        names = demo_names()
    except Exception:
        names = []
    if names:
        ctl = collections.defaultdict(lambda: [0, 0]); gat = collections.Counter(); lurk = collections.Counter(); rot = collections.Counter(); nR = 0
        for demo in names:
            T = ticks_of(demo)
            for r in rounds_of(demo):
                t0 = r['t0']; nR += 1
                W = T[(T.tick >= t0 + 5 * TICK) & (T.tick < t0 + 25 * TICK)]
                for x, y, sd in zip(W.x.values[::4], W.y.values[::4], W.side.values[::4]):
                    ctl[zone_of(x, y)][0 if sd == 'T' else 1] += 1
                if r['tplant']:
                    g = T[(T.tick >= r['tplant'] - 10 * TICK) & (T.tick < r['tplant'] - 4 * TICK) & (T.side == 'T')]
                    for x, y in zip(g.x.values[::8], g.y.values[::8]): gat[zone_of(x, y)] += 1
                L = T[(T.tick >= t0 + 10 * TICK) & (T.tick < t0 + 40 * TICK) & (T.side == 'T')]
                for tk, g in list(L.groupby('tick'))[::16]:
                    xs, ys = g.x.values, g.y.values
                    for i in range(len(xs)):
                        o = [np.hypot(xs[j] - xs[i], ys[j] - ys[i]) for j in range(len(xs)) if j != i]
                        if o and min(o) * UNIT > 900: lurk[zone_of(xs[i], ys[i])] += 1
                Cw = T[(T.tick >= t0) & (T.tick < (r['tplant'] or r['t1'])) & (T.side == 'CT')]
                for sid, g in Cw.groupby('steamid'):
                    zs = [zone_of(x, y) for x, y in zip(g.x.values[::8], g.y.values[::8])]
                    sides = [props[z]['side'] for z in zs]
                    a = [i for i, s in enumerate(sides) if s == 'A']; b = [i for i, s in enumerate(sides) if s == 'B']
                    if a and b:   # CT побывал на обеих сторонах — зоны между ними — путь ротации
                        i0, i1 = sorted([a[0], b[0]]) if a[0] < b[0] else sorted([b[0], a[0]])
                        for z in set(zs[i0:i1 + 1]): rot[z] += 1
        totC = sum(v[0] + v[1] for v in ctl.values()) or 1
        for k in props:
            c = ctl.get(k, [0, 0]); n = c[0] + c[1]
            props[k]['occ'] = round(n / totC, 4)                         # доля присутствия на 5–25 с
            props[k]['tShare'] = round(c[0] / n, 2) if n else None       # доля T среди присутствующих
            props[k]['gather'] = round(gat.get(k, 0) / (sum(gat.values()) or 1), 4)
            props[k]['lurk'] = round(lurk.get(k, 0) / (sum(lurk.values()) or 1), 4)
            props[k]['rot'] = round(rot.get(k, 0) / max(1, nR), 4)
            # зона контроля: заметно присутствие обеих сторон в начале раунда (доли — ориентир, не правило)
            props[k]['control'] = bool(n / totC > 0.01 and c[0] and c[1] and 0.25 <= c[0] / n <= 0.85)
        out['demo'] = {'demos': len(names), 'rounds': nR}
    p = mapdir.path(MAPNAME, 'zoneprops.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('→', p, '| зон', len(props), '| входы A:', [NAME.get(k, k) for k in entries['A']], 'B:', [NAME.get(k, k) for k in entries['B']])
    top = lambda key: [NAME.get(k, k) for k, v in sorted(props.items(), key=lambda kv: -(kv[1].get(key) or 0))[:6]]
    if out['demo']:
        print('контроль:', [NAME.get(k, k) for k, v in props.items() if v.get('control')][:12])
        print('сбор:', top('gather')); print('лёрк:', top('lurk')); print('ротация CT:', top('rot'))
    print('T раньше CT (meet < 0):', [NAME.get(k, k) for k, v in sorted(props.items(), key=lambda kv: kv[1]['meet'] if kv[1]['meet'] is not None else 99) if v['meet'] is not None and -3 < v['meet'] < 3][:12])


if __name__ == '__main__':
    main()
