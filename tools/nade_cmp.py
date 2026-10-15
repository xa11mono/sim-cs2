"""Гранаты у про и у ботов (v252, замер): тип, сторона, когда в раунде, до/после планта, куда падают (зоны src/zones.json).

Про — разрывы из демок (smoke/flash/HE detonate, inferno_startburn), сторона — по команде бросившего в этот тик.
Боты — rec_N.json → det. Время — от начала раунда (конец freeze), с.
Запуск: python3 tools/nade_cmp.py <run> [<run> …]"""
import json, os, sys, bisect, collections
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from demos import DEMOS, tr, demo_names, rounds_of, event  # noqa: E402

Z = json.load(open(os.path.join(ROOT, 'src', 'zones.json')))['zones']


def inpoly(x, y, P):
    c = False; j = len(P) - 1
    for i in range(len(P)):
        if (P[i][1] > y) != (P[j][1] > y) and x < (P[j][0]-P[i][0])*(y-P[i][1])/(P[j][1]-P[i][1]+1e-9) + P[i][0]: c = not c
        j = i
    return c


def zone(x, y):
    for z in Z:
        if inpoly(x, y, z['pts']): return z['name']
    return '—'


TYPES = ('smoke', 'flash', 'he', 'molly')


def add(S, side, typ, t_rel, post, x, y):
    S['n'][(side, typ, post)] += 1
    if not post: S['t'][(side, typ)].append(t_rel)
    S['z'][(side, typ)][zone(x, y)] += 1


def new():
    return {'n': collections.Counter(), 't': collections.defaultdict(list), 'z': collections.defaultdict(collections.Counter), 'rounds': 0,
            'first': collections.defaultdict(list)}


def pro():
    S = new()
    EV = {'smokegrenade_detonate': 'smoke', 'flashbang_detonate': 'flash', 'hegrenade_detonate': 'he', 'inferno_startburn': 'molly'}
    for demo in demo_names():
        rounds = rounds_of(demo)
        if not rounds: continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num'])
        TM = {int(s): (g.tick.values, g.team_num.values) for s, g in t.sort_values('tick').groupby('steamid')}
        S['rounds'] += len(rounds)
        first = {}
        for ev, typ in EV.items():
            e = event(demo, ev)
            if not len(e): continue
            for tk, sid, X, Y in zip(e.tick.values, e.user_steamid.values, e.x.values, e.y.values):
                if sid != sid: continue
                r = [q for q in rounds if q['t0'] - 64*20 <= tk <= q['t1']]
                if not r or int(sid) not in TM: continue
                r = r[-1]; tt, tm = TM[int(sid)]; i = max(0, np.searchsorted(tt, tk) - 1)
                side = 'CT' if tm[i] == 3 else 'T'
                post = bool(r['tplant'] and tk >= r['tplant'])
                x, y = tr(X, Y)
                add(S, side, typ, (tk - r['t0'])/64, post, x, y)
                if not post: first.setdefault((r['rid'], side), []).append((tk - r['t0'])/64)
        for (rid, side), L in first.items(): S['first'][side].append(min(L))
        print(demo, file=sys.stderr)
    return S


def bots(runs):
    S = new()
    M = {'smoke': 'smoke', 'flash': 'flash', 'he': 'he', 'HE': 'he', 'molly': 'molly', 'molotov': 'molly', 'inc': 'molly'}
    for run in runs:
        D = os.path.join(HERE, 'measure', 'runs', run)
        for f in sorted(os.listdir(D)):
            if not f.startswith('rec_'): continue
            d = json.load(open(os.path.join(D, f)))
            R = [r for r in d['rounds'] if 't1' in r]; S['rounds'] += len(R)
            plants = [p[0] for p in d['plants']] if d['plants'] and isinstance(d['plants'][0], list) else []
            first = {}
            for q in d['det']:
                tk, side, typ, x, y = q[0], q[1], M.get(q[2], q[2]), q[3], q[4]
                r = [r for r in R if r['t0'] - 64*20 <= tk <= r['t1']]
                if not r: continue
                r = r[-1]; pl = [p for p in plants if r['t0'] <= p <= r['t1']]
                post = bool(pl and tk >= pl[0])
                add(S, side, typ, (tk - r['t0'])/64, post, x, y)
                if not post: first.setdefault((r['r'], side), []).append((tk - r['t0'])/64)
            for (rn, side), L in first.items(): S['first'][side].append(min(L))
    return S


def show(P, B):
    for side in ('CT', 'T'):
        print(f'— {side}  (про | боты)')
        print(f"  первая граната стороны в раунде, медиана с: {np.median(P['first'][side]):.1f} | {np.median(B['first'][side]):.1f}")
        for typ in TYPES:
            pn = [P['n'][(side, typ, x)] / P['rounds'] for x in (False, True)]
            bn = [B['n'][(side, typ, x)] / max(1, B['rounds']) for x in (False, True)]
            pt, bt = P['t'][(side, typ)], B['t'][(side, typ)]
            q = lambda L: '/'.join(f'{v:.0f}' for v in np.quantile(L, [0.25, 0.5, 0.75])) if L else '-'
            print(f'  {typ:6} за раунд до планта {pn[0]:.2f} | {bn[0]:.2f}   после {pn[1]:.2f} | {bn[1]:.2f}   время до планта 25/50/75 % {q(pt)} | {q(bt)} с')
            pz, bz = P['z'][(side, typ)], B['z'][(side, typ)]
            ps, bs = sum(pz.values()) or 1, sum(bz.values()) or 1
            top = [z for z, _ in pz.most_common(6)]
            btop = [z for z, _ in bz.most_common(8) if z not in top][:3]
            print('         куда (доля): ' + ', '.join(f'{z} {pz[z]/ps:.0%}|{bz[z]/bs:.0%}' for z in top) +
                  ('   у ботов ещё: ' + ', '.join(f'{z} {pz[z]/ps:.0%}|{bz[z]/bs:.0%}' for z in btop) if btop else ''))


if __name__ == '__main__':
    B = bots(sys.argv[1:])
    P = pro()
    show(P, B)
