"""Встречи «видят друг друга» у про и у ботов (v251): одна и та же проверка видимости из игры (hasLOS, 3D; дым не учитывается).

Пары: каждый выстрел игрока (до планта) — с ближайшим врагом ≤ 900 px, окно −6…+4 с; каждый фраг — убийца и жертва, −6…+1 с.
Позиции раз в 16 тиков (и в демках, и у ботов), выстрелы прорежены как в демках (один на игрока за 0,5 с).
Встреча — подряд идущие отсчёты, когда пара видит друг друга (один пропуск отсчёта склеивается). Встречи, упёршиеся в край окна, не считаются.
Считается: доля встреч со стрельбой; чем кончилась встреча со стрельбой — смертью или «ушли из вида»; через сколько от начала
встречи первый выстрел и смерть; сколько длится встреча без смерти; выиграл ли тот, кто выстрелил первым.

Запуск: python3 tools/vis_bake.py              — демки → src/data/trades.json поле vis
        python3 tools/vis_bake.py --bots <run>…  — боты (tools/measure/runs/<run>), сравнение с про"""
import json, os, sys, math, bisect, collections, subprocess, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
R_PAIR = 900


def build(tracks, shots, deaths, kills, t0, t1, cut, out_pairs, meta):
    """tracks: id → (ticks, xs, ys, side) за раунд; shots: id → тики; deaths: id → тик смерти; kills: [(тик, a, v)]."""
    def at(b, tk):
        L = tracks.get(b)
        if not L: return None
        i = bisect.bisect_right(L[0], tk) - 1
        if i < 0 or tk - L[0][i] > 32: return None
        return L[1][i], L[2][i]
    side = {b: v[3] for b, v in tracks.items()}
    iv = collections.defaultdict(list)
    for b, sh in shots.items():
        if b not in side: continue
        for t in sh:
            if not (t0 <= t < cut): continue
            p = at(b, t)
            if not p: continue
            foes = [(math.hypot(q[0]-p[0], q[1]-p[1]), o) for o in side if side[o] != side[b] and (q := at(o, t))]
            if not foes: continue
            d, o = min(foes)
            if d <= R_PAIR: iv[tuple(sorted((b, o)))].append((t - 6*64, t + 4*64))
    for (t, a, v) in kills:
        if t0 <= t < cut and a in side and v in side and side[a] != side[v]:
            iv[tuple(sorted((a, v)))].append((t - 6*64, t + 64))
    for pair, L in iv.items():
        L.sort(); M = [list(L[0])]
        for s, e in L[1:]:
            if s <= M[-1][1]: M[-1][1] = max(M[-1][1], e)
            else: M.append([s, e])
        a, b = pair
        for s, e in M:
            s, e = max(s, t0), min(e, t1)
            ticks = [t for t in tracks[a][0] if s <= t <= e]
            smp = []
            for t in ticks:
                pa, pb = at(a, t), at(b, t)
                if not pa or not pb: continue
                smp.append((t, len(out_pairs), math.hypot(pa[0]-pb[0], pa[1]-pb[1])))
                out_pairs.append([round(pa[0], 1), round(pa[1], 1), round(pb[0], 1), round(pb[1], 1)])
            if len(smp) >= 2:
                meta.append({'a': a, 'b': b, 'side': side[a], 's': s, 'e': e, 'smp': smp,
                             'sa': [t for t in shots.get(a, ()) if s - 64 <= t <= e + 64],
                             'sb': [t for t in shots.get(b, ()) if s - 64 <= t <= e + 64],
                             'da': deaths.get(a), 'db': deaths.get(b)})


def evaluate(pairs, sim):
    d = tempfile.mkdtemp()
    fi, fo = os.path.join(d, 'in.json'), os.path.join(d, 'out.txt')
    json.dump(pairs, open(fi, 'w'))
    subprocess.run(['node', os.path.join(HERE, 'los_eval.js'), sim, fi, fo], check=True)
    return open(fo).read()


def stats(meta, bits):
    S = collections.Counter(); L = collections.defaultdict(list)
    for m in meta:
        smp = m['smp']; v = [bits[i] == '1' for (_, i, _) in smp]
        # один пропуск склеиваем
        for k in range(1, len(v) - 1):
            if not v[k] and v[k-1] and v[k+1]: v[k] = True
        k = 0
        while k < len(v):
            if not v[k]: k += 1; continue
            j = k
            while j + 1 < len(v) and v[j+1]: j += 1
            ts, te = smp[k][0], smp[j][0]; dist = smp[k][2]
            dead = [x for x in (m['da'], m['db']) if x is not None and ts - 16 <= x <= te + 32]
            if (k == 0 and not dead and ts <= m['s'] + 16) or (j == len(v) - 1 and not dead):
                k = j + 1; continue          # упёрлась в край окна
            sh_a = [t for t in m['sa'] if ts - 16 <= t <= te + 32]; sh_b = [t for t in m['sb'] if ts - 16 <= t <= te + 32]
            bk = '<250' if dist < 250 else '250-450' if dist < 450 else '450+'
            S['встреч'] += 1; S['встреч ' + bk] += 1
            if not sh_a and not sh_b:
                S['без стрельбы'] += 1; k = j + 1; continue
            S['со стрельбой'] += 1; S['со стрельбой ' + bk] += 1
            first = min(sh_a + sh_b); L['до первого выстрела'].append(max(0, first - ts) / 64)
            if dead:
                S['кончилась смертью'] += 1; S['смертью ' + bk] += 1
                L['до смерти'].append(max(0, min(dead) - ts) / 64); L['до смерти ' + bk].append(max(0, min(dead) - ts) / 64)
                fa = min(sh_a) if sh_a else 1e18; fb = min(sh_b) if sh_b else 1e18
                first_is_a = fa <= fb
                died_a = m['da'] is not None and m['da'] in dead and (m['db'] not in dead or m['da'] <= m['db'])
                S['первый выстреливший выжил'] += (first_is_a != died_a)
            else:
                S['ушли из вида'] += 1
                L['видели друг друга без смерти'].append((te - ts) / 64 + 0.25); L['без смерти ' + bk].append((te - ts) / 64 + 0.25)
            k = j + 1
    n = max(1, S['со стрельбой']); md = lambda k: round(float(np.median(L[k])), 3) if L[k] else None
    return {'встреч': S['встреч'], 'без стрельбы': S['без стрельбы'] / max(1, S['встреч']),
            'со стрельбой: кончилась смертью': S['кончилась смертью'] / n,
            'со стрельбой: ушли из вида без смерти': S['ушли из вида'] / n,
            'смертью по дистанции <250 / 250-450 / 450+': [round(S['смертью ' + b] / max(1, S['со стрельбой ' + b]), 3) for b in ('<250', '250-450', '450+')],
            'от начала встречи до первого выстрела, медиана с': md('до первого выстрела'),
            'от начала встречи до смерти, медиана с': md('до смерти'),
            'видели друг друга без смерти, медиана с': md('видели друг друга без смерти'),
            'до смерти по дистанции, медиана с': [md('до смерти ' + b) for b in ('<250', '250-450', '450+')],
            'видели без смерти по дистанции, медиана с': [md('без смерти ' + b) for b in ('<250', '250-450', '450+')],
            'видели без смерти, квантили 10/25/50/75/90 с': [round(float(q), 3) for q in np.quantile(L['видели друг друга без смерти'], [0.1, 0.25, 0.5, 0.75, 0.9])] if L['видели друг друга без смерти'] else None,
            'доля встреч по дистанции <250 / 250-450 / 450+': [round(S['со стрельбой ' + b] / n, 3) for b in ('<250', '250-450', '450+')],
            'первый выстреливший выжил': S['первый выстреливший выжил'] / max(1, S['кончилась смертью'])}


def pro(sim):
    import pandas as pd
    sys.path.insert(0, HERE)
    from ancient_demos import DEMOS, tr, demo_names, rounds_of
    NADE = 'grenade|molotov|incgrenade|flashbang|decoy|knife|c4|bayonet'
    pairs, meta = [], []
    for demo in demo_names():
        rounds = rounds_of(demo)
        if not rounds: continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'is_alive'])
        t = t[t.is_alive == True]  # noqa: E712
        x, y = tr(t.X.values, t.Y.values)
        df = pd.DataFrame({'tick': t.tick.values, 'sid': t.steamid.values, 'team': t.team_num.values, 'x': x, 'y': y}).sort_values('tick')
        G = {int(s): (g.tick.values, g.x.values, g.y.values, g.team.values) for s, g in df.groupby('sid')}
        d = pd.read_csv(os.path.join(DEMOS, demo + '_player_death.csv.gz'))
        wf = pd.read_csv(os.path.join(DEMOS, demo + '_weapon_fire.csv.gz'))
        wf = wf[~wf.weapon.astype(str).str.contains(NADE, case=False) & wf.user_steamid.notna()]
        shots = {int(s): sorted(g.tick.values.tolist()) for s, g in wf.groupby('user_steamid')}
        for r in rounds:
            tracks = {}
            for sid, (tt, xx, yy, tm) in G.items():
                i0, i1 = np.searchsorted(tt, r['t0']), np.searchsorted(tt, r['t1'], side='right')
                if i1 > i0: tracks[sid] = (tt[i0:i1].tolist(), xx[i0:i1].tolist(), yy[i0:i1].tolist(), 'CT' if tm[i0] == 3 else 'T')
            dr = d[(d.tick >= r['t0']) & (d.tick <= r['t1'])]
            deaths = {int(u): int(tk) for tk, u in zip(dr.tick.values, dr.user_steamid.values) if u == u}
            kills = [(int(tk), int(a), int(u)) for tk, a, u in zip(dr.tick.values, dr.attacker_steamid.values, dr.user_steamid.values) if a == a and u == u]
            build(tracks, shots, deaths, kills, r['t0'], r['t1'], r['tplant'] or r['t1'], pairs, meta)
        print(demo, len(pairs), file=sys.stderr)
    return stats(meta, evaluate(pairs, sim))


def bots(runs, sim):
    pairs, meta = [], []
    for run in runs:
        D = os.path.join(HERE, 'measure', 'runs', run)
        for f in sorted(os.listdir(D)):
            if not f.startswith('rec_'): continue
            d = json.load(open(os.path.join(D, f)))
            plants = [p[0] for p in d['plants']] if d['plants'] and isinstance(d['plants'][0], list) else []
            T = {}
            for p in sorted(d['pos'], key=lambda q: q[0]):
                if not p[5]: continue
                Lp = T.setdefault((p[1], p[2]), ([], [], [])); Lp[0].append(p[0]); Lp[1].append(p[3]); Lp[2].append(p[4])
            shots, seen = collections.defaultdict(list), set()
            for s in sorted(d['shots'], key=lambda q: q[0]):
                if (s[1], s[0] // 32) in seen: continue
                seen.add((s[1], s[0] // 32)); shots[s[1]].append(s[0])
            for r in d['rounds']:
                if 't1' not in r: continue
                t0, t1 = int(r['t0']), int(r['t1'])
                tracks = {}
                for (b, ct), (tt, xx, yy) in T.items():
                    i0, i1 = bisect.bisect_left(tt, t0), bisect.bisect_right(tt, t1)
                    if i1 > i0: tracks[b] = (tt[i0:i1], xx[i0:i1], yy[i0:i1], 'CT' if ct == 1 else 'T')
                ks = [k for k in d['kills'] if t0 <= k[0] <= t1]
                deaths = {k[5]: k[0] for k in ks}
                kills = [(k[0], k[1], k[5]) for k in ks if k[1]]
                cut = min([p for p in plants if t0 <= p <= t1] or [t1])
                build(tracks, shots, deaths, kills, t0, t1, cut, pairs, meta)
    return stats(meta, evaluate(pairs, sim))


if __name__ == '__main__':
    sim = os.path.join(ROOT, 'sim.html')
    if len(sys.argv) > 2 and sys.argv[1] == '--bots':
        B = bots(sys.argv[2:], sim)
        P = json.load(open(os.path.join(ROOT, 'src', 'data', 'trades.json'))).get('vis', {})
        for k, v in B.items():
            print(f'{k:52} про {P.get(k)} | боты {round(v, 3) if isinstance(v, float) else v}')
    else:
        out = pro(sim)
        F = os.path.join(ROOT, 'src', 'data', 'trades.json')
        J = json.load(open(F)); J['vis'] = out; json.dump(J, open(F, 'w'), ensure_ascii=False, indent=1)
        print(json.dumps(out, ensure_ascii=False, indent=1))
