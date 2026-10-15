#!/usr/bin/env python3
"""Этап 3, P0-1: урон по окнам стрельбы — у про (88 демок: ticks.csv с health) и у ботов (hit_rec.js), одно определение.

Окно стрельбы игрока P — 32 тика (0,5 с), в которые P стрелял (как прореживание в parse_demos / peek_bake). До планта.
Цель окна — ближайший живой враг P ≤ 700 px в начале окна. Урон за окно — HP цели по отсчёту перед окном минус HP по
отсчёту через 16 тиков после окна (отсчёты раз в 16 тиков и там, и там); умерла в окне — урон = HP перед окном, «убил».
Окно не считается, если в него же по той же цели стрелял кто-то ещё из команды P (урон нельзя приписать одному).
Отдельно — «первое окно» перестрелки (P не стрелял 3 с до него) и то, ранили ли самого P в этом окне (обмен).
Корзины: дистанция <250 / 250–450 / 450+ px; P стоит (<15 px/с) / шагом / бежит (>65 px/с) по отсчётам позиции.

python3 tools/measure/audit/hit_bake.py pro            → runs/hits_pro.json
python3 tools/measure/audit/hit_bake.py bots <метка>…   → по tools/measure/audit/runs/<метка>/hit_rec_*.json"""
import sys, os, json, glob, math, bisect, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
W, R_CONTACT = 32, 700

def dbin(d): return '<250' if d < 250 else '250-450' if d < 450 else '450+'
def mbin(v): return 'стоит' if v < 15 else 'шагом' if v <= 65 else 'бежит'

class Acc:
    def __init__(s): s.C = collections.defaultdict(lambda: collections.Counter()); s.rec = []; s.killwin = set(); s.check = collections.Counter()
    def finish(s, sim):
        # видел ли P цель в начале окна (та же видимость игры, что в vis_bake): стрельба по видимой цели — отдельно
        import vis_bake as V
        bits = V.evaluate([r[6] for r in s.rec], sim).strip()
        for k, (d, v, dmg, kill, hurt, first, _) in enumerate(s.rec):
            los = 'видит' if bits[k] == '1' else 'не видит'
            for key in ((dbin(d), mbin(v)), (dbin(d), 'все'), ('все', mbin(v)), ('все', 'все')):
                s.add((los,) + key, dmg, kill, hurt)
                if first: s.add((los, 'первое окно') + key, dmg, kill, hurt)
    def add(s, key, dmg, kill, hurt):
        c = s.C[key]; c['n'] += 1; c['урон>0'] += dmg > 0; c['урон'] += dmg; c['убил'] += kill; c['ранили P'] += hurt
    def out(s):
        R = {}
        for k, c in sorted(s.C.items()):
            n = c['n']; R[' | '.join(k)] = {'окон': n, 'попал хоть раз %': round(100*c['урон>0']/n, 1), 'урон за окно': round(c['урон']/n, 1),
                                           'убил в окне %': round(100*c['убил']/n, 1), 'ранили самого P %': round(100*c['ранили P']/n, 1)}
        return R

def process(players, shots, A, t0, cut):
    """players: id → (ticks, xs, ys, hps, team); shots: id → [тики]."""
    def at(p, tk):
        L = players.get(p)
        if not L: return None
        i = bisect.bisect_right(L[0], tk) - 1
        if i < 0 or tk - L[0][i] > 16: return None
        return i
    def speed(p, i):
        L = players[p]
        if i <= 0 or L[0][i] - L[0][i-1] != 16: return None
        return math.hypot(L[1][i]-L[1][i-1], L[2][i]-L[2][i-1]) / 0.25
    def hp_after(p, tk):  # HP по первому отсчёту не раньше tk; нет отсчёта (умер) → 0
        L = players[p]; i = bisect.bisect_left(L[0], tk)
        if i >= len(L[0]) or L[0][i] - tk > 32: return 0
        return L[3][i]
    win = collections.defaultdict(set)
    for p, S in shots.items():
        for t in S:
            if t0 <= t < cut: win[p].add(t // W)
    tgt_of = {}
    for p, B in win.items():
        if p not in players: continue
        for w in B:
            ts = w*W; i = at(p, ts)
            if i is None: continue
            L = players[p]; best = None
            for o, M in players.items():
                if M[4] == L[4]: continue
                j = at(o, ts)
                if j is None or M[3][j] <= 0: continue
                d = math.hypot(M[1][j]-L[1][i], M[2][j]-L[2][i])
                if d <= R_CONTACT and (best is None or d < best[0]): best = (d, o, j)
            if best: tgt_of[(p, w)] = best
    for (p, w), (d, o, j) in tgt_of.items():
        if any(q != p and players[q][4] == players[p][4] and tgt_of.get((q, w), (0, None))[1] == o for q in win if (q, w) in tgt_of): continue
        ts = w*W; i = at(p, ts); v = speed(p, i)
        if v is None: continue
        hp0 = players[o][3][j]; hp1 = hp_after(o, ts + W + 16); kill = hp1 <= 0
        dmg = max(0, hp0 - hp1)
        php0 = players[p][3][i]; php1 = hp_after(p, ts + W + 16); hurt = php1 < php0
        first = not any(ww in win[p] for ww in range(w - 6, w))
        L = players[p]; M = players[o]
        A.rec.append((d, v, dmg, kill, hurt, first, [round(L[1][i], 1), round(L[2][i], 1), round(M[1][j], 1), round(M[2][j], 1)]))
        if kill: A.killwin.add((p, o, ts))

def run_pro():
    import numpy as np, pandas as pd
    from demos import DEMOS, tr, demo_names, rounds_of
    NADE = 'grenade|molotov|incgrenade|flashbang|decoy|knife|c4|bayonet'
    A = Acc()
    for demo in demo_names():
        rounds = rounds_of(demo)
        if not rounds: continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'health', 'is_alive'])
        t = t[t.is_alive == True].sort_values('tick')  # noqa: E712
        x, y = tr(t.X.values, t.Y.values)
        df = pd.DataFrame({'tick': t.tick.values, 'sid': t.steamid.values, 'team': t.team_num.values, 'x': x, 'y': y, 'hp': t.health.values})
        G = {int(s): (g.tick.values, g.x.values, g.y.values, g.hp.values, g.team.values) for s, g in df.groupby('sid')}
        wf = pd.read_csv(os.path.join(DEMOS, demo + '_weapon_fire.csv.gz'))
        wf = wf[~wf.weapon.astype(str).str.contains(NADE, case=False) & wf.user_steamid.notna()]
        SH = {int(s): sorted(g.tick.values.tolist()) for s, g in wf.groupby('user_steamid')}
        d = pd.read_csv(os.path.join(DEMOS, demo + '_player_death.csv.gz'))
        for r in rounds:
            players = {}
            for sid, (tt, xx, yy, hh, tm) in G.items():
                i0, i1 = np.searchsorted(tt, r['t0']), np.searchsorted(tt, r['t1'], side='right')
                if i1 > i0: players[sid] = (tt[i0:i1].tolist(), xx[i0:i1].tolist(), yy[i0:i1].tolist(), hh[i0:i1].tolist(), int(tm[i0]))
            process(players, SH, A, r['t0'], r['tplant'] or r['t1'])
            # проверка метода на известных эпизодах: каждое убийство пулей до планта (player_death) должно лечь в окно
            # убийцы, где цель = жертва и «убил» (окно может отпасть: цель не ближайшая, общий огонь, нет отсчёта скорости)
            cut = r['tplant'] or r['t1']
            dr = d[(d.tick >= r['t0']) & (d.tick < cut) & d.attacker_steamid.notna() & ~d.weapon.astype(str).str.contains(NADE + '|inferno|world', case=False)]
            for tk, a, u in zip(dr.tick.values, dr.attacker_steamid.values, dr.user_steamid.values):
                a, u, tk = int(a), int(u), int(tk)
                if a not in players or u not in players or players[a][4] == players[u][4]: continue
                A.check['убийств'] += 1
                if any((a, u, w*W) in A.killwin for w in range(tk//W - 2, tk//W + 1)): A.check['в окне убийцы с этой целью'] += 1
                elif any((a, o, w*W) in A.killwin for o in players for w in range(tk//W - 2, tk//W + 1)): A.check['окно убийцы, другая цель'] += 1
        print(demo, file=sys.stderr)
    print('проверка на убийствах:', dict(A.check), file=sys.stderr)
    if '--nolos' in sys.argv: return {'проверка': dict(A.check)}
    A.finish(os.path.join(ROOT, 'sim.html')); R = A.out(); R['проверка на убийствах'] = dict(A.check); return R

def run_bots(labels):
    A = Acc()
    for lab in labels:
        for f in sorted(glob.glob(os.path.join(HERE, 'runs', lab, 'hit_rec_*.json'))):
            d = json.load(open(f))
            P = collections.defaultdict(lambda: ([], [], [], [], None))
            T = {}
            for p in d['pos']: T.setdefault(p[1], []).append(p)
            SH = collections.defaultdict(list)
            for s in d['shots']: SH[s[1]].append(s[0])
            for r in d['rounds']:
                t0, t1 = r['t0'], r.get('t1') or 10**9
                players = {}
                for b, L in T.items():
                    S = [q for q in L if t0 <= q[0] <= t1]
                    if S: players[b] = ([q[0] for q in S], [q[3] for q in S], [q[4] for q in S], [q[5] for q in S], S[0][2])
                process(players, SH, A, t0, r.get('plant') or t1)
    A.finish(os.path.join(ROOT, 'sim.html')); return A.out()

if __name__ == '__main__':
    if sys.argv[1] == 'pro':
        R = run_pro()
        if '--nolos' not in sys.argv: json.dump(R, open(os.path.join(HERE, 'runs', 'hits_pro.json'), 'w'), ensure_ascii=False, indent=1)
    else:
        R = run_bots(sys.argv[2:])
    print(json.dumps({k: v for k, v in R.items()}, ensure_ascii=False, indent=0))
