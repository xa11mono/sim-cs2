"""В147: составные повороты про (несколько слитных рывков) и быстрый возврат после поворота — по корзинам угла (как pro_turn_model).
Составной: внутри поворота ≥ 2 локальных пика |Δyaw| (пик ≥ 30 % главного); граница — минимум между пиками; второй рывок — его начало (доля
длительности) и доля угла. Возврат: обратное движение > 0,3°/тик в 8 тиков после конца — доля поворотов, пауза до него, его угол / угол поворота.
Запуск: python3 -I tools/measure/motion/pro_turn_sub.py --map mirage [--json]  (дописывает в data/maps/<карта>/turnmodel.json поле sub)"""
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
        ad = np.abs(dy); m = np.r_[False, ad > 0.3, False].astype(int); dd = np.diff(m)
        for a, b in zip(np.where(dd == 1)[0], np.where(dd == -1)[0]):
            if b - a < 2: continue
            A = abs(dy[a:b].sum()); bi = np.searchsorted(B, A) - 1
            if bi < 0 or bi >= len(B) - 1: continue
            r = R[('f' if fight[a:b].any() else 'n', bi)]; seg = ad[a:b]; top = seg.max()
            pk = [i for i in range(1, len(seg) - 1) if seg[i] > seg[i - 1] and seg[i] >= seg[i + 1] and seg[i] >= 0.3 * top]
            if len(seg) > 2 and seg[0] >= seg[1] and seg[0] >= 0.3 * top: pk = [0] + pk
            if len(pk) >= 2:
                mi = pk[0] + int(np.argmin(seg[pk[0]:pk[1] + 1])); r['sub'].append(1)
                r['at'].append(mi / len(seg)); r['share'].append(abs(dy[a + mi:b].sum()) / max(A, 1e-6))
            else: r['sub'].append(0)
            sg = np.sign(dy[a:b].sum()); post = dy[b:b + 8]; rv = np.where(post * sg < -0.3)[0]
            if len(rv):
                r['back'].append(1); r['bgap'].append(int(rv[0])); r['bratio'].append(abs(post[post * sg < 0].sum()) / max(A, 1e-6)); r['bdeg'].append(abs(post[post * sg < 0].sum()))
            else: r['back'].append(0)
q = lambda v: [round(float(np.percentile(v, p)), 3) for p in (25, 50, 75)] if len(v) else None
out = {}
for c in ('n', 'f'):
    for bi in range(len(B) - 1):
        r = R[(c, bi)]
        if not r['sub']: continue
        o = {'p': round(float(np.mean(r['sub'])), 3), 'at': q(r['at']), 'share': q(r['share']), 'pb': round(float(np.mean(r['back'])), 3), 'bgap': q(r['bgap']), 'bratio': q(r['bratio']), 'bdeg': q(r['bdeg'])}
        out['%s|%g-%g' % (c, B[bi], B[bi + 1])] = o
        print(c, '%5g–%-4g' % (B[bi], B[bi + 1]), 'составных %2d %%, второй с %s длит., доля угла %s; возврат %2d %% через %s тиков, %s угла, %s°' % (round(100 * o['p']), o['at'], o['share'], round(100 * o['pb']), o['bgap'], o['bratio'], o['bdeg']))
if '--json' in sys.argv:
    fp = os.path.join(mapdir.path(MAP, ''), 'turnmodel.json'); J = json.load(open(fp)); J['sub'] = out; json.dump(J, open(fp, 'w'))
