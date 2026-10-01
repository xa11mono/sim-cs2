exec(open('onset.py').read())
D='/home/claude/demos/demo_export/'
def tr(X,Y): return ((X+2953)/5*2, (2164-Y)/5*2)
allo=[]
for f in sorted(glob.glob(D+'*_ticks.csv.gz')):
    n=f.replace('_ticks.csv.gz','')
    t=pd.read_csv(f,usecols=['tick','steamid','team_num','X','Y','yaw','is_alive'])
    fe=pd.read_csv(n+'_round_freeze_end.csv.gz'); re=pd.read_csv(n+'_round_end.csv.gz'); pl=pd.read_csv(n+'_bomb_planted.csv.gz')
    t=t[t.is_alive==True]
    x,y=tr(t.X.values,t.Y.values)
    t=t.assign(x=x,y=y,ang=-np.radians(t.yaw.values),ct=(t.team_num==3).astype(int),pid=t.steamid.astype(str))
    t=t.sort_values(['pid','tick']); sp=np.hypot(t.groupby('pid').x.diff(),t.groupby('pid').y.diff())/(16/64); t['still']=(sp<25).values
    parts=[]
    for j,r in fe.reset_index(drop=True).iterrows():
        t0=r.tick; e=re[re.tick>t0].tick; t1=e.min() if len(e) else t.tick.max()
        p=pl[(pl.tick>t0)&(pl.tick<t1)].tick; tp=p.min() if len(p) else 1e18
        s=t[(t.tick>=t0)&(t.tick<t1)].copy(); sec=(s.tick-t0)/64
        s['ph']=np.where(s.tick>=tp,3,np.where(sec<20,0,np.where(sec<50,1,2))); s['round']=f'{n}|{j}'
        parts.append(s)
    o=onsets(pd.concat(parts)); o['match']=n.split('/')[-1]; allo.append(o); print(n.split('/')[-1], len(o), flush=True)
O=pd.concat(allo); O.to_csv('pro_onsets.csv',index=False)
print(summarize(O,'про'))
