#!/usr/bin/env python3
"""(М140) сравнение версий разбора видимости: python3 tools/measure/engine/vis_cmp.py <карта> <тег1> <тег2> …  (тег '' — база)
Главные цифры: «не видно» в убийствах про, hasLOS, обратная ошибка («видит», хотя 2 с не стреляли), причины."""
import sys, os, json
VD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'runs', 'e0a_vis')
M = sys.argv[1]; tags = [t if t != 'base' else '' for t in sys.argv[2:]]
rows = [('не видно стоя, %', lambda S: S['kills']['не видно стоя, %']), ('hasLOS нет, %', lambda S: S['kills']['hasLOS нет, %']),
        ('обратная: все пары, %', lambda S: S['neg']['движок видит, %']), ('обратная: смотрел на врага, %', lambda S: S['neg']['смотрит — движок видит, %']),
        ('обратная hasLOS, %', lambda S: S['neg']['hasLOS видит, %'])]
for c in ['wall', 'floor', 'cover', 'level', 'ceil']: rows.append((f'режет {c}, шт', lambda S, c=c: S['kills']['причина «не видно»'].get(c, 0)))
SS = [json.load(open(os.path.join(VD, f'{M}_vis_stats{t}.json'))) for t in tags]
print(f'{M:8s}' + ''.join(f'{(t or "база"):>12s}' for t in tags))
for n, f in rows: print(f'{n:32s}' + ''.join(f'{f(S):>12}' for S in SS))
