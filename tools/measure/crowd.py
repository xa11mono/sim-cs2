#!/usr/bin/env python3
"""(v412, Б5д-1 / М151) «Толпа на ходу»: доля снимков, когда бегущий T (живой, до планта, ≥ 150 ед. игры/с) имеет живого своего ближе
150 ед. игры (60 ед. карты). Одинаково у про (тики демок карты, шаг 16) и у ботов (позиции прогона).
  python3 tools/measure/crowd.py pro <карта>            — демки data/maps/<карта>/demos/*_ticks.csv.gz
  python3 tools/measure/crowd.py <прогон>[,<прогон>…]    — tools/measure/runs/<прогон>/rec_*.json
v370 (16.10): у про 11–13 %, у ботов 25 % (скрипта тогда не сохранили — этот считает заново)."""
import sys, os, glob, math
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
NEAR_G, RUN_G = 150.0, 150.0   # ед. игры: «рядом» (= FOLLOW_GAP 60 ед. карты · 2,5) и «бежит» (бег 250, шаг ≈ 130)

def share(P, k):
    """P: rid, tick, id, x, y (ед. игры), только T, живые, окно «раунд идёт, до планта». k — ед. игры на единицу x/y"""
    near = n = 0
    P = P.sort_values(['rid', 'id', 'tick'])
    P['dt'] = P.groupby(['rid', 'id']).tick.diff(); P['dd'] = np.hypot(P.groupby(['rid', 'id']).x.diff(), P.groupby(['rid', 'id']).y.diff())*k
    P['v'] = P.dd/(P.dt/64.0)
    for (rid, tk), g in P.groupby(['rid', 'tick']):
        if len(g) < 2: continue
        xy = g[['x', 'y']].values*k; v = g.v.values
        for i in range(len(g)):
            if not (v[i] >= RUN_G): continue
            d = np.hypot(xy[:, 0]-xy[i, 0], xy[:, 1]-xy[i, 1]); d[i] = 1e9
            n += 1; near += d.min() < NEAR_G
    return near/max(1, n), n

def pro(mapname):
    D = os.path.join(ROOT, 'data', 'maps', mapname, 'demos'); out = []
    for f in sorted(glob.glob(os.path.join(D, '*_ticks.csv.gz'))):
        base = f[:-len('_ticks.csv.gz')]
        try: fe = pd.read_csv(base + '_round_freeze_end.csv.gz'); re = pd.read_csv(base + '_round_end.csv.gz')
        except FileNotFoundError: continue
        try: bp = pd.read_csv(base + '_bomb_planted.csv.gz')
        except (FileNotFoundError, pd.errors.EmptyDataError): bp = pd.DataFrame(columns=['tick'])
        t = pd.read_csv(f, usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'is_alive', 'is_warmup_period'])
        t = t[(t.team_num == 2) & t.is_alive.astype(bool) & ~t.is_warmup_period.astype(bool)]
        ends = sorted(re.tick[re.tick > 0].tolist()); plants = sorted(bp.tick.tolist())
        rid = np.full(len(t), None, dtype=object); tk = t.tick.values
        for i, a in enumerate(sorted(fe.tick.tolist())):
            b = min([e for e in ends if e > a] or [10**9]); p = [q for q in plants if a < q < b]; b = p[0] if p else b
            rid[(tk >= a) & (tk < b)] = f'{os.path.basename(base)}|{i}'
        t = t.assign(rid=rid, id=t.steamid, x=t.X, y=t.Y)[lambda q: q.rid.notna()]
        out.append(t[['rid', 'tick', 'id', 'x', 'y']])
    return share(pd.concat(out), 1.0)

def bots(names):
    import json
    P = []
    for f in sorted(sum([glob.glob(os.path.join(HERE, 'runs', r, 'rec_*.json')) for r in names], [])):
        if os.path.getsize(f) == 0: continue
        d = json.load(open(f)); m = os.path.basename(f)
        p = pd.DataFrame([r[:6] for r in d['pos']], columns=['tick', 'id', 'ct', 'x', 'y', 'alive'])
        p = p[(p.ct != 1) & p.alive.astype(bool)]
        rid = np.full(len(p), None, dtype=object); tk = p.tick.values
        for i, r in enumerate(x for x in d['rounds'] if 't1' in x):
            a = r.get('live', r['t0']); b = r['plant'] if r.get('plant') else r['t1']
            rid[(tk >= a) & (tk < b)] = f'{m}|{i}'
        P.append(p.assign(rid=rid)[lambda q: q.rid.notna()][['rid', 'tick', 'id', 'x', 'y']])
    return share(pd.concat(P), 2.5)

if __name__ == '__main__':
    s, n = pro(sys.argv[2]) if sys.argv[1] == 'pro' else bots(sys.argv[1].split(','))
    print(f'свой ближе 60 ед. карты на бегу (T, до планта): {s:.3f}  (снимков {n})')
