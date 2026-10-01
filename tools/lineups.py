import pandas as pd, numpy as np, glob, json
from matplotlib.path import Path
D='/home/claude/demos/demo_export/'
Z=json.load(open('/home/claude/sim/zones.json'))['zones']
def zn(x,y):
    for z in Z:
        if Path(np.array(z['pts'])).contains_point((x,y)): return z['name'] or z['id']
    return None
def tr(X,Y): return ((X+2953)/5*2, (2164-Y)/5*2)
SITES={'A':(630,518),'B':(1533,845)}
def site_of(x,y): return 'A' if (x-630)**2+(y-518)**2 < (x-1533)**2+(y-845)**2 else 'B'
TYPES={'weapon_smokegrenade':('smoke','smokegrenade_detonate',(0.5,6.5)),'weapon_flashbang':('flash','flashbang_detonate',(0.5,3.5)),
       'weapon_hegrenade':('he','hegrenade_detonate',(0.5,4)),'weapon_molotov':('molly','inferno_startburn',(0.3,4)),'weapon_incgrenade':('molly','inferno_startburn',(0.3,4))}
rows=[]; ctx={}
for f in sorted(glob.glob(D+'*_weapon_fire.csv.gz')):
    n=f.replace('_weapon_fire.csv.gz',''); m=n.split('/')[-1]
    w=pd.read_csv(f); fe=pd.read_csv(n+'_round_freeze_end.csv.gz'); re=pd.read_csv(n+'_round_end.csv.gz'); pl=pd.read_csv(n+'_bomb_planted.csv.gz')
    det={k:pd.read_csv(n+f'_{v[1]}.csv.gz') for k,v in TYPES.items()}
    for j,r in fe.reset_index(drop=True).iterrows():
        t0=r.tick; e=re[re.tick>t0].tick; t1=e.min() if len(e) else 1e18
        p=pl[(pl.tick>t0)&(pl.tick<t1)]; tp=p.tick.min() if len(p) else None
        psite=site_of(*tr(p.user_X.iloc[0],p.user_Y.iloc[0])) if len(p) else None
        rid=f'{m}|{j}'
        ctx[rid]={'plant':psite}
        th=w[(w.tick>=t0)&(w.tick<t1)&(w.weapon.isin(TYPES.keys()))]
        used=set()
        for _,x in th.iterrows():
            typ,_,(a,b)=TYPES[x.weapon]; d=det[x.weapon]
            c=d[(d.user_steamid==x.user_steamid)&(d.tick>x.tick+a*64)&(d.tick<x.tick+b*64)].sort_values('tick')
            c=c[~c.index.isin(used)]
            if not len(c): continue
            dd=c.iloc[0]; used.add(c.index[0])
            fx,fy=tr(x.user_X,x.user_Y); lx,ly=tr(dd.x,dd.y)
            side='T' if x.user_team_num==2 else 'CT'; sec=(x.tick-t0)/64
            post = tp is not None and x.tick>=tp
            if post: trig='postplant' if side=='T' else 'retake'; site=psite
            elif sec<=3: trig='insta'; site='any'
            elif side=='T':
                if psite and tp-x.tick<=25*64 and ((lx-SITES[psite][0])**2+(ly-SITES[psite][1])**2)**.5<650: trig='exec'; site=psite
                else: trig='setup'; site=psite if psite else 'any'
            else:
                ls=site_of(lx,ly); dl=((lx-SITES[ls][0])**2+(ly-SITES[ls][1])**2)**.5
                if psite and tp-x.tick<=25*64 and ls==psite and dl<750: trig='call'; site=psite
                else: trig='timed'; site='any'
            rows.append({'rid':rid,'m':m,'thrower':x.user_name,'side':side,'type':typ,'trig':trig,'site':site,'sec':round(sec,1),'fx':fx,'fy':fy,'lx':lx,'ly':ly,
                         'yaw':x.user_yaw,'flight':round((dd.tick-x.tick)/64,2),'secToPlant': round((tp-x.tick)/64,1) if tp is not None else None})
G=pd.DataFrame(rows); G.to_csv('/home/claude/heat/pro_nades.csv',index=False)
nR=len(ctx); planted={s:sum(1 for v in ctx.values() if v['plant']==s) for s in 'AB'}
print('раундов',nR,'плант A/B',planted,'гранат сопоставлено',len(G))
print(G.groupby(['side','trig','type']).size().unstack(fill_value=0))
json.dump({'rounds':nR,'planted':planted},open('/home/claude/heat/nade_ctx.json','w'))
