#!/usr/bin/env python3
"""(v443) где стоят T в фазе дефолта — из демок про: data/maps/<карта>/defaultpos.json → MAP.defaultpos.

python3 tools/defpos_bake.py --map mirage

Для каждого сайта планта — сколько T в среднем стоит в каждой зоне (из 5) на 20–50-й с раунда:
  * у карты есть демки по раундам (pro_samples.csv.gz с колонками sec и rid, Mirage) — только раунды с плантом после 60-й с
    (раунд с поздним выходом — это и есть дефолт), сайт — где поставили, время 25–50 с;
  * нет (Ancient, data/pro/pro_samples.csv.gz без sec / rid) — фаза setup (20–50 с) всех раундов с плантом на этом сайте.
Названия зон — по зонам набора карты (через собранную страницу, src/q.js), зона «?» не берётся, доля < 0,05 игрока — тоже.
Игра (170, фаза дефолта) раздаёт игрокам зоны жребием по этим долям.
"""
import csv, gzip, json, os, subprocess, sys, tempfile, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402

name = mapdir.current()
ROOT = mapdir.ROOT
own = mapdir.path(name, 'pro', 'pro_samples.csv.gz')
src = own if os.path.exists(own) else os.path.join(ROOT, 'data', 'pro', 'pro_samples.csv.gz')
bins = collections.Counter()
with gzip.open(src, 'rt') as f:
    rd = csv.DictReader(f)
    timed = 'sec' in rd.fieldnames and 'rid' in rd.fieldnames
    if timed:
        post = collections.defaultdict(lambda: 1e9); site = {}; S = []
        for x in rd:
            r, sec = x['rid'], float(x['sec'])
            if x['phase'] == 'post':
                if sec < post[r]: post[r] = sec; site[r] = x['site']
            elif x['side'] == 'T' and 25 <= sec <= 50: S.append((r, float(x['x']), float(x['y'])))
        for r, X, Y in S:
            if r in site and post[r] >= 60 and site[r] in ('A', 'B'): bins[(site[r], int(X)//8*8, int(Y)//8*8)] += 1
    else:
        for x in rd:
            if x['phase'] == 'setup' and x['side'] == 'T' and x['site'] in ('A', 'B'):
                bins[(x['site'], int(float(x['x']))//8*8, int(float(x['y']))//8*8)] += 1
tmp = tempfile.mkdtemp()
page = os.path.join(tmp, 'p.html'); js = os.path.join(tmp, 'z.js')
subprocess.run([sys.executable, os.path.join(ROOT, 'src', 'build.py'), '--map', name, page], check=True, stdout=subprocess.DEVNULL)
open(js, 'w').write('var D=' + json.dumps([[s, x, y, n] for (s, x, y), n in bins.items()]) +
                    ';var O={};D.forEach(function(e){var z=zoneUserName(zoneIdAt(e[1]+4,e[2]+4))||"?";var k=e[0]+"|"+z;O[k]=(O[k]||0)+e[3];});JSON.stringify(O)')
O = json.loads(subprocess.run(['node', os.path.join(ROOT, 'src', 'q.js'), page, '@' + js], check=True, capture_output=True, text=True).stdout)
out = {'_src': 'tools/defpos_bake.py: ' + ('раунды с плантом после 60 с, T на 25–50 с' if timed else 'фаза setup 20–50 с, раунды с плантом'), 'sites': {}}
for s in ('A', 'B'):
    c = {k.split('|', 1)[1]: v for k, v in O.items() if k.startswith(s + '|')}
    tot = sum(c.values()) or 1
    out['sites'][s] = [[z, round(5.0*v/tot, 3)] for z, v in sorted(c.items(), key=lambda a: -a[1]) if z != '?' and 5.0*v/tot >= 0.05]
json.dump(out, open(mapdir.path(name, 'defaultpos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(name, {s: len(v) for s, v in out['sites'].items()}, out['sites']['A'][:4], out['sites']['B'][:4])
