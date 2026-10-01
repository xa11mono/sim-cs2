import pandas as pd, glob, numpy as np
def tr(X,Y): return ((X+2953)/5*2, (2164-Y)/5*2)
res={'T_adv':[], 'CT_adv':[]}
for f in sorted(glob.glob('*_ticks.csv.gz')):
    n=f.replace('_ticks.csv.gz','')
    t=pd.read_csv(f); fe=pd.read_csv(n+'_round_freeze_end.csv.gz'); re=pd.read_csv(n+'_round_end.csv.gz')
    pl=pd.read_csv(n+'_bomb_planted.csv.gz')
    for _,r in fe.iterrows():
        rn=r.total_rounds_played; t0=r.tick
        ends=re[re.tick>t0].tick; t1=ends.min() if len(ends) else t.tick.max()
        pls=pl[(pl.tick>t0)&(pl.tick<t1)].tick; tp=pls.min() if len(pls) else None
        s=t[(t.tick>=t0)&(t.tick<=t1)]
        for side,me,foe in (('T_adv',2,3),('CT_adv',3,2)):
            # первый момент до планта, когда у врага <=2, а нас больше
            for tk,g in s.groupby('tick'):
                if tp is not None and tk>=tp: break
                a=g[g.is_alive==True]; nm=(a.team_num==me).sum(); nf=(a.team_num==foe).sum()
                if 1<=nf<=2 and nm>nf:
                    # что делают дальше 10 секунд: средняя скорость своих
                    w=s[(s.tick>=tk)&(s.tick<=tk+640)&(s.is_alive==True)&(s.team_num==me)].sort_values('tick')
                    sp=[]
                    for sid,gg in w.groupby('steamid'):
                        xy=np.array([tr(x,y) for x,y in zip(gg.X,gg.Y)]); 
                        if len(xy)>4: sp.append(np.mean(np.hypot(*np.diff(xy,axis=0).T))/(16/64))  # px/s
                    secLeft=(115*64-(tk-t0))/64
                    res[side].append({'m':n[:20],'r':rn,'nm':int(nm),'nf':int(nf),'secLeft':round(secLeft),'plantedLater': tp is not None, 'tToPlant': round((tp-tk)/64,1) if tp is not None else None,'speed_px_s':round(np.mean(sp),1) if sp else None})
                    break
for k,v in res.items():
    d=pd.DataFrame(v); print('==',k,len(d)); print(d.to_string()); 
    if k=='T_adv': print('plant after advantage:', d.plantedLater.mean().round(2), 'median time to plant', d.tToPlant.median())
    print('median speed px/s', d.speed_px_s.median())
