"""В142 (13.11.2026): лёрк одной меркой — про и боты. Раунд с лёрком: на 15–45-й с хотя бы 5 с подряд (выборка раз в 1 с) какой-то живой T
дальше LURK_D ед. от всех живых своих и в другой стороне карты (регион A / B по tools/pro_tactics.region), чем большинство своих.
Запуск: python3 tools/shadow/lurk_cmp.py [--map mirage] [папка записей ботов rec_*.json.gz]"""
import sys, os, json, gzip, glob, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import mapdir  # noqa: E402
MAP = mapdir.current()
from demos import demo_names, rounds_of, ticks_of  # noqa: E402
from pro_tactics import region  # noqa: E402
LURK_D = 1000 / 2.5   # px радара (1000 ед. игры) — проектное число: «далеко от своих»
SEC = 64


def lurk_round(frames):
    """frames: [(t с, [(x, y), …] живые T)] по секундам → True, если лёрк ≥ 5 с подряд"""
    run = 0
    for t, P in frames:
        hit = False
        if len(P) >= 3:
            A = np.array(P); R = region(A[:, 0], A[:, 1]); maj = collections.Counter(r for r in R if r != 'M').most_common(1)
            for i in range(len(A)):
                d = np.hypot(A[:, 0] - A[i, 0], A[:, 1] - A[i, 1]); d[i] = 1e9
                if d.min() > LURK_D and R[i] != 'M' and maj and R[i] != maj[0][0]: hit = True; break
        run = run + 1 if hit else 0
        if run >= 5: return True
    return False


def pro():
    n = k = 0
    for d in demo_names():
        rs = rounds_of(d)
        if not rs: continue
        T = ticks_of(d); T = T[T.side == 'T']
        for r in rs:
            if r['num'] in (0, 12): continue
            fr = []
            for s in range(15, 46):
                tk = r['t0'] + s * SEC; w = T[(T.tick >= tk) & (T.tick < tk + 16)]
                fr.append((s, list(zip(w.x.values, w.y.values))))
            n += 1; k += lurk_round(fr)
    return n, k


def bots(rd):
    n = k = 0
    for f in sorted(glob.glob(os.path.join(rd, 'rec_*.json*'))):
        d = json.load(gzip.open(f) if f.endswith('.gz') else open(f))
        byt = collections.defaultdict(list)
        for q in d['pos']:
            if q[5] and q[2] != 1: byt[q[0]].append((q[3], q[4]))
        for r in d['rounds']:
            if 't1' not in r or r.get('tType') == 'pistol': continue
            fr = []
            for s in range(15, 46):
                tk = r['t0'] + s * SEC; tk -= tk % 16
                fr.append((s, byt.get(tk, [])))
            n += 1; k += lurk_round(fr)
    return n, k


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    n, k = pro(); print('про: раундов %d, с лёрком %d (%d %%)' % (n, k, round(100 * k / max(1, n))))
    if a: n, k = bots(a[0]); print('боты: раундов %d, с лёрком %d (%d %%)' % (n, k, round(100 * k / max(1, n))))
