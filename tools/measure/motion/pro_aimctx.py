import sys,os,glob,numpy as np,pandas as pd,collections
sys.path.insert(0,'tools'); import demos
T=collections.Counter(); ST=collections.Counter(); FL=collections.Counter(); R=collections.defaultdict(list)
for f in sorted(glob.glob(os.path.join(demos.DEMOS,'*_motion.csv.gz'))):
  d=pd.read_csv(f,low_memory=False,usecols=['tick','steamid','is_alive','velocity_X','velocity_Y','yaw','shots_fired'])
  d=d[d.is_alive==True].sort_values(['steamid','tick'])
  for sid,g in d.groupby('steamid'):
    tk=g.tick.values; v=np.hypot(g.velocity_X.fillna(0).values,g.velocity_Y.fillna(0).values); sf=g.shots_fired.fillna(0).values; cont=np.r_[False,np.diff(tk)==1]
    near=np.zeros(len(tk),bool)
    for i in np.where((np.diff(sf,prepend=sf[0])>0)&cont)[0]: near[max(0,i-96):i+97]=True
    ctx=np.where(near,'fight',np.where(v<100,'hold',np.where(v<200,'walk','run')))
    y=g.yaw.values.astype(float); dy=np.abs((np.diff(y,prepend=y[0])+180)%360-180)*64; dy[~cont]=np.nan
    for c in ('fight','hold','walk','run'):
      m=(ctx==c)&~np.isnan(dy); T[c]+=m.sum(); ST[c]+=(m&(dy<5)).sum(); R[c].extend(dy[m][::16].tolist())
for c in T: print(c,'неподвижен %.0f%%'%(100*ST[c]/T[c]),'скорость поворота °/с кв 50/75/90:',np.percentile(R[c],[50,75,90]).round().tolist())
