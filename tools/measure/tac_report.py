"""(тактика 30.10) Разбор REC.tac (сторож rec2.js ветки measure/exec-sync) по прогону ПК.
python3 tools/measure/tac_report.py <папка pc-results>/<метка> [<метка2> …]   — rec_<m>.json.gz в папке
Печатает по метке: исход раундов (доля T, планты, ретейк, после планта), ротации CT (сколько ушло, на чужой сайт, задержка
относительно первого T на сайте, пропуски), калибровку «сайт пуст» (варианты: точек N, свежесть F), дефуз и байт-пики.
Цифры по раундам; «± шум» — половина 95 % интервала по матчам (t ≈ 2,36 для 8 матчей)."""
import json, gzip, sys, os, glob, statistics as st

def load(d):
    out = []
    for f in sorted(glob.glob(os.path.join(d, 'rec_*.json*'))):
        op = gzip.open if f.endswith('.gz') else open
        with op(f, 'rt', encoding='utf-8') as h: out.append(json.load(h))
    return out

def ci(vals):
    if len(vals) < 2: return 0
    return 2.36 * st.stdev(vals) / len(vals) ** 0.5

VARS = [('old2', None, F) for F in (8, 12, 20)] + [(N, N, F) for N in (3, 4, 6, 9) for F in (8, 12, 20)]

for d in sys.argv[1:]:
    M = load(d); print('==', d, 'матчей', len(M))
    per = {k: [] for k in ('tw', 'pl', 'rt', 'pp', 'rot', 'wrong', 'blind')}
    delays, missed, rounds_on = [], 0, 0
    SC = {v: [0, 0, 0] for v in VARS}   # сказал «пусто»: всего, из них CT там были; истинно пусто (выборок)
    states = [0, 0, 0]; empties = 0
    dfk = {'fake': 0, 'real': 0, 'bait': 0, 'baitDied': 0, 'antidef': 0, 'dffake': 0, 'dfreal': 0}
    for R in M:
        T = R.get('tac') or {}
        rs = [r for r in R['rounds'] if r.get('winner')]
        if not rs: continue
        per['tw'].append(sum(r['winner'] == 'T' for r in rs) / len(rs))
        pl = [r for r in rs if r.get('plant') is not None]
        per['pl'].append(len(pl) / len(rs))
        if pl: per['rt'].append(sum(r['winner'] == 'CT' for r in pl) / len(pl)); per['pp'].append(sum(r['winner'] == 'T' for r in pl) / len(pl))
        rot = T.get('rot', []); per['rot'].append(len(rot) / len(rs))
        # раунд по тику
        def rnd(t):
            for r in rs:
                if r['t0'] <= t <= r.get('t1', 1e12): return r
        ex = {e[0]: e for e in T.get('ex', [])}; on = {e[0]: e for e in T.get('on', [])}
        wrong = 0
        for x in rot:
            r = rnd(x[0])
            if r and r.get('tsite') and x[2] != r.get('tsite') and (r['r'] in ex and ex[r['r']][2] != x[2]): wrong += 1
        per['wrong'].append(wrong / len(rs))
        # ротации, когда в колле T не видели, только гранаты
        calls = T.get('call', [])
        blind = 0
        for x in rot:
            c = [q for q in calls if q[0] <= x[0] and q[1] == x[2]]
            if c and c[-1][3] == 0 and c[-1][4] >= 2 and c[-1][2] <= 2.6 and c[-1][5] == 0: blind += 1
        per['blind'].append(blind / len(rs))
        for rn, o in on.items():
            r = next((q for q in rs if q['r'] == rn), None)
            if not r: continue
            rounds_on += 1
            rr = [x for x in rot if x[2] == o[2] and r['t0'] <= x[0] <= r.get('t1', 1e12)]
            if rr: delays.append((min(x[0] for x in rr) - o[1]) / 64)
            else: missed += 1
        for t, k, truth, ages, near in T.get('sc', []):
            if truth == 0: empties += 1
            for v in VARS:
                name, N, F = v
                if N is None: say = near[(8, 12, 20).index(F)] >= 2
                else: say = len(ages) >= N and all(0 <= a < F for a in ages[:N])
                if say:
                    SC[v][0] += 1; SC[v][1] += truth > 0
                if truth == 0: SC[v][2] += say
            a6 = ages[:6]; chk = sum(0 <= a < 12 for a in a6)
            states[0 if chk == len(a6) and a6 else (1 if chk else 2)] += 1
        for x in T.get('fk', []): dfk['fake' if 'фейк' in x[1] else 'real'] += 1
        dead = T.get('d', [])
        for x in T.get('dv', []):
            if x[1] != 'T': continue
            if x[2] == 'bait':
                dfk['bait'] += 1; dfk['baitDied'] += any(dd[1] == x[3] and 0 <= dd[0] - x[0] <= 192 for dd in dead)
            elif x[2] in dfk: dfk[x[2]] += 1
    f = lambda k: '%.3f ± %.3f' % (st.mean(per[k]), ci(per[k])) if per[k] else '-'
    print('  доля раундов T %s; плант %s; ретейк CT (из плантов) %s; после планта T %s' % (f('tw'), f('pl'), f('rt'), f('pp')))
    print('  ротаций CT на раунд %s; на сайт не тот, что T %s; «по гранатам, T не видели» %s' % (f('rot'), f('wrong'), f('blind')))
    if delays: print('  первый ротатор на сайт T относительно первого T на сайте: медиана %.1f с, p75 %.1f; без ротации на сайт: %d из %d' % (
        st.median(delays), sorted(delays)[int(.75 * (len(delays) - 1))], missed, rounds_on))
    tot = sum(states) or 1
    print('  сайт (6 точек, 12 с): проверено пусто %.1f%%, частично %.1f%%, не проверено %.1f%%; выборок «CT там нет» %d' % (100*states[0]/tot, 100*states[1]/tot, 100*states[2]/tot, empties))
    for v in VARS:
        s, fl, rc = SC[v]
        print('    %-5s F=%2d с: «пусто» %5d, из них CT были %5.1f%%, поймано пустых %5.1f%%' % (v[0], v[2], s, 100*fl/max(1, s), 100*rc/max(1, empties)))
    print('  дефуз: фейков CT %d, настоящих %d; T: байт-пиков %d (погиб в 3 с %d), «все на бомбу» %d, «фейк — держим» %d, «настоящий» %d' % (
        dfk['fake'], dfk['real'], dfk['bait'], dfk['baitDied'], dfk['antidef'], dfk['dffake'], dfk['dfreal']))
