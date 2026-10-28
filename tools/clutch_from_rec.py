#!/usr/bin/env python3
"""(v459) Клатчи 1vN (N ≥ 2), выигранные, — по записям прогонов (rec_<m>.json[.gz]: REC.kills, REC.rounds). Игру не трогает.
python3 tools/clutch_from_rec.py <папка с rec_*.json(.gz)> [мин_N=2]
Как в игре (checkClutch): игрок остался один, а живых врагов ≥ 2; N — сколько их было больше всего; выиграла его сторона."""
import sys, os, json, gzip, glob

def load(p):
    with (gzip.open(p, 'rt', encoding='utf-8') if p.endswith('.gz') else open(p, encoding='utf-8')) as f:
        return json.load(f)

def clutches(rec, min_n=2):
    out = []
    for r in rec.get('rounds', []):
        t0, t1 = r.get('t0'), r.get('t1')
        if t0 is None or t1 is None: continue
        alive = {'CT': {'CT%d' % i for i in range(5)}, 'T': {'T%d' % i for i in range(5)}}
        info = None; ck = 0
        for k in sorted((k for k in rec.get('kills', []) if t0 <= k[0] <= t1), key=lambda k: k[0]):
            vic, vt = k[5], k[6]
            if info and k[1] == info['id'] and vt != info['side']: ck += 1
            alive[vt].discard(vic)
            for s in ('CT', 'T'):
                o = 'T' if s == 'CT' else 'CT'
                if len(alive[s]) == 1 and len(alive[o]) >= 2:
                    me = next(iter(alive[s]))
                    if not info or info['id'] != me: info = {'id': me, 'side': s, 'n': len(alive[o]), 'tick': k[0]}; ck = 0
                    else: info['n'] = max(info['n'], len(alive[o]))
        if info and info['n'] >= min_n and r.get('winner') == info['side']:
            out.append(dict(match=rec.get('match'), round=r.get('r'), kills_after=ck, reason=r.get('reason'), **info))
    return out

if __name__ == '__main__':
    d = sys.argv[1]; mn = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    allc = []
    for p in sorted(glob.glob(os.path.join(d, 'rec_*.json*'))):
        allc += clutches(load(p), mn)
    allc.sort(key=lambda c: (-c['n'], c['match'], c['round']))
    for c in allc:
        print('матч %(match)s раунд %(round)s — %(id)s (%(side)s) 1v%(n)s, фрагов в клатче %(kills_after)s, конец: %(reason)s' % c)
    print('всего:', len(allc))
