"""Тактики про по демкам карты (v254, 11.10; v318 — --map и тактики для игры): из чего составлены выходы T и
расстановки CT.

python3 tools/tactics_bake.py [--map ancient] [--game]
  → <pro_dir>/tactics.json (разбор) и сводка в консоль; с --game — ещё <pro_dir>/tactics_game.json: тактики в формате
    набора карты (MAP.tactics: tTactics, ctSetups, pos, lurkPlans, shiftTo, proRole; plays — пустые). Его кладёт в
    tactics.json набора tools/demos_bake.py. Для --game нужны <pro_dir>/positions.json и setups.json (tools/positions_bake.py)
    и pro_samples.csv.gz (tools/pro.py).

Разбор. T (раунды с плантом): у каждого T — через какой вход он пришёл к сайту планта (последняя зона перед сайтом) и
  модальный маршрут по зонам до входа; никуда не входил — far (лёркер/отставший). Подпись тактики = сайт + сколько
  игроков каким входом + темп (плант < 40 с — быстро, > 75 с — поздно).
  Ancient (как было): входы и стороны — списки зон из рецепта карты (tactics.entry, sides). Другие карты: игрок «зашёл на
  сайт», когда впервые оказался ближе ENTER_R к центру плантов; вход — последняя зона перед этим; сторона — regions рецепта.
CT: на 20-й с — сколько CT на стороне A / в миде / на B; на 12-й с — кто вышел вперёд за инфой (зоны «вперёд»).

Тактики для игры (--game, всё из демок; названия зон — zones.json набора):
  * T: подписи с долей ≥ 3 % плантов (не больше 16). Один вход — exec, два и больше — split; темп «быстро» и
    плант < 30 с — rush (эко, пистолетки, форс; rushVia — маршрут главного входа); «поздно» — default. setupEnd —
    медиана секунды планта − 9 с (выход ≈ за 9 с до планта — медиана про, tools/positions_bake.py: plantSec − startSec);
    weight — доля подписи относительно средней. Группы: самая большая — entry, awp, igl; остальные — support, …;
    у второй группы stage — предпоследняя зона маршрута, look — вход. Плюс по раш-тактике на сайт, если в данных
    раша не нашлось (маршрут самого частого входа) — чтобы у эко и пистолеток был выбор.
  * CT: расстановки — раскладки A-мид-B из setups.json (positions_bake, слоты с ролями): rot "212", если на каком-то
    сайте двое, "stack" при трёх+, иначе "111"; роли — зона точки слота и зона, куда она смотрит; w — доля раундов.
  * pos: ctHold / ctSecond — зоны стандартных точек CT на стороне сайта по доле раундов; ctRetake — где CT после
    планта на этом сайте (кроме зон сайта); tClear — зоны сайта и точек CT на нём; tPost — где T после планта;
    entries — 2 частых входа; M.ctHold — CT в миде, M.tHold — T в миде (+ "TMID").
  * proRole: anchorA/anchorB — зоны CT-точек сторон по доле; rot212 — задние проходы CT; roam212 — мид CT.
  * lurkPlans: на каждый сайт — маршруты двух частых входов (stage — предпоследняя зона, entry — вход).
  * shiftTo: на каждый сайт — две частые зоны T до планта на его стороне (не сайт, не вход) и куда оттуда смотрят.
"""
import os, sys, json, collections
import numpy as np
from matplotlib.path import Path
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); sys.path.insert(0, HERE)
from demos import demo_names, rounds_of, ticks_of, MAPNAME  # noqa: E402
import mapdir  # noqa: E402

PRO = mapdir.pro_dir(MAPNAME)
R_ = mapdir.recipe(MAPNAME)
_ZJ = json.load(open(mapdir.path(MAPNAME, 'zones.json'), encoding='utf-8'))
_ZL = json.load(open(mapdir.path(MAPNAME, 'map.json'), encoding='utf-8'))['zoneLayer']


def _zl(p):
    return [1024 + (p['x'] - 1024) * _ZL['scale'] + _ZL['dx'], 1024 + (p['y'] - 1024) * _ZL['scale'] + _ZL['dy']]


ZP = [((_ZJ['names'].get(z['id']) or '').split(' / ')[0], Path(np.array([_zl(p) for p in _ZJ['shapes'].get(z['id'], z['points'])])))
      for z in _ZJ['zonemap']['zones'] if _ZJ['names'].get(z['id'])]


def zone(x, y):
    for nm, p in ZP:
        if p.contains_point((x, y)): return nm
    return None


TAC = R_.get('tactics', {})
REG = R_['regions']
_RBY = {n.split(' / ')[0]: k for k in ('A', 'B', 'mid') for n in REG.get(k, [])}
for n in REG['back'] + REG['Tside']:
    _RBY[n.split(' / ')[0]] = 'M'
ENTRY = TAC.get('entry')                 # Ancient: {сайт: {зона: вход}}
SIDES = TAC.get('sides')                 # Ancient: {'A': [...], 'B': [...], 'M': [...]}
FORWARD = set(TAC.get('forward', []))
ANCH = {k: tuple(v) for k, v in TAC.get('anchors', {}).items()}
T_SPAWN = set(TAC.get('tSpawn', REG['Tside'][:1]))


def side_of(z, x, y):
    if SIDES:
        for k in ('A', 'B', 'M'):
            if z in SIDES[k]: return k
        return min(ANCH, key=lambda k: (ANCH[k][0]-x)**2 + (ANCH[k][1]-y)**2)
    r = _RBY.get((z or '').split(' → ')[0], 'M')   # (v321) часть длинной зоны — сторона исходной
    return 'M' if r == 'mid' else r


ENTER_R = 220   # игрок «зашёл на сайт» — ближе 220 ед. карты (550 ед. игры) к центру плантов — проектное число


def site_zones(rounds):
    """зоны «сайта»: где лежит хотя бы 5 % плантов сайта; центр плантов (для карт без списка входов в рецепте)"""
    out, cen = {}, {}
    for s in 'AB':
        P = [r['plantXY'] for r in rounds if r['site'] == s]
        c = collections.Counter(zone(*p) for p in P)
        n = sum(c.values())
        out[s] = {z for z, k in c.items() if z and k >= 0.05 * n}
        cen[s] = (float(np.mean([p[0] for p in P])), float(np.mean([p[1] for p in P])))
    return out, cen


def lane_of(seq, site, SZ):
    """вход игрока на сайт и маршрут до входа (включительно)"""
    if ENTRY:
        lane = 'far'
        for z in seq:
            if z in ENTRY[site]: lane = ENTRY[site][z]
        if lane == 'far':
            return lane, None
        cut = [z for z in seq if z not in T_SPAWN]
        idx = [i for i, z in enumerate(cut) if ENTRY[site].get(z) == lane]
        stop = max(idx) if idx else len(cut) - 1
        return lane, cut[:stop + 1]
    # seq — зоны до первого захода ближе ENTER_R к центру плантов (None — не заходил)
    if seq is None:
        return 'far', None
    # вход — «ветка» маршрута: первая зона после спавна T и его окрестностей (Tside рецепта), чтобы T Ramp и Tetris
    # (один заход) не считались разными; последняя зона перед сайтом — entry (в TE)
    # (v337) часть длинной зоны («T Roof → T Spawn», «T Spawn → Elevator») — сторона исходной зоны; раньше такие части не
    # считались стороной T, и «веткой» у большинства выходов Mirage становилась часть спавна T вместо Palace/Ramp/Apps
    base = lambda z: z.split(' → ')[0]
    cut = [z for z in seq if base(z) not in T_SPAWN]
    if not cut:
        return 'far', None
    TSIDE = set(REG['Tside'])
    # (v339) ветка — первая зона после ПОСЛЕДНЕГО пребывания на стороне T: кто сходил в Top Mid за контролем и вернулся через
    # спавн в B Apps, идёт через Apps (раньше — «мид», и сплит на B через мид сливался с выходом через Apps в одну группу)
    last_t = max([i for i, z in enumerate(cut) if base(z) in TSIDE], default=-1)
    branch = next((z for z in cut[last_t + 1:] if base(z) not in TSIDE), None)
    if branch is None:
        return 'far', None
    return branch, cut


def analyse():
    T = collections.Counter(); TR = collections.defaultdict(collections.Counter); TPLANT = collections.defaultdict(list)
    TE = collections.defaultdict(collections.Counter)   # вход (ветка) → зоны, из которых заходили на сайт
    TCNT = collections.defaultdict(collections.Counter)  # подпись → игроков по веткам (сумма по раундам)
    CT = collections.Counter(); CTF = collections.Counter(); n_ct = 0
    allr = []
    per_demo = []
    for demo in demo_names():
        rs = rounds_of(demo)
        if rs:
            per_demo.append((demo, rs)); allr += rs
    SZ, CEN = (None, None) if ENTRY else site_zones([r for r in allr if r['site'] in ('A', 'B')])
    for demo, rs in per_demo:
        tk = ticks_of(demo)
        G = {s: g.sort_values('tick') for s, g in tk.groupby('steamid')}
        for r in rs:
            t0 = r['t0']
            # ---- CT ----
            cnt = {'A': 0, 'M': 0, 'B': 0}; fwd = []; ok = 0
            for sid, g in G.items():
                k20 = np.searchsorted(g.tick.values, t0 + 20*64)
                if k20 >= len(g) or g.side.values[k20] != 'CT' or abs(g.tick.values[k20] - t0 - 20*64) > 64: continue
                ok += 1; z = zone(g.x.values[k20], g.y.values[k20])
                cnt[side_of(z, g.x.values[k20], g.y.values[k20])] += 1
                k12 = np.searchsorted(g.tick.values, t0 + 12*64)
                if k12 < len(g):
                    z12 = zone(g.x.values[k12], g.y.values[k12])
                    if z12 in FORWARD: fwd.append(z12)
            if ok == 5:
                n_ct += 1; CT['%d-%d-%d' % (cnt['A'], cnt['M'], cnt['B'])] += 1
                CTF[tuple(sorted(fwd))] += 1
            # ---- T ----
            if not r['tplant'] or r['site'] not in ('A', 'B'): continue
            site = r['site']; lanes = []
            for sid, g in G.items():
                m = (g.tick.values >= t0) & (g.tick.values <= r['tplant'])
                if not m.any() or g.side.values[m][0] != 'T': continue
                xs, ys = g.x.values[m][::8], g.y.values[m][::8]
                if not ENTRY:   # до первого захода на сайт (ближе ENTER_R к центру плантов)
                    inn = np.nonzero(np.hypot(xs - CEN[site][0], ys - CEN[site][1]) < ENTER_R)[0]
                    if not len(inn):
                        xs = None
                    else:
                        xs, ys = xs[:inn[0]], ys[:inn[0]]
                seq = []
                for x, y in (zip(xs, ys) if xs is not None else ()):
                    z = zone(x, y)
                    if z and (not seq or seq[-1] != z): seq.append(z)
                lane, route = lane_of(seq if (ENTRY or xs is not None) else None, site, SZ)
                lanes.append(lane)
                if lane != 'far':
                    TR[(site, lane)][tuple(route)] += 1
                    TE[(site, lane)][route[-1]] += 1
            if len(lanes) != 5: continue
            c = collections.Counter(lanes)
            sec = (r['tplant'] - t0)/64
            tempo = 'быстро' if sec < 40 else ('поздно' if sec > 75 else 'норма')
            if ENTRY:
                sig = (site, tuple(sorted(c.items())), tempo)
            else:   # новые карты: подпись — какими ветками шли (сколько игроков — среднее), темп — медианой по подписи
                sig = (site, tuple(sorted(l for l in c if l != 'far')), '')
                for l in c: TCNT[sig][l] += c[l]
            T[sig] += 1; TPLANT[sig].append(sec)
    nplant = sum(T.values())
    out = {'map': MAPNAME, 'plants': nplant, 'ctRounds': n_ct, 'siteZones': {k: sorted(v) for k, v in (SZ or {}).items()},
           'siteCenter': CEN,
           'T': [], 'routes': {}, 'CT': [], 'CTforward': []}
    print('== T: подписи выходов (сайт, входы, темп) — сколько раундов (раундов с плантом и 5 T: %d)' % nplant)
    for sig, n in T.most_common(40):
        print(n, sig[0], sig[1], sig[2])
        ps = np.array(TPLANT[sig])
        lanes = dict(sig[1]) if ENTRY else {l: max(1, int(round(TCNT[sig][l] / n))) for l in sig[1]}
        if not ENTRY:
            lanes['far'] = max(0, 5 - sum(lanes.values()))
        out['T'].append({'site': sig[0], 'lanes': lanes, 'tempo': sig[2], 'n': n, 'plantSec': round(float(np.median(ps)), 1),
                         'fast': round(float((ps < 40).mean()), 2), 'late': round(float((ps > 75).mean()), 2)})
    print('== T: модальные маршруты по входам')
    for k, C in sorted(TR.items()):
        top = C.most_common(10); out['routes']['%s:%s' % k] = [[list(p), n] for p, n in top]
        print(k, [(' > '.join(p[-6:]), n) for p, n in top[:3]])
    out['entries'] = {'%s:%s' % k: C.most_common(3) for k, C in sorted(TE.items())}
    print('== CT: A-мид-B на 20-й с (раундов %d)' % n_ct)
    for sig, n in CT.most_common(15): print(n, sig); out['CT'].append({'split': sig, 'n': n})
    print('== CT: кто впереди на 12-й с')
    for sig, n in CTF.most_common(25): print(n, sig); out['CTforward'].append({'zones': list(sig), 'n': n})
    json.dump(out, open(os.path.join(PRO, 'tactics.json'), 'w'), ensure_ascii=False, indent=1)
    return out


# ---------------------------------------------------------------- тактики для игры
SIG_MIN, SIG_MAX = 0.01, 16    # подпись — тактика, если не реже 1 % плантов (≥ 8 раундов Mirage; v337: 2 %, было 3 %); не больше 16 — проектные числа
EXEC_LEAD = 9                  # выход за 9 с до планта (медиана про по positions_bake: plantSec − startSec ≈ 6–9 с)
ROUTE_MAX = 6                  # маршрут — не больше 6 последних зон до входа — проектное число
HOLD_R = 420                   # «держит сайт» — CT-точка ближе 420 ед. карты (1050 ед. игры) к центру плантов — проектное число
TITLE = {'A': 'A', 'B': 'B'}


def _route(A, site, lane):
    """самый частый маршрут ветки, который кончается её главной зоной входа (иначе — самый частый)"""
    R = A['routes'].get('%s:%s' % (site, lane))
    if not R:
        return [lane]
    end = (A.get('entries', {}).get('%s:%s' % (site, lane)) or [[None]])[0][0]
    best = next((p for p, n in R if p and p[-1] == end), R[0][0])
    r = [z for z in best if z not in T_SPAWN]
    return r[-ROUTE_MAX:] or [lane]


FAKE_R, FAKE_SEC = 450, (8, 30)   # проектные числа: радиус «у сайта» (ед. карты) и окно до планта, с


def fake_stats():
    """раунды с плантом: сколько с фейком (гранаты T у другого сайта за 8–30 с до планта) — by[(сайт планта, сайт фейка)]"""
    import pandas as pd
    from demos import DEMOS, tr
    EV = {'smoke': 'smokegrenade_detonate', 'flash': 'flashbang_detonate', 'molly': 'inferno_startburn'}
    rows, pl = [], collections.defaultdict(list)
    for demo in demo_names():
        ev = []
        for k, e in EV.items():
            f = os.path.join(DEMOS, demo + '_' + e + '.csv.gz')
            if os.path.exists(f):
                d = pd.read_csv(f, usecols=['tick', 'user_steamid', 'x', 'y']); d['k'] = k; ev.append(d)
        if not ev:
            continue
        ev = pd.concat(ev, ignore_index=True); ev = ev[ev.user_steamid.notna()]
        mx, my = tr(ev.x.values, ev.y.values); ev['mx'] = mx; ev['my'] = my
        try:
            t = ticks_of(demo)
        except Exception:
            continue
        for r in rounds_of(demo):
            if r['num'] >= 24 or not r['tplant'] or r['site'] not in ('A', 'B'):
                continue
            pl[r['site']].append(r['plantXY'])
            ts = set(t[(t.tick >= r['t0']) & (t.tick < r['t0'] + 64 * 5) & (t.side == 'T')].steamid)
            e = ev[(ev.tick > r['tplant'] - FAKE_SEC[1] * 64) & (ev.tick < r['tplant'] - FAKE_SEC[0] * 64)]
            rows.append((r['site'], e[e.user_steamid.astype('int64').isin(list(ts))]))
    C = {k: np.mean(v, axis=0) for k, v in pl.items()}
    by = collections.Counter()
    for site, e in rows:
        other = 'B' if site == 'A' else 'A'
        if other in C and int((np.hypot(e.mx - C[other][0], e.my - C[other][1]) < FAKE_R).sum()) >= 2:
            by[(site, other)] += 1
    return {'n': len(rows), 'by': dict(by)}


def game_tactics(A):
    import pandas as pd
    nplant = A['plants']
    pos = json.load(open(os.path.join(PRO, 'positions.json'), encoding='utf-8'))
    sets = json.load(open(os.path.join(PRO, 'setups.json'), encoding='utf-8'))
    P = pos['points']
    site_z = {k: set(v) for k, v in A['siteZones'].items()} if A['siteZones'] else {k: set() for k in 'AB'}
    ent_of = lambda site, l: (A.get('entries', {}).get('%s:%s' % (site, l)) or [[l]])[0][0]
    # ---- T ----
    sigs = [s for s in A['T'] if s['n'] >= SIG_MIN * nplant and set(s['lanes']) != {'far'}][:SIG_MAX]
    mean_n = np.mean([s['n'] for s in sigs]) if sigs else 1
    tt, used = [], collections.Counter()
    ROLES = ['entry', 'awp', 'igl', 'support']
    for s in sigs:
        site = s['site']
        ent = lambda l: (A.get('entries', {}).get('%s:%s' % (site, l)) or [[l]])[0][0]   # зона входа на сайт у этой ветки
        # ветки с одной зоной входа (B Stairs → B Apps и Stove → B Apps) — один вход; маршрут — у ветки, где игроков больше
        merged = collections.OrderedDict()
        for l, c in sorted(((l, c) for l, c in s['lanes'].items() if l != 'far'), key=lambda t: (-t[1], t[0])):
            e = ent(l)
            if e in merged:
                merged[e][1] += c
            else:
                merged[e] = [l, c]
        lanes = sorted(((l, c) for l, c in merged.values()), key=lambda t: (-t[1], t[0]))
        tempo = s['tempo'] or ('быстро' if s['plantSec'] < 40 else ('поздно' if s['plantSec'] > 75 else 'норма'))
        rush = (tempo == 'быстро' and s['plantSec'] < 30) if s['tempo'] else tempo == 'быстро'
        style = 'rush' if rush else ('split' if len(lanes) > 1 else ('default' if tempo == 'поздно' else 'exec'))
        main = lanes[0][0]
        name = '%s: ' % TITLE[site] + ' + '.join('%d %s' % (c, ent(l)) for l, c in lanes) + {'быстро': ', быстро', 'поздно': ', поздно', 'норма': ''}[tempo]
        base = '%s%s_%s' % ({'rush': 'rush', 'split': 'split', 'default': 'def', 'exec': 'exec'}[style], site,
                             ''.join(c for c in ent(main).lower() if c.isalnum())[:10])
        used[base] += 1
        t = {'id': base + ('' if used[base] == 1 else str(used[base])), 'name': name, 'site': site,
             'pools': ['eco', 'pistol', 'force'] if rush else (['full', 'half'] if style == 'default' else ['full', 'half', 'force']),
             'setupEnd': 0 if rush else int(max(20, round(s['plantSec'] - EXEC_LEAD))), 'style': style,
             'weight': round(s['n'] / mean_n, 2), 'n': s['n']}
        if rush:
            t['rushVia'] = _route(A, site, main)
        else:
            groups, k = [], 0
            for gi, (l, c) in enumerate(lanes):
                take = 3 if gi == 0 else max(1, min(c, len(ROLES) - k))
                roles = ROLES[k:k + take] if gi else ['entry', 'awp', 'igl'] + (['support'] if c >= 4 and len(lanes) == 1 else [])
                k = len(roles) if gi == 0 else k + len(roles)
                if not roles:
                    continue
                via = _route(A, site, l)
                g = {'roles': roles, 'via': via}
                # (v319) сбор — у каждой группы свой, по её маршруту: без него игра ставит T на точку кратчайшего пути до
                # сайта (GEO), а на Mirage это мид, а не B Apps
                if len(via) >= 2:
                    g['stage'] = via[-2]; g['look'] = ent(l)
                groups.append(g)
            t['groups'] = groups
        tt.append(t)
    for site in 'AB':      # раш на каждый сайт — у эко и пистолеток должен быть выбор
        if not any(t['style'] == 'rush' and t['site'] == site for t in tt):
            ls = collections.Counter()
            for s in A['T']:
                if s['site'] == site:
                    for l, c in s['lanes'].items():
                        if l != 'far': ls[l] += c * s['n']
            if ls:
                main = ls.most_common(1)[0][0]
                tt.append({'id': 'rush%s' % site, 'name': '%s: раш через %s' % (site, ent_of(site, main)), 'site': site, 'pools': ['eco', 'pistol', 'force'],
                           'setupEnd': 0, 'style': 'rush', 'rushVia': _route(A, site, main), 'weight': 0.5, 'n': 0})
    # (v365, владелец: «добавляй фейки») фейк-выходы — по демкам: раунд с плантом, где за 8–30 с до планта T бросили 2+ гранаты
    # (смок / молотов / флешка) у другого сайта (≤ FAKE_R ед. карты от средней точки плантов того сайта). Вес — доля таких раундов
    # от всех тактик (общая сумма весов), группы и тайминг — у самой частой тактики настоящего сайта
    fs = fake_stats()
    wsum = sum(t['weight'] for t in tt if 'full' in t['pools'])
    for real, fake in (('B', 'A'), ('A', 'B')):
        k = fs['by'].get((real, fake), 0)
        if not k or not fs['n']:
            continue
        base = max((t for t in tt if t['site'] == real and t['style'] in ('exec', 'split')), key=lambda t: t['weight'], default=None)
        if not base:
            continue
        share = k / fs['n']
        tt.append({'id': 'fake%s_%s' % (fake, real), 'name': '%s: фейк %s (%s)' % (real, fake, base['name'].split(': ', 1)[-1]), 'site': real,
                   'fake': fake, 'pools': ['full', 'half'], 'setupEnd': base['setupEnd'], 'style': 'fake',
                   'weight': round(wsum * share / (1 - share), 2), 'groups': base.get('groups', []), 'n': k})
    # ---- зоны по сторонам ----
    def by_share(pts):
        c = collections.Counter()
        for p in pts:
            c[p['area'].split(' / ')[0]] += p['rounds']
        return [z for z, _ in c.most_common()]
    std = [p for p in P if p['type'] == 'standard']
    ct_all = {k: [p for p in std if p['side'] == 'CT' and p['region'] == k] for k in ('A', 'B', 'mid', 'back', 'Tside')}
    tp = {k: [p for p in P if p['side'] == 'T' and p['region'] == k] for k in ('A', 'B', 'mid', 'back', 'Tside')}
    S = pd.read_csv(os.path.join(PRO, 'pro_samples.csv.gz'), usecols=['x', 'y', 'side', 'phase', 'site', 'still'])
    S = S[S.still.astype(bool)].sample(frac=0.2, random_state=1)

    cen0 = A.get('siteCenter') or {}

    def post_zones(side, site, k=5):
        d = S[(S.side == side) & (S.phase == 'post') & (S.site == site)]
        if site in cen0:   # (v319) у сайта (ближе 1,5 × HOLD_R), а не там, где прятались/сейвили
            d = d[np.hypot(d.x - cen0[site][0], d.y - cen0[site][1]) < 1.5 * HOLD_R]
        c = collections.Counter(zone(x, y) for x, y in zip(d.x.values, d.y.values))
        c.pop(None, None)
        return [z for z, _ in c.most_common(k + len(site_z[site])) if z not in site_z[site]][:k]
    entries, lanes_of = {}, {}
    for site in 'AB':
        ls = collections.Counter()
        for s in A['T']:
            if s['site'] == site:
                for l, c in s['lanes'].items():
                    if l != 'far': ls[l] += c * s['n']
        ez = collections.Counter()
        for l, c in ls.items():
            for z, k in (A.get('entries', {}).get('%s:%s' % (site, l)) or [[l, c]]):
                ez[z] += k
        entries[site] = [z for z, _ in ez.most_common(2)]                     # две разные зоны входа
        TEs = {l: dict(A.get('entries', {}).get('%s:%s' % (site, l)) or []) for l in ls}
        lanes_of[site] = {z: max(ls, key=lambda l: TEs[l].get(z, 0)) for z in entries[site]}
    # (v319) CT держат свою сторону: без подпушей (push) и без зон на пути T к сайтам (маршруты двух главных входов
    # каждого сайта, включая сам вход) и у спавна T
    tpath = set()
    for site in 'AB':
        for z in entries[site]:
            l = lanes_of[site].get(z)
            if l:
                r = _route(A, site, l)
                tpath |= set(r[:r.index(z) + 1] if z in r else r)
    ok = lambda p: not p['push'] and p['area'].split(' / ')[0] not in tpath
    # у сайта CT стоят и на «редких» (off) точках — берём все не-подпуши стороны (у Mirage на B стандартных мало)
    ct = {k: [p for p in P if p['side'] == 'CT' and p['region'] == k and p['type'] in ('standard', 'off') and ok(p)]
          for k in ('A', 'B', 'mid', 'back')}
    ct['Tside'] = []
    posd = {}
    cen = A.get('siteCenter') or {}
    near = lambda pts, site: [p for p in pts if site not in cen or ((p['x'] - cen[site][0]) ** 2 + (p['y'] - cen[site][1]) ** 2) ** 0.5 < HOLD_R]
    for site in 'AB':
        hold = by_share(near(ct[site] + ct['back'] + ct['mid'], site))
        onsite = [z for z in hold if z in site_z[site]] or hold[:3]
        posd[site] = {'ctHold': hold[:9], 'ctSecond': hold[1:6] or hold[:1], 'ctRetake': post_zones('CT', site, 4),
                      'tClear': (onsite + [z for z in hold if z not in onsite])[:6], 'tPost': post_zones('T', site, 5),
                      'entries': entries[site]}
    # (v319) мид T — зоны, где T стоят в миде по демкам; "TMID" (точка на пути между спавнами) не берём: на Mirage это T Roof
    posd['M'] = {'ctHold': by_share(ct['mid'])[:4], 'tHold': by_share([p for p in tp['mid'] if p['sec'] <= 35])[:4] if not TAC.get('entry') else ['TMID'] + by_share(tp['mid'])[:3]}
    # ---- CT расстановки ----
    cs = []
    tot = sum(x['rounds'] for x in sets['ct']) or 1
    byid = {p['id']: p for p in P}
    for x in sets['ct']:
        sp = x['split']
        rot = 'stack' if max(sp['A'], sp['B']) >= 3 else ('212' if max(sp['A'], sp['B']) >= 2 else '111')
        roles, rest = {}, []
        for sl in x['slots']:
            p = byid.get(sl['point'])
            if not p:
                continue
            # (v319) роль держит свою сторону раскладки: зоны — только из списка этой стороны (без подпушей и пути T)
            side = 'A' if '_A' in sl['role'] else ('B' if '_B' in sl['role'] else 'M')
            allow = posd[side]['ctHold']
            cand = [p['area'].split(' / ')[0]] + [byid[a['id']]['area'].split(' / ')[0] for a in sl.get('alternatives', []) if a['id'] in byid]
            pz = [z for z in dict.fromkeys(cand) if z in allow][:3] or allow[:2]
            lk = p['angle']['zone'].split(' / ')[0]
            if lk == pz[0] or lk not in set(allow) | tpath | set(posd['M']['tHold']):
                lk = entries[side][0] if side in entries else (posd['M']['tHold'] or [lk])[0]
            R = {'pos': pz, 'look': lk}
            role = {'anchor_A': 'anchorA', 'anchor_B': 'anchorB', 'mid_control': 'mid'}.get(sl['role'])
            if role and role not in roles:
                roles[role] = R
            else:
                rest.append(R)
        # (v359, владелец: «3-0-2 встают 4 на A, 1 на B») у раскладки без мид-игрока (3-0-2, 4-0-1) роли mid не было: пятый игрок
        # вставал по умолчанию. Свободные слоты раскладки — rotator, roamer и mid по очереди (каждый на свою сторону из демок)
        for role, R in zip([r for r in ('rotator', 'roamer', 'mid') if r not in roles], rest):
            roles[role] = R
        S_ = {'id': 'ct%s_%d%d%d' % ({'stack': 'Stack', '212': 'Std', '111': 'Rot'}[rot], sp['A'], sp['mid'], sp['B']),
              'name': 'Расстановка %d-%d-%d (A-мид-B)' % (sp['A'], sp['mid'], sp['B']), 'rot': rot,
              'w': round(x['rounds'] / tot * len(sets['ct']), 2), 'roles': roles}
        if rot == 'stack':
            S_['stack'] = 'A' if sp['A'] >= 3 else 'B'
        cs.append(S_)
    # ---- лёрк и «там пусто — иду» ----
    lurk = {}
    for site in 'AB':
        lurk[site] = []
        for z in entries[site]:
            l = lanes_of[site].get(z)
            if not l:
                continue
            via = _route(A, site, l)
            if z in via:
                via = via[:via.index(z) + 1]
            lurk[site].append(dict({'via': via}, **({'stage': via[-2], 'entry': z} if len(via) >= 2 else {})))
    shift = {}
    for site in 'AB':
        c = collections.Counter()
        aim = collections.defaultdict(collections.Counter)
        for p in tp[site] + tp['mid']:
            a = p['area'].split(' / ')[0]
            if a in site_z[site] or a in entries[site] or p['type'] != 'standard':
                continue
            c[a] += p['rounds']; aim[a][p['angle']['zone'].split(' / ')[0]] += p['rounds']
        shift[site] = [{'pos': z, 'look': next(a for a, _ in aim[z].most_common() if a != z)}
                       for z, _ in c.most_common() if any(a != z for a in aim[z])][:2]
    role = {'anchorA': posd['A']['ctHold'], 'anchorB': posd['B']['ctHold'], 'rot212': by_share(ct['back'])[:3] or by_share(ct['mid'])[:2],
            'roam212': by_share(ct['mid'])[:3]}
    # (v319) мид для игры (GEO.ctMid / tMid): самая частая стандартная точка мидера CT и самая частая ранняя (≤ 35 с) точка
    # T в миде, и куда с них смотрят — вместо точек на пути между спавнами (на Mirage он идёт через A)
    def top(pts):
        p = max(pts, key=lambda q: q['rounds'])
        return {'x': p['x'], 'y': p['y']}, {'x': p['angle']['x'], 'y': p['angle']['y']}
    gm = {}
    cm = [p for p in ct['mid'] if p['type'] == 'standard']
    tm = [p for p in tp['mid'] if p['sec'] <= 35 and p['type'] == 'standard']
    if cm and tm:
        (gm['ct'], gm['ctLook']), (gm['t'], gm['tLook']) = top(cm), top(tm)
    out = {'tTactics': tt, 'pos': posd, 'ctSetups': cs, 'lurkPlans': lurk, 'shiftTo': shift, 'proRole': role, 'plays': {}}
    if gm and not TAC.get('entry'):
        out['geoMid'] = gm
    json.dump(out, open(os.path.join(PRO, 'tactics_game.json'), 'w'), ensure_ascii=False, indent=1)
    print('тактики для игры: T %d (%s), CT %d, зоны A %s' % (len(tt), collections.Counter(t['style'] for t in tt), len(cs), posd['A']['ctHold'][:4]))
    return out


if __name__ == '__main__':
    A = analyse()
    if '--game' in sys.argv:
        game_tactics(A)
