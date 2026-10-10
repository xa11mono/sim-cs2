"""Детектор (v250): первый контакт — один или с тиммейтом, что дальше (как tools/contact_bake.py у про).
Запуск: python3 tools/measure/contact.py <run> [<run> …]"""
import json, os, sys, math, bisect, collections
HERE = os.path.dirname(os.path.abspath(__file__))
S = collections.defaultdict(collections.Counter)
for run in sys.argv[1:]:
    for f in sorted(os.listdir(os.path.join(HERE, 'runs', run))):
        if not f.startswith('rec_'): continue
        d = json.load(open(os.path.join(HERE, 'runs', run, f)))
        plants = [p[0] for p in d['plants']] if d['plants'] and isinstance(d['plants'][0], list) else []
        R = [(int(r['t0']), int(r['t1'])) for r in d['rounds'] if 't1' in r]
        tr = collections.defaultdict(list)
        for p in d['pos']:
            if p[5]: tr[p[1]].append((p[0], p[3], p[4], 'CT' if p[2] == 1 else 'T'))
        def at(b, tk):
            L = tr.get(b); 
            if not L: return None
            i = bisect.bisect_right([q[0] for q in L], tk) - 1
            if i < 0 or tk - L[i][0] > 32: return None
            return L[i]
        deaths = collections.defaultdict(list)
        for k in d['kills']: deaths[k[5]].append(k[0])
        done = set()
        for s in d['shots']:
            tk, sid = s[0], s[1]
            rr = [r for r in R if r[0] <= tk <= r[1]]
            if not rr or any(rr[0][0] <= pt <= tk for pt in plants): continue
            pe = at(sid, tk)
            if not pe: continue
            foes = [(math.hypot(q[1]-pe[1], q[2]-pe[2]), b, q) for b in tr if (q := at(b, tk)) and q[3] != pe[3]]
            if not foes: continue
            dist, P, pp = min(foes)
            if dist > 700: continue
            for who, pw, po in ((P, pp, pe), (sid, pe, pp)):
                key = (rr[0][0], who)
                if key in done: continue
                done.add(key)
                alone = not any(math.hypot(q[1]-pw[1], q[2]-pw[2]) <= 272 for b in tr if b != who and (q := at(b, tk)) and q[3] == pw[3])
                p2 = at(who, tk + 128)
                died = any(tk <= t2 <= tk + 320 for t2 in deaths.get(who, []))
                k = pw[3] + (' один' if alone else ' с тиммейтом')
                S[k]['n'] += 1; S[k]['died'] += died
                if p2:
                    d0 = math.hypot(pw[1]-po[1], pw[2]-po[2]); d1 = math.hypot(p2[1]-po[1], p2[2]-po[2])
                    S[k]['back' if d1-d0 > 40 else 'fwd' if d0-d1 > 40 else 'hold'] += 1
pro = json.load(open(os.path.join(HERE, '..', '..', 'src', 'data', 'trades.json')))['contact']
for k in ('CT один', 'CT с тиммейтом', 'T один', 'T с тиммейтом'):
    v = S[k]; n = max(1, v['n']); p = pro[k]
    print(f"{k:16} контактов в один / всего: боты {v['n']/max(1,sum(S[x]['n'] for x in S if x[:2]==k[:2])):.0%} про {p['n']/sum(pro[x]['n'] for x in pro if x[:2]==k[:2]):.0%} | отошёл {p['отошёл']:.0%}/{v['back']/n:.0%} держит {p['держит']:.0%}/{v['hold']/n:.0%} вперёд {p['вперёд']:.0%}/{v['fwd']/n:.0%} погиб за 5 с {p['погиб за 5 с']:.0%}/{v['died']/n:.0%}  (про/боты)")
