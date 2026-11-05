#!/usr/bin/env python3
"""Время доставания и броска гранаты у про (05.11, пакет гранат; аудит 5.2): python3 tools/nades/draw_time_pro.py
Источник — демки data/maps/{mirage,ancient}/demos: *_ticks.csv.gz (оружие в руках, раз в 16 тиков) и *_weapon_fire.csv.gz (бросок).
На каждый бросок: «в руках» — сколько граната этого типа была в руках до броска подряд (от первой выборки с ней; выборка раз в 16 тиков —
плюс до 16 тиков, берём середину); «после» — через сколько после броска в руках другое (не граната этого броска). Печатает квантили, с."""
import csv, gzip, glob, os, collections, bisect
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
WF = {'weapon_smokegrenade': 'Smoke Grenade', 'weapon_flashbang': 'Flashbang', 'weapon_hegrenade': 'High Explosive Grenade',
      'weapon_molotov': 'Molotov', 'weapon_incgrenade': 'Incendiary Grenade'}
TY = {'weapon_smokegrenade': 'smoke', 'weapon_flashbang': 'flash', 'weapon_hegrenade': 'he', 'weapon_molotov': 'molly', 'weapon_incgrenade': 'molly'}
def q(a, p):
    a = sorted(a); return a[int(round(p * (len(a) - 1)))] if a else float('nan')
HOLD = collections.defaultdict(list); AFTER = collections.defaultdict(list)
for m in ('mirage', 'ancient'):
    for tf in glob.glob(os.path.join(ROOT, 'data', 'maps', m, 'demos', '*_ticks.csv.gz')):
        base = tf[:-len('_ticks.csv.gz')]; ff = base + '_weapon_fire.csv.gz'
        if not os.path.exists(ff): continue
        S = collections.defaultdict(list)
        for r in csv.DictReader(gzip.open(tf, 'rt', encoding='utf-8')):
            if r['is_warmup_period'] == 'True': continue
            S[r['steamid']].append((int(r['tick']), r['active_weapon_name'], r['is_alive'] == 'True'))
        for sid in S: S[sid].sort()
        K = {sid: [x[0] for x in S[sid]] for sid in S}
        for r in csv.DictReader(gzip.open(ff, 'rt', encoding='utf-8')):
            w = r['weapon']
            if w not in WF: continue
            sid, t = r['user_steamid'], int(r['tick']); L = S.get(sid)
            if not L: continue
            i = bisect.bisect_right(K[sid], t) - 1
            if i < 0: continue
            j = i
            while j >= 0 and L[j][1] == WF[w] and L[j][2]: j -= 1
            if j == i: continue                     # в выборке до броска гранаты в руках не было (меньше 16 тиков)
            first = L[j + 1][0]; HOLD[TY[w]].append((t - first + 8) / 64.0)
            k = i + 1
            while k < len(L) and L[k][1] == WF[w] and L[k][2]: k += 1
            if k < len(L) and L[k][2]: AFTER[TY[w]].append((L[k][0] - t - 8) / 64.0)
for ty in ('smoke', 'flash', 'he', 'molly'):
    H, A = HOLD[ty], AFTER[ty]
    print('%-6s бросков %5d  в руках до броска, с: p5 %.2f p10 %.2f p25 %.2f p50 %.2f   после броска до другого, с: p10 %.2f p50 %.2f p90 %.2f' % (
        ty, len(H), q(H, .05), q(H, .1), q(H, .25), q(H, .5), q(A, .1), q(A, .5), q(A, .9)))
