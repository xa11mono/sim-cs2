"""Защита сайта CT и экономика — про против ботов (v252, замер). Один классификатор для демок и ботов.

Сайт: центры A/B — средняя точка планта по демкам. Считается: плант %; на 25-й с раунда — сколько CT ближе SITE_R к
каждому сайту; в момент планта — живые CT/T, CT ближе SITE_R к месту планта; за 10 с до планта — сколько CT было на этом
сайте; CT, погибшие до планта на этом сайте; первый CT, пришедший на сайт после планта (с), если его там не было.
Экономика: тип закупа команды по оружию в руках за первые 30 с (лучшее оружие игрока): фулл — 4+ с винтовкой/AWP,
эко — у 4+ только пистолет, иначе форс. Переходы CT: тип после проигранного раунда по типу прошлого раунда.
Запуск: python3 tools/ct_cmp.py <run> [<run> …]"""
import json, os, sys, bisect, math, collections
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ancient_demos import DEMOS, tr, demo_names, rounds_of, event  # noqa: E402
SITE_R = 450
RIFLE = ('ak47', 'm4a1', 'm4a1_silencer', 'm4a4', 'galilar', 'famas', 'aug', 'sg556', 'awp', 'ssg08', 'AK', 'M4', 'M4A1', 'M4A4', 'GALIL', 'FAMAS', 'AUG', 'SG', 'AWP', 'SSG', 'SCOUT', 'M4S')
SMG = ('mac10', 'mp9', 'mp7', 'ump45', 'p90', 'bizon', 'mp5sd', 'xm1014', 'nova', 'mag7', 'sawedoff', 'negev', 'm249',
       'MAC10', 'MP9', 'MP7', 'UMP', 'P90', 'BIZON', 'MP5', 'XM', 'NOVA', 'MAG7', 'SMG')


DEMO_RIFLE = {'AK-47', 'M4A1-S', 'M4A4', 'Galil AR', 'FAMAS', 'AUG', 'SG 553', 'AWP', 'SSG 08'}   # как в player_positions_bake.py
DEMO_SMG = {'MP9', 'MAC-10', 'MP7', 'UMP-45', 'P90', 'PP-Bizon', 'MP5-SD', 'XM1014', 'Nova', 'MAG-7', 'Sawed-Off', 'Negev', 'M249'}


def wcls(w):
    if w in DEMO_RIFLE: return 2
    if w in DEMO_SMG: return 1
    w = str(w).replace('weapon_', '')
    if any(w == r or w.upper() == r.upper() for r in RIFLE): return 2
    if any(w == r or w.upper() == r.upper() for r in SMG): return 1
    return 0


def rtype(best):   # best: [класс лучшего оружия] по игрокам команды
    if sum(1 for b in best if b == 2) >= 4: return 'фулл'
    if sum(1 for b in best if b == 0) >= 4: return 'эко'
    return 'форс'


def new():
    return {'n': 0, 'plant': 0, 'ct25': collections.Counter(), 'atplant': collections.defaultdict(list),
            'arrive': [], 'eco': collections.Counter(), 'trans': collections.Counter(), 'vs': collections.Counter()}


def round_stats(S, pos_at, alive_ids, t0, t1, tplant, pxy, site_c, deaths, winner, best, prev):
    """pos_at(id, tick) → (x, y, side) живого; alive_ids(tick) → [(id, side)]"""
    S['n'] += 1
    for sd in ('A', 'B'):
        c = site_c[sd]
        S['ct25'][sd] += sum(1 for i, s in alive_ids(t0 + 25*64) if s == 'CT' and (p := pos_at(i, t0 + 25*64)) and math.hypot(p[0]-c[0], p[1]-c[1]) < SITE_R)
    if tplant:
        S['plant'] += 1
        al = alive_ids(tplant)
        S['atplant']['CT живых'].append(sum(1 for i, s in al if s == 'CT'))
        S['atplant']['T живых'].append(sum(1 for i, s in al if s == 'T'))
        near = lambda tk: [i for i, s in alive_ids(tk) if s == 'CT' and (p := pos_at(i, tk)) and math.hypot(p[0]-pxy[0], p[1]-pxy[1]) < SITE_R]
        S['atplant']['CT на сайте при планте'].append(len(near(tplant)))
        before = near(tplant - 10*64)
        S['atplant']['CT на сайте за 10 с до планта'].append(len(before))
        S['atplant']['CT погибли на сайте до планта'].append(sum(1 for (tk, x, y, sd) in deaths if sd == 'CT' and tk < tplant and math.hypot(x-pxy[0], y-pxy[1]) < SITE_R))
        if not near(tplant):
            for tk in range(tplant, t1, 16):
                if near(tk): S['arrive'].append((tk - tplant)/64); break
    ct, t = rtype(best['CT']), rtype(best['T'])
    S['eco'][('CT', ct)] += 1; S['eco'][('T', t)] += 1
    S['vs'][(ct, t, winner)] += 1
    if prev and prev['winner'] == 'T': S['trans'][(prev['ct'], ct)] += 1
    return {'ct': ct, 'winner': winner}


def pro():
    S = new(); plants = collections.defaultdict(list); R = []
    for demo in demo_names():
        for r in rounds_of(demo):
            if r['tplant'] and r['site']: plants[r['site']].append(tr(*r['plantXY']))
    site_c = {s: tuple(np.mean(plants[s], axis=0)) for s in ('A', 'B')}
    for demo in demo_names():
        rounds = rounds_of(demo)
        if not rounds: continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'is_alive', 'active_weapon_name'])
        t = t[t.is_alive == True]  # noqa: E712
        x, y = tr(t.X.values, t.Y.values)
        df = pd.DataFrame({'tick': t.tick.values, 'sid': t.steamid.values, 'team': t.team_num.values, 'x': x, 'y': y, 'w': t.active_weapon_name.values}).sort_values('tick')
        G = {int(s): (g.tick.values, g.x.values, g.y.values, g.team.values, g.w.values) for s, g in df.groupby('sid')}
        d = event(demo, 'player_death'); re_ = event(demo, 'round_end')
        prev = None
        for r in rounds:
            def pos_at(i, tk):
                tt, xx, yy, tm, _ = G[i]; k = np.searchsorted(tt, tk, side='right') - 1
                if k < 0 or tk - tt[k] > 32: return None
                return xx[k], yy[k], ('CT' if tm[k] == 3 else 'T')
            def alive_ids(tk):
                return [(i, p[2]) for i in G if (p := pos_at(i, tk))]
            dr = d[(d.tick >= r['t0']) & (d.tick <= r['t1'])]
            deaths = [(int(tk), *tr(ux, uy), 'CT' if ut == 3 else 'T') for tk, ux, uy, ut in zip(dr.tick.values, dr.user_X.values, dr.user_Y.values, dr.user_team_num.values) if ux == ux]
            e = re_[(re_.tick > r['t0']) & (re_.tick <= r['t1'] + 1)]
            w = str(e.winner.iloc[0]) if len(e) else '?'
            winner = 'CT' if w in ('3', 'CT') else 'T' if w in ('2', 'T') else '?'
            best = {'CT': [], 'T': []}
            for i, (tt, xx, yy, tm, ww) in G.items():
                k0, k1 = np.searchsorted(tt, r['t0']), np.searchsorted(tt, r['t0'] + 30*64)
                if k1 > k0: best['CT' if tm[k0] == 3 else 'T'].append(max(wcls(v) for v in ww[k0:k1]))
            pxy = tr(*r['plantXY']) if r['tplant'] else None
            prev = round_stats(S, pos_at, alive_ids, r['t0'], r['t1'], r['tplant'], pxy, site_c, deaths, winner, best, prev)
        print(demo, file=sys.stderr)
    S['site'] = collections.Counter(r['site'] for demo in demo_names() for r in rounds_of(demo) if r['tplant'])
    return S


def bots(runs):
    S = new(); plants = collections.defaultdict(list)
    files = [os.path.join(HERE, 'measure', 'runs', run, f) for run in runs for f in sorted(os.listdir(os.path.join(HERE, 'measure', 'runs', run))) if f.startswith('rec_')]
    for f in files:
        d = json.load(open(f))
        for p in d['plants']: plants[p[1]].append((p[2], p[3]))
    site_c = {s: tuple(np.mean(plants[s], axis=0)) for s in ('A', 'B')}
    for f in files:
        d = json.load(open(f))
        T = {}
        for p in sorted(d['pos'], key=lambda q: q[0]):
            if not p[5]: continue
            L = T.setdefault(p[1], ([], [], [], [], [])); L[0].append(p[0]); L[1].append(p[3]); L[2].append(p[4]); L[3].append('CT' if p[2] == 1 else 'T'); L[4].append(p[7])
        def pos_at(i, tk):
            tt = T[i][0]; k = bisect.bisect_right(tt, tk) - 1
            if k < 0 or tk - tt[k] > 32: return None
            return T[i][1][k], T[i][2][k], T[i][3][k]
        def alive_ids(tk): return [(i, p[2]) for i in T if (p := pos_at(i, tk))]
        prev = None
        for r in d['rounds']:
            if 't1' not in r: continue
            t0, t1 = int(r['t0']), int(r['t1'])
            pl = [p for p in d['plants'] if t0 <= p[0] <= t1]
            deaths = [(k[0], k[7], k[8], k[6]) for k in d['kills'] if t0 <= k[0] <= t1]
            best = {'CT': [], 'T': []}
            for i, L in T.items():
                k0, k1 = bisect.bisect_left(L[0], t0), bisect.bisect_left(L[0], t0 + 30*64)
                if k1 > k0: best[L[3][k0]].append(max(wcls(v) for v in L[4][k0:k1]))
            if pl: S.setdefault('site', collections.Counter())[pl[0][1]] += 1
            prev = round_stats(S, pos_at, alive_ids, t0, t1, pl[0][0] if pl else None, (pl[0][2], pl[0][3]) if pl else None, site_c, deaths, r.get('winner'), best, prev)
    return S


def show(P, B):
    f = lambda S, k: np.mean(S['atplant'][k]) if S['atplant'][k] else float('nan')
    print(f"плант % раундов: {P['plant']/P['n']:.0%} | {B['plant']/B['n']:.0%}  (про | боты)")
    print(f"планты на B: {P['site']['B']/sum(P['site'].values()):.0%} | {B['site']['B']/sum(B['site'].values()):.0%}")
    for sd in ('A', 'B'): print(f"CT ближе {SITE_R} px к сайту {sd} на 25-й с, в среднем: {P['ct25'][sd]/P['n']:.2f} | {B['ct25'][sd]/B['n']:.2f}")
    for k in ('CT живых', 'T живых', 'CT на сайте за 10 с до планта', 'CT на сайте при планте', 'CT погибли на сайте до планта'):
        print(f'при планте — {k}: {f(P, k):.2f} | {f(B, k):.2f}')
    print(f"после планта первый CT на сайте (если не было), медиана с: {np.median(P['arrive']):.1f} | {np.median(B['arrive']):.1f}  (n {len(P['arrive'])} | {len(B['arrive'])})")
    for sd in ('CT', 'T'):
        tp, tb = sum(v for (s, _), v in P['eco'].items() if s == sd), sum(v for (s, _), v in B['eco'].items() if s == sd)
        print(f'экономика {sd} фулл/форс/эко: ' + ' / '.join(f"{P['eco'][(sd, x)]/tp:.0%}" for x in ('фулл', 'форс', 'эко')) + ' | ' + ' / '.join(f"{B['eco'][(sd, x)]/tb:.0%}" for x in ('фулл', 'форс', 'эко')))
    for pv in ('фулл', 'форс', 'эко'):
        tp, tb = sum(P['trans'][(pv, x)] for x in ('фулл', 'форс', 'эко')), sum(B['trans'][(pv, x)] for x in ('фулл', 'форс', 'эко'))
        print(f'CT проиграл раунд с «{pv}» → следующий фулл/форс/эко: ' + ' / '.join(f"{P['trans'][(pv, x)]/max(1, tp):.0%}" for x in ('фулл', 'форс', 'эко')) + f' (n {tp}) | ' + ' / '.join(f"{B['trans'][(pv, x)]/max(1, tb):.0%}" for x in ('фулл', 'форс', 'эко')) + f' (n {tb})')
    for ct, t in (('фулл', 'фулл'), ('форс', 'фулл'), ('эко', 'фулл'), ('фулл', 'форс'), ('фулл', 'эко')):
        def wr(S):
            w, n = S['vs'][(ct, t, 'CT')], S['vs'][(ct, t, 'CT')] + S['vs'][(ct, t, 'T')]
            return f'{w/max(1, n):.0%} (n {n})'
        print(f'CT {ct} против T {t}: CT выиграли {wr(P)} | {wr(B)}')


if __name__ == '__main__':
    B = bots(sys.argv[1:]); P = pro(); show(P, B)
