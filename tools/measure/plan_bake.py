#!/usr/bin/env python3
"""Нож, темп атаки, плотность T — у про (88 демок) и у ботов (tools/measure/runs/<метка>/rec_*.json), одно определение.
Позиции раз в 16 тиков, до конца раунда. python3 tools/measure/plan_bake.py <метка бота>…
  нож: доля времени с ножом по стороне × фазе раунда (с от начала / после планта), × дистанции до ближайшего живого врага,
       × скорости; доля времени, когда враг «не может быть рядом» (ближайший > 1200 px)
  темп: время планта (квантили), первый T в зоне сайта, первый фраг, от первого T на сайте до планта
  плотность T до планта: до ближайшего живого тиммейта (медиана) и доля «свой ≤ 350 px» по фазам; у первой смерти T"""
import sys, os, glob, collections, json
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, HERE)
import metrics as MX
PH = [(0, 10), (10, 20), (20, 30), (30, 45), (45, 60), (60, 200)]
def ph(t):
    for a, b in PH:
        if a <= t < b: return f'{a}-{b if b < 200 else ""}'
    return '?'
def bake(R, K, P, name):
    out = {}
    R = R.set_index('rid'); P = P[P.alive].copy()
    P['t0'] = P.rid.map(R.t0); P['plant'] = P.rid.map(R.plant); P['sec'] = (P.tick - P.t0) / 64
    P = P.sort_values(['rid', 'id', 'tick'])
    dx = P.groupby(['rid', 'id']).x.diff(); dy = P.groupby(['rid', 'id']).y.diff(); dt = P.groupby(['rid', 'id']).tick.diff()
    P['sp'] = (np.hypot(dx, dy) / (dt / 64)).where(dt == 16)
    # ближайший враг / свой
    P = P.reset_index(drop=True)
    ne = np.full(len(P), np.inf); nm = np.full(len(P), np.inf)
    X = P.x.values; Y = P.y.values; TM = np.asarray(P.team.values, dtype=object) == 'T'
    for ii in P.groupby(['rid', 'tick']).indices.values():
        if len(ii) < 2: continue
        xs, ys, tm = X[ii], Y[ii], TM[ii]
        D = np.hypot(xs[:, None] - xs[None, :], ys[:, None] - ys[None, :]); np.fill_diagonal(D, np.inf)
        same = tm[:, None] == tm[None, :]
        ne[ii] = np.where(~same, D, np.inf).min(1); nm[ii] = np.where(same, D, np.inf).min(1)
    P['dEn'] = ne; P['dMate'] = nm
    post = P.plant.notna() & (P.tick >= P.plant)
    P['phase'] = np.where(post, 'после планта', [ph(s) for s in P.sec])
    kn = P.w == 'knife'
    out['нож: всего %'] = round(100 * kn.mean(), 1)
    for side in ('T', 'CT'):
        S = P[P.team == side]
        out[f'нож {side} по фазе %'] = {k: round(100 * (g.w == 'knife').mean(), 1) for k, g in S.groupby('phase')}
    nb = pd.cut(P['dEn'], [0, 600, 1200, 1e9], labels=['враг <600', '600-1200', '>1200'])
    out['нож по ближайшему врагу %'] = {str(k): round(100 * (g.w == 'knife').mean(), 1) for k, g in P.groupby(nb, observed=True)}
    out['доля времени: ближайший враг >1200 px %'] = round(100 * (P['dEn'] > 1200).mean(), 1)
    sb = pd.cut(P.sp, [-1, 15, 65, 1e9], labels=['стоит', 'шагом', 'бежит'])
    out['нож по скорости %'] = {str(k): round(100 * (g.w == 'knife').mean(), 1) for k, g in P.groupby(sb, observed=True)}
    # темп
    pl = R[R.plant.notna()]; out['время планта, квантили 10/25/50/75/90 с'] = list(np.round(np.quantile((pl.plant - pl.t0) / 64, [.1, .25, .5, .75, .9]), 1))
    T = P[(P.team == 'T') & ~post]
    z = MX.zone_of(T.x.values, T.y.values); T = T.assign(z=z)
    onsite = T[T.z.isin(['A Site', 'B Site', 'Site B'])]
    first_in = onsite.groupby('rid').sec.min()
    out['первый T в зоне сайта, медиана с (раунды с плантом / все)'] = [round(float(first_in[first_in.index.isin(pl.index)].median()), 1), round(float(first_in.median()), 1)]
    fk = K.groupby('rid').tick.min(); fk = (fk - R.t0.reindex(fk.index)) / 64
    out['первый фраг, медиана с'] = round(float(fk.median()), 1)
    ps = ((pl.plant - pl.t0) / 64); d = (ps - first_in.reindex(ps.index)).dropna()
    out['от первого T на сайте до планта, медиана с'] = round(float(d.median()), 1)
    kb = K.merge(R[['t0', 'plant']], left_on='rid', right_index=True)
    kb = kb[kb.plant.notna() & (kb.tick < kb.plant)]
    out['фрагов до планта (в раундах с плантом), в среднем'] = round(len(kb) / max(1, len(pl)), 2)
    # плотность T
    for k, g in T.groupby('phase'):
        out.setdefault('T до ближайшего своего, медиана px по фазе', {})[k] = round(float(g['dMate'][np.isfinite(g['dMate'])].median()), 0)
        out.setdefault('T: свой ≤350 px, % времени по фазе', {})[k] = round(100 * (g['dMate'] <= 350).mean(), 1)
    return out

if __name__ == '__main__':
    labs = sys.argv[1:]
    res = {}
    cache = os.path.join(HERE, 'runs', 'plan_pro.json')
    if os.path.exists(cache): res['про'] = json.load(open(cache))
    else:
        R, K, P = MX.load_pro(); res['про'] = bake(R, K, P, 'про'); json.dump(res['про'], open(cache, 'w'), ensure_ascii=False, indent=1, default=float)
    for lab in labs:
        files = sorted(glob.glob(os.path.join(HERE, 'runs', lab, 'rec_*.json')))
        R, K, P = MX.load_bot(files)
        kn = set()   # у ботов нож — отдельный флаг в pos[8] (оружие в pos[7] — основное)
        for f in files:
            m = f.split('/')[-1]
            for q in json.load(open(f))['pos']:
                if len(q) > 8 and q[8]: kn.add((m, q[0], q[1]))
        P = P.reset_index(drop=True)
        fm = P.rid.str.split('|').str[0]
        P.loc[[(a, b, c) in kn for a, b, c in zip(fm, P.tick, P.id)], 'w'] = 'knife'
        res[lab] = bake(R, K, P, lab)
    keys = list(res['про'].keys())
    for k in keys:
        print(k); [print(f'   {n:12} {res[n].get(k)}') for n in res]
