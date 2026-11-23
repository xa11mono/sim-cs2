#!/usr/bin/env python3
"""Места CT по демкам про — как пост-плант T (владелец 18.11, Д28: «расстановки — как постплент: хорошие позиции, кроссфайр»).

python3 tools/map/ct_spots_bake.py --map <карта>  → data/maps/<карта>/ctspots.json (в игре — MAP.ctspots)

Было (tools/ct/ct_setup_spots_bake.py): одна точка на роль — середина (k-медиан) мест про этой структуры; у сайта A Mirage середина
опорников пришлась на Triple Box, где про стоят в 1–2 % раундов (прогон 274: боты 12 %). Теперь — сами места про: CT, которые СТОЯТ
(скорость < STILL ед./с) с WIN0 по WIN1 с после freeze, — сгустки стоянок (клетка CELL, центры не ближе MERGE, от MIN_ROUNDS раундов).
Раунды делятся по стороне карты (A / M / B — как region в tools/pro/pro_tactics.py: ближе к сайту в 0,6 раза — его сторона) и по тому,
сколько CT на этой стороне на 20-й с (n). На место:
  share — доля раундов (сторона, n), где там стоял CT ≥ 1 с;
  look  — до двух главных направлений взгляда [угол (рад, как facing: atan2(dy, dx), y вниз), доля];
  pair  — {j: доля} — в скольких раундах с этим местом занято и место j (кто с кем держит сторону: кроссфайр у про).
Пороги — проектные числа. Общий для всех карт; в памятке (tools/map/map_manifest.json).
"""
import json, math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
import demos as D  # noqa: E402

MAPNAME = mapdir.current()
STILL = 25                 # ед. карты/с
WIN0, WIN1, TN = 12, 28, 20  # с после freeze; на TN с — сколько CT на стороне
CELL, MERGE, MIN_ROUNDS = 24, 60, 3
NEAR = 40                  # ед.: стоял «на месте»
YAW_BINS = 24


def main():
    # центры сайтов — как tools/pro/pro_tactics.py (точки zonemap Asite_* / Bsite_*); пишутся в файл, игра делит стороны по ним же
    Z = json.load(open(mapdir.path(MAPNAME, 'zones.json'), encoding='utf-8'))['zonemap']['points']
    SITE = {}
    for p in Z:
        k = p['name'].split('_')[0]
        if k in ('Asite', 'Bsite'): SITE[k[0]] = (float(p['x']), float(p['y']))
    def region(x, y):
        dA = math.hypot(x - SITE['A'][0], y - SITE['A'][1]); dB = math.hypot(x - SITE['B'][0], y - SITE['B'][1])
        return 'A' if dA < 0.6 * dB else 'B' if dB < 0.6 * dA else 'M'
    groups = {}   # (side, n) → [rounds: [(x, y, yaw, sid)...]]
    for demo in D.demo_names():
        t = D.ticks_of(demo)
        t = t[t.side == 'CT']
        for r in D.rounds_of(demo):
            a, b = r['t0'] + WIN0 * D.TICK, min(r['t1'], r['t0'] + WIN1 * D.TICK)
            if r['tplant'] and r['tplant'] < b: b = r['tplant']
            w = t[(t.tick >= a - 16) & (t.tick <= b)]
            at = w[(w.tick >= r['t0'] + TN * D.TICK - 8) & (w.tick <= r['t0'] + TN * D.TICK + 8)].groupby('steamid').last()
            if len(at) < 4: continue
            cnt = {}
            for x, y in zip(at.x.values, at.y.values): s = region(x, y); cnt[s] = cnt.get(s, 0) + 1
            per = {}
            for sid, g in w.groupby('steamid'):
                g = g.sort_values('tick')
                x, y, tk, yaw = g.x.values, g.y.values, g.tick.values, np.radians(g.yaw.values)
                if len(x) < 2: continue
                sp = np.r_[np.inf, np.hypot(np.diff(x), np.diff(y)) / np.maximum(np.diff(tk), 1) * D.TICK]
                for k in range(len(x)):
                    if tk[k] >= a and sp[k] < STILL:
                        per.setdefault(int(sid), []).append((float(x[k]), float(y[k]), math.atan2(-math.sin(yaw[k]), math.cos(yaw[k]))))
            for s, n in cnt.items():
                pts = [(p[0], p[1], p[2], sid) for sid, P in per.items() for p in P if region(p[0], p[1]) == s]
                groups.setdefault((s, n), []).append(pts)
    out = {'_about': 'tools/map/ct_spots_bake.py: места CT у про (стоят %d–%d с) по стороне (A/M/B) и числу CT на ней — доля, взгляд, пары' % (WIN0, WIN1),
           'map': MAPNAME, 'site': {k: [round(v[0], 1), round(v[1], 1)] for k, v in SITE.items()}, 'sides': {}}
    for (s, n), rounds in sorted(groups.items()):
        if len(rounds) < 20: continue
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
        occ = []   # раунд → множество мест
        spots = []
        for i, (cx, cy) in enumerate(cent):
            rr, ang, xs, ys, ids = 0, [], [], [], set()
            for ri, S in enumerate(rounds):
                here = [p for p in S if math.hypot(p[0] - cx, p[1] - cy) < NEAR]
                if len(here) < 4: continue
                rr += 1; ids.add(ri); ang += [p[2] for p in here]; xs += [p[0] for p in here]; ys += [p[1] for p in here]
            if rr < MIN_ROUNDS: continue
            h = np.histogram(np.mod(ang, 2 * math.pi), bins=YAW_BINS, range=(0, 2 * math.pi))[0].astype(float)
            h3 = h + np.roll(h, 1) + np.roll(h, -1); look = []
            for _ in range(2):
                j = int(np.argmax(h3))
                if h3[j] <= 0 or (look and h3[j] / len(ang) < 0.15): break
                a0 = (j + 0.5) * 2 * math.pi / YAW_BINS; a0 = a0 - 2 * math.pi if a0 > math.pi else a0
                look.append([round(a0, 3), round(float(h3[j]) / len(ang), 2)])
                for d in range(-4, 5): h3[(j + d) % YAW_BINS] = 0
            spots.append({'x': round(float(np.median(xs)), 1), 'y': round(float(np.median(ys)), 1), 'share': round(rr / len(rounds), 3), 'look': look})
            occ.append(ids)
        order = sorted(range(len(spots)), key=lambda i: -spots[i]['share'])
        spots = [spots[i] for i in order]; occ = [occ[i] for i in order]
        for i, sp in enumerate(spots):
            sp['pair'] = {str(j): round(len(occ[i] & occ[j]) / len(occ[i]), 2) for j in range(len(spots)) if j != i and occ[i] & occ[j]}
        out['sides'].setdefault(s, {})[str(n)] = {'rounds': len(rounds), 'spots': spots}
    f = mapdir.path(MAPNAME, 'ctspots.json')
    json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('%s → %s' % (MAPNAME, f))
    for s, N in out['sides'].items():
        for n, v in N.items():
            print('  %s, CT на стороне %s: раундов %d, мест %d; первые: %s' % (s, n, v['rounds'], len(v['spots']),
                  ', '.join('%d,%d %.0f%%' % (q['x'], q['y'], 100 * q['share']) for q in v['spots'][:5])))


if __name__ == '__main__':
    main()
