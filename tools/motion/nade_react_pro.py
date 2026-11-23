"""Д30 (18.11): гранаты CT до планта «по увиденным» у про — смок / молотов / HE / флешка, которые сработали рядом с T (≤ NEAR ед. от T в момент
срабатывания): сколько T рядом, как далеко бросающий от места срабатывания, проход это или нет — по демкам карты (события *_detonate, позиции 4 раза
в секунду). Запуск: python3 tools/motion/nade_react_pro.py [--map mirage]"""
import sys, os, math, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import demos as D  # noqa: E402
NEAR = 350
EV = {'smokegrenade_detonate': 'смок', 'inferno_startburn': 'молотов', 'hegrenade_detonate': 'HE', 'flashbang_detonate': 'флешка'}
C = collections.defaultdict(lambda: collections.defaultdict(list))
for demo in D.demo_names():
    t = D.ticks_of(demo).sort_values('tick'); side = dict(zip(t.steamid, t.side)); T = t[t.side == 'T']; CT = t[t.side == 'CT']
    R = D.rounds_of(demo)
    for ev, nm in EV.items():
        try: e = D.event(demo, ev)
        except Exception: continue
        for _, r in e.iterrows():
            try: sid = int(r.user_steamid)
            except Exception: continue
            if side.get(sid) != 'CT': continue
            rr = [q for q in R if q['t0'] <= r.tick <= (q['tplant'] or q['t1'])]
            if not rr: continue
            x, y = D.tr(float(r.x), float(r.y))
            tt = T[(T.tick >= r.tick - 16) & (T.tick <= r.tick)].groupby('steamid').last()
            n = int((np.hypot(tt.x - x, tt.y - y) < NEAR).sum())
            me = CT[(CT.steamid == sid) & (CT.tick <= r.tick)].tail(1)
            dist = float(np.hypot(me.x.values[0] - x, me.y.values[0] - y)) if len(me) else float('nan')
            sec = (r.tick - rr[0]['t0']) / 64
            C[nm]['n'].append(n); C[nm]['dist'].append(dist); C[nm]['sec'].append(sec)
for nm, X in C.items():
    n = np.array(X['n']); d = np.array(X['dist']); s = np.array(X['sec'])
    hit = n >= 1
    print('%s CT до планта: %d; рядом с T (≤ %d ед.) %.0f%%; из них T рядом: 1 — %.0f%%, 2+ — %.0f%%; до места срабатывания (медиана): по T %.0f ед., без T %.0f ед.; секунда раунда (медиана) по T %.0f' % (
        nm, len(n), NEAR, 100 * hit.mean(), 100 * np.mean(n[hit] == 1), 100 * np.mean(n[hit] >= 2), np.nanmedian(d[hit]), np.nanmedian(d[~hit]), np.median(s[hit])))
