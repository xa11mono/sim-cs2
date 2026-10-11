#!/usr/bin/env python3
"""Этап 2, P2-1: взгляд стоя — распределения, а не одно среднее (про и боты, одно определение, отсчёты раз в 16 тиков).
Стоит — скорость < 15 px/с между соседними отсчётами. Для стоящих отсчётов: |поворот за 0,25 с| по корзинам;
удержание направления — сколько подряд отсчётов стоя поворот < 5°; амплитуда поворотов > 5°.
python3 tools/measure/audit/look_bake.py pro | <run> …"""
import sys, os, json, glob, math
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))

def frames_pro():
    from ancient_demos import DEMOS, tr, demo_names, rounds_of
    for demo in demo_names():
        R = rounds_of(demo)
        if not R: continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'X', 'Y', 'yaw', 'is_alive'])
        t = t[t.is_alive == True]  # noqa: E712
        x, y = tr(t.X.values, t.Y.values)
        df = pd.DataFrame({'tick': t.tick.values, 'id': t.steamid.values, 'x': x, 'y': y, 'a': np.radians(-t.yaw.values)})
        for r in R:
            s = df[(df.tick >= r['t0']) & (df.tick <= (r['tplant'] or r['t1']))]
            yield s.assign(rid=demo + str(r['t0']))

def frames_bots(runs):
    for run in runs:
        for f in sorted(glob.glob(os.path.join(ROOT, 'tools', 'measure', 'runs', run, 'rec_*.json'))):
            d = json.load(open(f)); P = pd.DataFrame([p[:7] for p in d['pos']], columns=['tick', 'id', 'ct', 'x', 'y', 'alive', 'a'])
            P = P[P.alive == 1]
            plants = {}
            for r in d['rounds']:
                if 't1' not in r: continue
                t1 = r.get('plant') or r['t1']
                yield P[(P.tick >= r['t0']) & (P.tick <= t1)].assign(rid=f + str(r['t0']))

def stats(frames):
    da_all, holds, amps = [], [], []
    for s in frames:
        s = s.sort_values(['id', 'tick'])
        for _, g in s.groupby('id'):
            tk, x, y, a = g.tick.values, g.x.values.astype(float), g.y.values.astype(float), g.a.values.astype(float)
            if len(tk) < 3: continue
            ok = np.diff(tk) == 16
            sp = np.hypot(np.diff(x), np.diff(y)) / 0.25
            da = np.degrees(np.abs((np.diff(a) + np.pi) % (2*np.pi) - np.pi))
            st = ok & (sp < 15)
            da_all.append(da[st]); amps.append(da[st & (da >= 5)])
            run = 0
            for k in range(len(st)):
                if st[k] and da[k] < 5: run += 1
                else:
                    if run: holds.append(run); run = 0
            if run: holds.append(run)
    D = np.concatenate(da_all); A = np.concatenate(amps); H = np.array(holds) * 0.25
    bins = [0, 2, 5, 10, 20, 45, 90, 181]
    hist = np.histogram(D, bins=bins)[0] / len(D)
    return {'стоящих отсчётов': int(len(D)), 'средний поворот, °': round(float(D.mean()), 2),
            'доля по корзинам °: 0-2/2-5/5-10/10-20/20-45/45-90/90+ %': [round(float(v)*100, 1) for v in hist],
            'удержание направления (<5° подряд), с: квантили 25/50/75/90': [round(float(q), 2) for q in np.quantile(H, [0.25, 0.5, 0.75, 0.9])],
            'амплитуда поворотов ≥5°, °: квантили 25/50/75/90': [round(float(q), 1) for q in np.quantile(A, [0.25, 0.5, 0.75, 0.9])],
            'поворотов ≥5° в минуту стоя': round(len(A) / (len(D)*0.25/60), 1)}

if __name__ == '__main__':
    R = stats(frames_pro()) if sys.argv[1] == 'pro' else stats(frames_bots(sys.argv[1:]))
    print(json.dumps(R, ensure_ascii=False, indent=1))
    if sys.argv[1] == 'pro': json.dump(R, open(os.path.join(HERE, 'runs', 'look_pro.json'), 'w'), ensure_ascii=False, indent=1)
