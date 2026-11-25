#!/usr/bin/env python3
"""Памятка по данным карты — проверка (владелец 17.11: «чтобы для новой карты всё нужное бралось сразу, а не "почему тут нет точек"»).
python3 tools/map/map_check.py [карта ...] [--known=файл] — по списку tools/map/map_manifest.json: у каждой карты есть ли файл и непустое ли поле.
(Р2.0, владелец 25.11) --known=rebuild/known_map_gaps.json — известные недостатки данных отделены от новых: известный — «известно», код
выхода не портит; новый — код 1 (регрессия); известный, но уже закрытый — напоминание убрать его из списка. Без --known — как раньше: любой
недостаток — код 1. Проверка не ослабляется: список известных меняется только правкой файла (с датой и причиной).
Код возврата 1, если чего-то нет. Строки «нет скрипта» — данных нет ни у одной карты (нужен новый скрипт запекания)."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAN = json.load(open(os.path.join(ROOT, 'tools', 'map', 'map_manifest.json'), encoding='utf-8'))
KNOWN_F = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--known=')), None)
KNOWN = {(g['what'], g['map']) for g in json.load(open(os.path.join(ROOT, KNOWN_F), encoding='utf-8'))['gaps']} if KNOWN_F else set()
maps = [a for a in sys.argv[1:] if not a.startswith('--')] or sorted(d for d in os.listdir(os.path.join(ROOT, 'data', 'maps')) if os.path.isfile(os.path.join(ROOT, 'data', 'maps', d, 'map.json')))
cache = {}
def get(m, f, key):
    p = os.path.join(ROOT, 'data', 'maps', m, f)
    if not os.path.exists(p): return None, 'нет файла'
    if p not in cache: cache[p] = json.load(open(p, encoding='utf-8'))
    v = cache[p]
    for k in [x for x in key.split('.') if x] if '|' not in key else key.split('.', 1):
        if not isinstance(v, dict) or k not in v: return None, 'нет поля ' + key
        v = v[k]
    n = len(v) if isinstance(v, (list, dict, str)) else 1
    return n, ('пусто' if n == 0 else 'есть (%d)' % n)
bad = 0; known = 0; seen = set()
def gap(it, m):   # недостаток: известный (список) или новый
    global bad, known
    k = (it['what'], m); seen.add(k)
    if k in KNOWN: known += 1; return 'известно'
    bad += 1; return 'НОВОЕ'
print('%-48s ' % 'что' + ' '.join('%-16s' % m for m in maps))
for it in MAN['items']:
    if it.get('need'):
        print('%-48s ' % it['what'][:48] + ' '.join('%-16s' % ('НЕТ СКРИПТА (' + gap(it, m) + ')')[:16] for m in maps)); continue
    row = []
    for m in maps:
        n, s = get(m, it['file'], it['key'])
        if not n: s = s + ' — ' + gap(it, m)
        row.append(('%-16s' % ('✓ ' + s)[:16]) if n else ('✗ ' + s))
    print('%-48s ' % it['what'][:48] + ' '.join(row))
closed = sorted(KNOWN - seen)
if KNOWN_F:
    print('\nизвестных недостатков (%s): %d; новых: %d' % (KNOWN_F, known, bad))
    for w, m in closed: print('  закрыто, убрать из списка известных: %s — %s' % (w, m))
else: print('\nне хватает: %d' % bad if bad else '\nвсё на месте')
sys.exit(1 if bad else 0)
