# Урон взрыва бомбы у про (v271): по каждому взрыву — HP игроков до и через 1,5–2,5 с после, расстояние до бомбы.
# python3 tools/bomb_dmg.py <out.csv>; длину пути по навмешу считает игра (buildWaypointPath) — см. DECISIONS v271.
import pandas as pd, glob, os, numpy as np, json, sys
D='/home/claude/sim-cs2/data/demos'
rows=[]
for f in sorted(glob.glob(D+'/*_bomb_exploded.csv.gz')):
    base=f[:-len('_bomb_exploded.csv.gz')]
    ex=pd.read_csv(f); pl=pd.read_csv(base+'_bomb_planted.csv.gz')
    if not os.path.exists(base+'_ticks.csv.gz'): continue
    tk=pd.read_csv(base+'_ticks.csv.gz',usecols=['tick','name','health','is_alive','X','Y','Z','team_num'])
    for _,e in ex.iterrows():
        p=pl[pl.total_rounds_played==e.total_rounds_played]
        if not len(p): continue
        p=p.iloc[-1]; bx,by=p.user_X,p.user_Y
        bz=tk[(tk.tick<=p.tick)&(tk.name==p.user_name)].tail(1).Z
        bz=float(bz.iloc[0]) if len(bz) else 0
        before=tk[(tk.tick<e.tick)&(tk.tick>=e.tick-48)].groupby('name').tail(1)
        after=tk[(tk.tick>=e.tick+96)&(tk.tick<e.tick+160)].groupby('name').head(1).set_index('name')
        for _,b in before.iterrows():
            if not b.is_alive or b['name'] not in after.index: continue
            a=after.loc[b['name']]
            hp0=b.health; hp1=a.health if a.is_alive else 0
            d=float(np.hypot(b.X-bx,b.Y-by)); dz=float(b.Z-bz)
            rows.append(dict(demo=os.path.basename(base),rnd=int(e.total_rounds_played),name=b['name'],team=int(b.team_num),d=d,dz=dz,hp0=int(hp0),hp1=int(hp1),dmg=int(hp0-hp1),died=hp1==0,
                 bx=(bx+2953)/5*2,by=(2164-by)/5*2,px=(b.X+2953)/5*2,py=(2164-b.Y)/5*2))
r=pd.DataFrame(rows); r.to_csv(sys.argv[1],index=False)
print(len(r),'игроков в',r.groupby(['demo','rnd']).ngroups,'взрывах')
r['bin']=pd.cut(r.d,[0,250,500,750,1000,1250,1500,1750,2000,2500,3000,5000])
print(r.groupby('bin',observed=True).agg(n=('dmg','size'),dmg_med=('dmg','median'),dmg_max=('dmg','max'),died=('died','mean'),hurt=('dmg',lambda s:(s>0).mean())).round(2).to_string())
