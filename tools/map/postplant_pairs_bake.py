#!/usr/bin/env python3
"""Пост-плант «бомба → места» из демок про (владелец 17.11: «постплент должен раздаваться от того, куда поставили бомбу; взгляд в стену
не отбрасывать — доджат флешку; вдвоём на одной позиции — можно»).

python3 tools/map/postplant_pairs_bake.py --map <карта>  → data/maps/<карта>/postplant.json (в игре — MAP.postplant)

Для каждого раунда с плантом: место бомбы → ближайшее место планта про (MAP.pro.plants того же сайта, ≤ PLANT_R); T, которые СТОЯТ
(скорость < STILL ед./с) с WIN0 по WIN1 с после планта (до конца раунда), — снимки раз в STEP тиков. Места T — сгустки стоянок
(клетка CELL, центры не ближе MERGE, от MIN_ROUNDS раундов). На место:
  share  — доля раундов этого места бомбы, где хоть один T простоял там ≥ 1 с;
  look   — до двух главных направлений взгляда стоящих [угол (рад, как facing в игре: atan2(dy, dx), y вниз), доля] — все взгляды,
           и «в стену» тоже (у про это бывает отворот от флешки), не отбрасываются;
  two    — доля раундов места, где там стояли двое одновременно (кроссфайр / вдвоём на позиции);
  tArr   — медиана, через сколько секунд после планта T там встал; dBomb — до бомбы по прямой (ед. карты 0..2048);
  pair   — {j: доля раундов этого места, где занято и место j} — кто с кем держит бомбу у про (раздача в игре — ppProGroup, 280).
Пороги — проектные числа (подобраны, чтобы мест на сайт было 5–20). Общий для всех карт; входит в шаг demos (tools/map/demos_bake.py)
и в памятку (tools/map/map_manifest.json).
"""
import json, math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
import demos as D  # noqa: E402

MAPNAME = mapdir.current()
STILL = 25                      # ед. карты/с (тики демок — уже раз в 16, 4 снимка в секунду)
WIN0, WIN1 = 3, 25              # с после планта
PLANT_R = 120                   # ед. карты: раунд к месту планта про
PLANT_MERGE = 70                # ед. карты: места планта ближе — одна зона бомбы
CELL, MERGE, MIN_ROUNDS = 24, 60, 3
YAW_BINS = 24                   # 15°


def main():
    pro = json.load(open(mapdir.path(MAPNAME, 'pro.json'), encoding='utf-8'))
    # места планта про (MAP.pro.plants) мелкие (у Mirage 34, соседние в 12 ед.) — сливаются в зоны бомбы (центры не ближе PLANT_MERGE,
    # от частых к редким): «под Short», «под окном», «по умолчанию»
    PL = []
    for p in sorted([p for p in pro.get('plants', []) if p.get('site')], key=lambda q: -q.get('share', 0)):
        if all(q['site'] != p['site'] or math.hypot(q['x'] - p['x'], q['y'] - p['y']) >= PLANT_MERGE for q in PL):
            PL.append(dict(p))
    by = {i: [] for i in range(len(PL))}       # место планта → [(rid, samples)]
    for demo in D.demo_names():
        R = D.rounds_of(demo)
        RP = [r for r in R if r['tplant']]
        if not RP:
            continue
        t = D.ticks_of(demo)
        t = t[t.side == 'T']
        for r in RP:
            bx, by_ = r['plantXY']
            best, bd = None, PLANT_R
            for i, p in enumerate(PL):
                if p['site'] != r['site']:
                    continue
                d = math.hypot(p['x'] - bx, p['y'] - by_)
                if d < bd:
                    best, bd = i, d
            if best is None:
                continue
            a, b = r['tplant'] + WIN0 * D.TICK, min(r['t1'], r['tplant'] + WIN1 * D.TICK)
            w = t[(t.tick >= a - 16) & (t.tick <= b)]
            S = []
            for sid, g in w.groupby('steamid'):
                g = g.sort_values('tick')
                x, y, tk, yaw = g.x.values, g.y.values, g.tick.values, np.radians(g.yaw.values)
                if len(x) < 2:
                    continue
                sp = np.r_[np.inf, np.hypot(np.diff(x), np.diff(y)) / np.maximum(np.diff(tk), 1) * D.TICK]
                for k in range(len(x)):
                    if tk[k] >= a and sp[k] < STILL:
                        S.append((int(sid), float(x[k]), float(y[k]), math.atan2(-math.sin(yaw[k]), math.cos(yaw[k])), (tk[k] - r['tplant']) / D.TICK, int(tk[k])))
            by[best].append((r['rid'], S))
    out = []
    for i, rounds in by.items():
        if len(rounds) < 5:
            continue
        p = PL[i]
        # клетки: в скольких раундах там стояли ≥ 1 с (4 снимка)
        cells = {}
        for rid, S in rounds:
            cnt = {}
            for s in S:
                k = (int(s[1] // CELL), int(s[2] // CELL)); cnt[k] = cnt.get(k, 0) + 1
            for k, n in cnt.items():
                if n >= 4:
                    cells[k] = cells.get(k, 0) + 1
        cent = []
        for k, n in sorted(cells.items(), key=lambda kv: -kv[1]):
            cx, cy = (k[0] + 0.5) * CELL, (k[1] + 0.5) * CELL
            if n >= MIN_ROUNDS and all(math.hypot(cx - c[0], cy - c[1]) >= MERGE for c in cent):
                cent.append([cx, cy])
        spots = []
        occ = []   # место → раунды (номер в rounds), где там стояли
        for cx, cy in cent:
            rr, two, ang, arr, xs, ys = 0, 0, [], [], [], []
            ids = set()
            for ri, (rid, S) in enumerate(rounds):
                here = [s for s in S if math.hypot(s[1] - cx, s[2] - cy) < MERGE / 2]
                if len(here) < 4:
                    continue
                rr += 1; ids.add(ri)
                by_t = {}
                for s in here:
                    by_t.setdefault(s[5], set()).add(s[0])
                if any(len(v) >= 2 for v in by_t.values()):
                    two += 1
                ang += [s[3] for s in here]; arr.append(min(s[4] for s in here)); xs += [s[1] for s in here]; ys += [s[2] for s in here]
            if rr < MIN_ROUNDS:
                continue
            h = np.histogram(np.mod(ang, 2 * math.pi), bins=YAW_BINS, range=(0, 2 * math.pi))[0].astype(float)
            h3 = h + np.roll(h, 1) + np.roll(h, -1)
            look = []
            for _ in range(2):
                j = int(np.argmax(h3))
                if h3[j] <= 0 or (look and h3[j] / len(ang) < 0.15):
                    break
                a0 = (j + 0.5) * 2 * math.pi / YAW_BINS
                a0 = a0 - 2 * math.pi if a0 > math.pi else a0
                look.append([round(a0, 3), round(float(h3[j]) / len(ang), 2)])
                for d in range(-4, 5):
                    h3[(j + d) % YAW_BINS] = 0   # второй — дальше ±60°
            mx, my = float(np.median(xs)), float(np.median(ys))
            spots.append({'x': round(mx, 1), 'y': round(my, 1), 'share': round(rr / len(rounds), 3), 'rounds': rr, 'look': look,
                          'two': round(two / rr, 2), 'tArr': round(float(np.median(arr)), 1), 'dBomb': round(math.hypot(mx - p['x'], my - p['y']))})
            occ.append(ids)
        order = sorted(range(len(spots)), key=lambda i: -spots[i]['share'])
        spots = [spots[i] for i in order]; occ = [occ[i] for i in order]
        # pair — {j: доля раундов места i, где занято и место j} (владелец 18.11: «распределять, как про стоят вместе», а не четыре частых места)
        for i, sp in enumerate(spots):
            sp['pair'] = {str(j): round(len(occ[i] & occ[j]) / len(occ[i]), 2) for j in range(len(spots)) if j != i and occ[i] & occ[j]}
        out.append({'x': p['x'], 'y': p['y'], 'site': p['site'], 'rounds': len(rounds), 'spots': spots})
    res = {'_about': 'tools/map/postplant_pairs_bake.py: место бомбы (MAP.pro.plants) → где встают T после планта, куда смотрят, вдвоём ли',
           'map': MAPNAME, 'plants': out}
    f = mapdir.path(MAPNAME, 'postplant.json')
    json.dump(res, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('%s: мест бомбы %d, мест T %d → %s' % (MAPNAME, len(out), sum(len(o['spots']) for o in out), f))
    for o in out:
        print('  бомба %s (%d, %d): раундов %d, мест %d; первые: %s' % (o['site'], o['x'], o['y'], o['rounds'], len(o['spots']),
              ', '.join('%d,%d %.0f%%%s' % (s['x'], s['y'], 100 * s['share'], ' вдвоём %.0f%%' % (100 * s['two']) if s['two'] else '') for s in o['spots'][:4])))


if __name__ == '__main__':
    main()
