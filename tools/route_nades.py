"""Г1 (21.10): гранаты по маршрутам выхода T — эталон из демок про и та же таблица у ботов.

python3 tools/route_nades.py [--map mirage] pro            → <pro_dir>/route_nades.json + таблица в консоль
python3 tools/route_nades.py [--map mirage] <папка rec_*>  → та же таблица у ботов (и сравнение с эталоном, если он есть)
python3 tools/route_nades.py [--map mirage] game           → планы гранат в набор карты: tactics.json → nadePlans, tTactics[].exit

Определения (одни у про и у ботов):
  * Раунд берётся, если у T закуп (≥ 4 T с винтовкой / AWP / SMG в руках в первые 30 с) — гранаты маршрута кидают, когда они есть.
  * Ветка игрока T — первая зона фронта (стороны A / B / мида по набору карты: regions рецепта или tactics.sides) после
    последнего пребывания вне фронта, по пути до планта / смерти / конца раунда.
  * Выход раунда — ветка, которой шло больше всего T (≥ 2); сайт планта — распределением. Ключ таблицы — ветка.
  * Граната — (тип, зона разрыва) по zones.json набора (вне зон — ближайшая в NN_R); у молотова — где загорелся. До планта.
  * Доля — % раундов этого выхода, где такую гранату кинули хотя бы раз; t — медиана секунды броска от конца freeze.
  * «ответ CT» — то же у CT; рядом доля по всем раундам с закупом T (без условия на выход), чтобы видеть, что CT кидают
    именно на этот выход.
  * Тушение: смок разорвался в 150 ед. карты от горящего молотова соперника (горит 7 с от начала) — % смоков, на раунд.
"""
import os, sys, json, glob, gzip, collections
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from demos import demo_names, rounds_of, event, tr, DEMOS, TICK, MAPNAME  # noqa: E402
import mapdir  # noqa: E402
import pandas as pd  # noqa: E402
from tactics_bake import zone as zone0, ZP, REG, SIDES  # noqa: E402

PRO = mapdir.pro_dir(MAPNAME)
NN_R = 120   # разрыв вне зон (флешка в воздухе) — ближайшая зона по центру, если ближе 120 ед. карты — проектное число
_ZC = [(nm, P.vertices.mean(axis=0)) for nm, P in ZP]


def zone(x, y):
    z = zone0(x, y)
    if z: return z
    nm, c = min(_ZC, key=lambda q: (q[1][0] - x) ** 2 + (q[1][1] - y) ** 2)
    return nm if (c[0] - x) ** 2 + (c[1] - y) ** 2 < NN_R ** 2 else None


def base(z):
    return (z or '').split(' → ')[0]


# ветка — первая зона стороны A / B / мида по набору карты (Mirage — regions рецепта, Ancient — tactics.sides); всё прочее
# (спавн T, Split, Tunnel, T Apps…) — ещё сторона T
FRONT = {base(z) for k in ('A', 'B', 'mid') for z in REG.get(k, [])} | {z for k in ('A', 'B', 'M') for z in (SIDES or {}).get(k, [])}
BUY_W = ('AK-47', 'M4A1-S', 'M4A4', 'AWP', 'FAMAS', 'Galil AR', 'SG 553', 'AUG', 'SSG 08', 'MP9', 'MAC-10', 'MP7', 'UMP-45',
         'P90', 'MP5-SD', 'PP-Bizon', 'G3SG1', 'SCAR-20', 'XM1014', 'Nova', 'MAG-7', 'Sawed-Off', 'M249', 'Negev')
TYPES = {'smoke': 'смок', 'flash': 'флешка', 'he': 'HE', 'molotov': 'молотов', 'molly': 'молотов'}
EXT_R, BURN = 150, 7 * TICK   # тушение: радиус (ед. карты) и сколько горит — проектные числа (молотов в CS2 ≈ 7 с)
MIN_SHOW = 0.10               # в таблицу — гранаты, кинутые хотя бы в 10 % раундов выхода


def branch_of(seq):
    """seq — зоны игрока по порядку; ветка — первая зона фронта (A / B / мид) после последнего пребывания на стороне T"""
    last = max([i for i, z in enumerate(seq) if base(z) not in FRONT], default=-1)
    return next((base(z) for z in seq[last + 1:] if base(z) in FRONT), None)


def round_row(paths, nades, plant_site, t_plant):
    """paths: {игрок: [(t, x, y), …]} T до планта/смерти; nades: [(t броска, t разрыва, side, type, x, y)] (с от старта; x,y —
    разрыв/цель, ед. карты) → {exit, site, tExit, T: {(type, zone): [t, до выхода?]}, CT: {...}, ext: [смоков, тушений]}"""
    br, first = {}, {}
    for p, pts in paths.items():
        seq, tz = [], {}
        for t, x, y in pts:
            z = zone(x, y)
            if z and (not seq or seq[-1] != z): seq.append(z)
            if z and base(z) not in tz: tz[base(z)] = t
        b = branch_of(seq)
        if b: br[p] = b; first[p] = tz.get(b)
    c = collections.Counter(br.values())
    if not c or c.most_common(1)[0][1] < 2:
        return None
    ex = c.most_common(1)[0][0]
    t_exit = float(np.median([first[p] for p in br if br[p] == ex and first[p] is not None]))
    foot = set()   # зоны, где шли игроки выхода (по ним тактике игры ставится её выход)
    for p, pts in paths.items():
        if br.get(p) == ex: foot |= {base(zone0(x, y)) for _, x, y in pts if zone0(x, y)}
    got = {'T': {}, 'CT': {}}
    for t, td, side, ty, x, y in nades:
        if t_plant is not None and t > t_plant: continue
        k = (TYPES.get(ty, ty), base(zone(x, y)) or '?')
        if k not in got[side] or t < got[side][k][0]: got[side][k] = [round(t, 1), t < t_exit, round(x), round(y)]
    # тушение: смок разорвался на горящем молотове соперника
    mol = [(td, s, x, y) for t, td, s, ty, x, y in nades if ty in ('molotov', 'molly')]
    sm = [(td, s, x, y) for t, td, s, ty, x, y in nades if ty == 'smoke']
    ext = sum(1 for t, s, x, y in sm if any(s2 != s and 0 <= t - t2 <= BURN / TICK and (x - x2) ** 2 + (y - y2) ** 2 < EXT_R ** 2
                                              for t2, s2, x2, y2 in mol))
    return {'exit': ex, 'site': plant_site or '—', 'tExit': round(t_exit, 1), 'lanes': dict(c), 'T': got['T'], 'CT': got['CT'],
            'ext': [len(sm), ext], 'foot': sorted(foot)}


# ------------------------------------------------------------------ про
def pro_rows():
    th = json.load(open(mapdir.path(MAPNAME, 'throws.json')))['throws']
    by = collections.defaultdict(list)
    for t in th:
        if t['type'] == 'decoy' or not t.get('det'): continue
        x, y = tr(t['det']['pos'][0], t['det']['pos'][1])
        dt = t['det'].get('dt') or 0
        by[t['demo']].append((t['tick'], t['tick'] + dt * TICK, t['side'], t['type'], float(x), float(y)))
    rows = []
    for demo in demo_names():
        rs = rounds_of(demo)
        if not rs or demo not in by: continue
        tk = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'),
                         usecols=['tick', 'steamid', 'team_num', 'X', 'Y', 'is_alive', 'is_warmup_period', 'active_weapon_name'], low_memory=False)
        tk = tk[(tk.is_alive == True) & (tk.is_warmup_period != True)]  # noqa: E712
        X, Y = tr(tk.X.values, tk.Y.values)
        tk = tk.assign(x=X, y=Y).sort_values('tick')
        TT = tk.tick.values
        for r in rs:
            t0, t1 = r['t0'], r['t1']
            end = r['tplant'] or t1
            a, b = np.searchsorted(TT, t0), np.searchsorted(TT, end)
            w = tk.iloc[a:b]
            wt = w[w.team_num == 2]
            if not len(wt): continue
            early = wt[wt.tick < t0 + 30 * TICK]
            buy = early.groupby('steamid').active_weapon_name.agg(lambda s: any(v in BUY_W for v in s)).sum()
            if buy < 4: continue
            paths = {sid: list(zip((g.tick.values - t0) / TICK, g.x.values, g.y.values))[::4] for sid, g in wt.groupby('steamid')}
            nd = [((tt - t0) / TICK, (td - t0) / TICK, side, ty, x, y) for tt, td, side, ty, x, y in by[demo] if t0 <= tt < t1]
            row = round_row(paths, nd, r['site'], ((r['tplant'] - t0) / TICK) if r['tplant'] else None)
            if row:
                row['rid'] = r['rid']; rows.append(row)
    return rows


# ------------------------------------------------------------------ боты
BOT_BUY = ('AK', 'M4S', 'M4', 'AWP', 'MAC10', 'GALIL', 'FAMAS', 'MP9', 'MP7', 'SSG', 'AUG', 'SG553', 'UMP', 'P90', 'MP5')


def bot_rows(folder):
    """rec_*.json(.gz) сторожа (tools/measure/rec2.js): rounds {t0, t1, plant, site}, pos [tick, id, ct?, x, y, alive, facing, оружие],
    nades [tick, team, type, id, …] — бросок, det [tick, team, type, x, y, …, id] — разрыв (координаты — те же, что у зон)"""
    rows = []
    for f in sorted(glob.glob(os.path.join(folder, 'rec_*.json*'))):
        d = json.load(gzip.open(f) if f.endswith('.gz') else open(f))
        rows += bot_rounds(d)
    return rows


def bot_rounds(d):
    pos = collections.defaultdict(list)
    for p in d['pos']:
        if p[2] == 0 and p[5]: pos[p[1]].append((p[0], p[3], p[4], p[7]))
    thr = collections.defaultdict(list)   # (кто, тип) → тики бросков
    for n in d['nades']: thr[(n[3], n[2])].append(n[0])
    out = []
    for r in d['rounds']:
        t0, t1 = r['t0'], r.get('t1')
        if t1 is None: continue
        end = r.get('plant') or t1
        paths, buy = {}, 0
        for who, P in pos.items():
            pts = [q for q in P if t0 <= q[0] < end]
            if not pts: continue
            if any(q[3] in BOT_BUY for q in pts if q[0] < t0 + 30 * TICK): buy += 1
            paths[who] = [((q[0] - t0) / TICK, q[1], q[2]) for q in pts][::4]
        if buy < 4: continue
        nd = []
        for e in d['det']:
            if not (t0 <= e[0] < t1) or e[2] == 'decoy': continue
            tt = [t for t in thr.get((e[6], e[2]), []) if t0 <= t <= e[0]]
            tb = max(tt) if tt else e[0]
            nd.append(((tb - t0) / TICK, (e[0] - t0) / TICK, e[1], e[2], e[3], e[4]))
        row = round_row(paths, nd, r.get('site') if r.get('plant') else None, ((r['plant'] - t0) / TICK) if r.get('plant') else None)
        if row: out.append(row)
    return out


# ------------------------------------------------------------------ планы для игры
ITEM_MIN = 0.10    # граната входит в план, если про кидают её хотя бы в 10 % раундов своего вида — проектное число
RESP_LIFT = 1.2    # ответ CT на выход: после выхода T этим путём кидают в 1,2 раза чаще, чем после выхода вообще — проектное число
TYPE_LU = {'smoke': 'смок', 'flash': 'флешка', 'molly': 'молотов', 'he': 'HE'}


def game_plans(rows):
    """Планы гранат из демок (Г1). Граната плана — (сторона, тип, зона разрыва, фаза) со списком лайнапов про (lineups.json:
    pro + proExtra), чья цель в этой зоне; нет такого — точка разрыва про (to), бросок подбирает физика. Разрыв вне зон (?) не берётся. Набор раунда берётся как у про целиком (сочетание гранат одного раунда про с его
    частотой, а не каждая граната своей вероятностью): гранаты сочетания летят все, если есть граната и кидающий рядом.
      exits[ветка].T — сочетания T в раундах этого выхода; фаза гранаты: start — про кидают её до выхода (в большинстве
        раундов), exec — после;
      ctTimed — сочетания CT по всем раундам (CT выход T заранее не знают): фаза timed, t — медиана секунды;
      ctResp[ветка] — ответ CT: гранаты, которые в раундах этого выхода CT кидают в RESP_LIFT раз чаще, чем вообще, и в
        большинстве случаев уже после выхода T; летят, когда команда CT узнала (слышала / видела T в зонах выхода), если ещё
        не летели в этом раунде."""
    LU = json.load(open(mapdir.path(MAPNAME, 'lineups.json')))
    lu_by = collections.defaultdict(list)
    for L in LU['pro'] + LU['proExtra']:
        lu_by[(L['team'], TYPE_LU.get(L['type'], L['type']), base(zone(L['to']['x'], L['to']['y'])) or '?')].append(L['id'])
    items, idx, miss = [], {}, collections.defaultdict(dict)
    TYPE_EN = {v: k for k, v in TYPE_LU.items()}

    def item(side, k, t, phase, xy):
        """граната плана; без лайнапа про в этой зоне — lineups пустой, to — медианная точка разрыва у про: кидает физика (В5)"""
        key = (side, k[0], k[1], phase)
        if key not in idx:
            ids = lu_by.get((side, k[0], k[1]), [])
            if not ids: miss['%s %s' % (side, phase)]['%s %s' % k] = 1
            idx[key] = len(items)
            items.append({'team': side, 'type': TYPE_EN[k[0]], 'zone': k[1], 'phase': phase, 't': t, 'lineups': ids,
                          'to': {'x': int(np.median([q[0] for q in xy])), 'y': int(np.median([q[1] for q in xy]))}})
        return idx[key]

    def stats(R, side):
        C = collections.Counter(); TM = collections.defaultdict(list); PRE = collections.Counter(); XY = collections.defaultdict(list)
        for r in R:
            for k, (t, b, x, y) in r[side].items():
                C[k] += 1; TM[k].append(t); PRE[k] += b; XY[k].append((x, y))
        return C, TM, PRE, XY

    def sigs(R, side, num):
        sig = collections.Counter(tuple(sorted(num[k] for k in r[side] if k in num)) for r in R)
        return [[v, list(k)] for k, v in sig.most_common()]

    out = {'_about': 'Г1: планы гранат из демок про (tools/route_nades.py game); сочетания — [раундов про, [номера items]]',
           'items': items, 'ctTimed': None, 'exits': {}, 'ctResp': {}}
    n = len(rows)
    C, TM, _, XY = stats(rows, 'CT')
    num = {k: item('CT', k, round(float(np.median(TM[k])), 1), 'timed', XY[k]) for k, v in C.items() if v / n >= ITEM_MIN and k[1] != '?'}
    out['ctTimed'] = sigs(rows, 'CT', num)
    ex = collections.defaultdict(list)
    for r in rows: ex[r['exit']].append(r)
    CA = stats(rows, 'CT')[0]
    for e, R in sorted(ex.items(), key=lambda kv: -len(kv[1])):
        m = len(R)
        if m < 15: continue
        sites = collections.Counter(r['site'] for r in R)
        foot = collections.Counter(z for r in R for z in r['foot'])
        E = out['exits'][e] = {'n': m, 'share': round(m / n, 3), 'sites': {k: round(v / m, 2) for k, v in sites.items()},
                               'tExit': round(float(np.median([r['tExit'] for r in R])), 1),
                               'foot': {z: round(v / m, 2) for z, v in foot.most_common() if v / m >= 0.15}}
        C, TM, PRE, XY = stats(R, 'T')
        num = {k: item('T', k, round(float(np.median(TM[k])), 1), 'start' if PRE[k] / v > 0.5 else 'exec', XY[k])
               for k, v in C.items() if v / m >= ITEM_MIN and k[1] != '?'}
        E['T'] = sigs(R, 'T', num)
        C, TM, PRE, XY = stats(R, 'CT')
        out['ctResp'][e] = [item('CT', k, round(float(np.median(TM[k])), 1), 'resp', XY[k]) for k, v in C.items()
                            if v / m >= ITEM_MIN and v / m >= RESP_LIFT * CA[k] / n and PRE[k] / v <= 0.5 and k[1] != '?']
    out['noLineup'] = {k: sorted(v) for k, v in miss.items()}
    return out


def tactic_exit(tac, ex):
    """выход тактики игры: тот выход про, по зонам которого идёт её первая группа (via + stage), среди выходов её сайта;
    без маршрута — самый частый выход сайта"""
    via = list(tac.get('rushVia') or [])
    for g in tac.get('groups', [])[:1]: via += (g.get('via') or []) + ([g['stage']] if g.get('stage') else [])
    for z in via:   # маршрут идёт через зону самого выхода — это он
        if z in ex: return z
    site = tac['site']
    cand = {e: E for e, E in ex.items() if E['sites'].get(site, 0) >= 0.15}
    if not cand: cand = ex
    score = {e: sum(E['foot'].get(z, 0) for z in set(via)) for e, E in cand.items()}
    best = max(score.values()) if score else 0
    if best > 0: return max(score, key=score.get)
    return max(cand, key=lambda e: cand[e]['sites'].get(site, 0) * cand[e]['n'])


# ------------------------------------------------------------------ сводка
def table(rows):
    """ключ — ветка выхода (сайт планта — распределением); по каждой гранате: p — доля раундов выхода, pAll — по всем раундам,
    t — медиана секунды броска; у T pre — доля бросков до выхода (до того, как ветка дошла до своей зоны), у CT post — после"""
    ex = collections.defaultdict(list)
    for r in rows: ex[r['exit']].append(r)
    allc = {'T': collections.Counter(), 'CT': collections.Counter()}
    for r in rows:
        for side in allc: allc[side].update(r[side].keys())
    out = {'map': MAPNAME, 'rounds': len(rows), 'exits': {}}
    for k, R in sorted(ex.items(), key=lambda kv: -len(kv[1])):
        n = len(R)
        sites = collections.Counter(r['site'] for r in R)
        ln = collections.Counter()
        for r in R: ln.update(r['lanes'])
        e = {'n': n, 'share': round(n / len(rows), 3), 'sites': {s: round(v / n, 2) for s, v in sites.most_common()},
             'tExit': round(float(np.median([r['tExit'] for r in R])), 1),
             'lanes': {l: round(v / n, 1) for l, v in ln.most_common(4)}, 'T': [], 'CT': []}
        for side in ('T', 'CT'):
            C = collections.Counter(); TM = collections.defaultdict(list); PRE = collections.Counter()
            for r in R:
                for kk, (t, pre, *_) in r[side].items(): C[kk] += 1; TM[kk].append(t); PRE[kk] += pre
            for kk, v in C.most_common():
                if v / n < MIN_SHOW: break
                e[side].append({'type': kk[0], 'zone': kk[1], 'p': round(v / n, 3), 'pAll': round(allc[side][kk] / len(rows), 3),
                                't': round(float(np.median(TM[kk])), 1),
                                ('pre' if side == 'T' else 'post'): round((PRE[kk] if side == 'T' else v - PRE[kk]) / v, 2)})
        out['exits'][k] = e
    sm = sum(r['ext'][0] for r in rows); xt = sum(r['ext'][1] for r in rows)
    out['extinguish'] = {'smokes': sm, 'onMolly': xt, 'pct': round(100 * xt / max(1, sm), 1), 'perRound': round(xt / max(1, len(rows)), 2)}
    return out


def show(out, top=12):
    print('== %s: раундов с закупом T и выходом: %d' % (out['map'], out['rounds']))
    for k, e in out['exits'].items():
        if e['n'] < 20: continue
        print('\n### %s — %d раундов (%.0f %%), плант %s, выход на %.0f-й с, игроков по веткам: %s' % (
            k, e['n'], 100 * e['share'], e['sites'], e['tExit'], e['lanes']))
        print('  T: ' + '; '.join('%s %s %.0f %% [все %.0f] %.0f с%s' % (i['type'], i['zone'], 100 * i['p'], 100 * i['pAll'], i['t'],
                                                                     '' if i['pre'] > .5 else ' (после выхода)') for i in e['T'][:top]))
        print('  CT: ' + '; '.join('%s %s %.0f %% [все %.0f] %.0f с, после выхода %.0f %%' % (
            i['type'], i['zone'], 100 * i['p'], 100 * i['pAll'], i['t'], 100 * i['post']) for i in e['CT'][:top]))
    print('\nтушение:', out['extinguish'])


def compare(pro, bot, top=10):
    """таблица «про / боты» по выходам: гранаты эталона (p ≥ 30 % у про) и их доля у ботов; провал — разница больше 10 п. п."""
    print('\n== сравнение с про (%s): гранаты, которые у про ≥ 30 %% раундов выхода' % pro['map'])
    for k, e in pro['exits'].items():
        b = bot['exits'].get(k)
        if e['n'] < 20: continue
        bn = b['n'] if b else 0
        print('\n### %s — про %d раундов (%.0f %%), боты %d (%.0f %%)' % (k, e['n'], 100 * e['share'], bn, 100 * (b['share'] if b else 0)))
        for side in ('T', 'CT'):
            bi = {(i['type'], i['zone']): i for i in (b[side] if b else [])}
            for i in e[side]:
                if i['p'] < 0.30: continue
                j = bi.get((i['type'], i['zone']))
                pb = j['p'] if j else 0.0
                bad = abs(pb - i['p']) > 0.10
                print('  %s %-8s %-18s про %3.0f %% (%2.0f с)  боты %3.0f %%%s  %s' % (
                    side, i['type'], i['zone'], 100 * i['p'], i['t'], 100 * pb, (' (%2.0f с)' % j['t']) if j else '       ', '✗' if bad else '✓'))


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else 'pro'
    if arg == 'game':
        P = game_plans(pro_rows())
        tp = mapdir.path(MAPNAME, 'tactics.json'); TJ = json.load(open(tp, encoding='utf-8'))
        for t in TJ['tTactics']: t['exit'] = tactic_exit(t, P['exits'])
        TJ['nadePlans'] = '@@PLANS@@'
        txt = json.dumps(TJ, ensure_ascii=False, indent=1)   # планы — компактно, по строке на гранату / выход
        pl = '{\n' + ',\n'.join('  %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False, separators=(',', ':')))
                                for k, v in P.items() if k != 'items') + \
             ',\n  "items": [\n' + ',\n'.join('   ' + json.dumps(i, ensure_ascii=False, separators=(',', ':')) for i in P['items']) + '\n  ]\n }'
        open(tp, 'w', encoding='utf-8').write(txt.replace('"@@PLANS@@"', pl) + '\n')
        assert json.load(open(tp, encoding='utf-8'))['nadePlans']['items'] == P['items']
        print('гранат в планах:', len(P['items']), ', из них без лайнапа:', sum(1 for i in P['items'] if not i['lineups']))
        for t in TJ['tTactics']: print(' ', t['id'], t['site'], '→', t['exit'])
        print('ctTimed сочетаний', len(P['ctTimed']), 'первые', P['ctTimed'][:3])
        for e, E in P['exits'].items(): print(e, E['n'], 'сочетаний T', len(E['T']), E['T'][:2], '| ответ CT', [P['items'][i]['type'] + ' ' + P['items'][i]['zone'] for i in P['ctResp'][e]])
    elif arg == 'pro':
        rows = pro_rows()
        out = table(rows)
        json.dump(out, open(os.path.join(PRO, 'route_nades.json'), 'w'), ensure_ascii=False, indent=1)
        show(out)
    else:
        rows = []
        for a in sys.argv[1:]: rows += bot_rows(a)
        out = table(rows)
        show(out)
        ref = os.path.join(PRO, 'route_nades.json')
        if os.path.exists(ref): compare(json.load(open(ref)), out)
