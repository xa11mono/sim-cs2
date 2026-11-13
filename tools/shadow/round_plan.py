"""В142, шаг 1 (13.11.2026): что играли про в каждом раунде — для честного сравнения «про / бот» в режиме тени и для разбора логики.
Владелец 13.11: «в демке своя тактика, а у ботов своя расстановка — понятно, что будут расхождения; хочу понять, как играют про».
По каждому раунду демок карты (без названий мест в коде — зоны и регионы из набора карты):
  · закуп сторон (eco_est.pro_rounds);
  · T: выход — первый момент, когда ≥ 3 живых T на сайте (onsite, как tools/pro_tactics.py); сайт; темп (время выхода);
    направления входа — зона каждого T за 3 с до того, как он впервые оказался на сайте; гранаты T за 12 с до выхода (тип, зона);
    лёркер — живой T в другом регионе карты в момент выхода; плант (время, сайт);
  · CT: зона каждого CT на 20-й с, структура A-мид-B; первый контакт (первое попадание: время, зона);
    ротация — CT, пришедшие на сайт выхода из другого региона после выхода (через сколько секунд);
  · ближайшая наша тактика T (tactics.json tTactics: сайт, зоны входа групп, темп) и расстановка CT (ctSetups: роли ↔ зоны,
    лучшее назначение) — с мерой совпадения: низкая = у нас такого розыгрыша нет.
Запуск: python3 tools/shadow/round_plan.py [--map mirage] → tools/shadow/plans_<карта>.json и сводка в консоль."""
import sys, os, json, collections, itertools
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
from demos import demo_names, rounds_of, ticks_of, event, MAPNAME, tr as dtr  # noqa: E402
from eco_est import pro_rounds  # noqa: E402
from pro_tactics import onsite, region, _inside  # noqa: E402

SEC = 64
_ZJ = json.load(open(mapdir.path(MAPNAME, 'zones.json'), encoding='utf-8'))
_ZL = json.load(open(mapdir.path(MAPNAME, 'map.json'), encoding='utf-8'))['zoneLayer']
_zl = lambda p: [1024 + (p['x'] - 1024) * _ZL['scale'] + _ZL['dx'], 1024 + (p['y'] - 1024) * _ZL['scale'] + _ZL['dy']]
ZP = [((_ZJ['names'].get(z['id']) or '').split(' / ')[0], [_zl(p) for p in _ZJ['shapes'].get(z['id'], z['points'])])
      for z in _ZJ['zonemap']['zones'] if _ZJ['names'].get(z['id'])]
SYN = mapdir.recipe(MAPNAME).get('tactics', {}).get('callouts', {})   # подзона → зона, как у тактик (Tetris → Ramp …)


ZB = [(min(q[0] for q in P), max(q[0] for q in P), min(q[1] for q in P), max(q[1] for q in P)) for _, P in ZP]


def zone(x, y):
    for (nm, P), (x0, x1, y0, y1) in zip(ZP, ZB):
        if x0 <= x <= x1 and y0 <= y <= y1 and _inside(P, x, y): return nm
    return None


def zkey(z):
    return SYN.get(z, z) if z else None


TAC = json.load(open(mapdir.path(MAPNAME, 'tactics.json'), encoding='utf-8'))


def tac_zones(t):
    """зоны, через которые группы тактики входят на сайт: две последние зоны пути и стоянка"""
    s = set()
    for g in t.get('groups', []):
        v = [zkey(z) for z in g.get('via', [])][-2:] + [zkey(g.get('stage'))]
        s.update(z for z in v if z)
    return s


def tac_tempo(t):
    st = t.get('style', ''); nm = t.get('name', '')
    if st == 'rush' or 'Раш' in nm: return 'rush'
    if 'поздн' in nm or 'Дефолт' in nm: return 'late'
    return 'exec'


def match_tactic(site, entries, tempo):
    best = None
    for t in TAC['tTactics']:
        if t.get('site') != site: continue
        tz = tac_zones(t); u = entries | tz
        j = len(entries & tz) / len(u) if u else 0
        sc = j + (0.25 if tac_tempo(t) == tempo else 0)
        if best is None or sc > best[0]: best = (round(sc, 2), t['id'], t['name'], round(j, 2))
    return best


def match_setup(ct_zones):
    """лучшее назначение 5 CT на роли расстановки: сколько CT стоят в зоне своей роли"""
    best = None
    zs = [zkey(z) for z in ct_zones]
    for s in TAC['ctSetups']:
        roles = [set(zkey(z) for z in r.get('pos', [])) for r in s['roles'].values()]
        n = min(len(roles), len(zs)); top = 0
        for perm in itertools.permutations(range(len(roles)), n):
            top = max(top, sum(1 for i in range(n) if zs[i] in roles[perm[i]]))
            if top == n: break
        if best is None or top > best[0]: best = (top, s['id'], s['name'])
    return best


def tempo_of(sec):
    return 'none' if sec is None else 'rush' if sec < 25 else 'late' if sec > 55 else 'exec'


def main():
    types = {}
    for half in pro_rounds():
        for r in half: types[r['id']] = r
    out = []
    for demo in demo_names():
        rs = rounds_of(demo)
        if not rs: continue
        T = ticks_of(demo).sort_values('tick')
        hurt = event(demo, 'player_hurt').sort_values('tick')
        nades = {k: event(demo, k) for k in ('smokegrenade_detonate', 'flashbang_detonate', 'inferno_startburn', 'hegrenade_detonate')}
        for r in rs:
            t0, t1 = r['t0'], r['t1']
            if t1 - t0 < 10 * SEC: continue
            W = T[(T.tick >= t0) & (T.tick < t1)]
            if not len(W): continue
            tr = {int(s): g for s, g in W.groupby('steamid')}
            side = {s: g.side.values[0] for s, g in tr.items()}
            ticks = np.unique(W.tick.values)
            # выход T: первый тик, где ≥ 3 живых T на одном сайте
            t_exec, site = None, None
            for tk in ticks[::4]:
                f = W[(W.tick == tk) & (W.side == 'T')]
                c = collections.Counter(onsite(x, y) for x, y in zip(f.x.values, f.y.values))
                c.pop(None, None)
                if c and c.most_common(1)[0][1] >= 3: t_exec, site = int(tk), c.most_common(1)[0][0]; break
            plant = None
            if r['tplant']: plant = {'t': round((r['tplant'] - t0) / SEC, 1), 'site': r['site']}
            if site is None and plant: site = plant['site']
            # направления входа: зона T за 3 с до первого появления на сайте выхода
            entries, ent_by = set(), {}
            if site:
                for s, g in tr.items():
                    if side[s] != 'T': continue
                    on = [onsite(x, y) == site for x, y in zip(g.x.values, g.y.values)]
                    if not any(on): continue
                    k = on.index(True); tk = g.tick.values[k] - 3 * SEC
                    j = int(np.searchsorted(g.tick.values, tk)); j = min(max(j, 0), len(g) - 1)
                    z = zkey(zone(g.x.values[j], g.y.values[j]))
                    if z: entries.add(z); ent_by[str(s)] = z
            # лёркер: живой T в другом регионе карты в момент выхода
            lurk = []
            if t_exec and site:
                f = W[(W.tick == t_exec) & (W.side == 'T')]
                for s, x, y in zip(f.steamid.values, f.x.values, f.y.values):
                    rg = str(region(np.array([x]), np.array([y]))[0])
                    if rg not in (site, 'M') and onsite(x, y) != site: lurk.append(zkey(zone(x, y)))
            # гранаты T за 12 с до выхода
            util = []
            if t_exec:
                for k, d in nades.items():
                    e = d[(d.tick >= t_exec - 12 * SEC) & (d.tick <= t_exec + 2 * SEC)]
                    for _, q in e.iterrows():
                        if side.get(int(q.user_steamid)) != 'T': continue
                        a, b = dtr(np.array([float(q.x)]), np.array([float(q.y)]))
                        util.append([k.split('_')[0].replace('grenade', '').replace('inferno', 'molotov'), zkey(zone(float(a[0]), float(b[0])))])
            # CT на 20-й с
            t20 = t0 + 20 * SEC; ct_z = []
            f = W[(W.tick >= t20) & (W.tick < t20 + 16) & (W.side == 'CT')]
            for x, y in zip(f.x.values, f.y.values): ct_z.append(zkey(zone(x, y)))
            reg20 = collections.Counter(str(region(np.array([x]), np.array([y]))[0]) for x, y in zip(f.x.values, f.y.values))
            # первый контакт
            h = hurt[(hurt.tick >= t0) & (hurt.tick < t1)]
            contact = None
            if len(h):
                q = h.iloc[0]; g = tr.get(int(q.user_steamid))
                if g is not None:
                    j = min(int(np.searchsorted(g.tick.values, q.tick)), len(g) - 1)
                    contact = {'t': round((q.tick - t0) / SEC, 1), 'zone': zkey(zone(g.x.values[j], g.y.values[j])), 'victim': side.get(int(q.user_steamid))}
            # ротация CT на сайт выхода
            rot = []
            if t_exec and site:
                for s, g in tr.items():
                    if side[s] != 'CT': continue
                    k0 = min(int(np.searchsorted(g.tick.values, t_exec)), len(g) - 1)
                    if onsite(g.x.values[k0], g.y.values[k0]) == site: continue
                    rg0 = str(region(g.x.values[k0:k0 + 1], g.y.values[k0:k0 + 1])[0])
                    if rg0 == site: continue
                    for k in range(k0, len(g)):
                        if onsite(g.x.values[k], g.y.values[k], 260) == site: rot.append([rg0, round((g.tick.values[k] - t_exec) / SEC, 1)]); break
            ex_s = round((t_exec - t0) / SEC, 1) if t_exec else None
            ty = types.get(r['rid'], {})
            rec = {'rid': r['rid'], 'tbuy': (ty.get('type') or {}).get('T'), 'ctbuy': (ty.get('type') or {}).get('CT'), 'win': ty.get('winner'), 'pistol': ty.get('pistol'),
                   'site': site, 'exec': ex_s, 'tempo': tempo_of(ex_s), 'entries': sorted(entries), 'lurk': lurk, 'util': util, 'plant': plant,
                   'ct20': ct_z, 'ct20_struct': '%d-%d-%d' % (reg20.get('A', 0), reg20.get('M', 0), reg20.get('B', 0)),
                   'contact': contact, 'rot': rot,
                   'tac': match_tactic(site, entries, tempo_of(ex_s)) if site else None,
                   'setup': match_setup(ct_z) if len(ct_z) >= 4 else None}
            out.append(rec)
        print(demo, len(out), file=sys.stderr)
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'plans_%s.json' % MAPNAME)
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    summary(out)
    print(p)


def summary(out):
    n = len(out); pc = lambda a: '%d %%' % round(100 * a / max(1, n))
    ex = [r for r in out if r['exec'] is not None]
    print('раундов', n, '| с выходом (≥ 3 T на сайте)', len(ex), pc(len(ex)), '| с плантом', pc(sum(1 for r in out if r['plant'])))
    print('темп выхода:', dict(collections.Counter(r['tempo'] for r in out)))
    tt = sorted(r['exec'] for r in ex)
    if tt: print('время выхода, с: медиана %.0f, 25 %% — %.0f, 75 %% — %.0f' % (tt[len(tt) // 2], tt[len(tt) // 4], tt[3 * len(tt) // 4]))
    print('лёркер при выходе:', pc(sum(1 for r in ex if r['lurk'])), 'раундов с выходом' if ex else '')
    good = [r for r in ex if r['tac'] and r['tac'][3] >= 0.34]
    print('выход похож на нашу тактику (зоны входа ≥ 1/3):', '%d из %d' % (len(good), len(ex)))
    c = collections.Counter(r['tac'][2] for r in good)
    for k, v in c.most_common(): print('   %3d  %s' % (v, k))
    miss = collections.Counter((r['site'], ' + '.join(r['entries'])) for r in ex if r not in good)
    print('выходы, которых у нас нет (сайт, зоны входа) — топ:')
    for (s, e), v in miss.most_common(10): print('   %3d  %s: %s' % (v, s, e))
    st = [r for r in out if r['setup']]
    print('расстановка CT на 20 с совпала с нашей (≥ 4 из 5 по зонам ролей):', '%d из %d' % (sum(1 for r in st if r['setup'][0] >= 4), len(st)))
    print('первый контакт: медиана %.0f с' % np.median([r['contact']['t'] for r in out if r['contact']]))
    rt = [x[1] for r in ex for x in r['rot']]
    if rt: print('ротация CT на сайт выхода: в среднем %.1f игрока за раунд, медиана %.1f с после выхода' % (len(rt) / max(1, len(ex)), np.median(rt)))


if __name__ == '__main__':
    main()
