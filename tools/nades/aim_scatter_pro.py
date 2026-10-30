#!/usr/bin/env python3
"""Разброс прицела про при повторе одного броска (30.10, этап 2 физики гранат): python3 tools/nades/aim_scatter_pro.py
Источник — data/maps/{mirage,ancient}/throws.json (броски из демок: место ног, поворот, наклон, разрыв).
Повтор одного броска — броски стоя (move == stand) одного типа с места в 8 ед. (клетка 8 ед.) и разрывом в одной клетке 96 ед.;
группа ≥ 3 бросков. Отклонение — от медианы группы; больше MAX_DEV° — это другой бросок в ту же точку, а не промах (отбрасывается).
Печатает: по типу — число групп / бросков, децили |Δповорота| и |Δнаклона| (°) и разброс разрыва (ед.); и строку для кода
(NADE_AIM_SCATTER в src/game/380_nades_throw.js): 11 точек 0, 10, …, 100 % по каждой оси."""
import json, math, collections, statistics as st, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
MAX_DEV = 5.0
def q(a, p):
    a = sorted(a); return a[int(round(p * (len(a) - 1)))] if a else float('nan')
D = collections.defaultdict(lambda: {'y': [], 'p': [], 'l': [], 'g': 0, 'drop': 0})
for m in ('mirage', 'ancient'):
    T = [t for t in json.load(open(os.path.join(ROOT, 'data', 'maps', m, 'throws.json')))['throws'] if t.get('det') and t.get('move') == 'stand']
    G = collections.defaultdict(list)
    for t in T: G[(t['type'], round(t['pos'][0] / 8), round(t['pos'][1] / 8), round(t['det']['pos'][0] / 96), round(t['det']['pos'][1] / 96))].append(t)
    for k, g in G.items():
        if len(g) < 3: continue
        R = D[k[0]]; R['g'] += 1
        my = st.median(t['yaw'] for t in g); mp = st.median(t['pitch'] for t in g)
        mx = st.median(t['det']['pos'][0] for t in g); mY = st.median(t['det']['pos'][1] for t in g)
        for t in g:
            dy = abs((t['yaw'] - my + 180) % 360 - 180); dp = abs(t['pitch'] - mp)
            if dy > MAX_DEV or dp > MAX_DEV: R['drop'] += 1; continue
            R['y'].append(dy); R['p'].append(dp); R['l'].append(math.hypot(t['det']['pos'][0] - mx, t['det']['pos'][1] - mY))
out = {}
for ty in ('smoke', 'flash', 'he', 'molotov'):
    R = D[ty]
    print('%-8s групп %4d бросков %5d (отброшено %d)  |Δyaw|° p50 %.2f p90 %.2f  |Δpitch|° p50 %.2f p90 %.2f  разрыв ед. p50 %.0f p75 %.0f p90 %.0f' % (
        ty, R['g'], len(R['y']), R['drop'], q(R['y'], .5), q(R['y'], .9), q(R['p'], .5), q(R['p'], .9), q(R['l'], .5), q(R['l'], .75), q(R['l'], .9)))
    out['molly' if ty == 'molotov' else ty] = {'yaw': [round(q(R['y'], i / 10), 2) for i in range(11)], 'pitch': [round(q(R['p'], i / 10), 2) for i in range(11)],
                                              'n': len(R['y']), 'land': [round(q(R['l'], p)) for p in (.5, .75, .9)]}
print('NADE_AIM_SCATTER =', json.dumps(out, separators=(',', ':')))
