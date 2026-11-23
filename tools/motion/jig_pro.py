"""Д29 (18.11): стрейф / джиггл про — нажатие A / D, после которого в 0,4 с жмут противоположную: длительность и сдвиг за нажатие
(демки карты с каждым тиком, *_motion.csv.gz). Даёт STRAFE_PRO (470). Запуск: python3 tools/motion/jig_pro.py"""
import pandas as pd, numpy as np, glob, math
F=sorted(glob.glob('data/maps/mirage/demos/*_motion.csv.gz'))[:25]
D=[];S=[]
for f in F:
    d=pd.read_csv(f,usecols=['tick','steamid','LEFT','RIGHT','FORWARD','BACK','X','Y','is_alive','active_weapon_name'],low_memory=False)
    d=d[(d.is_alive==True)&d.active_weapon_name.isin(['AK-47','M4A4','M4A1-S','Galil AR','FAMAS'])].sort_values(['steamid','tick'])
    for sid,g in d.groupby('steamid'):
        L=g.LEFT.values.astype(bool); R=g.RIGHT.values.astype(bool); Fw=g.FORWARD.values.astype(bool)|g.BACK.values.astype(bool)
        k=np.where(L&~R&~Fw,1,np.where(R&~L&~Fw,2,0)); tk=g.tick.values; x=g.X.values; y=g.Y.values
        i=0; n=len(k); segs=[]
        while i<n:
            j=i
            while j+1<n and k[j+1]==k[i] and tk[j+1]-tk[j]<=2: j+=1
            segs.append((k[i],i,j)); i=j+1
        # стрейф «A–D»: нажатие, за которым в 0,4 с идёт противоположное
        for a,b in zip(segs,segs[1:]+[(0,0,0)]):
            if a[0]==0: continue
            nxt=[s for s in segs if s[1]>a[2] and tk[s[1]]-tk[a[2]]<=26 and s[0]!=0]
            if not nxt or nxt[0][0]==a[0]: continue
            D.append(tk[a[2]]-tk[a[1]]+1); S.append(math.hypot(x[a[2]]-x[a[1]],y[a[2]]-y[a[1]]))
D=np.array(D); S=np.array(S)
q=lambda v:' / '.join('%.0f'%np.percentile(v,p) for p in (10,25,50,75,90))
print('про (Mirage, %d демок): нажатий A/D со сменой на противоположное ≤ 0,4 с: %d'%(len(F),len(D)))
print('  длительность нажатия, тики (10/25/50/75/90 %%): %s  (64 тика = 1 с)'%q(D))
print('  сдвиг за нажатие, ед. игры (10/25/50/75/90 %%): %s'%q(S))
