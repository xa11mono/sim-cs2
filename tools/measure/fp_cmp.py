#!/usr/bin/env python3
"""(15.11, перестройка) Сравнить отпечатки двух меток: python3 tools/measure/fp_cmp.py <метка_база> <метка> — по содержимому (JSON), без поля
fields (ловец полей). Пусто расхождений = бит в бит. Иначе — по матчу первый расходящийся раунд / фраг / граната."""
import json, os, sys
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runs')
a, b = sys.argv[1], sys.argv[2]; bad = 0
for f in sorted(os.listdir(os.path.join(R, a))):
    if not f.startswith('fp_'): continue
    p, q = os.path.join(R, a, f), os.path.join(R, b, f)
    if not os.path.exists(q): print(f, 'нет у', b); bad += 1; continue
    x, y = json.load(open(p)), json.load(open(q)); x.pop('fields', None); y.pop('fields', None)
    if x == y: continue
    bad += 1
    def first(k): return next((i for i, (u, v) in enumerate(zip(x[k], y[k])) if u != v), None)
    r = first('rounds'); print(f, 'раунд', r, x['rounds'][r][:4] if r is not None else '', '| фраг', first('kills'), '| граната', first('nades'))
print('бит в бит' if not bad else 'РАСХОЖДЕНИЙ: %d' % bad)
