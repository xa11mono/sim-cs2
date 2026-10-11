"""Тактики про по демкам Ancient (v254, 11.10): из чего составлены выходы T и расстановки CT.

T (раунды с плантом): у каждого T — через какой вход он пришёл к сайту плана (последняя «входная» зона до планта):
  A: main (A Main/Long), short (Short/Donut), ct (CT Lane/Temple/CT Spawn); B: ramp (Ramp), cave (Cave/Dark),
  ct (Second Lane/Back Halls/First Lane); никуда не входил — far (лёркер/отставший). Подпись тактики = сайт + сколько
  игроков каким входом + темп (плант < 40 с — быстро, > 75 с — поздно). Плюс модальный маршрут по зонам для каждого входа.
CT: на 20-й с — сколько CT на стороне A / в миде / на B; на 12-й с — кто вышел вперёд за инфой (зоны «вперёд»).
Запуск: python3 tools/tactics_bake.py → data/pro/tactics.json + сводка в консоль."""
import os, sys, json, collections
import numpy as np
from matplotlib.path import Path
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); sys.path.insert(0, HERE)
from ancient_demos import demo_names, rounds_of, ticks_of  # noqa: E402

Z = json.load(open(os.path.join(ROOT, 'src', 'zones.json')))['zones']
ZP = [((z.get('name') or '').split(' / ')[0], Path(np.array([[p['x'], p['y']] if isinstance(p, dict) else p for p in z['pts']]))) for z in Z if z.get('name')]


def zone(x, y):
    for nm, p in ZP:
        if p.contains_point((x, y)): return nm
    return None


ENTRY = {'A': {'A Main': 'main', 'Long': 'main', 'Short': 'short', 'Donut': 'short', 'CT Lane': 'ct', 'Temple': 'ct', 'CT Spawn': 'ct'},
         'B': {'Ramp': 'ramp', 'Cave': 'cave', 'Dark': 'cave', 'Second Lane': 'ct', 'Back Halls': 'ct', 'First Lane': 'ct'}}
SIDE_A = {'A Site', 'Back Site', 'Triple Box', 'Plat', 'Box', 'Boost', 'Def', 'Single', 'Temple', 'CT Lane', 'Long', 'A Main'}
SIDE_B = {'B Site', 'Site B', '90', 'Dark Box', 'Bonger', 'First Lane', 'Second Lane', 'Back Halls', 'Cave', 'Dark', 'Ramp', 'Lamp Room', 'Rat', 'Wood'}
MID = {'Mid', 'Top Mid', 'Sniper Nest', 'Connector', 'Jungle', 'Xbox', 'Chamber Lane', 'Donut', 'Short', 'Triple', 'Lower Mid', 'Alley'}
FORWARD = {'Donut', 'Lower Mid', 'Mid', 'A Main', 'Long', 'Ramp', 'Cave', 'Dark', 'Lamp Room', 'T Lower', 'Chamber Lane', 'Split'}


ANCH = {'A': (547, 374), 'B': (1633, 793), 'M': (1000, 760)}


def side_of(z, x, y):
    if z in SIDE_A: return 'A'
    if z in SIDE_B: return 'B'
    if z in MID: return 'M'
    return min(ANCH, key=lambda k: (ANCH[k][0]-x)**2 + (ANCH[k][1]-y)**2)


def main():
    T = collections.Counter(); TR = collections.defaultdict(collections.Counter); TPLANT = collections.defaultdict(list)
    CT = collections.Counter(); CTF = collections.Counter(); CTZ = collections.defaultdict(collections.Counter); n_ct = 0
    for demo in demo_names():
        rs = rounds_of(demo)
        if not rs: continue
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
                seq = []
                for x, y in zip(xs, ys):
                    z = zone(x, y)
                    if z and (not seq or seq[-1] != z): seq.append(z)
                lane = 'far'
                for z in seq:
                    if z in ENTRY[site]: lane = ENTRY[site][z]
                lanes.append(lane)
                if lane != 'far':
                    cut = [z for z in seq if z not in ('T Spawn',)]
                    stop = max(i for i, z in enumerate(cut) if ENTRY[site].get(z) == lane) if any(ENTRY[site].get(z) == lane for z in cut) else len(cut)-1
                    TR[(site, lane)][tuple(cut[:stop+1])] += 1
            if len(lanes) != 5: continue
            c = collections.Counter(lanes)
            sec = (r['tplant'] - t0)/64
            tempo = 'быстро' if sec < 40 else ('поздно' if sec > 75 else 'норма')
            sig = (site, tuple(sorted(c.items())), tempo)
            T[sig] += 1; TPLANT[sig[:2]].append(sec)
    out = {'T': [], 'routes': {}, 'CT': [], 'CTforward': []}
    print('== T: подписи выходов (сайт, входы, темп) — сколько раундов')
    for sig, n in T.most_common(40):
        print(n, sig[0], dict(sig[1]), sig[2]); out['T'].append({'site': sig[0], 'lanes': dict(sig[1]), 'tempo': sig[2], 'n': n})
    print('== T: модальные маршруты по входам')
    for k, C in sorted(TR.items()):
        top = C.most_common(3); out['routes']['%s:%s' % k] = [[list(p), n] for p, n in top]
        print(k, [(' > '.join(p[-6:]), n) for p, n in top])
    print('== CT: A-мид-B на 20-й с (раундов %d)' % n_ct)
    for sig, n in CT.most_common(15): print(n, sig); out['CT'].append({'split': sig, 'n': n})
    print('== CT: кто впереди на 12-й с')
    for sig, n in CTF.most_common(25): print(n, sig); out['CTforward'].append({'zones': list(sig), 'n': n})
    json.dump(out, open(os.path.join(ROOT, 'data', 'pro', 'tactics.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
