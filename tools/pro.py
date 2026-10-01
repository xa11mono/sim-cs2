import pandas as pd, glob, numpy as np, json
from matplotlib.path import Path
D='/home/claude/demos/demo_export/'
def tr(X,Y): return ((X+2953)/5*2, (2164-Y)/5*2)
PH=['early','setup','late','post']
out=[]  # rows: x,y,dx,dy,side,phase,still
for f in sorted(glob.glob(D+'*_ticks.csv.gz')):
    n=f.replace('_ticks.csv.gz','')
    t=pd.read_csv(f); fe=pd.read_csv(n+'_round_freeze_end.csv.gz'); re=pd.read_csv(n+'_round_end.csv.gz'); pl=pd.read_csv(n+'_bomb_planted.csv.gz')
    t=t[t.is_alive==True].copy()
    x,y=tr(t.X.values,t.Y.values); t['x']=x; t['y']=y
    yaw=np.radians(t.yaw.values); t['dx']=np.cos(yaw); t['dy']=-np.sin(yaw)
    t=t.sort_values(['steamid','tick'])
    sp=np.hypot(t.groupby('steamid').x.diff(), t.groupby('steamid').y.diff())/(16/64)
    t['spd']=sp.values
    for _,r in fe.iterrows():
        t0=r.tick; e=re[re.tick>t0].tick; t1=e.min() if len(e) else t.tick.max()
        pp=pl[(pl.tick>t0)&(pl.tick<t1)]; tp=pp.tick.min() if len(pp) else 1e18
        site='-'
        if len(pp):
            bx,by=tr(pp.user_X.iloc[0],pp.user_Y.iloc[0]); site='A' if (bx-630)**2+(by-518)**2 < (bx-1533)**2+(by-845)**2 else 'B'
        s=t[(t.tick>=t0)&(t.tick<t1)]
        sec=(s.tick-t0)/64
        ph=np.where(s.tick>=tp,'post',np.where(sec<20,'early',np.where(sec<50,'setup','late')))
        o=pd.DataFrame({'x':s.x,'y':s.y,'dx':s.dx,'dy':s.dy,'side':np.where(s.team_num==3,'CT','T'),'phase':ph,'still':(s.spd<25).values,'site':site})
        out.append(o)
P=pd.concat(out); P=P[(P.x>=0)&(P.x<2048)&(P.y>=0)&(P.y<2048)]
P.to_parquet('pro.parquet') if False else P.to_csv('pro_samples.csv.gz',index=False,compression='gzip')
print(len(P)); print(P.groupby(['side','phase']).size()); print('still share', P.still.mean().round(2))
