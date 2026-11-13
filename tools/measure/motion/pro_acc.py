import sys,os,glob,numpy as np,pandas as pd,collections
sys.path.insert(0,'tools'); import demos
C=collections.defaultdict(list); D=collections.defaultdict(list)
RIF=('AK-47','M4A4','M4A1-S','Galil AR','FAMAS')
for f in sorted(glob.glob(os.path.join(demos.DEMOS,'*_motion.csv.gz'))):
  d=pd.read_csv(f,low_memory=False,usecols=['tick','steamid','is_alive','LEFT','RIGHT','FORWARD','BACK','velocity_X','velocity_Y','is_walking','ducking','is_scoped','active_weapon_name'])
  d=d[d.is_alive==True].sort_values(['steamid','tick'])
  for sid,g in d.groupby('steamid'):
    tk=g.tick.values; v=np.hypot(g.velocity_X.fillna(0).values,g.velocity_Y.fillna(0).values); cont=np.r_[False,np.diff(tk)==1]
    L=g.LEFT.values.astype(bool); R=g.RIGHT.values.astype(bool); F=g.FORWARD.values.astype(bool)|g.BACK.values.astype(bool)
    ok=~(g.is_walking.fillna(False).values.astype(bool)|g.ducking.fillna(False).values.astype(bool)|g.is_scoped.fillna(False).values.astype(bool)|F)&np.isin(g.active_weapon_name.astype(str).values,RIF)
    side=np.where(L&~R,-1,np.where(R&~L,1,0)); n=len(tk)
    for i in range(1,n):
      if side[i] and not side[i-1] and cont[i] and v[i-1]<5:
        for k in range(0,40):
          j=i+k
          if j>=n or not cont[j] or side[j]!=side[i] or not ok[j]: break
          C[k].append(v[j])
      # отпустил клавишу на скорости — торможение трением
      if side[i-1] and not side[i] and cont[i] and v[i-1]>150 and ok[i-1]:
        for k in range(0,30):
          j=i+k
          if j>=n or not cont[j] or side[j] or not ok[j]: break
          D[k].append(v[j])
print('разгон с места (винтовка, без шифта/приседа/W): тик → медиана скорости (n)')
print([(k,round(float(np.median(C[k]))),len(C[k])) for k in range(0,40,2) if len(C[k])>20])
print('отпустил на >150: тик → медиана скорости')
print([(k,round(float(np.median(D[k]))),len(D[k])) for k in range(0,30,2) if len(D[k])>20])
