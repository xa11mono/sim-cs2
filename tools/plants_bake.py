#!/usr/bin/env python3
"""Места планта про (v381, М135, владелец 16.10: «бомба ставится на укрытии»): <pro_dir>/plants.json → pro.json, поле plants.

python3 tools/plants_bake.py --map <карта>
Каждый плант из демок (bomb_planted: где стоял ставящий) → координаты карты 0..2048; сайт — ближайший центр сайта
(zones.json, точки Asite_* / Bsite_*). Кластер — сетка CELL ед. карты; место берётся, если там ставили ≥ MIN_N раз.
Пишет [{x, y, site, share}] — share: доля плантов этого сайта в этом месте. Игра выбирает точку планта только из этих мест
(sitePlantOptions), поэтому бомба не окажется на ящике или укрытии, куда про не ставят.
"""
import json, os, sys
from collections import defaultdict

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
import demos as D  # noqa: E402

CELL, MIN_N = 24, 3   # проектные числа: сетка кластера (ед. карты) и сколько плантов нужно месту


def site_centers():
    Z = json.load(open(mapdir.path(D.MAPNAME, 'zones.json'), encoding='utf-8'))['zonemap']['points']
    S = defaultdict(list)
    for p in Z:
        k = p['name'].split('_')[0]
        if k in ('Asite', 'Bsite'):
            S[k[0]].append((p['x'], p['y']))
    return {k: (float(np.mean([q[0] for q in v])), float(np.mean([q[1] for q in v]))) for k, v in S.items()}


def main():
    SC = site_centers()
    cl = defaultdict(lambda: {'n': 0, 'x': 0.0, 'y': 0.0, 'site': defaultdict(int), 'm': set()})
    tot = defaultdict(int)
    for dm in D.demo_names():
        e = D.event(dm, 'bomb_planted')
        if not len(e) or 'user_X' not in e:
            continue
        x, y = D.tr(e.user_X.values.astype(float), e.user_Y.values.astype(float))
        for xi, yi in zip(x, y):
            k = min(SC, key=lambda s: (SC[s][0]-xi)**2 + (SC[s][1]-yi)**2)
            c = cl[(round(xi / CELL), round(yi / CELL))]
            c['n'] += 1; c['x'] += float(xi); c['y'] += float(yi); c['site'][k] += 1; c['m'].add(dm)
            tot[k] += 1
    out = []
    for c in sorted(cl.values(), key=lambda c: -c['n']):
        if c['n'] < MIN_N:
            continue
        k = max(c['site'], key=c['site'].get)
        out.append({'x': round(c['x'] / c['n'], 1), 'y': round(c['y'] / c['n'], 1), 'site': k,
                    'share': round(c['n'] / tot[k], 3), 'n': c['n'], 'matches': len(c['m'])})
    f = os.path.join(mapdir.pro_dir(D.MAPNAME), 'plants.json')
    json.dump({'plants': dict(tot), 'spots': out}, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # в pro.json набора — только поле plants (остальное не трогаем)
    # (дописываем строкой в конец, не переформатируя файл: остальные поля и их вид — как были)
    pf = mapdir.path(D.MAPNAME, 'pro.json')
    s = open(pf, encoding='utf-8').read()
    if ',\n"plants":' in s:
        s = s[:s.index(',\n"plants":')] + '}\n'
    s = s.rstrip()
    assert s.endswith('}')
    pl = [{k: o[k] for k in ('x', 'y', 'site', 'share')} for o in out]
    s = s[:-1].rstrip() + ',\n"plants":' + json.dumps(pl, ensure_ascii=False, separators=(',', ':')) + '}\n'
    json.loads(s)
    open(pf, 'w', encoding='utf-8').write(s)
    print('%s: плантов %s, мест %d (A %d, B %d)' % (D.MAPNAME, dict(tot), len(out), sum(o['site'] == 'A' for o in out), sum(o['site'] == 'B' for o in out)))


if __name__ == '__main__':
    main()
