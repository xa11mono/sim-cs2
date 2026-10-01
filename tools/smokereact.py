import pandas as pd, numpy as np, glob, json
D='/home/claude/demos/demo_export/'
W=np.array(json.load(open('walls.json'))['segs'],dtype=float); ax,ay,bx,by=W.T
def los1(px,py,qx,qy):
    d1x,d1y=qx-px,qy-py; d2x,d2y=bx-ax,by-ay; den=d1x*d2y-d1y*d2x
    with np.errstate(divide='ignore',invalid='ignore'):
        t=((ax-px)*d2y-(ay-py)*d2x)/den; u=((ax-px)*d1y-(ay-py)*d1x)/den
    return not ((np.abs(den)>1e-9)&(t>0)&(t<1)&(u>=0)&(u<=1)).any()
def tr(X,Y): return ((X+2953)/5*2, (2164-Y)/5*2)
R=58; LIFE=18
res={'smokes':0,'spammed':0,'bursts':0,'heCleared':0,'moveN':0,'moved':0,'baseN':0,'baseMoved':0,'byPhase':{}}
rng=np.random.default_rng(1)
for f in sorted(glob.glob(D+'*_ticks.csv.gz')):
    n=f.replace('_ticks.csv.gz','')
    t=pd.read_csv(f,usecols=['tick','steamid','team_num','X','Y','is_alive']); t=t[t.is_alive==True]
    x,y=tr(t.X.values,t.Y.values); t=t.assign(x=x,y=y)
    sm=pd.read_csv(n+'_smokegrenade_detonate.csv.gz'); he=pd.read_csv(n+'_hegrenade_detonate.csv.gz'); wf=pd.read_csv(n+'_weapon_fire.csv.gz')
    wf=wf[~wf.weapon.str.contains('grenade|flashbang|molotov|incgrenade|knife|c4|decoy',regex=True)]
    wx,wy=tr(wf.user_X.values,wf.user_Y.values); wf=wf.assign(x=wx,y=wy,a=-np.radians(wf.user_yaw.values))
    hx,hy=tr(he.x.values,he.y.values); he=he.assign(x=hx,y=hy)
    # команда бросившего смок: по позиции игрока в тиках
    team_of={}
    for sid,g in t.groupby('steamid'): team_of[sid]=int(g.team_num.mode().iloc[0])
    by_tick={k:g for k,g in t.groupby('tick')}
    ticks=np.array(sorted(by_tick.keys()))
    for _,s in sm.iterrows():
        sx,sy=tr(s.x,s.y); st=team_of.get(s.user_steamid); 
        if st is None: continue
        enemy=5-st; t0=s.tick; t1=t0+LIFE*64
        res['smokes']+=1
        # 1) стрельба врагов (по отношению к бросившему) сквозь смок
        sh=wf[(wf.tick>=t0)&(wf.tick<t1)&(wf.user_team_num==enemy)]
        nb=0
        for _,q in sh.iterrows():
            dx,dy=np.cos(q.a),np.sin(q.a); vx,vy=sx-q.x,sy-q.y; proj=vx*dx+vy*dy
            if proj<R or proj>900: continue
            perp=abs(vx*dy-vy*dx)
            if perp>R*0.9: continue
            if np.hypot(vx,vy)<R: continue
            ex,ey=q.x+dx*(proj-R),q.y+dy*(proj-R)
            if not los1(q.x,q.y,ex,ey): continue
            nb+=1
        res['bursts']+=nb
        if nb>0: res['spammed']+=1
        # 2) HE врагов в смок
        if len(he[(he.tick>=t0)&(he.tick<t1)&(np.hypot(he.x-sx,he.y-sy)<R*1.3)]): res['heCleared']+=1
        # 3) смена позиции: враги бросившего, стоящие, в 150..700 px, с линией на центр смока
        i0=np.searchsorted(ticks,t0); 
        if i0>=len(ticks): continue
        g0=by_tick[ticks[i0]]; i1=np.searchsorted(ticks,t0+4*64)
        if i1>=len(ticks): continue
        g1=by_tick[ticks[i1]].set_index('steamid')
        ip=np.searchsorted(ticks,t0-2*64); gp=by_tick[ticks[max(0,ip)]].set_index('steamid')
        for _,p in g0[g0.team_num==enemy].iterrows():
            if p.steamid not in g1.index or p.steamid not in gp.index: continue
            if np.hypot(gp.loc[p.steamid].x-p.x,gp.loc[p.steamid].y-p.y)>30: continue   # стоял 2с до смока
            d=np.hypot(sx-p.x,sy-p.y)
            if d<150 or d>700 or not los1(p.x,p.y,sx,sy): continue
            res['moveN']+=1
            if np.hypot(g1.loc[p.steamid].x-p.x,g1.loc[p.steamid].y-p.y)>100: res['moved']+=1
    # базовая линия: стоящие игроки в случайные моменты — сдвинулись ли >100px за 4с
    for _ in range(400):
        i=rng.integers(8,len(ticks)-17); g0=by_tick[ticks[i]]; gp=by_tick[ticks[i-8]].set_index('steamid'); g1=by_tick[ticks[i+16]].set_index('steamid')
        if ticks[i+16]-ticks[i]!=256 or ticks[i]-ticks[i-8]!=128: continue
        for _,p in g0.iterrows():
            if p.steamid not in g1.index or p.steamid not in gp.index: continue
            if np.hypot(gp.loc[p.steamid].x-p.x,gp.loc[p.steamid].y-p.y)>30: continue
            res['baseN']+=1
            if np.hypot(g1.loc[p.steamid].x-p.x,g1.loc[p.steamid].y-p.y)>100: res['baseMoved']+=1
    print(n.split('/')[-1],res['smokes'],flush=True)
out={'smokes':res['smokes'],'spammedShare':round(res['spammed']/res['smokes'],3),'burstsPerSmoke':round(res['bursts']/res['smokes'],2),
     'heClearedShare':round(res['heCleared']/res['smokes'],3),'moveAfterSmoke':round(res['moved']/max(1,res['moveN']),3),'moveN':res['moveN'],
     'moveBaseline':round(res['baseMoved']/max(1,res['baseN']),3),'baseN':res['baseN']}
print(out); json.dump(out,open('pro_smoke_react.json','w'))
