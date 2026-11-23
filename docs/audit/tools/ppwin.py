import sys; sys.path.insert(0,'/home/user/sim-cs2/tools'); import mapdir; M=mapdir.current(); import demos as D
n=w=0
for demo in D.demo_names():
    re_=D.event(demo,'round_end')
    for r in D.rounds_of(demo):
        if not r['tplant']: continue
        e=re_[(re_.tick>r['tplant'])&(re_.tick<=r['t1']+64)]
        if not len(e): continue
        n+=1; w+= str(e.winner.iloc[0]).upper() in ('T','2','TERRORIST')
print(M,'плантов',n,'T выиграл после планта %.0f%%'%(100*w/n))
