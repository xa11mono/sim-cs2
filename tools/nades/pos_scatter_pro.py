#!/usr/bin/env python3
"""Разброс места ног про при повторе одного броска (05.11, пакет гранат, схема владельца «ошибка исполнения»):
python3 tools/nades/pos_scatter_pro.py
Источник — data/maps/{mirage,ancient}/throws.json. Повтор одного броска — броски стоя (move == stand) одного типа с одним прицелом
(поворот и наклон в клетке AIM_CELL°) и разрывом в одной клетке 96 ед.; группа ≥ 3. Отклонение места — от медианы группы (ед. игры, по
горизонтали); больше MAX_DEV — другой бросок (отбрасывается). Печатает децили и строку для кода (NADE_POS_SCATTER, 380)."""
import json, math, collections, statistics as st, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
AIM_CELL, MAX_DEV = 1.0, 48.0
def q(a, p):
    a = sorted(a); return a[int(round(p * (len(a) - 1)))] if a else float('nan')
D = collections.defaultdict(lambda: {'d': [], 'g': 0, 'drop': 0})
for m in ('mirage', 'ancient'):
    T = [t for t in json.load(open(os.path.join(ROOT, 'data', 'maps', m, 'throws.json')))['throws'] if t.get('det') and t.get('move') == 'stand']
    G = collections.defaultdict(list)
    for t in T: G[(t['type'], round(t['yaw'] / AIM_CELL), round(t['pitch'] / AIM_CELL), round(t['det']['pos'][0] / 96), round(t['det']['pos'][1] / 96))].append(t)
    for k, g in G.items():
        if len(g) < 3: continue
        R = D[k[0]]; R['g'] += 1
        mx = st.median(t['pos'][0] for t in g); my = st.median(t['pos'][1] for t in g)
        for t in g:
            d = math.hypot(t['pos'][0] - mx, t['pos'][1] - my)
            if d > MAX_DEV: R['drop'] += 1; continue
            R['d'].append(d)
out = {}
for ty in ('smoke', 'flash', 'he', 'molotov'):
    R = D[ty]
    print('%-8s групп %4d бросков %5d (отброшено %d)  место ед. p50 %.1f p75 %.1f p90 %.1f' % (ty, R['g'], len(R['d']), R['drop'], q(R['d'], .5), q(R['d'], .75), q(R['d'], .9)))
    out['molly' if ty == 'molotov' else ty] = [round(q(R['d'], i / 10), 1) for i in range(11)]
print('NADE_POS_SCATTER =', json.dumps(out, separators=(',', ':')))
