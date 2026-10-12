#!/usr/bin/env python3
"""Этап 2, P1-3: где враг через Δt после того, как его потеряли из вида (у про и у ботов, одно определение).
Встречи «видят друг друга» — как tools/vis_bake.py (та же видимость игры, позиции раз в 16 тиков, до планта).
Берутся встречи, которые кончились без смерти («ушли из вида»). Для каждой стороны: где был соперник в последний
момент видимости и насколько он сдвинулся через 2/5/10/20/40 с (если жив и раунд идёт). Доли: остался (<150 px),
рядом (150–300), ушёл (>300). Это то, насколько верна гипотеза «остался на месте» спустя Δt.
python3 tools/measure/audit/memory_bake.py pro              → runs/memory_pro.json (долго: 88 демок)
python3 tools/measure/audit/memory_bake.py bots <run>…      → по tools/measure/runs/<run>/rec_*.json"""
import sys, os, json, bisect, collections, math
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import vis_bake as V
DT = [2, 5, 10, 20, 40]

def collect(meta, bits, tracks_by_meta):
    out = {d: collections.Counter() for d in DT}
    for m, tracks in zip(meta, tracks_by_meta):
        smp = m['smp']; v = [bits[q[1]] == '1' for q in smp]
        for k in range(1, len(v) - 1):
            if not v[k] and v[k-1] and v[k+1]: v[k] = True
        k = 0
        while k < len(v):
            if not v[k]: k += 1; continue
            j = k
            while j + 1 < len(v) and v[j+1]: j += 1
            ts, te = smp[k][0], smp[j][0]
            dead = [x for x in (m['da'], m['db']) if x is not None and ts - 16 <= x <= te + 32]
            if not dead and j < len(v) - 1:              # встреча кончилась: перестали видеть, оба живы
                for who in (m['a'], m['b']):
                    L = tracks.get(who)
                    if not L: continue
                    i = bisect.bisect_right(L[0], te) - 1
                    if i < 0: continue
                    x0, y0 = L[1][i], L[2][i]
                    vel = math.hypot(L[1][i]-L[1][i-1], L[2][i]-L[2][i-1]) / max(1, (L[0][i]-L[0][i-1]))*64 if i > 0 else 0
                    st = 'стоял' if vel < 15 else 'шёл' if vel <= 65 else 'бежал'   # в момент, когда пропал из вида
                    for d in DT:
                        t2 = te + d*64; i2 = bisect.bisect_right(L[0], t2) - 1
                        if i2 < 0 or t2 - L[0][i2] > 32 or L[0][-1] < t2: continue   # погиб / раунд кончился
                        dd = math.hypot(L[1][i2]-x0, L[2][i2]-y0)
                        out[d]['n'] += 1; out[d]['остался <150'] += dd < 150; out[d]['рядом 150–300'] += 150 <= dd <= 300; out[d]['ушёл >300'] += dd > 300
                        out[d]['n ' + st] += 1; out[d]['<150 ' + st] += dd < 150; out[d]['<300 ' + st] += dd <= 300
            k = j + 1
    R = {}
    for d in DT:
        o = out[d]; R[d] = {'n': o['n'], 'остался <150': round(o['остался <150']/max(1, o['n']), 3), '<300': round((o['остался <150']+o['рядом 150–300'])/max(1, o['n']), 3)}
        for st in ('стоял', 'шёл', 'бежал'):
            R[d][st] = [o['n ' + st], round(o['<150 ' + st]/max(1, o['n ' + st]), 3), round(o['<300 ' + st]/max(1, o['n ' + st]), 3)]
    return R

def run_pro(sim):
    import numpy as np, pandas as pd
    from ancient_demos import DEMOS, tr, demo_names, rounds_of
    NADE = 'grenade|molotov|incgrenade|flashbang|decoy|knife|c4|bayonet'
    pairs, meta, TB = [], [], []
    for demo in demo_names():
        rounds = rounds_of(demo)
        if not rounds: continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'yaw', 'is_alive'])
        t = t[t.is_alive == True]  # noqa: E712
        x, y = tr(t.X.values, t.Y.values)
        df = pd.DataFrame({'tick': t.tick.values, 'sid': t.steamid.values, 'team': t.team_num.values, 'x': x, 'y': y, 'yaw': t.yaw.values}).sort_values('tick')
        G = {int(s): (g.tick.values, g.x.values, g.y.values, g.team.values, g.yaw.values) for s, g in df.groupby('sid')}
        d = pd.read_csv(os.path.join(DEMOS, demo + '_player_death.csv.gz'))
        wf = pd.read_csv(os.path.join(DEMOS, demo + '_weapon_fire.csv.gz'))
        wf = wf[~wf.weapon.astype(str).str.contains(NADE, case=False) & wf.user_steamid.notna()]
        shots = {int(s): sorted(g.tick.values.tolist()) for s, g in wf.groupby('user_steamid')}
        for r in rounds:
            tracks = {}
            for sid, (tt, xx, yy, tm, yw) in G.items():
                i0, i1 = np.searchsorted(tt, r['t0']), np.searchsorted(tt, r['t1'], side='right')
                if i1 > i0: tracks[sid] = (tt[i0:i1].tolist(), xx[i0:i1].tolist(), yy[i0:i1].tolist(), 'CT' if tm[i0] == 3 else 'T', (-yw[i0:i1] * math.pi / 180).tolist())
            dr = d[(d.tick >= r['t0']) & (d.tick <= r['t1'])]
            deaths = {int(u): int(tk) for tk, u in zip(dr.tick.values, dr.user_steamid.values) if u == u}
            kills = [(int(tk), int(a), int(u)) for tk, a, u in zip(dr.tick.values, dr.attacker_steamid.values, dr.user_steamid.values) if a == a and u == u]
            n0 = len(meta)
            V.build(tracks, shots, deaths, kills, r['t0'], r['t1'], r['tplant'] or r['t1'], pairs, meta)
            TB += [tracks] * (len(meta) - n0)
        print(demo, len(pairs), file=sys.stderr)
    return collect(meta, V.evaluate(pairs, sim).strip(), TB)

def run_bots(runs, sim):
    pairs, meta, TB = [], [], []
    for run in runs:
        D = os.path.join(ROOT, 'tools', 'measure', 'runs', run)
        for f in sorted(os.listdir(D)):
            if not f.startswith('rec_'): continue
            d = json.load(open(os.path.join(D, f)))
            plants = [p[0] for p in d['plants']] if d['plants'] and isinstance(d['plants'][0], list) else []
            T = {}
            for p in sorted(d['pos'], key=lambda q: q[0]):
                if not p[5]: continue
                Lp = T.setdefault((p[1], p[2]), ([], [], [], [])); Lp[0].append(p[0]); Lp[1].append(p[3]); Lp[2].append(p[4]); Lp[3].append(p[6])
            shots, seen = collections.defaultdict(list), set()
            for s in sorted(d['shots'], key=lambda q: q[0]):
                if (s[1], s[0] // 32) in seen: continue
                seen.add((s[1], s[0] // 32)); shots[s[1]].append(s[0])
            for r in d['rounds']:
                if 't1' not in r: continue
                t0, t1 = int(r['t0']), int(r['t1'])
                tracks = {}
                for (b, ct), (tt, xx, yy, ff) in T.items():
                    i0, i1 = bisect.bisect_left(tt, t0), bisect.bisect_right(tt, t1)
                    if i1 > i0: tracks[b] = (tt[i0:i1], xx[i0:i1], yy[i0:i1], 'CT' if ct == 1 else 'T', ff[i0:i1])
                ks = [k for k in d['kills'] if t0 <= k[0] <= t1]
                deaths = {k[5]: k[0] for k in ks}; kills = [(k[0], k[1], k[5]) for k in ks if k[1]]
                cut = min([p for p in plants if t0 <= p <= t1] or [t1])
                n0 = len(meta); V.build(tracks, shots, deaths, kills, t0, t1, cut, pairs, meta); TB += [tracks] * (len(meta) - n0)
    return collect(meta, V.evaluate(pairs, sim).strip(), TB)

if __name__ == '__main__':
    sim = os.path.join(ROOT, 'sim.html')
    if sys.argv[1] == 'pro':
        R = run_pro(sim); json.dump(R, open(os.path.join(HERE, 'runs', 'memory_pro.json'), 'w'), ensure_ascii=False, indent=1)
    else:
        R = run_bots(sys.argv[2:], sim)
    for d in DT: print(f'через {d:2d} с: ', R[d])
