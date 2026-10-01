import pandas as pd, numpy as np, json, glob
from matplotlib.path import Path
Z=json.load(open('/home/claude/sim/zones.json'))['zones']
REG={'A сторона':['A Main','A Hall','A Stairs','Long','Main Hall / Candle','A Site','Back Site','Def','Boost','Box','Plat','Temple','Single','Triple Box'],
 'мид':['Mid','Top Mid','Lower Mid / Start Mid','Xbox','Jungle / Pit','Chamber Lane','Donut','Short','Triple / Window / Cat','zone65','Split','Connector / Red Room / Red','Sniper Nest'],
 'B сторона':['T Ramp','Tunnel','Water','Ruins','T Lower','T Upper / Heaven','Ramp','Rat','Wood','Lamp Room / Excavation','Dark','Cave / House','B Site','Site B','90','Bonger / Wood / Ninja','Dark Box']}
Z2R={z:r for r,zs in REG.items() for z in zs}
paths=[(z['name'] or z['id'],Path(np.array(z['pts']))) for z in Z]
def reg(x,y):
    for nm,p in paths:
        if p.contains_point((x,y)): return Z2R.get(nm,'другое')
    return 'другое'
def tr(X,Y): return ((X+2953)/5*2, (2164-Y)/5*2)
D='/home/claude/demos/demo_export/'
rows=[]
for f in sorted(glob.glob(D+'*_ticks.csv.gz')):
    n=f.replace('_ticks.csv.gz',''); t=pd.read_csv(f,usecols=['tick','steamid','team_num','X','Y','is_alive'])
    fe=pd.read_csv(n+'_round_freeze_end.csv.gz'); re=pd.read_csv(n+'_round_end.csv.gz'); pl=pd.read_csv(n+'_bomb_planted.csv.gz'); de=pd.read_csv(n+'_player_death.csv.gz')
    for _,r in fe.iterrows():
        t0=r.tick; e=re[re.tick>t0].tick; t1=e.min() if len(e) else 1e18
        p=pl[(pl.tick>t0)&(pl.tick<t1)]
        if not len(p): continue
        tp=p.tick.min(); sec=(tp-t0)/64; px,py=tr(p.user_X.iloc[0],p.user_Y.iloc[0])
        site='A' if (px-630)**2+(py-518)**2 < (px-1533)**2+(py-845)**2 else 'B'
        if sec<55: continue
        tt=t0+30*64; tt-=tt%16
        s=t[(t.tick==tt)&(t.team_num==2)&(t.is_alive==True)]
        if len(s)<4: continue
        cnt={'A сторона':0,'мид':0,'B сторона':0,'другое':0}
        for _,q in s.iterrows(): cnt[reg(*tr(q.X,q.Y))]+=1
        dd=de[(de.tick>t0)&(de.tick<t0+45*64)]
        rows.append({'site':site,**cnt,'Tdead_before45':int((dd.user_team_num==2).sum()),'CTdead_before45':int((dd.user_team_num==3).sum())})
d=pd.DataFrame(rows)
print(len(d),'дефолтных раундов (плант после 55 с); T на 30-й секунде по районам:')
print(d.groupby('site')[['A сторона','мид','B сторона','другое','Tdead_before45','CTdead_before45']].mean().round(2)); print(d.groupby('site').size())
