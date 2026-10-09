#!/usr/bin/env python3
"""Читает вывод tools/script_log.js: лог шагов по времени, разрывы в мире, итог проверки.
python3 tools/script_log.py script_B_main.json [...]"""
import json, sys
for f in sys.argv[1:]:
    d = json.load(open(f, encoding='utf-8'))
    print("=" * 78)
    print("%s  (god=%s)  старт execute: %s с, тиков в тесте: %s" % (d['setup'], d['god'], d['startSec'], d['ticks']))
    print("гранаты T:", "; ".join("%s: %s" % kv for kv in d['inv'].items()))
    print("-" * 78)
    for sec, tick, actor, who, ev, why in d['rows']:
        print("%6.1f с  т%-5d %-9s %-4s %-14s %s" % (sec, tick, actor, who or "", ev, why[:150]))
    print("-" * 78)
    print("разрывы в мире (тик, тип, x, y, кто бросил, какой шаг):")
    for t in d['truth']:
        print("  ", t)
    print("-" * 78)
    print("итоги шагов:", d['summary'])
    print("по таймауту:", d['timeouts'] or "нет")
    print("источник снят (идут без него):", d.get('noSource') or "нет")
    print("НАРУШЕНИЯ порядка:", d['violations'] or "нет — ни один шаг не раньше своего события")
    if d['voice']:
        print("войс (фразы сценария):", [v for v in d['voice'] if any(w in v[1] for w in ("дым", "флеш", "молот", "заходим"))])
