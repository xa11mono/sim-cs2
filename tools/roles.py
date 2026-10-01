import pandas as pd, numpy as np, json, glob
from matplotlib.path import Path
Z=json.load(open('/home/claude/sim/zones.json'))['zones']; Z2R=json.load(open('z2r.json'))
paths=[(z['name'] or z['id'],Path(np.array(z['pts']))) for z in Z]
def reg(x,y):
    for nm,p in paths:
        if p.contains_point((x,y)): return Z2R.get(nm,'прочее')
    return 'прочее'
def tr(X,Y): return ((X+2953)/5*2, (2164-Y)/5*2)
D='/home/claude/demos/demo_export/'
G=pd.read_csv('pro_nades.csv')
P=[]
for f in sorted(glob.glob(D+'*_ticks.csv.gz')):
    n=f.replace('_ticks.csv.gz',''); m=n.split('/')[-1]
    t=pd.read_csv(f,usecols=['tick','steamid','name','team_num','X','Y','is_alive','active_weapon_name'])
    fe=pd.read_csv(n+'_round_freeze_end.csv.gz'); re=pd.read_csv(n+'_round_end.csv.gz'); de=pd.read_csv(n+'_player_death.csv.gz')
    x,y=tr(t.X.values,t.Y.values); t=t.assign(x=x,y=y)
    st={}
    def S(name,side): 
        k=(name,side); 
        if k not in st: st[k]={'m':m,'name':name,'side':side,'rounds':0,'open':0,'openDeath':0,'openKill':0,'awp':0,'ticks':0,'sep':[], 'reg25':{}, 'firstIn':0}
        return st[k]
    for _,r in fe.iterrows():
        t0=r.tick; e=re[re.tick>t0].tick; t1=e.min() if len(e) else 1e18
        s=t[(t.tick>=t0)&(t.tick<t1)&(t.is_alive==True)]
        if not len(s): continue
        sides={nm:('T' if tn==2 else 'CT') for nm,tn in s.groupby('name').team_num.agg(lambda v:v.mode().iloc[0]).items()}
        for nm,sd in sides.items(): S(nm,sd)['rounds']+=1
        d=de[(de.tick>t0)&(de.tick<t1)].sort_values('tick')
        if len(d):
            f0=d.iloc[0]
            for nm in (f0.user_name,f0.attacker_name):
                if nm in sides: S(nm,sides[nm])['open']+=1
            if f0.user_name in sides: S(f0.user_name,sides[f0.user_name])['openDeath']+=1
            if f0.attacker_name in sides: S(f0.attacker_name,sides[f0.attacker_name])['openKill']+=1
        g=s[s.tick%64==0]
        for nm,gg in g.groupby('name'):
            if nm not in sides: continue
            q=S(nm,sides[nm]); q['ticks']+=len(gg); q['awp']+=int(gg.active_weapon_name.astype(str).str.contains('AWP').sum())
        # отдельность: средняя дистанция до ближайшего тиммейта 20-50с
        w=g[(g.tick>=t0+20*64)&(g.tick<t0+50*64)]
        for tk,gg in w.groupby('tick'):
            for sd in ('T','CT'):
                mm=gg[gg.name.map(sides)==sd]
                if len(mm)<3: continue
                XY=mm[['x','y']].values
                for i,nm in enumerate(mm.name):
                    dd=np.hypot(*(XY-XY[i]).T); dd[i]=1e9; S(nm,sd)['sep'].append(dd.min())
        tt=t0+25*64; tt-=tt%16
        for _,q in s[s.tick==tt].iterrows():
            nm=q['name']
            if nm in sides: R=S(nm,sides[nm])['reg25']; k=reg(q.x,q.y); R[k]=R.get(k,0)+1
    for k,v in st.items():
        v['sep']=float(np.median(v['sep'])) if v['sep'] else None
        v['awpShare']=v['awp']/max(1,v['ticks'])
        gn=G[(G.m==m)&(G.thrower==v['name'])&(G.side==v['side'])]
        v['nadesPerRound']=len(gn)/max(1,v['rounds'])
        v['openRate']=v['open']/max(1,v['rounds'])
        del v['awp']; del v['ticks']
        P.append(v)
df=pd.DataFrame(P); df.to_json('pro_players.json',orient='records',force_ascii=False)
print(len(df))
