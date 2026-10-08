"""Лайнапы про: data/pro/pro_nades.csv (tools/lineups.py) → data/pro/pro_lineups.json.
Гранаты «себе» (purpose) не берутся. src/data/lineups_pro.json (его читает игра)
отсюда не перезаписывается."""
import pandas as pd, numpy as np, json, os
from matplotlib.path import Path
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRO=os.path.join(ROOT,'data','pro')
Z=json.load(open(os.path.join(ROOT,'src','zones.json')))['zones']
def zn(x,y):
    for z in Z:
        if Path(np.array(z['pts'])).contains_point((x,y)): return (z['name'] or z['id']).split(' / ')[0]
    return None
G=pd.read_csv(os.path.join(PRO,'pro_nades.csv')); C=json.load(open(os.path.join(PRO,'nade_ctx.json')))
G=G[G.purpose.fillna('')=='']
def ctxN(side,trig,site):
    if site in ('A','B'): return C['planted'][site]
    return C['rounds']
TN={'smoke':'смок','flash':'флешка','he':'HE','molly':'молотов'}
TR={'insta':'инста','exec':'выход','setup':'сетап','postplant':'пост-плант','retake':'ретейк','call':'задержка выхода','timed':'по времени'}
out=[]
for (side,typ,trig,site),g in G.groupby(['side','type','trig','site']):
    P=g[['fx','fy','lx','ly']].values; left=np.ones(len(g),bool); idx=np.arange(len(g))
    while left.any():
        # центр с наибольшим числом соседей
        L=idx[left]; best=None
        for i in L:
            nb=L[(np.hypot(P[L,0]-P[i,0],P[L,1]-P[i,1])<70)&(np.hypot(P[L,2]-P[i,2],P[L,3]-P[i,3])<60)]
            if best is None or len(nb)>len(best[1]): best=(i,nb)
        i,nb=best; left[nb]=False
        s=g.iloc[nb]
        if len(nb)<3 or s.m.nunique()<2: continue
        fx,fy,lx,ly=np.median(P[nb],axis=0)
        n=ctxN(side,trig,site)
        L2={'team':side,'type':typ,'trigger':trig,'site':site,'from':{'x':round(float(fx),1),'y':round(float(fy),1)},'to':{'x':round(float(lx),1),'y':round(float(ly),1)},
            'n':int(len(nb)),'matches':int(s.m.nunique()),'prob':round(min(1,len(nb)/n),3),'at':round(float(s.sec.median()),1),
            'lead':round(float(s.secToPlant.median()),1) if trig=='exec' else None,'flight':round(float(s.flight.median()),2)}
        fz,tz=zn(fx,fy),zn(lx,ly)
        L2['name']=f"про: {TN[typ]} {tz or '?'} ({TR[trig]}{', '+site if site in ('A','B') else ''})"
        L2['fromZone']=fz; L2['toZone']=tz
        out.append(L2)
out.sort(key=lambda l:(-l['prob']))
for i,l in enumerate(out): l['id']=f"pro{i}"
json.dump(out,open(os.path.join(PRO,'pro_lineups.json'),'w'),ensure_ascii=False,indent=1)
df=pd.DataFrame(out)
print(len(out),'лайнапов'); print(df.groupby(['team','trigger','site']).size().unstack(fill_value=0))
print(df[['team','name','n','matches','prob','at','fromZone']].head(30).to_string())
