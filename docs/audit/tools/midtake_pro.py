import sys, json, math, collections
sys.path.insert(0, '/home/user/sim-cs2/tools'); import mapdir; M = mapdir.current(); import demos as D
G = json.load(open('/tmp/claude-0/-home-user-sim-cs2/4dc23a19-8eb9-51be-a3d4-dca908798881/scratchpad/callgrid_mirage.json'))
nm = lambda x, y: G.get('%d,%d' % (int(x)>>4, int(y)>>4), '')
MID = {'Mid', 'Top Mid', 'Mid Boxes', 'миде'}
CTS = {'A': {'Connector', 'Jungle', 'Stairs', 'CT', 'Ticket'}, 'B': {'Catwalk', 'Short', 'B Short', 'Kitchen'}}
cnt = {'A': collections.Counter(), 'B': collections.Counter()}; stage = {'A': collections.Counter(), 'B': collections.Counter()}; look = {'A': collections.Counter(), 'B': collections.Counter()}
route = {'A': collections.Counter(), 'B': collections.Counter()}
for demo in D.demo_names():
    R = [r for r in D.rounds_of(demo) if r['tplant']]
    if not R: continue
    t = D.ticks_of(demo); t = t[t.side == 'T']
    for r in R:
        k = r['site']; w = t[(t.tick >= r['t0']) & (t.tick <= r['tplant'])]
        n = 0
        for sid, g in w.groupby('steamid'):
            g = g.sort_values('tick'); names = [nm(x, y) for x, y in zip(g.x.values, g.y.values)]
            im = next((i for i, s in enumerate(names) if s in MID), None)
            if im is None: continue
            ic = next((i for i in range(im, len(names)) if names[i] in CTS[k]), None)
            if ic is None: continue
            n += 1
            seq = []; [seq.append(s) for s in names[im:ic+1] if s and (not seq or seq[-1] != s)]
            route[k][' > '.join(seq[:6])] += 1
            x, y, tk, yaw = g.x.values, g.y.values, g.tick.values, g.yaw.values
            for j in range(ic, len(x) - 1):
                sp = math.hypot(x[j+1]-x[j], y[j+1]-y[j]) / max(1, tk[j+1]-tk[j]) * D.TICK
                if sp < 25 and names[j] in CTS[k]:
                    stage[k][names[j]] += 1
                    a = math.radians(yaw[j]); lx, ly = x[j] + math.cos(a)*350, y[j] - math.sin(a)*350
                    look[k][nm(lx, ly)] += 1
        cnt[k][min(n, 3)] += 1
for k in 'AB':
    N = sum(cnt[k].values())
    print(k, 'плантов', N, '— T через мид на сторону CT: 0 — %.0f%%, 1 — %.0f%%, 2 — %.0f%%, 3+ — %.0f%%' % tuple(100*cnt[k][i]/N for i in range(4)))
    print('   путь:', route[k].most_common(4)); print('   стоят:', stage[k].most_common(4)); print('   смотрят:', look[k].most_common(5))
