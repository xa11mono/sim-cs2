"""В147: модель «руки» (поворот прицела) по демкам — для 510 resolveEngagements. По рывкам (|Δyaw| > 0,3°/тик подряд ≥ 2 тиков):
по корзинам угла — длительность (тики) и пик (°/тик) квантилями; доводка — следующий рывок в 24 тика после: доля, пауза, доля угла и знак
(перелёт — обратно, недолёт — туда же). Запуск: python3 -I tools/measure/motion/pro_turn_model.py --map mirage [--json]"""
import sys, os, json, glob, collections
import numpy as np, pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import mapdir  # noqa: E402
MAP = mapdir.current()
B = [0.6, 2, 5, 10, 20, 45, 90, 400]
R = collections.defaultdict(lambda: collections.defaultdict(list))
for f in sorted(glob.glob(os.path.join(mapdir.path(MAP, ''), 'demos', '*_motion.csv.gz'))):
    d = pd.read_csv(f, usecols=['tick', 'steamid', 'yaw', 'is_alive', 'shots_fired'], low_memory=False)
    d = d[d.is_alive == True].sort_values(['steamid', 'tick'])  # noqa: E712
    for sid, g in d.groupby('steamid'):
        tk = g.tick.values; yaw = g.yaw.values.astype(float); sf = g.shots_fired.fillna(0).values
        dy = np.r_[0, (np.diff(yaw) + 180) % 360 - 180]; dy[np.r_[False, np.diff(tk) != 1]] = 0
        fight = np.zeros(len(tk), bool)
        for i in np.where(np.r_[False, np.diff(sf) > 0])[0]: fight[max(0, i - 96):i + 96] = True
        ad = np.abs(dy); m = np.r_[False, ad > 0.3, False].astype(int); dd = np.diff(m); S = list(zip(np.where(dd == 1)[0], np.where(dd == -1)[0]))
        S = [(a, b) for a, b in S if b - a >= 2]
        for k, (a, b) in enumerate(S):
            A = abs(dy[a:b].sum()); bi = np.searchsorted(B, A) - 1
            if bi < 0 or bi >= len(B) - 1: continue
            c = 'f' if fight[a:b].any() else 'n'; r = R[(c, bi)]
            r['T'].append(b - a); r['pk'].append(ad[a:b].max())
            sg = np.sign(dy[a:b].sum())
            if k + 1 < len(S) and S[k + 1][0] - b <= 24:
                a2, b2 = S[k + 1]; A2 = dy[a2:b2].sum()
                r['corr'].append(1); r['gap'].append(a2 - b); r['ratio'].append(abs(A2) / max(A, 1e-6)); r['back'].append(1 if np.sign(A2) != sg else 0)
            else: r['corr'].append(0)
out = {}
for c in ('n', 'f'):
    print('контекст', 'вне боя' if c == 'n' else 'перестрелка')
    for bi in range(len(B) - 1):
        r = R[(c, bi)]
        if not r['T']: continue
        q = lambda v: [round(float(np.percentile(v, p)), 2) for p in (25, 50, 75)] if len(v) else None
        o = {'n': len(r['T']), 'T': q(r['T']), 'pk': q(r['pk']), 'corr': round(float(np.mean(r['corr'])), 3), 'gap': q(r['gap']), 'ratio': q(r['ratio']),
             'back': round(float(np.mean(r['back'])), 3) if r['back'] else None}
        out['%s|%g-%g' % (c, B[bi], B[bi + 1])] = o
        print('  %5g–%-4g° n=%-6d T %s пик %s доводка %d %% через %s тиков, доля угла %s, назад %s' % (B[bi], B[bi + 1], o['n'], o['T'], o['pk'], round(100 * o['corr']), o['gap'], o['ratio'], o['back']))
if '--json' in sys.argv: json.dump({'bins': B, 'model': out}, open(os.path.join(mapdir.path(MAP, ''), 'turnmodel.json'), 'w'))
