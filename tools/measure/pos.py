#!/usr/bin/env python3
"""Детекторы позиции CT на сайтах (П1, П2, П4, П5, К3) — у про по демкам и у ботов
по записям матчей, определения одинаковые (координаты — пиксели радара, шаг 0,25 с).
python3 tools/measure/pos.py pro
python3 tools/measure/pos.py <прогон1,прогон2,...> [примеров]
Берётся только время до планта, живые CT «у сайта» (≤320 px от центра A или B);
«стоит» — сдвинулся меньше 3 px за 0,25 с.
  - П1 «открыт на 2+ входа»: стоящий CT у сайта по прямой видит 2 и больше входа
    сайта (A: Long, Short, A Main; B: Ramp, Cave), % времени;
  - П4 «двое вплотную»: рядом (≤110 px) стоит другой CT у того же сайта, % времени;
  - П2 «на про-точке»: стоит в 20 px от точки, где обычно стоят про (библиотека
    про-точек игры) — у про высокое по построению, это ориентир;
  - К3 «умер без размена»: CT погиб у сайта, а ближе 350 px не было живого тиммейта,
    % смертей CT у сайта;
  - П5 «вышел вперёд — второй отреагировал»: CT, стоявший у сайта, за 3 с вышел
    к входу сайта (ближе к нему на 120+ px); другой CT, стоявший у того же сайта,
    за 5 с сдвинулся на 60+ px, % таких случаев."""
import sys, os, glob, json, gzip, pickle
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
W = np.array(json.load(open(os.path.join(ROOT, 'data', 'walls.json')))['w'], dtype=float)
SITES = {'A': (630, 518), 'B': (1533, 845)}
ENTR = {'A': [(347, 734), (629, 773), (422, 591)], 'B': [(1693, 1021), (1386, 830)]}
PS = None
def pro_spots():
    global PS
    if PS is None:
        f = os.path.join(HERE, 'pro_spots_ct.json')
        PS = np.array(json.load(open(f)), dtype=float)[:, :2] if os.path.exists(f) else np.zeros((0, 2))
    return PS
R_SITE, STILL, NEAR, PROR, TRADE = 320, 3.0, 110, 20, 350

def los(x0, y0, x1, y1):
    """Прямая видимость для массива отрезков (по стенам игры)."""
    out = np.ones(len(x0), bool)
    ax, ay, bx, by = W[:, 0], W[:, 1], W[:, 2], W[:, 3]
    for i in range(0, len(x0), 3000):
        X0, Y0, X1, Y1 = (v[i:i+3000, None] for v in (x0, y0, x1, y1))
        dx, dy = X1 - X0, Y1 - Y0; sx, sy = bx - ax, by - ay
        den = dx * sy - dy * sx
        with np.errstate(divide='ignore', invalid='ignore'):
            t = ((ax - X0) * sy - (ay - Y0) * sx) / den
            u = ((ax - X0) * dy - (ay - Y0) * dx) / den
        hit = (np.abs(den) > 1e-9) & (t > 0.001) & (t < 0.999) & (u >= 0) & (u <= 1)
        out[i:i+3000] = ~hit.any(axis=1)
    return out

def detect(R, K, P, examples=0):
    P = P[P.alive.astype(bool)].copy()
    lim = {r.rid: (r.t0, r.plant if r.plant == r.plant and r.plant else r.t1) for r in R.itertuples()}
    P = P[[lim[r][0] <= t <= lim[r][1] if r in lim else False for r, t in zip(P.rid.values, P.tick.values)]]
    P = P.sort_values(['rid', 'id', 'tick'])
    g = P.groupby(['rid', 'id'])
    P['sp'] = np.hypot(g.x.diff(), g.y.diff()).fillna(99).values
    P['site'] = ''
    for k, (sx, sy) in SITES.items():
        P.loc[np.hypot(P.x - sx, P.y - sy) <= R_SITE, 'site'] = k
    C = P[(P.team == 'CT')]
    S = C[(C.site != '') & (C.sp < STILL)].copy()
    out, ex = {}, []
    # П1 открыт на 2+ входа
    nopen = np.zeros(len(S), int)
    for k in SITES:
        m = (S.site == k).values
        for ex_, ey_ in ENTR[k]:
            nopen[m] += los(S.x.values[m], S.y.values[m], np.full(m.sum(), ex_), np.full(m.sum(), ey_))
    S['open'] = nopen
    out['П1 стоит у сайта открытым на 2+ входа, % времени'] = round(100 * (nopen >= 2).mean(), 1)
    # П4 двое вплотную
    close = np.zeros(len(S), bool); idx = {i: n for n, i in enumerate(S.index)}
    for (rid, tk, k), q in S.groupby(['rid', 'tick', 'site']):
        if len(q) < 2: continue
        d = np.hypot(q.x.values[:, None] - q.x.values[None, :], q.y.values[:, None] - q.y.values[None, :])
        np.fill_diagonal(d, 1e9); h = (d < NEAR).any(axis=1)
        for i, hh in zip(q.index, h):
            if hh: close[idx[i]] = True
    out['П4 двое CT у сайта вплотную (≤110 px), % времени'] = round(100 * close.mean(), 1)
    # П2 на про-точке
    ps = pro_spots()
    if len(ps):
        dm = np.full(len(S), 1e9)
        for i in range(0, len(ps), 50):
            dm = np.minimum(dm, np.hypot(S.x.values[:, None] - ps[None, i:i+50, 0], S.y.values[:, None] - ps[None, i:i+50, 1]).min(axis=1))
        out['П2 стоит на про-точке (≤20 px), % времени'] = round(100 * (dm <= PROR).mean(), 1)
    # К3 умер у сайта без размена
    n = alone = 0
    Kc = K[(K.vicT == 'CT')]
    Pi = P.set_index(['rid', 'tick']).sort_index()
    for kr in Kc.itertuples():
        if kr.rid not in lim or not (lim[kr.rid][0] <= kr.tick <= lim[kr.rid][1]): continue
        if min(np.hypot(kr.vx - sx, kr.vy - sy) for sx, sy in SITES.values()) > R_SITE: continue
        t0 = (kr.tick // 16) * 16
        try: q = Pi.loc[(kr.rid, t0)]
        except KeyError: continue
        q = q[(q.team == 'CT') & (q.id != kr.vic)] if isinstance(q, pd.DataFrame) else q.iloc[0:0]
        n += 1
        if not len(q) or np.hypot(q.x - kr.vx, q.y - kr.vy).min() > TRADE:
            alone += 1
            if examples and len(ex) < examples: ex.append(('умер без размена', kr.rid, int(kr.tick), kr.vic))
    out['К3 CT погиб у сайта без тиммейта ≤350 px, % смертей'] = round(100 * alone / max(1, n), 1)
    # П5 вышел вперёд — второй отреагировал
    ev = re = 0
    for rid, q in C.groupby('rid'):
        byid = {i: g.set_index('tick') for i, g in q.groupby('id')}
        seen = set()
        for i, g in byid.items():
            st = g[(g.site != '') & (g.sp < STILL)]
            for tk, r in st.iloc[::4].iterrows():
                if (i, r.site) in seen: continue
                k = r.site; sx, sy = SITES[k]
                fut = g.loc[tk + 16: tk + 192]
                if not len(fut): continue
                d0 = np.hypot(r.x - sx, r.y - sy); e0 = min(np.hypot(r.x - ex_, r.y - ey_) for ex_, ey_ in ENTR[k])
                f = fut[(np.array([min(np.hypot(a - ex_, b - ey_) for ex_, ey_ in ENTR[k]) for a, b in zip(fut.x, fut.y)]) < e0 - 120)]
                if not len(f): continue
                seen.add((i, k)); t1 = f.index[0]
                for j, h in byid.items():
                    if j == i or t1 not in h.index: continue
                    a = h.loc[t1]
                    if a.site != k or a.sp >= STILL or (t1 + 320) not in h.index: continue
                    b = h.loc[t1 + 320]; ev += 1
                    if np.hypot(b.x - a.x, b.y - a.y) >= 60: re += 1
                    elif examples and len(ex) < 2 * examples: ex.append(('не отреагировал', rid, int(t1), j))
    out['П5 тиммейт вышел вперёд — второй сдвинулся за 5 с, %'] = round(100 * re / max(1, ev), 1)
    out['П5 случаев'] = ev
    out['стоящих CT у сайта, замеров'] = len(S)
    return out, ex

def load_runs(names):
    G = {}; os.chdir(HERE)
    src = '\n'.join(l for l in open(os.path.join(HERE, 'metrics.py')).read().split('\n') if not l.startswith("exec(open('metrics.py')"))
    exec(src.split("\nif __name__")[0], G)
    files = sorted(sum([glob.glob(os.path.join(HERE, 'runs', r, 'rec_*.json')) for r in names], []))
    return G['load_bot']([f for f in files if os.path.getsize(f) > 0])

if __name__ == '__main__':
    if sys.argv[1] == 'pro':
        R, K, P = pickle.load(gzip.open(os.path.join(ROOT, 'data', 'pro', 'pro.pkl.gz')))
        M, ex = detect(R, K, P)
    else:
        R, K, P = load_runs(sys.argv[1].split(','))
        M, ex = detect(R, K, P, int(sys.argv[2]) if len(sys.argv) > 2 else 0)
    for k, v in M.items(): print(f'{k:60s} {v}')
    for e in ex: print(e)
