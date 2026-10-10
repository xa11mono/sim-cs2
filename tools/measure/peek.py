"""Детектор (v250): перестрелки ботов — как tools/peek_bake.py у про (тот же код analyze, выстрелы прорежены как в демках).
Запуск: python3 tools/measure/peek.py <run> [<run> …]"""
import json, os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from peek_bake import analyze, new_stats, summary  # noqa: E402

S = new_stats()
for run in sys.argv[1:]:
    for f in sorted(os.listdir(os.path.join(HERE, 'runs', run))):
        if not f.startswith('rec_'): continue
        d = json.load(open(os.path.join(HERE, 'runs', run, f)))
        plants = [p[0] for p in d['plants']] if d['plants'] and isinstance(d['plants'][0], list) else []
        R = [(int(r['t0']), int(r['t1'])) for r in d['rounds'] if 't1' in r]
        tr = collections.defaultdict(lambda: ([], [], [], None))
        T = {}
        for p in sorted(d['pos'], key=lambda q: q[0]):
            if not p[5]: continue
            L = T.setdefault((p[1], p[2]), ([], [], []))
            L[0].append(p[0]); L[1].append(p[3]); L[2].append(p[4])
        shots, seen = collections.defaultdict(list), set()
        for s in sorted(d['shots'], key=lambda q: q[0]):
            if (s[1], s[0] // 32) in seen: continue
            seen.add((s[1], s[0] // 32)); shots[s[1]].append(s[0])
        deaths, kills_by = collections.defaultdict(list), collections.defaultdict(list)
        for k in d['kills']:
            deaths[k[5]].append(k[0])
            if k[1] and k[2] != k[6]: kills_by[k[1]].append(k[0])
        for r in R:
            import bisect
            tr_r = {}
            for (b, ct), (tt, xx, yy) in T.items():
                i0, i1 = bisect.bisect_left(tt, r[0]), bisect.bisect_right(tt, r[1])
                if i1 > i0: tr_r[b] = (tt[i0:i1], xx[i0:i1], yy[i0:i1], 'CT' if ct == 1 else 'T')
            analyze(tr_r, shots, deaths, kills_by, [r], plants, S)
bot = summary(S)
pro_ = json.load(open(os.path.join(HERE, '..', '..', 'src', 'data', 'trades.json')))['peek']
for sd in ('CT', 'T'):
    k = 'по дистанции: доля перестрелок / без фрага и смерти'
    if k in pro_[sd]:
        print(sd, k, '(про | боты):', ' '.join(f"{bk}: {p[0]:.0%}/{p[1]:.0%} | {bot[sd][k][bk][0]:.0%}/{bot[sd][k][bk][1]:.0%}" for bk, p in pro_[sd][k].items()))
pro = json.load(open(os.path.join(HERE, '..', '..', 'src', 'data', 'trades.json')))['peek']
for sd in ('CT', 'T'):
    print('—', sd, '(про | боты)')
    for k, v in pro[sd].items():
        if isinstance(v, dict): continue
        b = bot[sd].get(k)
        f = (lambda z: f'{z:.0%}') if (isinstance(v, float) and v <= 1 and k not in ('перестрелок на игрока за раунд',) and 'медиана' not in k and 'среднее' not in k and 'на перестрелку' not in k) else (lambda z: f'{z:.2f}' if isinstance(z, float) else str(z))
        print(f'  {k:44} {f(v)} | {f(b) if b is not None else "-"}')
