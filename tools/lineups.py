#!/usr/bin/env python3
"""Гранаты про из демок → data/pro/pro_nades.csv (+ data/pro/nade_ctx.json).

python3 tools/lineups.py

Раунды и rid — из tools/ancient_demos.py (те же, что у positions_bake.py).
Бросок (weapon_fire) сопоставляется с ближайшим разрывом той же гранаты того
же игрока. trig — когда кинута (insta / setup / exec / postplant у T; insta /
timed / call / retake у CT), как раньше.

purpose — граната «себе» (не шаг командного сценария, а решение игрока под свою
ситуацию; пойдёт в решения бота, шаг 10 docs/PROMPTS.md):
  * flash_exit   — флешка под свой выход: бросивший был ближе SELF_FLASH_NEAR
    к месту разрыва и за SELF_FLASH_SEC с после разрыва сам сдвинулся к нему
    (прошёл ≥ SELF_MOVE и стал ближе хотя бы на SELF_CLOSER);
  * smoke_plant  — смок на себя под плант: сам поставил бомбу в пределах
    SELF_SMOKE_R от смока за SELF_SMOKE_SEC с после разрыва;
  * smoke_defuse — то же под свой дефуз (CT);
  * molly_clear  — молотов в угол перед проходом: бросивший сам прошёл ближе
    SELF_MOLLY_R к месту горения за SELF_MOLLY_SEC с после начала горения.
Остальные — purpose пустой (командная или «по времени»).
"""
import json, os, sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ancient_demos as AD  # noqa: E402

OUT = os.path.join(AD.ROOT, 'data', 'pro', 'pro_nades.csv')
OUT_CTX = os.path.join(AD.ROOT, 'data', 'pro', 'nade_ctx.json')
SITES = {'A': (630, 518), 'B': (1533, 845)}
TYPES = {'weapon_smokegrenade': ('smoke', 'smokegrenade_detonate', (0.5, 6.5)),
         'weapon_flashbang': ('flash', 'flashbang_detonate', (0.5, 3.5)),
         'weapon_hegrenade': ('he', 'hegrenade_detonate', (0.5, 4)),
         'weapon_molotov': ('molly', 'inferno_startburn', (0.3, 4)),
         'weapon_incgrenade': ('molly', 'inferno_startburn', (0.3, 4))}
# «себе» — ед. карты (1 ед. карты ≈ 2,5 ед. игры) и секунды
SELF_FLASH_NEAR = 300
SELF_FLASH_SEC = 2.0
SELF_MOVE = 25
SELF_CLOSER = 15
SELF_SMOKE_R = 70
SELF_SMOKE_SEC = 18
SELF_MOLLY_R = 45
SELF_MOLLY_SEC = (3, 10)


def site_near(x, y):
    return 'A' if (x - 630) ** 2 + (y - 518) ** 2 < (x - 1533) ** 2 + (y - 845) ** 2 else 'B'


class Tracks:
    """где был игрок: позиции по тикам (живой)"""

    def __init__(self, ticks):
        self.d = {sid: (g.tick.values, g.x.values, g.y.values) for sid, g in ticks.sort_values('tick').groupby('steamid')}

    def path(self, sid, a, b):
        tk, x, y = self.d.get(sid, (np.array([], int), None, None))
        i, j = np.searchsorted(tk, a), np.searchsorted(tk, b, side='right')
        return (x[i:j], y[i:j]) if j > i else (np.array([]), np.array([]))

    def at(self, sid, t):
        tk, x, y = self.d.get(sid, (np.array([], int), None, None))
        i = np.searchsorted(tk, t)
        if i >= len(tk) or abs(tk[i] - t) > AD.TICK:
            i = i - 1
        if i < 0 or abs(tk[i] - t) > AD.TICK:
            return None
        return x[i], y[i]


def self_kind(typ, sid, tdet, lx, ly, side, rnd, defuse, tracks):
    if typ == 'flash':
        p0 = tracks.at(sid, tdet)
        if p0 is None:
            return ''
        d0 = np.hypot(p0[0] - lx, p0[1] - ly)
        x, y = tracks.path(sid, tdet, tdet + SELF_FLASH_SEC * AD.TICK)
        if d0 < SELF_FLASH_NEAR and len(x):
            moved = np.hypot(x - p0[0], y - p0[1]).max()
            closer = d0 - np.hypot(x - lx, y - ly).min()
            if moved >= SELF_MOVE and closer >= SELF_CLOSER:
                return 'flash_exit'
    elif typ == 'smoke':
        if side == 'T' and rnd['planter'] == sid and tdet <= rnd['tplant'] <= tdet + SELF_SMOKE_SEC * AD.TICK and \
                np.hypot(rnd['plantXY'][0] - lx, rnd['plantXY'][1] - ly) < SELF_SMOKE_R:
            return 'smoke_plant'
        if side == 'CT' and defuse is not None and defuse[0] == sid and tdet <= defuse[1] <= tdet + (SELF_SMOKE_SEC + 10) * AD.TICK \
                and np.hypot(defuse[2] - lx, defuse[3] - ly) < SELF_SMOKE_R:
            return 'smoke_defuse'
    elif typ == 'molly':
        x, y = tracks.path(sid, tdet + SELF_MOLLY_SEC[0] * AD.TICK, tdet + SELF_MOLLY_SEC[1] * AD.TICK)
        if len(x) and np.hypot(x - lx, y - ly).min() < SELF_MOLLY_R:
            return 'molly_clear'
    return ''


def main():
    rows, ctx = [], {}
    for m in AD.demo_names():
        w = AD.event(m, 'weapon_fire')
        w = w[w.weapon.isin(TYPES.keys())] if len(w) else w
        det = {k: AD.event(m, v[1]) for k, v in TYPES.items()}
        dfz = AD.event(m, 'bomb_defused')
        tracks = Tracks(AD.ticks_of(m))
        for r in AD.rounds_of(m):
            t0, t1, tp = r['t0'], r['t1'], r['tplant']
            ctx[r['rid']] = {'plant': r['site']}
            dd_ = dfz[(dfz.tick > t0) & (dfz.tick <= t1)]
            defuse = None
            if len(dd_):
                dx, dy = AD.tr(float(dd_.user_X.iloc[0]), float(dd_.user_Y.iloc[0]))
                defuse = (int(dd_.user_steamid.iloc[0]), int(dd_.tick.iloc[0]), dx, dy)
            th = w[(w.tick >= t0) & (w.tick < t1)]
            used = set()
            for _, x in th.iterrows():
                typ, kind, (a, b) = TYPES[x.weapon]
                d = det[x.weapon]
                c = d[(d.user_steamid == x.user_steamid) & (d.tick > x.tick + a * 64) & (d.tick < x.tick + b * 64)].sort_values('tick')
                c = c[~c.index.isin([i for k, i in used if k == kind])]
                if not len(c):
                    continue
                dd = c.iloc[0]
                used.add((kind, c.index[0]))
                fx, fy = AD.tr(x.user_X, x.user_Y)
                lx, ly = AD.tr(dd.x, dd.y)
                side = 'T' if x.user_team_num == 2 else 'CT'
                sec = (x.tick - t0) / 64
                if tp is not None and x.tick >= tp:
                    trig = 'postplant' if side == 'T' else 'retake'; site = r['site']
                elif sec <= 3:
                    trig = 'insta'; site = 'any'
                elif side == 'T':
                    if tp and tp - x.tick <= 25 * 64 and np.hypot(lx - SITES[r['site']][0], ly - SITES[r['site']][1]) < 650:
                        trig = 'exec'; site = r['site']
                    else:
                        trig = 'setup'; site = r['site'] or 'any'
                else:
                    ls = site_near(lx, ly)
                    dl = np.hypot(lx - SITES[ls][0], ly - SITES[ls][1])
                    if tp and tp - x.tick <= 25 * 64 and ls == r['site'] and dl < 750:
                        trig = 'call'; site = r['site']
                    else:
                        trig = 'timed'; site = 'any'
                sid = int(x.user_steamid)
                rows.append({'rid': r['rid'], 'm': m, 'thrower': x.user_name, 'sid': sid, 'side': side, 'type': typ,
                             'trig': trig, 'site': site, 'sec': round(sec, 1),
                             'fx': round(fx, 1), 'fy': round(fy, 1), 'lx': round(lx, 1), 'ly': round(ly, 1),
                             'yaw': x.user_yaw, 'flight': round((dd.tick - x.tick) / 64, 2),
                             'secToPlant': round((tp - x.tick) / 64, 1) if tp is not None else None,
                             'purpose': self_kind(typ, sid, int(dd.tick), lx, ly, side, r, defuse, tracks)})
    G = pd.DataFrame(rows)
    G.to_csv(OUT, index=False)
    planted = {s: sum(1 for v in ctx.values() if v['plant'] == s) for s in 'AB'}
    json.dump({'rounds': len(ctx), 'planted': planted}, open(OUT_CTX, 'w'))
    print('демок', G.m.nunique(), 'раундов', len(ctx), 'плант A/B', planted, 'гранат', len(G))
    print(G.groupby(['side', 'trig']).size().to_dict())
    print('себе:', G[G.purpose.fillna('') != ''].groupby(['side', 'purpose']).size().to_dict())


if __name__ == '__main__':
    main()
