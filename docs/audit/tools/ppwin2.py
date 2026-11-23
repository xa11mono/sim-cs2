import sys, collections; sys.path.insert(0,'/home/user/sim-cs2/tools'); import mapdir; M=mapdir.current(); import demos as D
G=collections.defaultdict(lambda:[0,0])
for demo in D.demo_names():
    re_=D.event(demo,'round_end'); t=D.ticks_of(demo)
    for r in D.rounds_of(demo):
        if not r['tplant']: continue
        e=re_[(re_.tick>r['tplant'])&(re_.tick<=r['t1']+64)]
        if not len(e): continue
        a=t[(t.tick>=r['tplant'])&(t.tick<r['tplant']+16)].drop_duplicates('steamid')
        nC=(a.side=='CT').sum(); nT=(a.side=='T').sum()
        g='T+' if nT>nC else ('=' if nT==nC else 'CT+'); G[g][0]+=1; G[g][1]+= str(e.winner.iloc[0]).upper() in ('T','2','TERRORIST')
print(M,{g:'%d: %.0f%%'%(v[0],100*v[1]/v[0]) for g,v in sorted(G.items())})
