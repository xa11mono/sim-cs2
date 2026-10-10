"""Детектор (v246): встаёт ли бот на ту же позицию демок в следующем раунде той же стороной.
Стоянка — как в tools/player_positions_bake.py: 2+ с, скорость < 10 ед. карты/с, до планта; позиция — ближайшая
точка positions.json своей стороны в пределах её разброса (не меньше 40). Про — из src/data/player_positions.json.
Запуск: python3 tools/measure/pos_repeat.py <positions.json> <run> [<run> …]"""
import json, math, sys, collections, os
HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(sys.argv[1], encoding='utf-8'))['points']
def pos_at(side, x, y):
    best, bd = None, 1e9
    for q in P:
        if q['side'] != side: continue
        d = math.hypot(q['x']-x, q['y']-y)
        if d <= max(q.get('spread') or 0, 40) and d < bd: bd, best = d, q
    return best
seq = []; per_bot = collections.defaultdict(collections.Counter)
for run in sys.argv[2:]:
    for f in sorted(os.listdir(os.path.join(HERE, 'runs', run))):
        if not f.startswith('rec_'): continue
        d = json.load(open(os.path.join(HERE, 'runs', run, f)))
        R = [(int(r['t0']), int(r['t1']), r.get('winner')) for r in d['rounds'] if 't1' in r]
        plants = [p[0] for p in d['plants']] if d['plants'] and isinstance(d['plants'][0], list) else []
        deaths = {}
        for k in d['kills']: deaths.setdefault(k[5], []).append((k[0], k[7], k[8]))
        tracks = collections.defaultdict(list)
        for p in d['pos']: tracks[p[1]].append(p)
        held = {}
        for bid, T in tracks.items():
            side = 'CT' if T[0][2] == 1 else 'T'
            for ri, (t0, t1, win) in enumerate(R):
                cut = min([pt for pt in plants if t0 <= pt <= t1] + [t1])
                S = [p for p in T if t0 <= p[0] < cut and p[5]]
                hs = {}; run_ = []
                for a, b in zip(S, S[1:]):
                    sp = math.hypot(b[3]-a[3], b[4]-a[4]) / max(1, b[0]-a[0]) * 64
                    if sp < 10: run_.append(b)
                    else:
                        if run_ and run_[-1][0] - run_[0][0] >= 128:
                            mx = sum(q[3] for q in run_)/len(run_); my = sum(q[4] for q in run_)/len(run_)
                            q = pos_at(side, mx, my)
                            if q:
                                died = any(run_[0][0] <= tk <= run_[0][0]+60*64 and math.hypot(dx-mx, dy-my) <= 60 for tk, dx, dy in deaths.get(bid, []))
                                hs[q['id']] = hs.get(q['id'], False) or died
                        run_ = []
                side_now = side   # стороны меняются в половине: сторону берём из записи тика
                if S: side_now = 'CT' if S[0][2] == 1 else 'T'
                held[(bid, ri)] = (side_now, hs, win)
                for pid in hs: per_bot[bid][pid] += 1
        for (bid, ri), (sd, hs, win) in held.items():
            nx = held.get((bid, ri+1))
            if not nx or nx[0] != sd: continue
            for pid, died in hs.items():
                seq.append((died, win == sd, pid in nx[1]))
def rate(f):
    s = [q for q in seq if f(q)]
    return (sum(q[2] for q in s)/len(s) if s else 0, len(s))
pro = json.load(open(os.path.join(HERE, '..', '..', 'src', 'data', 'player_positions.json')))['repeat']
for nm, f, pk in [('выжил и выиграл', lambda q: not q[0] and q[1], 'ok'), ('погиб на ней', lambda q: q[0], 'died'), ('выжил, проиграли', lambda q: not q[0] and not q[1], 'lost')]:
    r, n = rate(f)
    print(f'та же позиция в следующем раунде после «{nm}»: про {pro[pk][0]:.1%} (n={pro[pk][1]}) | боты {r:.1%} (n={n})')
r, n = rate(lambda q: True)
tp = sum(pro[k][0]*pro[k][1] for k in ('ok','died','lost')) / sum(pro[k][1] for k in ('ok','died','lost'))
print(f'та же позиция в следующем раунде, всего: про {tp:.1%} | боты {r:.1%} (n={n})')
