#!/usr/bin/env python3
"""Где T ждут выхода — по демкам про (владелец 18.11, Д27: «боты на подготовке стоят у самого сайта»; прогон 274: T на 20-й с у выхода
из Apartments (Stove) 6,1 % против 2,4 % у про, у низа T Ramp 4,9 / 1,7, на сайте A 8,5 / 0,8 — опорники их видят, ранние дуэли у сайта).

python3 tools/map/t_stage_bake.py --map <карта>  → data/maps/<карта>/tstage.json (в игре — MAP.tstage)

Для каждого раунда с заходом T на сайт (двое T ближе ENTRY_R к месту планта про) — T, которые СТОЯТ (скорость < STILL ед./с) с PRE0 по PRE1 с
до захода; сгустки стоянок (клетка CELL, центры не ближе MERGE, от MIN_ROUNDS раундов). На место: share — доля заходов на этот сайт, где там
ждал T ≥ 1 с; look — до двух направлений взгляда; pair — с какими местами занято в том же раунде; dEntry — медиана, за сколько секунд до
захода там стояли. Пороги — проектные числа. Общий для всех карт; в памятке (tools/map/map_manifest.json).
"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
import demos as D  # noqa: E402

MAPNAME = mapdir.current()
STILL, ENTRY_R = 25, 240
PRE0, PRE1 = 15, 2
CELL, MERGE, MIN_ROUNDS, NEAR, YAW_BINS = 24, 60, 4, 40, 24


def looks(ang):
    h = np.histogram(np.mod(ang, 2 * math.pi), bins=YAW_BINS, range=(0, 2 * math.pi))[0].astype(float)
    h3 = h + np.roll(h, 1) + np.roll(h, -1); out = []
    for _ in range(2):
        j = int(np.argmax(h3))
        if h3[j] <= 0 or (out and h3[j] / len(ang) < 0.15): break
        a0 = (j + 0.5) * 2 * math.pi / YAW_BINS; a0 = a0 - 2 * math.pi if a0 > math.pi else a0
        out.append([round(a0, 3), round(float(h3[j]) / len(ang), 2)])
        for d in range(-4, 5): h3[(j + d) % YAW_BINS] = 0
    return out


def main():
    P = json.load(open(mapdir.path(MAPNAME, 'pro.json'), encoding='utf-8'))['plants']; site = {}
    for s in ('A', 'B'):
        q = [p for p in P if p.get('site') == s]; w = sum(p['share'] for p in q)
        site[s] = (sum(p['x'] * p['share'] for p in q) / w, sum(p['y'] * p['share'] for p in q) / w)
    groups = {'A': [], 'B': []}
    for demo in D.demo_names():
        t = D.ticks_of(demo); t = t[t.side == 'T']
        for r in D.rounds_of(demo):
            w = t[(t.tick >= r['t0']) & (t.tick <= (r['tplant'] or r['t1']))]
            ent = None
            for tk, g in w.groupby('tick'):
                for s, (sx, sy) in site.items():
                    if (np.hypot(g.x.values - sx, g.y.values - sy) < ENTRY_R).sum() >= 2: ent = (tk, s); break
                if ent: break
            if not ent or ent[0] - r['t0'] < (PRE0 + 5) * D.TICK: continue   # раш с первых секунд — без ожидания
            a, b = ent[0] - PRE0 * D.TICK, ent[0] - PRE1 * D.TICK
            ww = w[(w.tick >= a - 16) & (w.tick <= b)]; pts = []
            for sid, g in ww.groupby('steamid'):
                g = g.sort_values('tick'); x, y, tk, yaw = g.x.values, g.y.values, g.tick.values, np.radians(g.yaw.values)
                if len(x) < 2: continue
                sp = np.r_[np.inf, np.hypot(np.diff(x), np.diff(y)) / np.maximum(np.diff(tk), 1) * D.TICK]
                for k in range(len(x)):
                    if tk[k] >= a and sp[k] < STILL:
                        pts.append((float(x[k]), float(y[k]), math.atan2(-math.sin(yaw[k]), math.cos(yaw[k])), (ent[0] - tk[k]) / D.TICK))
            groups[ent[1]].append(pts)
    out = {'_about': 'tools/map/t_stage_bake.py: где T про ждут захода на сайт (стоят за %d–%d с до захода) — доля, взгляд, пары' % (PRE1, PRE0),
           'map': MAPNAME, 'sites': {}}
    for s, rounds in groups.items():
        cells = {}
        for S in rounds:
            c = {}
            for p in S: k = (int(p[0] // CELL), int(p[1] // CELL)); c[k] = c.get(k, 0) + 1
            for k, m in c.items():
                if m >= 4: cells[k] = cells.get(k, 0) + 1
        cent = []
        for k, m in sorted(cells.items(), key=lambda kv: -kv[1]):
            cx, cy = (k[0] + 0.5) * CELL, (k[1] + 0.5) * CELL
            if m >= MIN_ROUNDS and all(math.hypot(cx - c[0], cy - c[1]) >= MERGE for c in cent): cent.append([cx, cy])
        spots, occ = [], []
        for cx, cy in cent:
            ids, ang, xs, ys, de = set(), [], [], [], []
            for ri, S in enumerate(rounds):
                here = [p for p in S if math.hypot(p[0] - cx, p[1] - cy) < NEAR]
                if len(here) < 4: continue
                ids.add(ri); ang += [p[2] for p in here]; xs += [p[0] for p in here]; ys += [p[1] for p in here]; de += [p[3] for p in here]
            if len(ids) < MIN_ROUNDS: continue
            spots.append({'x': round(float(np.median(xs)), 1), 'y': round(float(np.median(ys)), 1), 'share': round(len(ids) / len(rounds), 3),
                          'look': looks(ang), 'dEntry': round(float(np.median(de)), 1)}); occ.append(ids)
        order = sorted(range(len(spots)), key=lambda i: -spots[i]['share']); spots = [spots[i] for i in order]; occ = [occ[i] for i in order]
        for i, sp in enumerate(spots):
            sp['pair'] = {str(j): round(len(occ[i] & occ[j]) / len(occ[i]), 2) for j in range(len(spots)) if j != i and occ[i] & occ[j]}
        out['sites'][s] = {'rounds': len(rounds), 'spots': spots}
        print('  %s: заходов %d, мест %d; первые: %s' % (s, len(rounds), len(spots), ', '.join('%d,%d %.0f%% за %.0fс' % (q['x'], q['y'], 100 * q['share'], q['dEntry']) for q in spots[:6])))
    f = mapdir.path(MAPNAME, 'tstage.json')
    json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('%s → %s' % (MAPNAME, f))


if __name__ == '__main__':
    main()
