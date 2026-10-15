#!/usr/bin/env python3
"""Роли наших игроков на карте — по демкам этой карты (v321, М21): <pro_dir>/player_roles.json → tactics.json, playerRoles.

python3 tools/roles_bake.py --map <карта>
У каждого игрока своя роль на каждой карте (kyousuke на Ancient — опорник A, на Mirage — опорник B). Считается так:
  CT: где игрок стоит на 20–40-й с раунда (снимок раз в 2 с) — доля времени на стороне A / мид / B (стороны — regions
      рецепта по зонам); опорник A — у кого доля A больше всех в команде, затем опорник B, затем мидер; оставшиеся двое —
      ротатор (у кого больше A+B) и роумер.
  T:  снайпер — у кого чаще AWP в руках до планта; лёркер — кто в среднем дальше всех от остальных T на 15–45-й с;
      остальные — энтри, второй, IGL как по месту в составе (IGL по демкам не определить).
Раунды считаются, только если игрок из нашего состава (ник без учёта регистра).
"""
import json, os, sys
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
import demos as D  # noqa: E402
from tactics_bake import zone, side_of  # noqa: E402

TEAMS = {'sp': ['donk', 'sh1ro', 'TN1R', 'magixx', 'zont1x'], 'fa': ['kyousuke', 'm0NESY', 'TeSeS', 'karrigan', 'NiKo']}
LOW = {n.lower(): n for L in TEAMS.values() for n in L}


def main():
    ctside = defaultdict(Counter)
    awp = Counter(); held = Counter(); far = defaultdict(list)
    for demo in D.demo_names():
        R = D.rounds_of(demo)
        if not R:
            continue
        t = pd.read_csv(os.path.join(D.DEMOS, demo + '_ticks.csv.gz'), low_memory=False,
                        usecols=['tick', 'team_num', 'X', 'Y', 'is_alive', 'name', 'active_weapon_name'])
        t = t[t.is_alive == True]  # noqa: E712
        t['nick'] = t.name.astype(str).str.lower().map(LOW)
        t = t[t.nick.notna()]
        if not len(t):
            continue
        x, y = D.tr(t.X.values, t.Y.values)
        t = t.assign(x=x, y=y)
        for r in R:
            t0 = r['t0']; tp = r['tplant'] or r['t1']
            for sec in range(20, 41, 2):
                s = t[(t.tick >= t0 + sec * 64) & (t.tick < t0 + sec * 64 + 16) & (t.team_num == 3)].drop_duplicates('nick')
                for nk, xx, yy in zip(s.nick, s.x, s.y):
                    ctside[nk][side_of(zone(xx, yy), xx, yy)] += 1
            s = t[(t.tick >= t0) & (t.tick < tp) & (t.team_num == 2)]
            for nk, w in zip(s.nick, s.active_weapon_name.astype(str)):
                held[nk] += 1
                if w == 'AWP':
                    awp[nk] += 1
            for sec in range(15, 46, 5):
                s = t[(t.tick >= t0 + sec * 64) & (t.tick < t0 + sec * 64 + 16) & (t.team_num == 2)].drop_duplicates('nick')
                if len(s) < 3:
                    continue
                P = np.c_[s.x.values, s.y.values]
                for i, nk in enumerate(s.nick.values):
                    d = np.hypot(*(P - P[i]).T); far[nk].append(float(np.sort(d)[1:].mean()))
        print(demo, file=sys.stderr)
    out = {}
    for team, L in TEAMS.items():
        sh = {n: {k: ctside[n][k] / max(1, sum(ctside[n].values())) for k in ('A', 'M', 'B')} for n in L}
        left = list(L); ct = {}
        for role, k in (('anchorA', 'A'), ('anchorB', 'B'), ('mid', 'M')):
            p = max(left, key=lambda n: (sh[n][k], -L.index(n))); ct[p] = role; left.remove(p)
        left.sort(key=lambda n: (-(sh[n]['A'] + sh[n]['B']), L.index(n)))
        ct[left[0]] = 'rotator'; ct[left[1]] = 'roamer'
        tr = {}
        a = max(L, key=lambda n: (awp[n] / max(1, held[n]), -L.index(n))); tr[a] = 'awp'
        rest = [n for n in L if n != a]
        lk = max(rest, key=lambda n: (np.mean(far[n]) if far[n] else 0, -L.index(n))); tr[lk] = 'lurker'
        # энтри, второй, IGL — как в составе (место в составе: entry, awp, support, igl, lurker); IGL по демкам не определить
        SEAT = ['entry', 'awp', 'support', 'igl', 'lurker']
        free = [r for r in ('entry', 'support', 'igl') if r not in tr.values()]
        rest = [n for n in L if n not in tr]
        for n in rest:
            if SEAT[L.index(n)] in free:
                tr[n] = SEAT[L.index(n)]; free.remove(tr[n])
        for n in rest:
            if n not in tr:
                tr[n] = free.pop(0)
        for n in L:
            out[n] = {'CT': ct[n], 'T': tr[n], 'ctShare': {k: round(v, 2) for k, v in sh[n].items()},
                      'awpShare': round(awp[n] / max(1, held[n]), 2), 'spread': round(float(np.mean(far[n])) if far[n] else 0, 1)}
    f = os.path.join(mapdir.pro_dir(D.MAPNAME), 'player_roles.json')
    json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for n, v in out.items():
        print('%-9s CT %-8s T %-8s  A/M/B %s  AWP %.2f' % (n, v['CT'], v['T'], v['ctShare'], v['awpShare']))


if __name__ == '__main__':
    main()
