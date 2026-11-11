#!/usr/bin/env python3
"""Смок на огонь соперника у про (05.11, пакет гранат: «тушат ли молотов смоком нарочно»): python3 tools/nades/smoke_on_fire_pro.py
Демки Mirage (data/maps/mirage/demos): inferno_startburn (огонь), smokegrenade_detonate (смок), команда бросившего — по *_ticks (team_num).
Смок «на огонь соперника» — раскрылся в TOUCH ед. от точки огня соперника, пока тот горит (FIRE_LIFE с, CS2: inferno ~7 с).
Печатает: смоков всего / на огонь соперника (доля), огней соперника / потушено смоком."""
import csv, gzip, glob, os, math, bisect, collections
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FIRE_LIFE, TOUCH = 7.0, 280.0   # с; ед. игры — радиус дыма 144 + ~0,9 радиуса огня (≈ 150) — приближение
S = F = hit = burned = 0; by_round = collections.Counter()
for tf in glob.glob(os.path.join(ROOT, 'data', 'maps', 'mirage', 'demos', '*_ticks.csv.gz')):
    base = tf[:-len('_ticks.csv.gz')]
    if not os.path.exists(base + '_inferno_startburn.csv.gz') or not os.path.exists(base + '_smokegrenade_detonate.csv.gz'): continue
    team = collections.defaultdict(list)
    for r in csv.DictReader(gzip.open(tf, 'rt', encoding='utf-8')):
        if r['team_num']: team[r['steamid']].append((int(r['tick']), r['team_num']))
    for k in team: team[k].sort()
    def tm(sid, t):
        L = team.get(sid); 
        if not L: return None
        i = bisect.bisect_right([x[0] for x in L], t) - 1
        return L[max(0, i)][1]
    fires = [(int(r['tick']), float(r['x']), float(r['y']), tm(r['user_steamid'], int(r['tick']))) for r in csv.DictReader(gzip.open(base + '_inferno_startburn.csv.gz', 'rt', encoding='utf-8'))]
    smokes = [(int(r['tick']), float(r['x']), float(r['y']), tm(r['user_steamid'], int(r['tick']))) for r in csv.DictReader(gzip.open(base + '_smokegrenade_detonate.csv.gz', 'rt', encoding='utf-8'))]
    F += len(fires); S += len(smokes)
    used = set()
    for st, sx, sy, steam in smokes:
        for i, (ft, fx, fy, fteam) in enumerate(fires):
            if fteam and steam and fteam != steam and 0 <= (st - ft)/64 <= FIRE_LIFE and math.hypot(sx-fx, sy-fy) < TOUCH:
                hit += 1; used.add(i); break
    burned += len(used)
print('смоков', S, 'на огонь соперника', hit, '(%.1f %%)' % (100*hit/max(1,S)), '| огней', F, 'потушено смоком соперника', burned, '(%.1f %%)' % (100*burned/max(1,F)))
