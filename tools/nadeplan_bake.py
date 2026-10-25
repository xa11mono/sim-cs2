#!/usr/bin/env python3
"""(v428) Доли гранат про по моменту раунда и зоне карты — для командного плана гранат (src/game/365_nade_plan.js).

python3 tools/nadeplan_bake.py [--map mirage]   →   data/maps/<карта>/nadeplan.json (в игре — MAP.nadeplan)

Из бросков про (pro_nades.csv папки демок карты): каждый бросок — сторона, момент, зона, тип.
  момент:  CT — now (по времени, до контакта), call (по коллу — увидели T), retake;
           T  — now (инста и сетап), exec (выход), postplant
  зона:    сторона карты по рецепту (_build.json → regions: A, B, mid, back, Tside).
           CT — откуда кидал (где играет); с тыла / со стороны T — куда упала.
           T  — куда упала (куда идёт); упала у себя (Tside / back) — откуда кидал.
Пишет доли: {сторона: {тип: {"момент|зона": доля среди бросков этого типа}}} — сумма по типу = 1. Сколько гранат брать за раунд —
уже в pro.json (nadesBy, tools/nades_pro.py): план раздаёт это число по моментам и зонам этими долями.
"""
import csv, json, math, os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import mapdir

MAP = mapdir.current()
M = mapdir.path(MAP)
R = mapdir.recipe(MAP).get('regions')
if not R: sys.exit('нет regions в _build.json карты %s' % MAP)
BACK, TSIDE = set(R.get('back', [])), set(R.get('Tside', []))
RBY = {n: k for k in ('A', 'B', 'mid') for n in R.get(k, [])}
Z = json.load(open(os.path.join(M, 'zones.json'), encoding='utf-8'))
names = Z['names']
polys = []
for s in Z['zonemap']['zones']:
    nm = names.get(s['id'], '')
    nm = (nm if isinstance(nm, str) else '').split(' / ')[0]
    P = [(p['x'], p['y']) for p in s['points']]
    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    polys.append((nm, P, (max(xs) - min(xs)) * (max(ys) - min(ys))))
polys.sort(key=lambda q: q[2])   # меньшие зоны — первыми (вложенные)


def inside(x, y, P):
    c, j = False, len(P) - 1
    for i in range(len(P)):
        xi, yi = P[i]; xj, yj = P[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi: c = not c
        j = i
    return c


_cache = {}
def region(x, y):
    """сторона карты — как tools/positions_bake.py region_of: тыл CT и сторона T — по названию зоны; Ancient — по координате x
    (regions.x), остальные карты — по названию зоны (списки A, B, mid)"""
    k = (round(x / 8), round(y / 8))
    if k not in _cache:
        nm = next((nm for nm, P, _ in polys if inside(x, y, P)), None)
        if nm is None: nm = min(polys, key=lambda q: min(math.hypot(x - a, y - b) for a, b in q[1]))[0]
        if nm in BACK: r = 'back'
        elif nm in TSIDE: r = 'Tside'
        elif 'x' in R: r = 'A' if x < R['x'][0] else 'B' if x > R['x'][1] else 'mid'
        else: r = RBY.get(nm, 'mid')
        _cache[k] = r
    return _cache[k]


MOM = {'CT': {'timed': 'now', 'call': 'call', 'retake': 'retake'},
       'T': {'insta': 'now', 'setup': 'now', 'exec': 'exec', 'postplant': 'postplant'}}
cnt = {s: collections.defaultdict(collections.Counter) for s in MOM}
for r in csv.DictReader(open(os.path.join(mapdir.pro_dir(MAP), 'pro_nades.csv'), encoding='utf-8')):
    sd, m = r['side'], MOM.get(r['side'], {}).get(r['trig'])
    if not m: continue
    fr, to = region(float(r['fx']), float(r['fy'])), region(float(r['lx']), float(r['ly']))
    if sd == 'CT': z = fr if fr in ('A', 'B', 'mid') else to
    else: z = to if to in ('A', 'B', 'mid') else fr
    if z not in ('A', 'B', 'mid'): z = 'mid'
    cnt[sd][r['type']][m + '|' + z] += 1
# (v429) фейк: в раундах с плантом — гранаты T, упавшие на ДРУГОЙ сайт до планта; среднее по раундам, где такие были
plant, fper = {}, collections.defaultdict(collections.Counter)
for r in csv.DictReader(open(os.path.join(mapdir.pro_dir(MAP), 'pro_nades.csv'), encoding='utf-8')):
    if r['side'] == 'T' and r['secToPlant'] != '' and r['site'] in ('A', 'B'): plant[r['rid']] = r['site']
for r in csv.DictReader(open(os.path.join(mapdir.pro_dir(MAP), 'pro_nades.csv'), encoding='utf-8')):
    if r['side'] != 'T' or r['rid'] not in plant or r['secToPlant'] == '' or float(r['secToPlant']) < 0: continue
    if region(float(r['lx']), float(r['ly'])) == ('B' if plant[r['rid']] == 'A' else 'A'): fper[r['rid']][r['type']] += 1
fr = [k for k in plant if sum(fper[k].values()) > 0]
fakeBy = {t: round(sum(fper[k][t] for k in fr) / max(1, len(fr)), 2) for t in ('smoke', 'flash', 'molly', 'he')}
out = {'_about': 'tools/nadeplan_bake.py: доли бросков про по «момент|зона» для каждого типа гранаты (сумма по типу = 1); fakeBy — гранат T на другой сайт до планта за раунд, где такие были'}
for sd in cnt:
    out[sd] = {}
    for t, c in cnt[sd].items():
        n = sum(c.values())
        out[sd][t] = {k: round(v / n, 4) for k, v in sorted(c.items(), key=lambda kv: -kv[1])}
out['fakeBy'] = fakeBy   # гранат фейка за раунд с фейком (T)
open(os.path.join(M, 'nadeplan.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
print('fakeBy', fakeBy); print('nadeplan.json (%s):' % MAP, {sd: {t: len(v) for t, v in out[sd].items()} for sd in ('CT', 'T')})
for sd in ('CT', 'T'):
    for t in ('smoke', 'flash', 'molly', 'he'):
        print('  %s %-5s' % (sd, t), ', '.join('%s %d%%' % (k, round(100 * v)) for k, v in list(out[sd].get(t, {}).items())[:6]))
