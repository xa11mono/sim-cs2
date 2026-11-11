"""Тактики T, расстановки CT, клатчи, пост-плант — по демкам про (v561, 11.11.2026; определения — docs/PRO_PLAY.md §6з).

Без названий мест (для любой карты): сторона карты — по расстоянию до центров сайтов (A, если до A ближе 0,6 расстояния до B; B —
наоборот; иначе «мид»); спавны — среднее место команды в конце freeze time; «вперёд» у CT — ближе к спавну T, чем к своему.
Запуск: python3 tools/pro_tactics.py [--map ancient|mirage]; боты: python3 tools/pro_tactics.py --map ancient --bots tools/measure/runs/<метка>
Вывод — текст отчёта (в docs/reports/PRO_TACTICS_DEMOS.md переносить руками)."""
import sys, os, json, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
from demos import demo_names, rounds_of, ticks_of, event, MAPNAME, TICK  # noqa: E402
from eco_est import pro_rounds  # noqa: E402

UNIT = mapdir.radar(MAPNAME)['scale'] / 2.0          # ед. игры на px карты
SEC = [5, 10, 15, 20, 25, 30, 40]
Z = json.load(open(mapdir.path(MAPNAME, 'zones.json'), encoding='utf-8'))['zonemap']['points']
SITE = {}
for p in Z:
    k = p['name'].split('_')[0]
    if k in ('Asite', 'Bsite'): SITE[k[0]] = np.array([p['x'], p['y']], float)
_ZP = [(z['id'], [(q['x'], q['y']) for q in z['points']]) for z in json.load(open(mapdir.path(MAPNAME, 'zones.json'), encoding='utf-8'))['zonemap']['zones'] if len(z['points']) >= 3]
_ZB = [(zid, min(p[0] for p in P), max(p[0] for p in P), min(p[1] for p in P), max(p[1] for p in P)) for zid, P in _ZP]


def _inside(P, x, y):
    c = False; j = len(P) - 1
    for i in range(len(P)):
        if (P[i][1] > y) != (P[j][1] > y) and x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]: c = not c
        j = i
    return c


def zone_of(x, y):
    for (zid, P), (_, x0, x1, y0, y1) in zip(_ZP, _ZB):
        if x0 <= x <= x1 and y0 <= y <= y1 and _inside(P, x, y): return zid
    return None


WALK = 140   # ед/с: быстрее — бег (шаг CS2 ≈ 130 ед/с с винтовкой; проектный порог для разметки)


def region(x, y):
    dA = np.hypot(x - SITE['A'][0], y - SITE['A'][1]); dB = np.hypot(x - SITE['B'][0], y - SITE['B'][1])
    return np.where(dA < 0.6 * dB, 'A', np.where(dB < 0.6 * dA, 'B', 'M'))


def onsite(x, y, r=180):
    """на сайте: ближе r px к центру сайта (проектный радиус)"""
    for k, c in SITE.items():
        if np.hypot(x - c[0], y - c[1]) < r: return k
    return None


import pandas as pd  # noqa: E402
BT = {'full': 'фулл', 'eco': 'эко', 'force': 'форс', 'half': 'форс'}


def src_demos():
    """(раунды, тики живых, смерти, типы) по каждой демке про"""
    types = {}
    for half in pro_rounds():
        for r in half: types[r['id']] = r
    for demo in demo_names():
        yield rounds_of(demo), ticks_of(demo).sort_values('tick'), event(demo, 'player_death').sort_values('tick'), types


def src_bots(run_dir):
    """то же по записям матчей ботов (tools/measure/rec2.js: rec_<m>.json[.gz]) — для сравнения ботов с про одной меркой"""
    import glob, gzip
    for f in sorted(glob.glob(os.path.join(run_dir, 'rec_*.json*'))):
        d = json.load(gzip.open(f) if f.endswith('.gz') else open(f))
        P = pd.DataFrame([q for q in d['pos'] if q[5]], columns=['tick', 'steamid', 'ct', 'x', 'y', 'alive', 'yaw', 'w', 'k'])
        T = pd.DataFrame({'tick': P.tick, 'steamid': P.steamid, 'side': np.where(P.ct == 1, 'CT', 'T'), 'x': P.x.astype(float), 'y': P.y.astype(float)}).sort_values('tick')
        K = d['kills']
        dth = pd.DataFrame({'tick': [k[0] for k in K], 'user_team_num': [3 if k[6] == 'CT' else 2 for k in K], 'user_steamid': [k[5] for k in K]}).sort_values('tick')
        rs, types = [], {}
        for r in d['rounds']:
            if 't1' not in r: continue
            rid = '%s|%d' % (f, r['r']); pl = [q for q in d['plants'] if r['t0'] <= q[0] <= r['t1']]
            rs.append({'rid': rid, 't0': r['t0'], 't1': r['t1'], 'tplant': pl[0][0] if pl else None, 'site': pl[0][1] if pl else None,
                       'plantXY': (pl[0][2], pl[0][3]) if pl else None})
            types[rid] = {'pistol': r.get('tType') == 'pistol', 'winner': r.get('winner'),
                          'type': {'CT': BT.get(r.get('ctType'), 'форс'), 'T': BT.get(r.get('tType'), 'форс')}}
        yield rs, T, dth, types


def main(source):
    ct_setup = {s: collections.Counter() for s in SEC}; ct_setup_by = collections.defaultdict(collections.Counter)
    ct_fwd = collections.Counter(); n_ct = 0
    t_spread = {s: collections.Counter() for s in SEC}
    kinds = collections.Counter(); kinds_by = collections.defaultdict(collections.Counter)
    lurk = {'rounds': 0, 'with': 0, 'die_early': 0, 'die_t': [], 'join': 0}
    clutch = collections.defaultdict(list)
    post = {'n': 0, 'moves': [], 'see_bomb_far': []}
    hunt = collections.defaultdict(list)
    for rs, T, dth, types in source:
        for r in rs:
            R = types.get(r['rid'])
            if not R or R['pistol']: continue
            t0, t1 = r['t0'], r['t1']
            W = T[(T.tick >= t0) & (T.tick <= t1)]
            if not len(W): continue
            g0 = W[W.tick == W.tick.min()]
            spawn = {s: np.array([g0[g0.side == s].x.mean(), g0[g0.side == s].y.mean()]) for s in ('CT', 'T')}
            def at(sec):
                tk = t0 + sec * TICK; g = W[(W.tick >= tk) & (W.tick < tk + 16)]
                return g
            # --- расстановка CT: (A, мид, B) по секундам
            for s in SEC:
                g = at(s); c = g[g.side == 'CT']
                if len(c) < 5: continue
                reg = region(c.x.values, c.y.values); key = '%d-%d-%d' % ((reg == 'A').sum(), (reg == 'M').sum(), (reg == 'B').sum())
                ct_setup[s][key] += 1
                if s == 20:
                    ct_setup_by[R['type']['CT']][key] += 1; n_ct += 1
                    dT = np.hypot(c.x.values - spawn['T'][0], c.y.values - spawn['T'][1]); dC = np.hypot(c.x.values - spawn['CT'][0], c.y.values - spawn['CT'][1])
                    ct_fwd[int((dT < dC).sum())] += 1
                t = g[g.side == 'T']
                if len(t) >= 4:
                    rt = region(t.x.values, t.y.values)
                    t_spread[s]['%d-%d-%d' % ((rt == 'A').sum(), (rt == 'M').sum(), (rt == 'B').sum())] += 1
            # --- вид розыгрыша T (по признакам; не намерение IGL)
            tp = r['tplant']; site = r['site']
            tt = W[W.side == 'T']
            ids = tt.steamid.unique()
            tend = tp if tp else t1
            # «масса» T (≥ 3 в одной стороне карты) по времени до планта
            mass = []
            for tk in range(t0, tend, 2 * TICK):
                g = tt[(tt.tick >= tk) & (tt.tick < tk + 16)]
                if len(g) < 3: continue
                rg = region(g.x.values, g.y.values)
                for k in ('A', 'B'):
                    if (rg == k).sum() >= 3: mass.append((tk, k))
            first3 = None
            for tk in range(t0, tend, TICK // 2):
                g = tt[(tt.tick >= tk) & (tt.tick < tk + 16)]
                os_ = [onsite(x, y) for x, y in zip(g.x.values, g.y.values)]
                for k in ('A', 'B'):
                    if sum(1 for o in os_ if o == k) >= 3: first3 = ((tk - t0) / TICK, k); break
                if first3: break
            # направления входа на сайт планта: где был каждый T за 6 с до первого появления на сайте
            dirs = set()   # зона, из которой T вошёл на сайт планта (последняя зона не на сайте перед первым шагом на сайт), до планта + 5 с
            if tp and site:
                for i in ids:
                    gi = tt[(tt.steamid == i) & (tt.tick <= tp + 5 * TICK)]
                    last = None
                    for x, y in zip(gi.x.values, gi.y.values):
                        if onsite(x, y) == site:
                            if last: dirs.add(last)
                            break
                        zz = zone_of(x, y)
                        if zz: last = zz
            other = {'A': 'B', 'B': 'A'}
            fake = bool(site and any(k == other[site] for _, k in mass if _ < (tp or t1) - 8 * TICK))
            early = first3 and first3[0] <= 25 and first3[1] == site
            if not tp: kind = 'без планта'
            elif early and not fake: kind = 'раш / быстрый выход'
            elif fake: kind = 'масса на другом сайте → плант (фейк / перекол)'
            elif len(dirs) >= 2: kind = 'выход с 2+ направлений (сплит)'
            else: kind = 'выход с одного направления'
            kinds[kind] += 1; kinds_by[R['type']['T']][kind] += 1
            # --- лёркер: T дальше 0,5 карты… — проще: в момент 3 T на сайте планта (или планта) — T в другой стороне карты, живой
            if tp and site:
                lurk['rounds'] += 1
                g = tt[(tt.tick >= tp) & (tt.tick < tp + 16)]
                rg = region(g.x.values, g.y.values)
                lk = [i for i, k in zip(g.steamid.values, rg) if k == other[site]]
                if lk: lurk['with'] += 1
            # ранняя смерть одиночки T (≤ 30 с, вдали от своих — ближайший свой > 600 ед.)
            dr = dth[(dth.tick > t0) & (dth.tick <= t0 + 30 * TICK) & (dth.user_team_num == 2)]
            for tk, v in zip(dr.tick.values, dr.user_steamid.values):
                g = tt[(tt.tick >= tk - 32) & (tt.tick < tk)]
                me = g[g.steamid == v]
                if not len(me): continue
                oth = g[g.steamid != v]
                if len(oth) and np.min(np.hypot(oth.x.values - me.x.values[0], oth.y.values - me.y.values[0])) * UNIT > 600:
                    lurk['die_early'] += 1; lurk['die_t'].append((tk - t0) / TICK)
            # --- клатч: сторона осталась одна против ≥ 1
            alive = {'CT': 5, 'T': 5}; cl = None
            dd = dth[(dth.tick > t0) & (dth.tick <= t1)]
            for tk, ut in zip(dd.tick.values, dd.user_team_num.values):
                s = 'CT' if ut == 3 else 'T' if ut == 2 else None
                if not s: continue
                alive[s] -= 1
                o = 'T' if s == 'CT' else 'CT'
                if cl is None and alive[s] == 1 and alive[o] >= 1: cl = (tk, s, alive[o])
                if cl is None and alive[o] == 1 and alive[s] >= 1: cl = (tk, o, alive[s])
            if cl:
                tk, s, n = cl
                g = W[(W.side == s) & (W.tick >= tk) & (W.tick < tk + 16)]
                if len(g) == 1:
                    i = g.steamid.values[0]
                    me = W[(W.steamid == i) & (W.tick >= tk)].sort_values('tick')
                    if len(me) > 4:
                        v = np.hypot(np.diff(me.x.values), np.diff(me.y.values)) * UNIT / (np.diff(me.tick.values) / TICK)
                        planted = bool(tp and tp < tk)
                        left = ((tp + 40 * TICK) - tk) / TICK if planted else (t0 + 115 * TICK - tk) / TICK
                        won = R['winner'] == s
                        clutch[(s, min(n, 3), planted)].append({'run': float((v > WALK).mean()), 'still': float((v < 30).mean()),
                                                               'left': left, 'dur': (me.tick.values[-1] - tk) / TICK, 'won': won})
            # --- пост-плант T: смены места (сдвиг > 250 ед. между стоянками) до первой смерти после планта
            if tp:
                dd2 = dth[(dth.tick > tp) & (dth.tick <= t1)]
                tend2 = int(dd2.tick.min()) if len(dd2) else t1
                if tend2 - tp > 8 * TICK:
                    post['n'] += 1
                    for i in tt[(tt.tick >= tp) & (tt.tick < tp + 16)].steamid.values:
                        gi = tt[(tt.steamid == i) & (tt.tick >= tp + 3 * TICK) & (tt.tick <= tend2)].sort_values('tick')
                        if len(gi) < 4: continue
                        x, y, tk_ = gi.x.values, gi.y.values, gi.tick.values
                        v = np.r_[0, np.hypot(np.diff(x), np.diff(y)) * UNIT / (np.diff(tk_) / TICK)]
                        stops = []; k = 0   # стоянки: скорость < 30 ед/с не меньше 1,5 с (6 отсчётов по 0,25 с)
                        while k < len(v):
                            if v[k] < 30:
                                j = k
                                while j < len(v) and v[j] < 30: j += 1
                                if j - k >= 6: stops.append((x[k], y[k]))
                                k = j
                            else: k += 1
                        mv = sum(1 for a in range(1, len(stops)) if np.hypot(stops[a][0] - stops[a-1][0], stops[a][1] - stops[a-1][1]) * UNIT > 250)
                        post.setdefault('stops', []).append(len(stops))
                        post['moves'].append((mv, (tend2 - tp) / TICK))
                        post['see_bomb_far'].append(float(np.hypot(x[-1] - r['plantXY'][0], y[-1] - r['plantXY'][1]) * UNIT))
            # --- добивание: 1 против ≥ 3 — сколько длится, далеко ли друг от друга большинство
            if cl and cl[2] >= 3:
                tk, s, n = cl; o = 'T' if s == 'CT' else 'CT'
                g = W[(W.side == o) & (W.tick >= tk + 2 * TICK) & (W.tick < tk + 2 * TICK + 16)]
                if len(g) >= 2:
                    P = np.c_[g.x.values, g.y.values]; dmin = [np.min([np.hypot(*(P[a] - P[b])) for b in range(len(P)) if b != a]) * UNIT for a in range(len(P))]
                    hunt[o].append({'nearest': float(np.median(dmin))})
    out = []
    pr = lambda *a: out.append(' '.join(str(x) for x in a))
    pr('# Демки про (%s): тактики T, расстановки CT, клатчи, пост-плант — tools/pro_tactics.py' % MAPNAME)
    pr('\n## Расстановка CT (A-мид-B) — доля раундов, без пистолеток')
    for s in (10, 15, 20, 25):
        N = sum(ct_setup[s].values()) or 1
        pr('- %d с (n %d): ' % (s, N) + ', '.join('%s %d %%' % (k, round(100 * v / N)) for k, v in ct_setup[s].most_common(8)))
    for ty, C in ct_setup_by.items():
        N = sum(C.values()) or 1
        pr('- 20 с, закуп CT %s (n %d): ' % (ty, N) + ', '.join('%s %d %%' % (k, round(100 * v / N)) for k, v in C.most_common(6)))
    N = sum(ct_fwd.values()) or 1
    pr('- CT «вперёд» (ближе к спавну T) на 20 с — сколько игроков: ' + ', '.join('%d — %d %%' % (k, round(100 * v / N)) for k, v in sorted(ct_fwd.items())))
    pr('\n## T по сторонам карты (A-мид-B), ≥ 4 живых')
    for s in (10, 20, 30, 40):
        N = sum(t_spread[s].values()) or 1
        pr('- %d с (n %d): ' % (s, N) + ', '.join('%s %d %%' % (k, round(100 * v / N)) for k, v in t_spread[s].most_common(6)))
    pr('\n## Вид розыгрыша T по признакам (не намерение IGL)')
    N = sum(kinds.values()) or 1
    for k, v in kinds.most_common(): pr('- %s: %d %%' % (k, round(100 * v / N)))
    for ty, C in kinds_by.items():
        M = sum(C.values()) or 1
        pr('- закуп T %s (n %d): ' % (ty, M) + ', '.join('%s %d %%' % (k, round(100 * v / M)) for k, v in C.most_common()))
    pr('\n## Лёрк и ранняя смерть одиночки T')
    pr('- в момент планта живой T на другой стороне карты: %d %% раундов с плантом (n %d)' % (round(100 * lurk['with'] / max(1, lurk['rounds'])), lurk['rounds']))
    pr('- T умер в первые 30 с один (ближайший свой > 600 ед.): %.2f за раунд; медиана %s с' % (lurk['die_early'] / max(1, n_ct), round(float(np.median(lurk['die_t'])), 1) if lurk['die_t'] else '—'))
    pr('\n## Клатчи (сторона, против скольких (3 = 3+), бомба стоит) — доля времени бегом / стоя, сколько оставалось, побед')
    for k in sorted(clutch):
        L = clutch[k]
        pr('- %s 1 на %s%s, n %d: бегом %d %%, стоит %d %%, оставалось %d с, длился %d с, побед %d %%' % (
            k[0], k[1] if k[1] < 3 else '3+', ', бомба стоит' if k[2] else '', len(L), round(100 * np.mean([x['run'] for x in L])),
            round(100 * np.mean([x['still'] for x in L])), round(np.median([x['left'] for x in L])), round(np.median([x['dur'] for x in L])),
            round(100 * np.mean([x['won'] for x in L]))))
    pr('\n## Пост-плант T (от 3 с после планта до первой смерти, ≥ 8 с)')
    mv = [m for m, _ in post['moves']]
    pr('- раундов %d, игроков %d: переходов между стоянками (стоит ≥ 1,5 с, сдвиг > 250 ед.) — 0: %d %%, 1: %d %%, 2+: %d %%; медиана длительности %d с' % (
        post['n'], len(mv), round(100 * np.mean([m == 0 for m in mv])), round(100 * np.mean([m == 1 for m in mv])), round(100 * np.mean([m >= 2 for m in mv])),
        round(np.median([d for _, d in post['moves']]))))
    pr('- игроков без единой стоянки ≥ 1,5 с: %d %%' % round(100 * np.mean([n == 0 for n in post['stops']])))
    pr('- расстояние до бомбы в конце: медиана %d ед., 75 %% — %d ед.' % (np.median(post['see_bomb_far']), np.percentile(post['see_bomb_far'], 75)))
    pr('\n## Добивание (1 против 3+): медиана расстояния до ближайшего своего у большинства через 2 с')
    for s, L in hunt.items(): pr('- %s (n %d): %d ед.' % (s, len(L), np.median([x['nearest'] for x in L])))
    print('\n'.join(out))


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--bots':
        print('(записи ботов: %s)' % sys.argv[2]); main(src_bots(sys.argv[2]))
    else:
        main(src_demos())
