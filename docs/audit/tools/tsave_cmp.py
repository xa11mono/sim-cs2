import json, sys, collections
PRO={1:{2:[9,6,18],3:[4,9,18],4:[5,10,27],5:[2,9,21]},2:{3:[10,11,20],4:[8,14,27],5:[8,19,35]}}
for l in sys.argv[1:]:
    C=collections.Counter(); N=collections.Counter()
    for m in [3,7,11,13,17,19,23,29]:
        d=json.load(open('/home/user/sim-cs2/tools/measure/runs/%s/rec_%d.json'%(l,m)))
        PT=collections.defaultdict(list)
        for p in d['pos']: PT[p[0]].append(p)
        A=collections.defaultdict(list)
        for a in d['act']:
            if a[1].startswith('T'): A[a[0]].append(a[2])
        for r in d['rounds']:
            if 't1' not in r: continue
            end=r.get('plant') or r['t1']; seen=set(); saved=None
            for t in range(r['t0']-r['t0']%32, end, 32):
                P=PT.get(t-t%16,[]); nT=sum(1 for p in P if p[2]==0 and p[5]); nC=sum(1 for p in P if p[2]==1 and p[5])
                if nT in PRO and nC in PRO[nT]:
                    sec=115-(t-r['t0'])/64; k=(nT,nC,0 if sec>55 else 1 if sec>30 else 2)
                    if k not in seen: seen.add(k); N[k]+=1
                    if saved is None and any(tg.startswith('save') for tg in A.get(t,[])): saved=k; C[k]+=1
    print('==',l,'(расклад впервые в раунде → доля, где T ушли в сейв; про — доля выживших без планта)')
    for k in sorted(N):
        if N[k]>=3: print('  T%d на CT%d, %s: %2d раз, сейв %3.0f%%   | про %d%%' % (k[0],k[1],['>55с','30–55с','<30с'][k[2]],N[k],100*C[k]/N[k],PRO[k[0]][k[1]][k[2]]))
