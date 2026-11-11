"""Доли расстановок CT по закупу — из демок про (v561, этап 6 docs/tasks/PLAN_TACTICS_V2.md; владелец 11.11: «доли расстановок — по закупу, из демок»).

Структура расстановки — сколько CT к 20-й секунде в стороне A / мид / B (как tools/pro_tactics.py, без названий мест). У про — доля каждой
структуры по закупу CT (пистолетка, эко, форс, фулл). У наших расстановок (tactics.json ctSetups) структура — какая чаще всего выходит у
ботов на 20-й секунде в записях прогонов (tools/measure/runs/<метка>/rec_*.json): то, что игра правда ставит, а не название.
Вес расстановки на закуп = доля её структуры у про, поровну между нашими расстановками этой структуры (внутри — по своей частоте w).
Структуры про, которых у нас нет, — в «missing» (кандидаты на новые расстановки); их доля — ближайшим структурам (по числу CT на сторонах).
Запуск: python3 tools/ct_setup_bake.py --map ancient v559_anc v560b_anc → data/maps/<карта>/ctshare.json (игра: MAP.ctshare)."""
import sys, os, json, glob, gzip, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
from demos import TICK, MAPNAME  # noqa: E402
from pro_tactics import region, src_demos  # noqa: E402

AT = 20
BUY = {'фулл': 'full', 'форс': 'force', 'эко': 'eco'}


def struct(xs, ys):
    r = region(np.array(xs, float), np.array(ys, float))
    return '%d-%d-%d' % ((r == 'A').sum(), (r == 'M').sum(), (r == 'B').sum())


def pro_shares():
    C = collections.defaultdict(collections.Counter)
    for rs, T, dth, types in src_demos():
        for r in rs:
            R = types.get(r['rid'])
            if not R: continue
            tk = r['t0'] + AT * TICK
            g = T[(T.tick >= tk) & (T.tick < tk + 16) & (T.side == 'CT')]
            if len(g) < 5: continue
            buy = 'pistol' if R['pistol'] else BUY.get(R['type']['CT'], 'force')
            C[buy][struct(g.x.values, g.y.values)] += 1
    return C


def bot_structs(labels):
    C = collections.defaultdict(collections.Counter)
    for lab in labels:
        for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'measure', 'runs', lab, 'rec_*.json*'))):
            d = json.load(gzip.open(f) if f.endswith('.gz') else open(f))
            byt = collections.defaultdict(list)
            for q in d['pos']:
                if q[2] == 1 and q[5]: byt[q[0]].append(q)
            for r in d['rounds']:
                if not r.get('ctSetup'): continue
                tk = r['t0'] + AT * TICK; tk -= tk % 16
                g = byt.get(tk, [])
                if len(g) < 5: continue
                C[r['ctSetup']][struct([q[3] for q in g], [q[4] for q in g])] += 1
    return C


def main():
    labels = sys.argv[1:]
    T = json.load(open(mapdir.path(MAPNAME, 'tactics.json'), encoding='utf-8'))
    setups = T['ctSetups']
    P = pro_shares(); B = bot_structs(labels)
    st = {}
    for S in setups:
        c = B.get(S['id'])
        st[S['id']] = c.most_common(1)[0][0] if c else None
    out = {'at': AT, 'struct': st, 'n': {k: sum(v.values()) for k, v in B.items()}, 'by': {}, 'missing': {}, 'pro': {}}
    for buy, C in P.items():
        N = sum(C.values())
        out['pro'][buy] = {k: round(v / N, 3) for k, v in C.most_common()}
        groups = collections.defaultdict(list)
        for S in setups:
            if st[S['id']]: groups[st[S['id']]].append(S)
        w = {}; miss = {}
        L1 = lambda a, b: sum(abs(int(x) - int(y)) for x, y in zip(a.split('-'), b.split('-')))
        for k, v in C.items():
            ks = [k] if k in groups else []
            if not ks:   # такой структуры у нас нет — её доля ближайшим по числу игроков на сторонах (поровну)
                miss[k] = round(v / N, 3); dm = min(L1(k, q) for q in groups); ks = [q for q in groups if L1(k, q) == dm]
            for kk in ks:
                g = groups[kk]; tot = sum(S.get('w', 1) for S in g)
                for S in g: w[S['id']] = w.get(S['id'], 0) + v / N / len(ks) * S.get('w', 1) / tot
        Z = sum(w.values()) or 1
        out['by'][buy] = {k: round(v / Z, 4) for k, v in sorted(w.items(), key=lambda kv: -kv[1])}
        out['missing'][buy] = miss
    p = mapdir.path(MAPNAME, 'ctshare.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('→', p)
    for buy in out['by']:
        print(buy, 'нет у нас:', ', '.join('%s %d %%' % (k, round(100 * v)) for k, v in sorted(out['missing'][buy].items(), key=lambda kv: -kv[1])[:6]))
        print('   вес:', ', '.join('%s %.2f' % kv for kv in list(out['by'][buy].items())[:8]))
    print('без структуры (не игрались в записях):', [k for k, v in st.items() if not v])


if __name__ == '__main__':
    main()
