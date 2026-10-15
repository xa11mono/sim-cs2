"""Лайнапы про: <pro_dir>/pro_nades.csv (tools/lineups.py) → <pro_dir>/pro_lineups.json (у Ancient pro_dir — data/pro).
python3 tools/cluster.py [--map ancient]   (v318: карта — ключом --map; зоны и названия — zones.json набора карты)
Гранаты «себе» (purpose) не берутся. В набор карты (lineups.json: pro / proExtra) отбирает tools/demos_bake.py."""
import pandas as pd, numpy as np, json, os, sys
from matplotlib.path import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapdir  # noqa: E402
MAPNAME=mapdir.current()
ROOT=mapdir.ROOT
PRO=mapdir.pro_dir(MAPNAME)
_Z=json.load(open(mapdir.path(MAPNAME,'zones.json'),encoding='utf-8'))
_ZL=json.load(open(mapdir.path(MAPNAME,'map.json'),encoding='utf-8')).get('zoneLayer',{'dx':0,'dy':0,'scale':1})
def _zl(p): return (1024+(p['x']-1024)*_ZL['scale']+_ZL['dx'], 1024+(p['y']-1024)*_ZL['scale']+_ZL['dy'])
Z=[(_Z['names'].get(z['id']) or z['id'], Path(np.array([_zl(p) for p in _Z['shapes'].get(z['id'], z['points'])]))) for z in _Z['zonemap']['zones']]
def zn(x,y):
    for nm,p in Z:
        if p.contains_point((x,y)): return nm.split(' / ')[0]
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
