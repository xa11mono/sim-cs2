#!/usr/bin/env python3
"""Спавн и ранние зоны из демок про (владелец 17.11: «0,7–1,2 с разницы спавна сильно влияют на тайминги — сделать»).

python3 tools/map/spawn_early_bake.py --map <карта>  → data/maps/<карта>/spawnearly.json (в игре — MAP.spawnearly)

Ранняя зона — подпись радара (callouts рецепта), куда первый игрок стороны у про приходит в среднем не позже EARLY_SEC. Для каждой такой
зоны и каждого игрока раунда: его место спавна среди своих по расстоянию до зоны (1 — ближайший … 5) и пришёл ли он туда за REACH_SEC.
k — доля «пришёл» для места k, делённая на среднюю по местам (множитель: > 1 — с этого спавна в зону ходят чаще). Пример Mirage, CT AWP на
Window: с ближайшего спавна 86 %, с 5-го — 12 %. Пороги — проектные числа. Общий для всех карт; входит в памятку (tools/map/map_manifest.json).
"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
import demos as D  # noqa: E402

MAPNAME = mapdir.current()
EARLY_SEC, REACH_SEC, NEAR = 10, 12, 130   # с; с; px (радиус зоны вокруг подписи)


def main():
    cal = {c[0]: (c[1], c[2]) for c in mapdir.recipe(MAPNAME).get('callouts', [])}
    first = {s: {n: [] for n in cal} for s in ('T', 'CT')}
    reach = {s: {n: [[0, 0] for _ in range(5)] for n in cal} for s in ('T', 'CT')}
    for demo in D.demo_names():
        R = D.rounds_of(demo)
        if not R: continue
        t = D.ticks_of(demo)
        for r in R:
            w = t[(t.tick >= r['t0']) & (t.tick <= r['t0'] + REACH_SEC*64)]
            if not len(w): continue
            s0 = w[w.tick == w.tick.min()]
            for side in ('T', 'CT'):
                sp = s0[s0.side == side]
                if len(sp) != 5: continue
                ws = w[w.side == side]
                for n, (px, py) in cal.items():
                    near = ws[np.hypot(ws.x - px, ws.y - py) < NEAR]
                    if len(near): first[side][n].append((near.tick.min() - r['t0'])/64)
                    order = list(sp.assign(d=np.hypot(sp.x - px, sp.y - py)).sort_values('d').steamid)
                    got = set(near.steamid)
                    for k, sid in enumerate(order):
                        reach[side][n][k][0] += 1; reach[side][n][k][1] += sid in got
    out = {'_about': 'tools/map/spawn_early_bake.py: ранние зоны (первый приход ≤ %d с) — множитель по месту спавна среди своих (1 — ближайший)' % EARLY_SEC, 'map': MAPNAME}
    for side in ('T', 'CT'):
        out[side] = {}
        for n in cal:
            F = first[side][n]
            if len(F) < 30 or float(np.median(F)) > EARLY_SEC: continue
            p = [b / a if a else 0 for a, b in reach[side][n]]; m = sum(p)/5
            if m <= 0: continue
            out[side][n] = {'arr': round(float(np.median(F)), 1), 'p': [round(x, 2) for x in p], 'k': [round(x/m, 2) for x in p]}
    f = mapdir.path(MAPNAME, 'spawnearly.json')
    json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for side in ('T', 'CT'):
        print(side, ', '.join('%s %.1fс %s' % (n, v['arr'], v['k']) for n, v in out[side].items()))


if __name__ == '__main__':
    main()
