#!/usr/bin/env python3
"""Читаемая таблица из лога знания ботов (tools/know_log.js).
   python3 tools/know_log.py know_log.json [--snaps]
События: время от начала раунда, кто знает, о каком враге (одинаковое событие по
нескольким врагам — одной строкой), причина, гипотезы с весами после события.
--snaps — плюс снимок раз в секунду (кто что думает о каждом живом враге)."""
import json, sys

def hyps(hs):
    if hs is None: return ''
    if isinstance(hs, str): return hs
    return ' | '.join('%s %s %.2f' % ({'held': 'стоит', 'moved': '→', 'moved_unknown': 'ушёл ?'}[t], z if t != 'moved_unknown' else '', w)
                      for t, z, w in hs).replace('  ', ' ')

d = json.load(open(sys.argv[1])); s = d['start']
print('Раунд: %d тиков (%.0f с), %.3f мс на тик со знанием; убийства: %s' % (d['ticks'], d['ticks']/64, d['msPerTick'],
      ', '.join('%.1fс %s→%s' % ((t-s)/64, a, v) for t, a, v in d['kills'])))
print('В конце на самом деле: ' + ', '.join('%s %s' % (i, z if a else '(мёртв)') for i, a, z in d['truth']))
print()
rows, prev = [], None
for e in d['log']:
    key = (e['tick'], e['who'], e['cause'], json.dumps(e['hyps']))
    if prev and prev[0] == key: prev[1].append(e['enemy']); continue
    prev = (key, [e['enemy']], e); rows.append(prev)
for key, enemies, e in rows:
    print('%6.1fс %-4s о %-12s %-62s %s' % ((e['tick']-s)/64, e['who'], ','.join(enemies), e['cause'][:62], hyps(e['hyps'])))
if '--snaps' in sys.argv:
    print('\nСнимки раз в секунду')
    for sn in d['snaps']:
        print('%6.1fс %s: ' % (sn['sec'], sn['who']) + '  //  '.join('%s: %s' % (k, hyps(v)) for k, v in sn['enemies'].items()))
