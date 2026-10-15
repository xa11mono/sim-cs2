"""Кто из про где стоит и с чем (v246, пункт 4 владельца).

По демкам карты (v318: --map; демки и раунды — tools/demos.py) для каждой позиции <pro_dir>/positions.json
(tools/positions_bake.py; в игре — KNOW_POSITIONS, MAP.pro.positions) считает:
  • rounds    — в скольких раундах на ней стояли (стоянка: 2+ с, скорость < 10 ед. карты/с, до планта);
  • byPlayer  — то же для каждого из 10 игроков, которые есть у нас ботами (по нику из демок);
  • byWeapon  — то же по оружию в руках (AWP / винтовка / ПП / пистолет; нож и граната в руках —
                последнее огнестрельное оружие этого игрока в раунде).
И отдельно — «не сработало — меняю место»: вернулся ли игрок на ту же позицию в следующем раунде
той же стороной, если в прошлом раунде на ней погиб / раунд проигран, против — если выжил и выиграл.

Пишет <pro_dir>/player_positions.json. Запуск: python3 tools/player_positions_bake.py [--map ancient] [positions.json]
"""
import json, math, os, sys
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from demos import ROOT, DEMOS, TICK, tr, demo_names, rounds_of, round_index, event, MAPNAME  # noqa: E402
import mapdir  # noqa: E402

POS_FILE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(mapdir.pro_dir(MAPNAME), 'positions.json')
OUT = os.path.join(mapdir.pro_dir(MAPNAME), 'player_positions.json')
PLAYERS = ['donk', 'sh1ro', 'TN1R', 'magixx', 'zont1x', 'kyousuke', 'm0NESY', 'TeSeS', 'karrigan', 'NiKo']
PL_LOW = {n.lower(): n for n in PLAYERS}   # в демках ник бывает в другом регистре (tN1R)
STILL_SPEED, STILL_MIN = 10, 2.0      # как в positions_bake.py
SPLIT_D = 80                          # как в positions_bake.py: позиция — стоянки ближе SPLIT_D/2 к её центру (или spread)
DANGER_R, DANGER_SEC = 60, 60         # как в positions_bake.py: погиб рядом с точкой стоянки
AWP = {'AWP', 'SSG 08'}
RIFLE = {'AK-47', 'M4A1-S', 'M4A4', 'Galil AR', 'FAMAS', 'AUG', 'SG 553'}
SMG = {'MP9', 'MAC-10', 'MP7', 'UMP-45', 'P90', 'PP-Bizon', 'MP5-SD'}
PISTOL = {'USP-S', 'Glock-18', 'Five-SeveN', 'Desert Eagle', 'Tec-9', 'P2000', 'Dual Berettas', 'P250', 'CZ75-Auto', 'R8 Revolver'}


def wclass(w):
    if w in AWP: return 'awp'
    if w in RIFLE: return 'rifle'
    if w in SMG: return 'smg'
    if w in PISTOL: return 'pistol'
    return None


def main():
    P = json.load(open(POS_FILE, encoding='utf-8'))['points']
    PX = {s: [p for p in P if p['side'] == s] for s in ('CT', 'T')}
    res = {p['id']: {'rounds': set(), 'byPlayer': defaultdict(set), 'byWeapon': defaultdict(set)} for p in P}
    seq = []   # (demo, name, side, round num, point id, died, won)
    WITH = defaultdict(Counter)   # позиция → позиция → в скольких раундах на обеих стояли (разные игроки одной стороны)
    for demo in demo_names():
        rounds = rounds_of(demo)
        if not rounds:
            continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), low_memory=False,
                        usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'is_alive', 'is_warmup_period', 'name', 'active_weapon_name'])
        t = t[(t.is_alive == True) & (t.is_warmup_period != True)]  # noqa: E712
        ri = round_index(rounds, t.tick.values)
        cut = np.array([r['tplant'] or r['t1'] for r in rounds])
        keep = (ri >= 0) & (t.tick.values < cut[np.clip(ri, 0, None)])
        t = t[keep].assign(ri=ri[keep]).sort_values(['ri', 'steamid', 'tick'], kind='stable')
        x, y = tr(t.X.values, t.Y.values)
        tick, sid, rv = t.tick.values, t.steamid.values, t.ri.values
        side = np.where(t.team_num.values == 3, 'CT', 'T')
        names = t.name.values
        # оружие: нож/граната в руках — последнее огнестрельное этого игрока в раунде
        wc = [wclass(w) if isinstance(w, str) else None for w in t.active_weapon_name.values]
        last = {}
        for i in range(len(wc)):
            k = (rv[i], sid[i])
            if wc[i]: last[k] = wc[i]
            else: wc[i] = last.get(k)
        # стоянки
        n = len(tick)
        new = np.ones(n, bool); new[1:] = (rv[1:] != rv[:-1]) | (sid[1:] != sid[:-1])
        dt = np.zeros(n); dt[1:] = np.diff(tick) / TICK
        sp = np.full(n, np.inf); sp[1:] = np.hypot(np.diff(x), np.diff(y)) / np.where(dt[1:] > 0, dt[1:], 1)
        still = ~new & (sp < STILL_SPEED) & (dt > 0) & (dt < 1)
        prev = np.r_[False, still[:-1]]; nxt = np.r_[still[1:], False]
        starts = np.nonzero(still & ~prev)[0]; ends = np.nonzero(still & ~nxt)[0]
        a = starts - 1
        ok = (tick[ends] - tick[a]) / TICK >= STILL_MIN
        dth = event(demo, 'player_death'); deaths = defaultdict(list)
        if len(dth):
            for tk, us, ux, uy in zip(dth.tick.values, dth.user_steamid.values, dth.user_X.values, dth.user_Y.values):
                if us == us and ux == ux:
                    deaths[int(us)].append((int(tk),) + tr(ux, uy))
        rend = event(demo, 'round_end')
        win = {}
        for r in rounds:
            e = rend[(rend.tick > r['t0']) & (rend.tick <= r['t1'] + 1)]
            if len(e) and 'winner' in e: win[r['num']] = str(e.winner.iloc[0])
        held = defaultdict(dict)   # (name, side, num) → {point: died}
        team_held = defaultdict(lambda: defaultdict(set))   # (side, num) → point → игроки (кто где стоял в раунде)
        for i, j in zip(a[ok], ends[ok]):
            hx, hy, sd = float(x[i:j + 1].mean()), float(y[i:j + 1].mean()), side[i]
            nm = PL_LOW.get(str(names[i]).lower(), names[i])
            best, bd = None, 1e9
            for p in PX[sd]:
                d = math.hypot(p['x'] - hx, p['y'] - hy)
                if d < bd: bd, best = d, p
            if not best or bd > max(best.get('spread') or 0, SPLIT_D / 2):
                continue
            r = rounds[rv[i]]; rid = r['rid']
            R = res[best['id']]
            R['rounds'].add(rid)
            if nm in PLAYERS: R['byPlayer'][nm].add(rid)
            w = wc[(i + j) // 2]
            if w: R['byWeapon'][w].add(rid)
            died = any(tick[i] <= tk <= tick[i] + DANGER_SEC * TICK and math.hypot(dx - hx, dy - hy) <= DANGER_R
                       for tk, dx, dy in deaths.get(int(sid[i]), ()))
            k = (nm, sd, r['num'])
            held[k][best['id']] = held[k].get(best['id'], False) or died
            team_held[(sd, r['num'])][best['id']].add(int(sid[i]))
        for (nm, sd, num), pts in held.items():
            for pid, died in pts.items():
                nxt_ = held.get((nm, sd, num + 1))
                if nxt_ is None:
                    continue   # следующего раунда той же стороной нет (смена сторон, конец)
                won = win.get(num) == sd
                seq.append((nm, sd, pid, died, won, pid in nxt_))
        for (sd, num), pts in team_held.items():
            ids = sorted(pts)
            for x_ in range(len(ids)):
                for y_ in range(x_ + 1, len(ids)):
                    a_, b_ = ids[x_], ids[y_]
                    if pts[a_] - pts[b_] and pts[b_] - pts[a_]:   # стояли разные игроки
                        WITH[a_][b_] += 1; WITH[b_][a_] += 1
        print(demo, len(seq), file=sys.stderr)
    # «не сработало — меняю место»
    def rate(f):
        s = [q for q in seq if f(q)]
        return (sum(q[5] for q in s) / len(s) if s else None, len(s))
    ok_r, ok_n = rate(lambda q: not q[3] and q[4])
    fail_r, fail_n = rate(lambda q: q[3] or not q[4])
    died_r, died_n = rate(lambda q: q[3])
    lost_r, lost_n = rate(lambda q: not q[3] and not q[4])
    NR = sum(1 for _ in demo_names())
    out_with = {a_: {b_: c for b_, c in W.items() if c >= 2} for a_, W in WITH.items()}
    out = {'_about': 'tools/player_positions_bake.py: позиции positions.json — кто из наших 10 игроков и с каким оружием там стоял (раундов); '
                     'repeat — как часто игрок встаёт на ту же позицию в следующем раунде той же стороной: после «выжил и выиграл» (ok), '
                     'после «погиб на ней» (died), после «выжил, но раунд проигран» (lost).',
           'repeat': {'ok': [ok_r, ok_n], 'died': [died_r, died_n], 'lost': [lost_r, lost_n], 'fail': [fail_r, fail_n]},
           'with': out_with,
           'points': {pid: {'rounds': len(v['rounds']), 'byPlayer': {k: len(s) for k, s in v['byPlayer'].items()},
                            'byWeapon': {k: len(s) for k, s in v['byWeapon'].items()}} for pid, v in res.items() if v['rounds']}}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(json.dumps(out['repeat'], ensure_ascii=False))


if __name__ == '__main__':
    main()
