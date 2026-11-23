import json, sys, collections
PRO={(1,3):(0,39),(1,4):(0,34),(2,1):(73,0),(2,2):(47,6),(2,3):(3,35),(2,4):(3,62),(3,2):(50,4),(3,3):(27,8),(3,4):(8,47),(3,5):(6,62),(4,3):(67,15),(4,4):(21,18),(4,5):(23,48),(5,5):(30,19)}
for l in sys.argv[1:]:
    C=collections.defaultdict(collections.Counter)
    for m in [3,7,11,13,17,19,23,29]:
        d=json.load(open('/home/user/sim-cs2/tools/measure/runs/%s/rec_%d.json'%(l,m)))
        PT=collections.defaultdict(list)
        for p in d['pos']: PT[p[0]].append(p)
        CC=d['ctcall']
        for r in d['rounds']:
            if not r.get('plant') or 't1' not in r: continue
            t=r['plant']-r['plant']%16; P=PT.get(t,[])
            nC=sum(1 for p in P if p[2]==1 and p[5]); nT=sum(1 for p in P if p[2]==0 and p[5])
            if not nC: continue
            sv=any(c[6] for c in CC if r['plant']<=c[0]<=r['t1'])
            S=C[(nC,nT)]; S['n']+=1; S['win']+=r.get('winner')=='CT'; S['save']+=sv
    print('==',l)
    for k in sorted(C):
        S=C[k]
        if S['n']<3: continue
        pr=PRO.get(k); print('  CT %d на T %d: %2d плантов; CT выиграли %3.0f%%, сейв %3.0f%%%s' % (k[0],k[1],S['n'],100*S['win']/S['n'],100*S['save']/S['n'], ('   | про: выиграли %d%%, сейв %d%%' % pr) if pr else ''))
