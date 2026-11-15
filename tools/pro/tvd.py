import pandas as pd, numpy as np, json, sys
from matplotlib.path import Path
PH=['early','setup','late','post']
Z=json.load(open('/home/claude/sim/zones.json'))['zones']
paths=[(z['name'] or z['id'], Path(np.array(z['pts']))) for z in Z]
def zone_of(x,y):
    pts=np.c_[x,y]; out=np.array(['—']*len(pts),dtype=object)
    for nm,p in paths:
        m=p.contains_points(pts); out[m&(out=='—')]=nm
    return out
pro=pd.read_csv('pro_samples.csv.gz'); pro['zone']=zone_of(pro.x.values,pro.y.values)
def load(files):
    r=pd.concat([pd.DataFrame(json.load(open(f))['rows'],columns=['x','y','dx','dy','ct','ph','spd']) for f in files])
    d=pd.DataFrame({'x':r.x,'y':r.y,'side':np.where(r.ct==1,'CT','T'),'phase':[PH[i] for i in r.ph],'still':r.spd<25})
    d['zone']=zone_of(d.x.values,d.y.values); return d
res={}
for tag in sys.argv[1:]:
    b=load([f'b147_3_{tag}.json',f'b147_7_{tag}.json'])
    row={}
    for side in ('CT','T'):
        for ph in PH:
            p=pro[(pro.side==side)&(pro.phase==ph)].zone.value_counts(normalize=True)
            q=b[(b.side==side)&(b.phase==ph)].zone.value_counts(normalize=True)
            df=pd.DataFrame({'p':p,'q':q}).fillna(0)
            row[f'{side} {ph}']=round(0.5*abs(df.p-df.q).sum(),3)
    row['still']=round(b.still.mean(),2)
    res[tag]=row
    # key zones
    for side,ph,zn in [('CT','setup','Back Site'),('T','post','B Site'),('T','setup','Ruins'),('CT','post','Alley'),('CT','setup','Def')]:
        s=b[(b.side==side)&(b.phase==ph)]; row[f'{side} {ph} {zn}']=round((s.zone==zn).mean(),3)
print(pd.DataFrame(res).to_string())
