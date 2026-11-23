#!/usr/bin/env python3
"""Памятка по данным карты — проверка (владелец 17.11: «чтобы для новой карты всё нужное бралось сразу, а не "почему тут нет точек"»).
python3 tools/map/map_check.py [карта ...] — по списку tools/map/map_manifest.json: у каждой карты есть ли файл и непустое ли поле.
Код возврата 1, если чего-то нет. Строки «нет скрипта» — данных нет ни у одной карты (нужен новый скрипт запекания)."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAN = json.load(open(os.path.join(ROOT, 'tools', 'map', 'map_manifest.json'), encoding='utf-8'))
maps = sys.argv[1:] or sorted(d for d in os.listdir(os.path.join(ROOT, 'data', 'maps')) if os.path.isfile(os.path.join(ROOT, 'data', 'maps', d, 'map.json')))
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
bad = 0
print('%-48s ' % 'что' + ' '.join('%-16s' % m for m in maps))
for it in MAN['items']:
    if it.get('need'):
        print('%-48s ' % it['what'][:48] + ' '.join('%-16s' % ('НЕТ СКРИПТА') for m in maps)); bad += 1; continue
    row = []
    for m in maps:
        n, s = get(m, it['file'], it['key'])
        if not n: bad += 1
        row.append('%-16s' % (('✓ ' + s) if n else ('✗ ' + s))[:16])
    print('%-48s ' % it['what'][:48] + ' '.join(row))
print('\nне хватает: %d' % bad if bad else '\nвсё на месте')
sys.exit(1 if bad else 0)
