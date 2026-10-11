"""Оценка денег команды по раундам — одинаково для демок про и записей ботов (v252, 11.10).

В демках нет денег. Доход восстанавливаем по правилам CS2 (docs/ECONOMY.md, раздел 1): победа/лосс-бонус по
счётчику, плант, дефуз, фраги по оружию, $0 живым T при выходе времени. Расход — по видимому: новое оружие в руках
(основное и пистолет), брошенные гранаты. Брони, шлемов и китов не видно — два варианта:
  low  — кевлар+шлем ($1000) только тем, кто не выжил, и только в фулле/форсе; китов нет;
  high — кевлар+шлем всем в фулле/форсе (выжившим — +$350 на ремонт), кит каждому второму CT в фулле.
Всё — на команду (дропы и подобранное оружие не искажают сумму). Половины, начатые не с первого раунда, и
овертайм пропускаются. Для ботов настоящие деньги известны — по ним проверяется погрешность оценки.
Запуск: python3 tools/eco_est.py <run ботов>"""
import sys, os, json, glob, bisect, collections
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from ancient_demos import DEMOS, demo_names, rounds_of, event  # noqa: E402
from ct_cmp import wcls, rtype  # noqa: E402

# имя оружия (демка: «M4A1-S», 'm4a1_silencer'; бот: 'M4S') → ключ
ALIAS = {'ak-47': 'AK', 'ak47': 'AK', 'm4a1-s': 'M4S', 'm4a1_silencer': 'M4S', 'm4a4': 'M4', 'm4a1': 'M4', 'awp': 'AWP',
         'famas': 'FAMAS', 'galil ar': 'GALIL', 'galilar': 'GALIL', 'aug': 'AUG', 'sg 553': 'SG', 'sg556': 'SG',
         'ssg 08': 'SSG', 'ssg08': 'SSG', 'mp9': 'MP9', 'mac-10': 'MAC10', 'mac10': 'MAC10', 'mp7': 'MP7',
         'ump-45': 'UMP', 'ump45': 'UMP', 'p90': 'P90', 'mp5-sd': 'MP5', 'mp5sd': 'MP5', 'pp-bizon': 'BIZON', 'bizon': 'BIZON',
         'nova': 'NOVA', 'xm1014': 'XM', 'mag-7': 'MAG7', 'mag7': 'MAG7', 'sawed-off': 'SAWED', 'sawedoff': 'SAWED',
         'negev': 'NEGEV', 'm249': 'M249', 'p250': 'P250', 'five-seven': 'FIVE7', 'fiveseven': 'FIVE7', 'tec-9': 'TEC9',
         'tec9': 'TEC9', 'cz75-auto': 'CZ', 'cz75a': 'CZ', 'desert eagle': 'DEAGLE', 'deagle': 'DEAGLE',
         'dual berettas': 'ELITE', 'elite': 'ELITE', 'r8 revolver': 'R8', 'revolver': 'R8', 'usp-s': 'USP',
         'usp_silencer': 'USP', 'p2000': 'USP', 'hkp2000': 'USP', 'glock-18': 'GLOCK', 'glock': 'GLOCK',
         'hegrenade': 'HE', 'he': 'HE', 'inferno': 'MOLOTOV', 'molotov': 'MOLOTOV', 'zeus x27': 'ZEUS', 'taser': 'ZEUS'}
PRICE = {'AK': 2700, 'M4S': 2900, 'M4': 2900, 'AWP': 4750, 'FAMAS': 1950, 'GALIL': 1800, 'AUG': 3300, 'SG': 3000,
         'SSG': 1700, 'MP9': 1250, 'MAC10': 1050, 'MP7': 1500, 'UMP': 1200, 'P90': 2350, 'MP5': 1500, 'BIZON': 1400,
         'NOVA': 1050, 'XM': 2000, 'MAG7': 1300, 'SAWED': 1100, 'NEGEV': 1700, 'M249': 5200, 'P250': 300, 'FIVE7': 500,
         'TEC9': 500, 'CZ': 500, 'DEAGLE': 700, 'ELITE': 300, 'R8': 600}
PISTOL = {'P250', 'FIVE7', 'TEC9', 'CZ', 'DEAGLE', 'ELITE', 'R8'}
NADE_PRICE = {'smoke': 300, 'flash': 200, 'he': 300, 'molly': 400}
LOSS = [1400, 1900, 2400, 2900, 3400]


def key(w):
    w = str(w).replace('weapon_', '')
    if w.upper() in PRICE or w.upper() in ('USP', 'GLOCK', 'HE', 'MOLOTOV', 'KNIFE', 'ZEUS'): return w.upper()
    lw = w.lower()
    if 'knife' in lw or 'bayonet' in lw or 'karambit' in lw or 'dagger' in lw: return 'KNIFE'
    return ALIAS.get(lw)


def reward(k):
    if k is None: return 0
    if k == 'KNIFE': return 1500
    if k in ('AWP', 'ZEUS', 'CZ'): return 100
    if k in ('P90',): return 300
    if k in ('MP9', 'MAC10', 'MP7', 'UMP', 'MP5', 'BIZON', 'XM'): return 600
    if k in ('NOVA', 'MAG7', 'SAWED'): return 900
    return 300


def best_primary(ws):
    ks = [key(w) for w in ws]; ks = [k for k in ks if k in PRICE and k not in PISTOL]
    return max(ks, key=lambda k: PRICE[k]) if ks else None


def best_pistol(ws):
    ks = [key(w) for w in ws]; ks = [k for k in ks if k in PISTOL]
    return max(ks, key=lambda k: PRICE[k]) if ks else None


def simulate(rounds):
    """rounds: список половин; половина — список раундов-словарей (см. pro_rounds/bot_rounds).
    → по каждому раунду: оценка денег команды до закупа и после (low/high) + тип закупа."""
    out = []
    for half in rounds:
        money = {'CT': 800*5, 'T': 800*5}; cnt = {'CT': 1, 'T': 1}; carry = {}
        lo = dict(money); hi = dict(money)
        for r in half:
            rec = {'r': r, 'pre_lo': dict(lo), 'pre_hi': dict(hi)}
            for side in ('CT', 'T'):
                sp_lo = sp_hi = 0; typ = r['type'][side]
                for pid, (s, prim, pist) in r['start'].items():
                    if s != side: continue
                    had = carry.get(pid, (None, None, False))
                    if prim and prim != had[0]: sp_lo += PRICE[prim]; sp_hi += PRICE[prim]
                    if pist and pist != had[1]: sp_lo += PRICE[pist]; sp_hi += PRICE[pist]
                    if typ in ('фулл', 'форс') and not r['pistol']:
                        if not had[2]: sp_lo += 1000 if typ == 'фулл' else 650; sp_hi += 1000
                        else: sp_hi += 350
                if r['pistol']: sp_lo += 0; sp_hi += 650*2   # пистолетка: часть берёт кевлар
                if side == 'CT' and typ == 'фулл': sp_hi += 400*2
                nd = sum(NADE_PRICE[n] if not (n == 'molly' and side == 'CT') else 500 for n in r['nades'][side])
                sp_lo += nd; sp_hi += nd
                lo[side] = max(0, lo[side] - sp_lo); hi[side] = max(0, hi[side] - sp_hi)
            rec['post_lo'] = dict(lo); rec['post_hi'] = dict(hi)
            # доход
            for side in ('CT', 'T'):
                won = r['winner'] == side
                if won: inc = 5*(3500 if (side == 'T' and r['reason'] == 'bomb') or (side == 'CT' and r['reason'] == 'defuse') else 3250)
                else:
                    inc = 5*LOSS[min(4, cnt[side])]
                    if side == 'T' and r['planted']: inc += 5*600
                    if side == 'T' and r['reason'] == 'time' and not r['planted']: inc -= LOSS[min(4, cnt[side])]*r['alive_end']['T']
                if side == 'T' and r['planted']: inc += 300
                if side == 'CT' and r['reason'] == 'defuse': inc += 300
                inc += sum(reward(k) if a == side and v != side else (-300 if a == side else 0) for a, v, k in r['kills'])
                lo[side] = min(16000*5, lo[side] + inc); hi[side] = min(16000*5, hi[side] + inc)
                cnt[side] = max(0, cnt[side]-1) if won else min(4, cnt[side]+1)
            carry = {pid: v for pid, v in r['end'].items()}
            out.append(rec)
    return out


def pro_rounds():
    halves = []
    for demo in demo_names():
        rs = rounds_of(demo)
        if not rs: continue
        t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'is_alive', 'active_weapon_name'])
        t = t[t.is_alive == True].sort_values('tick')  # noqa: E712
        G = {int(s): (g.tick.values, g.team_num.values, g.active_weapon_name.values) for s, g in t.groupby('steamid')}
        d = event(demo, 'player_death'); re_ = event(demo, 'round_end'); wf = event(demo, 'weapon_fire'); df = event(demo, 'bomb_defused')
        byn = {r['num']: r for r in rs}
        for start in (0, 12):
            if start not in byn: continue
            half = []
            for num in range(start, start + 12):
                r = byn.get(num)
                if r is None: break
                t0, t1 = r['t0'], r['t1']
                e = re_[(re_.tick > t0) & (re_.tick <= t1 + 1)]
                if not len(e): break
                w = str(e.winner.iloc[0]); winner = 'CT' if w in ('3', 'CT') else 'T'
                rs_ = str(e.reason.iloc[0])
                reason = 'bomb' if rs_ == 'bomb_exploded' else 'defuse' if rs_ == 'bomb_defused' else 'time' if rs_ == 'time_ran_out' else 'elim'
                start_, end_, cls = {}, {}, {'CT': [], 'T': []}; alive_T = 0
                for i, (tt, tm, ww) in G.items():
                    k0, k1 = np.searchsorted(tt, t0), np.searchsorted(tt, t0 + 30*64)
                    if k1 > k0:
                        sd = 'CT' if tm[k0] == 3 else 'T'
                        start_[i] = (sd, best_primary(ww[k0:k1]), best_pistol(ww[k0:k1])); cls[sd].append(max(wcls(v) for v in ww[k0:k1]))
                    ke = np.searchsorted(tt, t1, side='right') - 1
                    if ke >= 0 and t1 - tt[ke] <= 64:
                        k2 = np.searchsorted(tt, t1 - 30*64)
                        end_[i] = (best_primary(ww[k2:ke+1]), best_pistol(ww[k2:ke+1]), True)
                        if tm[ke] == 2: alive_T += 1
                dr = d[(d.tick >= t0) & (d.tick <= t1)]
                kills = [('CT' if a == 3 else 'T', 'CT' if v == 3 else 'T', key(k)) for a, v, k in zip(dr.attacker_team_num, dr.user_team_num, dr.weapon) if a in (2, 3)]
                fr = wf[(wf.tick >= t0) & (wf.tick <= t1)]
                NM = {'weapon_smokegrenade': 'smoke', 'weapon_flashbang': 'flash', 'weapon_hegrenade': 'he', 'weapon_molotov': 'molly', 'weapon_incgrenade': 'molly'}
                nades = {'CT': [NM[x] for x in fr[fr.user_team_num == 3].weapon.astype(str) if x in NM],
                         'T': [NM[x] for x in fr[fr.user_team_num == 2].weapon.astype(str) if x in NM]}
                half.append({'id': r['rid'], 'num': num - start, 'pistol': num in (0, 12), 'winner': winner, 'reason': reason,
                             'planted': bool(r['tplant']), 'kills': kills, 'nades': nades, 'start': start_, 'end': end_,
                             'alive_end': {'T': alive_T}, 'type': {s: rtype(cls[s]) for s in cls}})
            if len(half) >= 6: halves.append(half)
    return halves


def bot_rounds(run):
    halves, truth = [], {}
    for f in sorted(glob.glob(os.path.join(HERE, 'measure', 'runs', run, 'rec_*.json'))):
        d = json.load(open(f)); m = os.path.basename(f)
        T = {}
        for p in sorted(d['pos'], key=lambda q: q[0]):
            if not p[5]: continue
            L = T.setdefault(p[1], ([], [], [])); L[0].append(p[0]); L[1].append('CT' if p[2] == 1 else 'T'); L[2].append(p[7])
        R = [r for r in d['rounds'] if 't1' in r]
        for start in (1, 13):
            half = []
            for r in R:
                if not (start <= r['r'] < start + 12): continue
                t0, t1 = int(r['t0']), int(r['t1'])
                start_, end_, cls = {}, {}, {'CT': [], 'T': []}; alive_T = 0
                for i, L in T.items():
                    k0, k1 = bisect.bisect_left(L[0], t0), bisect.bisect_left(L[0], t0 + 30*64)
                    if k1 > k0:
                        sd = L[1][k0]; start_[i] = (sd, best_primary(L[2][k0:k1]), best_pistol(L[2][k0:k1])); cls[sd].append(max(wcls(v) for v in L[2][k0:k1]))
                    ke = bisect.bisect_right(L[0], t1) - 1
                    if ke >= 0 and t1 - L[0][ke] <= 64:
                        k2 = bisect.bisect_left(L[0], t1 - 30*64)
                        end_[i] = (best_primary(L[2][k2:ke+1]), best_pistol(L[2][k2:ke+1]), True)
                        if L[1][ke] == 'T': alive_T += 1
                kills = [(k[2], k[6], key(k[9])) for k in d['kills'] if t0 <= k[0] <= t1 and k[2]]
                nades = {'CT': [n[2] for n in d['nades'] if t0 <= n[0] <= t1 and n[1] == 'CT'], 'T': [n[2] for n in d['nades'] if t0 <= n[0] <= t1 and n[1] == 'T']}
                rid = '%s|%d' % (m, r['r'])
                truth[rid] = {s: sum(x[9] for x in d['buys'] if x[0] == r['r'] and x[2] == s) for s in ('CT', 'T')}
                half.append({'id': rid, 'num': r['r'] - start, 'pistol': r['r'] == start, 'winner': r['winner'], 'reason': r.get('reason'),
                             'planted': r.get('bomb') in ('planted', 'exploded', 'defused'), 'kills': kills, 'nades': nades,
                             'start': start_, 'end': end_, 'alive_end': {'T': alive_T},
                             'type': {s: rtype(cls[s]) for s in cls}})
            if len(half) >= 6: halves.append(half)
    return halves, truth


def report(name, sim, truth=None):
    print(f'== {name}: раундов {len(sim)}')
    if truth:
        e_lo = [rec['post_lo']['CT'] - truth[rec['r']['id']]['CT'] for rec in sim if rec['r']['id'] in truth]
        e_hi = [rec['post_hi']['CT'] - truth[rec['r']['id']]['CT'] for rec in sim if rec['r']['id'] in truth]
        tr_ = [truth[rec['r']['id']]['CT'] for rec in sim if rec['r']['id'] in truth]
        print(f'  проверка: CT после закупа — настоящие медиана ${np.median(tr_):.0f}; ошибка оценки low {np.median(e_lo):+.0f} '
              f'(IQR {np.percentile(e_lo,25):+.0f}..{np.percentile(e_lo,75):+.0f}), high {np.median(e_hi):+.0f} '
              f'(IQR {np.percentile(e_hi,25):+.0f}..{np.percentile(e_hi,75):+.0f}) — на команду')
    full = [rec for rec in sim if rec['r']['type']['CT'] == 'фулл' and not rec['r']['pistol']]
    f = lambda xs: f'{np.median(xs)/5:.0f}'
    print(f"  CT фулл: денег до закупа на игрока {f([x['pre_lo']['CT'] for x in full])}–{f([x['pre_hi']['CT'] for x in full])}, "
          f"после закупа {f([x['post_hi']['CT'] for x in full])}–{f([x['post_lo']['CT'] for x in full])} (n {len(full)})")
    nxt = []
    for a, b in zip(sim, sim[1:]):
        if a['r']['type']['CT'] == 'фулл' and a['r']['winner'] == 'T' and b['r']['num'] == a['r']['num'] + 1: nxt.append((a, b))
    print(f"  после проигранного фулла CT: денег до закупа на игрока {f([b['pre_lo']['CT'] for a, b in nxt])}–{f([b['pre_hi']['CT'] for a, b in nxt])} (n {len(nxt)})")
    for typ in ('фулл', 'форс', 'эко'):
        xs = [b for a, b in nxt if b['r']['type']['CT'] == typ]
        if xs: print(f"    → {typ} {len(xs)/len(nxt):.0%}: до закупа {f([b['pre_lo']['CT'] for b in xs])}–{f([b['pre_hi']['CT'] for b in xs])}")
    # сколько денег оставляли в проигранном фулле (до этого раунда)
    print(f"  остаток после закупа в проигранном фулле: {f([a['post_hi']['CT'] for a, b in nxt])}–{f([a['post_lo']['CT'] for a, b in nxt])}")


if __name__ == '__main__':
    bh, truth = bot_rounds(sys.argv[1])
    report('боты ' + sys.argv[1], simulate(bh), truth)
    report('про', simulate(pro_rounds()))
