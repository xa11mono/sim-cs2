#!/usr/bin/env python3
"""Почему часто ставят (05.11, пакет тактики): исходы раундов, гибели до планта, первое убийство — про (демки Mirage) против записей прогона.
python3 tools/measure/plant_outcomes.py <папка с rec_*.json.gz прогона Mirage>
Плант с раундом — по тикам (номера раундов в файлах демок не совпадают)."""
import csv, gzip, glob, os, sys, json, collections, statistics as st
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
def pro():
    C = collections.Counter(); R = 0; T = []; CTd = []; F = collections.Counter()
    for f in glob.glob(os.path.join(ROOT, 'data', 'maps', 'mirage', 'demos', '*_round_end.csv.gz')):
        b = f[:-len('_round_end.csv.gz')]
        rows = sorted([r for r in csv.DictReader(gzip.open(f, 'rt', encoding='utf-8')) if r.get('winner')], key=lambda r: int(r['tick']))
        try: pt = sorted(int(r['tick']) for r in csv.DictReader(gzip.open(b + '_bomb_planted.csv.gz', 'rt', encoding='utf-8')))
        except FileNotFoundError: pt = []
        try: dd = sorted(csv.DictReader(gzip.open(b + '_player_death.csv.gz', 'rt', encoding='utf-8')), key=lambda x: int(x['tick']))
        except FileNotFoundError: dd = []
        prev = 0
        for r in rows:
            t = int(r['tick']); p = [x for x in pt if prev < x <= t]; cut = p[0] if p else t; R += 1
            C[(r['winner'], r['reason'], 'плант' if p else 'без планта')] += 1
            K = [x for x in dd if prev < int(x['tick']) <= cut]
            T.append(sum(1 for x in K if x.get('user_team_num') == '2')); CTd.append(sum(1 for x in K if x.get('user_team_num') == '3'))
            K2 = [x for x in dd if prev < int(x['tick']) <= t]
            if K2: F[K2[0].get('user_team_num')] += 1
            prev = t
    return R, C, st.mean(T), st.mean(CTd), F['2'] / max(1, sum(F.values()))
def ours(d0):
    C = collections.Counter(); R = 0; T = []; CTd = []; F = collections.Counter()
    for f in glob.glob(os.path.join(d0, 'rec_*.json*')):
        d = json.load(gzip.open(f) if f.endswith('.gz') else open(f)); pls = [p[0] for p in d['plants']]
        for r in d['rounds']:
            t0, t1 = r['t0'], r.get('t1', 1e12); p = [x for x in pls if t0 <= x <= t1]; cut = p[0] if p else t1; R += 1
            C[(r.get('winner'), r.get('reason'), 'плант' if p else 'без планта')] += 1
            K = [k for k in d['kills'] if t0 <= k[0] <= cut]
            T.append(sum(1 for k in K if k[6] == 'T')); CTd.append(sum(1 for k in K if k[6] == 'CT'))
            K2 = [k for k in d['kills'] if t0 <= k[0] <= t1]
            if K2: F[K2[0][6]] += 1
    return R, C, st.mean(T), st.mean(CTd), F['T'] / max(1, sum(F.values()))
for name, res in (('про', pro()), ('мы', ours(sys.argv[1]))):
    R, C, t, c, fT = res
    print('%s: раундов %d, с плантом %.1f %%, гибнет до планта T %.2f / CT %.2f, первый убитый — T %.0f %%' % (name, R, 100*sum(v for k, v in C.items() if k[2] == 'плант')/R, t, c, 100*fT))
    for k, v in C.most_common(7): print('   ', k, '%.1f %%' % (100*v/R))
