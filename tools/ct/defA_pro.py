"""Дефолт A у про (владелец 15.11: «дефолт A полностью: под разные расстановки — стак, один, двое на A; по демкам, куда летят гранаты,
какие зоны закрывают, как играет люркер — путь, тайминг подпуша»). Раунды демок карты, где T поставили бомбу на A не раньше LATE с
(дефолт → поздний выход; ранние — раш / быстрый выход, не дефолт). Группы — сколько CT на стороне A на 20-й с (1 / 2 / 3+).
По группе: гранаты T — зона приземления (смок, моли, флешка, HE), доля раундов и медиана времени до планта; T по зонам на 20 / 35 / 50 с;
люркер — T дальше всех от остальных на 25-й с: его зоны по времени и когда зашёл на сторону CT (относительно планта).
Запуск: python3 tools/ct/defA_pro.py --map mirage [--site=A] [--out=<json>]"""
import sys, os, json, collections
sys.path[:0] = [os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), g) for g in ('map', 'ct', 'pro', 'marks', 'logs', 'motion', 'page')]   # (15.11) модули tools/ разложены по группам
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'shadow'))
import mapdir  # noqa: E402
from demos import demo_names, rounds_of, ticks_of, event, tr  # noqa: E402
from pro_tactics import region  # noqa: E402
import round_plan as RP  # noqa: E402
MAP = mapdir.current()
arg = lambda k: next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--' + k + '=')), None)
SITE = arg('site') or 'A'
LATE = 45     # с от конца freeze — раньше плант: раш / быстрый выход (проектное число)
NADES = {'smokegrenade_detonate': 'смок', 'inferno_startburn': 'моли', 'flashbang_detonate': 'флешка', 'hegrenade_detonate': 'HE'}
zn = lambda x, y: RP.zkey(RP.zone(x, y)) or '?'


def main():
    G = collections.defaultdict(lambda: {'n': 0, 'nade': collections.defaultdict(list), 'pos': collections.defaultdict(collections.Counter),
                                         'lurk': collections.defaultdict(collections.Counter), 'lurkIn': [], 'tplant': []})
    for demo in demo_names():
        T = ticks_of(demo).sort_values('tick'); EV = {k: event(demo, k) for k in NADES}
        for r in rounds_of(demo):
            if r.get('site') != SITE or not r.get('tplant'): continue
            t0, tp = r['t0'], r['tplant']
            if (tp - t0) / 64 < LATE: continue
            at = lambda s: T[(T.tick >= t0 + s*64) & (T.tick < t0 + s*64 + 16)].drop_duplicates('steamid')
            g20 = at(20); ct = g20[g20.side == 'CT']
            if len(ct) < 4: continue
            nA = int((region(ct.x.values.astype(float), ct.y.values.astype(float)) == SITE).sum())
            key = '1' if nA <= 1 else ('2' if nA == 2 else '3+'); Gk = G[key]; Gk['n'] += 1; Gk['tplant'].append((tp - t0) / 64)
            tside = set(T[(T.tick >= t0) & (T.tick < t0 + 640) & (T.side == 'T')].steamid.unique())
            for k, nm in NADES.items():
                e = EV[k]; e = e[(e.tick >= t0) & (e.tick <= tp + 5*64)]
                if not len(e) or 'user_steamid' not in e: continue
                e = e[e.user_steamid.isin(tside)]
                x, y = tr(e.x.values, e.y.values)
                seen = set()
                for xx, yy, tk in zip(x, y, e.tick.values):
                    z = zn(xx, yy); kk = (nm, z)
                    Gk['nade'][kk].append((tk - tp) / 64); seen.add(kk)
            for s in (20, 35, 50):
                g = at(s); g = g[g.side == 'T']
                for xx, yy in zip(g.x.values, g.y.values): Gk['pos'][s][zn(xx, yy)] += 1
            g = at(25); g = g[g.side == 'T']
            if len(g) >= 3:
                P = np.c_[g.x.values, g.y.values].astype(float); D = [np.median(np.hypot(*(P - P[i]).T)) for i in range(len(P))]
                lid = g.steamid.values[int(np.argmax(D))]
                L = T[(T.steamid == lid) & (T.tick >= t0) & (T.tick <= tp)]
                prev = None
                for xx, yy, tk in zip(L.x.values[::8], L.y.values[::8], L.tick.values[::8]):
                    z = zn(xx, yy)
                    if z != prev: Gk['lurk'][int((tk - t0) / 64 // 10 * 10)][z] += 1; prev = z
    out = {}
    for key in ('1', '2', '3+'):
        Gk = G[key]; n = Gk['n']
        if not n: continue
        print('\n=== CT на %s к 20-й с: %s — раундов %d, плант — медиана %.0f с' % (SITE, key, n, np.median(Gk['tplant'])))
        rows = sorted(Gk['nade'].items(), key=lambda kv: -len(kv[1]))
        print('  гранаты T (доля раундов ≥ 15 %; время — с до планта, медиана):')
        for (nm, z), v in rows:
            if len(v) / n < 0.15: break
            print('    %-7s %-16s %3.0f%%  %+5.0f с' % (nm, z, 100 * len(v) / n, np.median(v)))
        for s in (20, 35, 50):
            print('  T на %d-й с: ' % s + ', '.join('%s %.1f' % (z, c / n) for z, c in Gk['pos'][s].most_common(7)))
        print('  люркер по времени (зоны, куда заходил): ' + ' | '.join('%d с: %s' % (t, ', '.join(z for z, _ in Gk['lurk'][t].most_common(3))) for t in sorted(Gk['lurk'])[:7]))
        out[key] = {'n': n, 'tplant': float(np.median(Gk['tplant'])),
                    'nade': [[nm, z, round(len(v) / n, 3), round(float(np.median(v)), 1)] for (nm, z), v in rows if len(v) / n >= 0.1],
                    'pos': {s: Gk['pos'][s].most_common(10) for s in (20, 35, 50)}}
    if arg('out'): json.dump(out, open(arg('out'), 'w'), ensure_ascii=False)


if __name__ == '__main__':
    main()
