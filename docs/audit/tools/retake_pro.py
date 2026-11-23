# исходы после планта у про: расклад CT×T в момент планта → победа CT (дефуз/убили всех), взрыв, сейв (CT жив после взрыва); путь — прямая (только анализ)
import sys, collections, math
sys.path.insert(0, '/home/user/sim-cs2/tools'); import mapdir; M = mapdir.current(); import demos as D
C = collections.defaultdict(collections.Counter)
for demo in D.demo_names():
    R = [r for r in D.rounds_of(demo) if r['tplant']]
    if not R: continue
    t = D.ticks_of(demo); re_ = D.event(demo, 'round_end')
    for r in R:
        a = t[(t.tick >= r['tplant']) & (t.tick < r['tplant'] + 16)].drop_duplicates('steamid')
        nC = (a.side == 'CT').sum(); nT = (a.side == 'T').sum()
        if nC == 0: continue
        e = re_[(re_.tick > r['tplant']) & (re_.tick <= r['t1'] + 64)]
        if not len(e): continue
        w = e.winner.iloc[0]; why = str(e.reason.iloc[0])
        bx, by = r['plantXY']; end = int(e.tick.iloc[0]); z = t[(t.tick >= end - 32) & (t.tick <= end) & (t.side == 'CT')].drop_duplicates('steamid')
        d = [math.hypot(x - bx, y - by) for x, y in zip(a[a.side == 'CT'].x, a[a.side == 'CT'].y)]
        k = (int(nC), int(nT)); S = C[k]; S['n'] += 1; S['ctwin'] += w == 'CT'
        if why == 'target_bombed' or 'bomb' in why.lower():
            S['boom'] += 1
            far = all(math.hypot(x - bx, y - by) > 800 for x, y in zip(z.x, z.y)) and len(z) > 0
            S['saved'] += far
        S['dmin'] += min(d) if d else 0
for k in sorted(C):
    S = C[k]
    if S['n'] < 8: continue
    print('CT %d против T %d: %3d раундов; CT выиграли %3.0f%%; взрыв %3.0f%% сейв (все живые CT дальше 800 от бомбы при взрыве) %3.0f%% раундов; ближайший CT до бомбы ср. %d' % (k[0], k[1], S['n'], 100*S['ctwin']/S['n'], 100*S['boom']/S['n'], 100*S['saved']/S['n'], S['dmin']/S['n']))
