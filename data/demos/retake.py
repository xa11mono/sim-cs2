import pandas as pd, glob, numpy as np
def tr(X,Y): return ((X+2953)/5*2, (2164-Y)/5*2)
rows=[]
for f in sorted(glob.glob('*_ticks.csv.gz')):
    n=f.replace('_ticks.csv.gz','')
    t=pd.read_csv(f); pl=pd.read_csv(n+'_bomb_planted.csv.gz'); re=pd.read_csv(n+'_round_end.csv.gz')
    for _,p in pl.iterrows():
        bx,by=tr(p.user_X,p.user_Y); tp=p.tick
        e=re[re.tick>tp].tick; t1=e.min() if len(e) else t.tick.max()
        s=t[(t.tick>=tp)&(t.tick<=t1)]
        a0=s[s.tick==s.tick.min()]; a0=a0[a0.is_alive==True]
        nT=(a0.team_num==2).sum(); nC=(a0.team_num==3).sum()
        if nC==0: continue
        # попытка ретейка: хоть один CT подошёл к бомбе ближе 450px
        c=s[(s.team_num==3)&(s.is_alive==True)]
        d=np.hypot(*(np.array([tr(x,y) for x,y in zip(c.X,c.Y)])-[bx,by]).T) if len(c) else np.array([9e9])
        rows.append({'m':n[:12],'nC':int(nC),'nT':int(nT),'attempt':bool((d<450).any())})
d=pd.DataFrame(rows)
d['diff']=d.nC-d.nT
print(len(d),'plants with CT alive; overall attempt rate', d.attempt.mean().round(2))
print(d.groupby('diff').attempt.agg(['count','mean']).round(2))
