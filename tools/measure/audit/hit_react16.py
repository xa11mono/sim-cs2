#!/usr/bin/env python3
"""Этап 4, P0 (предварительно, грубо): реакция на первое попадание по снимкам раз в 16 тиков — одинаково у про (ticks.csv:
health, X, Y) и у ботов (fight_tick_rec: снимки прорежены до каждого 16-го тика). Попадание = HP упало между соседними
снимками (не до 0), а 2 с до этого не падало. Через 1 с: сдвинулся ли > 30 px; стоял ли (< 15 px/с) в момент попадания.
Разрешение 0,25 с — только для сравнения «про / боты», не для модели (ТЗ этапа 4).
python3 tools/measure/audit/hit_react16.py pro | bots <метка>…"""
import sys, os, json, glob, math, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
def acc(C, tr):   # tr: [(тик, x, y, hp)] по 16 тиков, один игрок, один раунд (до планта)
    last = -10**9
    for i in range(1, len(tr) - 1):
        t, x, y, h = tr[i]; tp, xp, yp, hp = tr[i-1]
        if t - tp != 16: continue
        if h < hp and h > 0:
            if t - last > 128:
                v = math.hypot(x - xp, y - yp) * 4
                fut = [q for q in tr[i:] if q[0] <= t + 64]
                if fut and fut[-1][0] >= t + 48:
                    mv = max(math.hypot(q[1] - x, q[2] - y) for q in fut)
                    st = 'стоял' if v < 15 else 'шёл' if v <= 65 else 'бежал'
                    C['n'] += 1; C['n ' + st] += 1; C['за 1 с сдвинулся >30 px'] += mv > 30; C['сдвинулся ' + st] += mv > 30
                    died = tr[-1][0] < t + 64 + 16
            last = t
def out(C):
    n = max(1, C['n'])
    o = {'первых попаданий': C['n'], 'в момент попадания стоял / шёл / бежал %': [round(100*C['n ' + s]/n, 1) for s in ('стоял', 'шёл', 'бежал')],
         'за 1 с сдвинулся >30 px %': round(100*C['за 1 с сдвинулся >30 px']/n, 1)}
    for s in ('стоял', 'шёл', 'бежал'): o['  …если ' + s + ', сдвинулся %'] = round(100*C['сдвинулся ' + s]/max(1, C['n ' + s]), 1)
    return o
if __name__ == '__main__':
    C = collections.Counter()
    if sys.argv[1] == 'pro':
        import pandas as pd
        from ancient_demos import DEMOS, tr, demo_names, rounds_of
        for demo in demo_names():
            rounds = rounds_of(demo)
            if not rounds: continue
            t = pd.read_csv(os.path.join(DEMOS, demo + '_ticks.csv.gz'), usecols=['tick', 'steamid', 'X', 'Y', 'health', 'is_alive'])
            t = t[t.is_alive == True].sort_values('tick')  # noqa: E712
            x, y = tr(t.X.values, t.Y.values); t = t.assign(x=x, y=y)
            for sid, g in t.groupby('steamid'):
                L = list(zip(g.tick.values.tolist(), g.x.values.tolist(), g.y.values.tolist(), g.health.values.tolist()))
                for r in rounds:
                    cut = r['tplant'] or r['t1']; acc(C, [q for q in L if r['t0'] <= q[0] < cut])
    else:
        for lab in sys.argv[2:]:
            for f in glob.glob(os.path.join(HERE, 'runs', lab, 'fight_tick_rec_*.json')):
                if os.path.getsize(f) < 100: continue
                d = json.load(open(f)); P = collections.defaultdict(list)
                for s in d['snap']:
                    if s[0] % 16 == 0: P[s[1]].append((s[0], s[2], s[3], s[6]))
                for rd in d['rounds']:
                    cut = rd.get('plant') or rd.get('t1') or 10**9
                    for b, L in P.items(): acc(C, [q for q in L if rd['t0'] <= q[0] < cut])
    for k, v in out(C).items(): print(f'{k:45} {v}')
