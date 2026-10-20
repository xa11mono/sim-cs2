#!/usr/bin/env python3
"""Шум между матчами (М139, 20.10.2026): python3 tools/measure/noise.py <метка замера>
Берёт tools/measure/runs/<метка>/rec_*.json (одна версия на N матчах) и по каждой цифре считает среднее, разброс между матчами и
сколько матчей нужно на версию, чтобы разница в 10 % была настоящей (≈ 95 %: n = 2·(2·σ / (0,1·среднее))², σ — между матчами).
Цифры на матч: сторож на 100 раундов, гранат за раунд по сторонам, доля раундов T, доля раундов с плантом."""
import sys, os, json, glob, math
HERE = os.path.dirname(os.path.abspath(__file__))
run = sys.argv[1]
rows = []
for f in sorted(glob.glob(os.path.join(HERE, 'runs', run, 'rec_*.json'))):
    try: d = json.load(open(f))
    except ValueError: continue   # матч ещё играется
    R = d.get('rounds') or []
    if not R: continue
    nr = len(R); w = (d.get('watch') or {}).get('n', {})
    row = {'матч': os.path.basename(f)[4:-5]}
    for k in ('stall', 'nav', 'tug', 'flip', 'danger', 'wait', 'smokeKill'):
        row[k + ' /100 р'] = w.get(k, 0) * 100.0 / nr
    for side in ('CT', 'T'):
        row['гранат за раунд ' + side] = sum(1 for n in d.get('nades', []) if n[1] == side) / nr
    row['доля раундов T'] = sum(1 for r in R if r.get('winner') == 'T') / nr
    row['доля раундов с плантом'] = len(d.get('plants', [])) / nr
    rows.append(row)
if len(rows) < 2: sys.exit('мало матчей: %d' % len(rows))
keys = [k for k in rows[0] if k != 'матч']
print('матчей: %d (%s)' % (len(rows), ', '.join(r['матч'] for r in rows)))
print('%-28s %9s %9s %7s %s' % ('цифра', 'среднее', 'σ матчей', 'σ/ср', 'матчей на версию для разницы 10 %'))
out = {}
for k in keys:
    v = [r[k] for r in rows]; m = sum(v) / len(v); s = math.sqrt(sum((x - m) ** 2 for x in v) / (len(v) - 1))
    need = math.ceil(2 * (2 * s / (0.1 * m)) ** 2) if m > 0 else None
    out[k] = {'mean': m, 'sd': s, 'cv': s / m if m else None, 'n10': need}
    print('%-28s %9.2f %9.2f %6.0f%% %s' % (k, m, s, 100 * s / m if m else 0, need))
json.dump({'run': run, 'matches': [r['матч'] for r in rows], 'rows': rows, 'stats': out},
          open(os.path.join(HERE, 'results', 'noise_%s.json' % run), 'w'), ensure_ascii=False, indent=1)
