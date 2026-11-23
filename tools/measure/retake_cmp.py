#!/usr/bin/env python3
"""Ретейк: боты против про (владелец 17.11: «КТшники очень долго ретейкают» — проверить полностью).
python3 tools/measure/retake_cmp.py <папка с rec_*.json> [--map mirage]
По каждому планту: расклад CT против T в момент планта, ближайший CT до бомбы при планте, через сколько секунд первый CT ближе 250 px
к бомбе (или не дошёл), скорость подхода (расстояние / время). Про — по демкам карты (tools/demos.py), боты — по записям rec2.js."""
import sys, os, math, json, glob, statistics as st, collections
sys.path[:0] = [os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))]
import mapdir  # noqa: E402
import demos as D  # noqa: E402
import numpy as np  # noqa: E402

def pro_rows():
    out = []
    for demo in D.demo_names():
        R = [r for r in D.rounds_of(demo) if r['tplant']]
        if not R: continue
        t = D.ticks_of(demo)
        for r in R:
            tp = r['tplant']; bx, by = r['plantXY']
            w = t[(t.tick >= r['t0']) & (t.tick <= tp)]; at = w[w.tick == w.tick.max()]
            c = at[at.side == 'CT']; nct, nt = len(c), int((at.side == 'T').sum())
            if not nct: continue
            d0 = float(np.hypot(c.x - bx, c.y - by).min())
            a = t[(t.tick >= tp) & (t.tick <= r['t1']) & (t.side == 'CT')]; near = a[np.hypot(a.x - bx, a.y - by) < 250]
            out.append((nct, nt, d0, (near.tick.min() - tp) / 64 if len(near) else None))
    return out

def bot_rows(folder):
    out = []
    for fn in sorted(glob.glob(os.path.join(folder, 'rec_*.json*'))):
        d = json.load(open(fn)); K = d['kills']
        for r in d['rounds']:
            if not r.get('plant'): continue
            tp, t1 = r['plant'], r['t1']; P = [p for p in d['plants'] if abs(p[0] - tp) < 5]
            if not P: continue
            bx, by = P[0][2], P[0][3]; dead = {k[5] for k in K if r['t0'] <= k[0] < tp}
            nct = 5 - len([x for x in dead if x.startswith('CT')]); nt = 5 - len([x for x in dead if x.startswith('T')])
            at = [p for p in d['pos'] if abs(p[0] - tp) <= 16 and p[1].startswith('CT') and p[5]]
            if not at: continue
            d0 = min(math.hypot(p[3] - bx, p[4] - by) for p in at); f = None
            for p in d['pos']:
                if tp <= p[0] <= t1 and p[1].startswith('CT') and p[5] and math.hypot(p[3] - bx, p[4] - by) < 250: f = (p[0] - tp) / 64; break
            out.append((nct, nt, d0, f))
    return out

def show(name, rows):
    print(name)
    for k in [(1, 1), (2, 1), (3, 2), (2, 2), (3, 3), (1, 2), (2, 3), (1, 3)]:
        S = [x for x in rows if (x[0], x[1]) == k]
        if not S: continue
        fr = [x[3] for x in S if x[3] is not None]
        print('  CT %d против T %d: %3d плантов; до бомбы при планте %4.0f ед.; первый у бомбы %s с; не дошли %.0f%%' % (k[0], k[1], len(S), st.median([x[2] for x in S]) * 2.5,
              ('%.1f' % st.median(fr)) if fr else '-', 100 * (len(S) - len(fr)) / len(S)))

a = [x for x in sys.argv[1:] if not x.startswith('--')]
show('про (%s):' % D.MAPNAME, pro_rows())
if a: show('боты:', bot_rows(a[0]))
