"""В142 / В141 (13.11.2026, владелец: «проверяй всё — роли, гранаты — и доводи до ±5–6 %»): игра команд и ролей одной меркой — про и боты.
Роли — по поведению (одинаково для обеих сторон; ролей по нику у чужих команд в демках нет): энтри — первый T на сайте выхода; AWP — у кого
AWP в руках на 20-й с; опорник — CT ближе всех к сайту на 20-й с. Раунды без пистолеток.
Меры: победы T; открывающее убийство (чьё, когда; кто погиб — энтри?); размены (смерть, за которую свой убил убийцу ≤ 3 с); гранаты за
раунд по сторонам и типам; AWP — доля раундов у стороны; выход: доля, сайт, время; плант.
Запуск: python3 tools/shadow/roles_cmp.py --map mirage <папка записей ботов rec_*.json.gz> [plans_bots_<метка>.json] [--nopro]"""
import sys, os, json, gzip, glob, collections
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import mapdir  # noqa: E402
MAP = mapdir.current()
SEC = 64
NT = {'smoke': 'smoke', 'smokegrenade': 'smoke', 'flash': 'flash', 'flashbang': 'flash', 'he': 'he', 'hegrenade': 'he', 'molly': 'molly', 'inferno': 'molly', 'molotov': 'molly', 'incgrenade': 'molly'}


def metrics(rounds):
    """rounds: [{win: 'T'|'CT', kills: [(t с, att_side, att_id, vic_side, vic_id)], nades: [(t, side, type)], awp: {'T': n, 'CT': n},
                 exec: t|None, site, plant: bool, entry_id}]"""
    R = [r for r in rounds if r['kills'] is not None]; n = len(R); out = collections.OrderedDict()
    out['раундов'] = n
    out['победы T, %'] = 100 * sum(r['win'] == 'T' for r in R) / n
    op = [min(r['kills']) for r in R if r['kills']]
    out['открывающее убийство за T, %'] = 100 * sum(k[1] == 'T' for k in op) / max(1, len(op))
    out['открывающее убийство, с (медиана)'] = float(np.median([k[0] for k in op])) if op else 0
    tr = {'T': [0, 0], 'CT': [0, 0]}
    for r in R:
        K = sorted(r['kills'])
        for i, (t, a_s, a, v_s, v) in enumerate(K):
            if v_s not in tr: continue
            tr[v_s][1] += 1
            if any(t2 > t and t2 - t <= 3 and v2 == a and a_s2 == v_s for t2, a_s2, a2, v_s2, v2 in K[i + 1:]): tr[v_s][0] += 1
    for s in ('T', 'CT'): out['размен смерти %s ≤ 3 с, %%' % s] = 100 * tr[s][0] / max(1, tr[s][1])
    for s in ('T', 'CT'):
        for ty in ('smoke', 'flash', 'molly', 'he'):
            out['гранат %s %s за раунд' % (s, ty)] = sum(1 for r in R for q in r['nades'] if q[1] == s and q[2] == ty) / n
    for s in ('T', 'CT'): out['AWP у %s, %% раундов' % s] = 100 * sum(1 for r in R if r['awp'].get(s, 0) > 0) / n
    ex = [r for r in R if r['exec'] is not None]
    out['раундов с выходом, %'] = 100 * len(ex) / n
    out['выход на A, %'] = 100 * sum(r['site'] == 'A' for r in ex) / max(1, len(ex))
    out['время выхода, с (медиана)'] = float(np.median([r['exec'] for r in ex])) if ex else 0
    out['раундов с плантом, %'] = 100 * sum(r['plant'] for r in R) / n
    ee = [r for r in ex if r.get('entry')]
    out['энтри погиб первым из T, % выходов'] = 100 * sum(1 for r in ee if [k for k in sorted(r['kills']) if k[3] == 'T'][:1] and sorted(k for k in r['kills'] if k[3] == 'T')[0][4] == r['entry']) / max(1, len(ee))
    return out


def plans(lab):
    return {r['rid']: r for r in json.load(open(os.path.join(HERE, 'plans_%s.json' % lab), encoding='utf-8'))}


def pro_rounds():
    from demos import demo_names, rounds_of, event, ticks_of
    import pandas as pd
    P = plans(MAP); out = []
    from round_plan import onsite
    for d in demo_names():
        rs = rounds_of(d)
        if not rs: continue
        D = event(d, 'player_death'); E = event(d, 'round_end')
        T = pd.read_csv(os.path.join(mapdir.path(MAP, 'demos'), d + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'team_num', 'active_weapon_name', 'is_alive'], low_memory=False)
        T = T[T.is_alive == True]  # noqa: E712
        tk = ticks_of(d)
        side_of = {}
        nd = []
        for k in ('smokegrenade_detonate', 'flashbang_detonate', 'inferno_startburn', 'hegrenade_detonate'):
            e = event(d, k)
            nd += [(int(t), int(u), NT[k.split('_')[0]]) for t, u in zip(e.tick.values, e.user_steamid.values)]
        for r in rs:
            p = P.get(r['rid'])
            if not p or p.get('pistol'): continue
            t0, t1 = r['t0'], r['t1']
            w = T[(T.tick >= t0) & (T.tick <= t1)]
            sd = {int(s): ('CT' if int(g.team_num.values[0]) == 3 else 'T') for s, g in w.groupby('steamid')}
            k20 = w[(w.tick >= t0 + 10 * SEC) & (w.tick < t0 + 40 * SEC) & (w.active_weapon_name == 'AWP')]   # AWP в руках хоть раз за 10–40 с (на бегу про держат нож)
            awp = collections.Counter(sd.get(int(s)) for s in set(k20.steamid.values))
            dd = D[(D.tick >= t0) & (D.tick <= t1)]
            kills = [((t - t0) / SEC, 'CT' if a == 3 else 'T', int(ai) if ai == ai else -1, 'CT' if v == 3 else 'T', int(vi))
                     for t, a, ai, v, vi in zip(dd.tick.values, dd.attacker_team_num.values, dd.attacker_steamid.values, dd.user_team_num.values, dd.user_steamid.values)]
            ee = E[(E.tick > t0) & (E.tick <= t1 + 64)]
            win = ('T' if str(ee.winner.values[0]) in ('T', '2', 'TERRORIST') else 'CT') if len(ee) else None
            nades = [((t - t0) / SEC, sd.get(u), ty) for t, u, ty in nd if t0 <= t <= t1]
            entry = None
            if p['exec'] is not None and p['site']:
                te = t0 + p['exec'] * SEC; g = tk[(tk.tick >= t0) & (tk.tick <= te + 16) & (tk.side == 'T')]
                firsts = {}
                for s, x, y, t in zip(g.steamid.values, g.x.values, g.y.values, g.tick.values):
                    if int(s) not in firsts and onsite(x, y) == p['site']: firsts[int(s)] = t
                if firsts: entry = min(firsts, key=firsts.get)
            out.append({'win': win or p.get('win'), 'kills': kills, 'nades': nades, 'awp': awp, 'exec': p['exec'], 'site': p['site'],
                        'plant': bool(p.get('plant')), 'entry': entry, 'tbuy': p.get('tbuy'), 'ctbuy': p.get('ctbuy')})
        print(d, len(out), file=sys.stderr)
    return out


def bot_rounds(rd, lab):
    from round_plan import onsite
    P = plans(lab); out = []
    for f in sorted(glob.glob(os.path.join(rd, 'rec_*.json*'))):
        d = json.load(gzip.open(f) if f.endswith('.gz') else open(f))
        side = lambda i: 'CT' if str(i).startswith('CT') else 'T'
        bypos = collections.defaultdict(list)
        for q in d['pos']:
            if q[5]: bypos[q[0]].append(q)
        for r in d['rounds']:
            if 't1' not in r: continue
            p = P.get('%s|%d' % (os.path.basename(f), r['r']))
            if not p or p.get('pistol'): continue
            t0, t1 = r['t0'], r['t1']
            kills = [((q[0] - t0) / SEC, q[2], q[1], q[6], q[5]) for q in d['kills'] if t0 <= q[0] <= t1]
            nades = [((q[0] - t0) / SEC, q[1], NT.get(q[2], q[2])) for q in d['nades'] if t0 <= q[0] <= t1]
            aw = set(q[1] for tt in range(t0 + 10 * SEC - (t0 + 10 * SEC) % 16, t0 + 40 * SEC, 16) for q in bypos.get(tt, []) if str(q[7]).upper() == 'AWP')   # как у про: AWP хоть раз за 10–40 с
            awp = collections.Counter(side(i) for i in aw)
            entry = None
            if p['exec'] is not None and p['site']:
                te = t0 + p['exec'] * SEC; firsts = {}
                for tt in sorted(t for t in bypos if t0 <= t <= te + 16):
                    for q in bypos[tt]:
                        if side(q[1]) == 'T' and q[1] not in firsts and onsite(q[3], q[4]) == p['site']: firsts[q[1]] = tt
                if firsts: entry = min(firsts, key=firsts.get)
            out.append({'win': r.get('winner'), 'kills': kills, 'nades': nades, 'awp': awp, 'exec': p['exec'], 'site': p['site'], 'plant': bool(p.get('plant')), 'entry': entry})
    return out


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    cache = os.path.join(HERE, 'roles_pro_%s.json' % MAP)
    if os.path.exists(cache): PM = json.load(open(cache), object_pairs_hook=collections.OrderedDict)
    else:
        PR = pro_rounds(); PM = metrics(PR); json.dump(PM, open(cache, 'w'), ensure_ascii=False, indent=1)
        json.dump([{'awp': dict(r['awp']), 'tbuy': r['tbuy'], 'ctbuy': r['ctbuy']} for r in PR], open(os.path.join(HERE, 'roles_pro_rounds_%s.json' % MAP), 'w'))
    BM = metrics(bot_rounds(a[0], a[1] if len(a) > 1 else 'bots_v576a_mir')) if a else None
    print('%-40s %10s %10s %8s' % ('мера', 'про', 'боты', 'разница'))
    for k, v in PM.items():
        b = BM.get(k) if BM else None
        dif = '' if b is None else ('%+.0f %%' % (100 * (b - v) / v) if v else '—')
        print('%-40s %10.2f %10s %8s' % (k, v, '%.2f' % b if b is not None else '', dif))
