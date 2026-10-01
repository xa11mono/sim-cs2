# Детектор К1 «реакция команды на стак» (у про и у ботов одинаково, по позициям):
# момент — впервые за раунд (до планта) 3+ живых T в 400 px от сайта (подходы: рампа, T Lower, Long, Main).
# Для каждого CT, который в этот момент не на этом сайте (дальше 450 px):
# куда он сдвинулся за следующие 5 с — к сайту (ближе на 150+), от сайта
# (дальше на 150+) или остался. Плюс: сколько CT на сайте через 5 с.
import numpy as np, pandas as pd
SITES = {'A': (630, 518), 'B': (1533, 845)}
def stack_react(R, P):
    toward = away = stay = 0; onsite = []; n = 0
    P = P[P.alive.astype(bool)]
    for _, r in R.iterrows():
        p = P[(P.rid == r.rid) & (P.tick >= r.t0) & (P.tick <= (r.plant if r.plant == r.plant and r.plant else r.t1))]
        if not len(p): continue
        trig = None
        for tk, g in p.groupby('tick', sort=True):
            t = g[g.team == 'T']
            for k, (sx, sy) in SITES.items():
                if (np.hypot(t.x - sx, t.y - sy) < 400).sum() >= 3: trig = (tk, k); break
            if trig: break
        if not trig: continue
        tk, k = trig; sx, sy = SITES[k]; n += 1
        a = P[(P.rid == r.rid) & (P.tick == tk) & (P.team == 'CT')]
        b = P[(P.rid == r.rid) & (P.tick == tk + 320) & (P.team == 'CT')]
        for _, c in a.iterrows():
            d0 = np.hypot(c.x - sx, c.y - sy)
            if d0 < 450: continue
            c1 = b[b.id == c.id]
            if not len(c1): continue
            d1 = np.hypot(c1.x.iloc[0] - sx, c1.y.iloc[0] - sy)
            if d1 < d0 - 150: toward += 1
            elif d1 > d0 + 150: away += 1
            else: stay += 1
        onsite.append(int((np.hypot(b.x - sx, b.y - sy) < 450).sum()) if len(b) else 0)
    tot = max(1, toward + away + stay)
    return {'стак 3+ T у сайта: раундов': n,
            'стак: CT не с сайта идут к нему за 5 с %': round(toward / tot * 100, 1),
            'стак: CT уходят от сайта за 5 с %': round(away / tot * 100, 1),
            'стак: CT на сайте через 5 с': round(float(np.mean(onsite)), 2) if onsite else None}
