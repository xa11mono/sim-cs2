#!/usr/bin/env python3
"""Дефолт T по зонам (v225, правки владельца 2 и 7) — из 88 демок Ancient (раунды с плантом, до планта):
  trans — куда T переходят из зоны за 5 с: {сайт плана: {зона: {зона через 5 с: сколько раз}}} (снимки «где T»
          на 5, 10, … 45-й с — tsnap из tools/positions_bake.py; «осталась та же» — тоже переход);
  ctBase — сколько CT в среднем стоит на 20-й с на каждой стороне (A / B / mid / back) — сколько защитников
          IGL T ждёт на сайте, пока ничего не знает.
python3 tools/tzone_bake.py [кэш.pkl] → src/data/tzones.json (кэш — результат positions_bake.load_rounds())"""
import os, sys, json, pickle, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import positions_bake as PB
STEP, TICK = 5, 64
if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
    R = pickle.load(open(sys.argv[1], 'rb'))[0]
else:
    R = PB.load_rounds()[0]
def zn(x, y, z=None): return PB.zone_at(x, y, z)['name']
trans = {'A': collections.defaultdict(collections.Counter), 'B': collections.defaultdict(collections.Counter)}
ct = collections.Counter(); nct = 0
for r in R:
    if r.get('ct20'):
        nct += 1
        for _, x, y, z in r['ct20']: ct[PB.region_of(x, y, zn(x, y, z))] += 1
    if not r['tplant'] or r['site'] not in trans:
        continue
    for s in PB.DEF_SECS:
        if r['t0'] + (s + STEP) * TICK >= r['tplant'] or s + STEP not in r['tsnap']:
            continue
        now = {sid: zn(x, y, z) for sid, x, y, z in r['tsnap'][s]}
        for sid, x, y, z in r['tsnap'][s + STEP]:
            if sid in now:
                trans[r['site']][now[sid]][zn(x, y, z)] += 1
out = {'step': STEP,
       'trans': {site: {a: dict(c) for a, c in T.items()} for site, T in trans.items()},
       'ctBase': {k: round(ct[k] / nct, 2) for k in ('A', 'B', 'mid', 'back')}}
json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'tzones.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('раундов с CT на 20-й с:', nct, 'ctBase', out['ctBase'])
for site in 'AB':
    print(site, 'зон', len(out['trans'][site]), 'переходов', sum(sum(c.values()) for c in out['trans'][site].values()))
