import sys,os,glob,numpy as np,pandas as pd,collections
sys.path.insert(0,'tools'); import demos
T=collections.Counter(); Dk=collections.Counter(); S=collections.Counter(); SD=collections.Counter(); B=[]
RIF=('AK-47','M4A4','M4A1-S','Galil AR','FAMAS','AUG','SG 553')
for f in sorted(glob.glob(os.path.join(demos.DEMOS,'*_motion.csv.gz'))):
  d=pd.read_csv(f,low_memory=False,usecols=['tick','steamid','is_alive','velocity_X','velocity_Y','ducking','shots_fired','active_weapon_name'])
  d=d[d.is_alive==True].sort_values(['steamid','tick'])
  for sid,g in d.groupby('steamid'):
    tk=g.tick.values; v=np.hypot(g.velocity_X.fillna(0).values,g.velocity_Y.fillna(0).values); sf=g.shots_fired.fillna(0).values; cont=np.r_[False,np.diff(tk)==1]
    dk=g.ducking.fillna(False).values.astype(bool); w=g.active_weapon_name.astype(str).values
    shot=np.where((np.diff(sf,prepend=sf[0])>0)&cont)[0]; near=np.zeros(len(tk),bool)
    for i in shot: near[max(0,i-96):i+97]=True
    ctx=np.where(near,'fight',np.where(v<100,'hold',np.where(v<200,'walk','run')))
    for c in ('fight','hold','walk','run'): m=ctx==c; T[c]+=m.sum(); Dk[c]+=(m&dk).sum()
    for i in shot:
      if w[i] not in RIF: continue
      k='1-я пуля' if sf[i]==1 else ('2–3' if sf[i]<=3 else '4+'); S[k]+=1; SD[k]+=dk[i]
    # отрезки приседа: длина
    i=0;n=len(tk)
    while i<n:
      if dk[i]:
        j=i
        while j<n and dk[j]: j+=1
        B.append((j-i)/64); i=j
      else: i+=1
print('присед, доля времени: всего %.1f%%'%(100*sum(Dk.values())/sum(T.values())), {c:'%.1f%%'%(100*Dk[c]/T[c]) for c in T})
print('выстрелы винтовки на приседе:', {k:'%.0f%% из %d'%(100*SD[k]/S[k],S[k]) for k in S})
print('отрезок приседа, с, кв 25/50/75/90:',np.percentile(B,[25,50,75,90]).round(2).tolist(), 'приседаний в мин:', round(len(B)/(sum(T.values())/3840),2))
