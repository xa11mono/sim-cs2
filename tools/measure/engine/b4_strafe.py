#!/usr/bin/env python3
"""(Б4) Шаг стрейфа у про: сдвиг вбок от взгляда между очередями одного игрока (пауза 0,5–1,5 с) по weapon_fire_full обеих карт.
Запуск из корня репо: python3 tools/measure/engine/b4_strafe.py → квантили паузы, сдвига вбок и вперёд (ед.) → STRAFE_PRO в 470_fight_cycle."""
import glob, math, numpy as np, pandas as pd, sys
sys.path.insert(0,'tools/measure/engine'); from b2_shoot import wcls
res=[]; gaps=[]
for D in ('data/demos','data/maps/mirage/demos'):
  for f in sorted(glob.glob(D+'/*_weapon_fire_full.csv.gz')):
    F=pd.read_csv(f,usecols=['tick','user_steamid','weapon','user_X','user_Y','user_yaw','user_velocity_X','user_velocity_Y'])
    F=F[F.weapon.map(lambda w: wcls(w) in ('rifle','pistol','smg'))].sort_values('tick')
    for s,g in F.groupby('user_steamid'):
      t=g.tick.values; X=g.user_X.values; Y=g.user_Y.values; yw=g.user_yaw.values
      for i in range(1,len(t)):
        dt=t[i]-t[i-1]
        if 32<dt<=96:   # пауза между очередями 0,5–1,5 с
          a=math.radians(yw[i-1]); dx=X[i]-X[i-1]; dy=Y[i]-Y[i-1]
          lat=abs(-math.sin(a)*dx+math.cos(a)*dy); fw=(math.cos(a)*dx+math.sin(a)*dy)
          res.append((dt/64,lat,fw))
r=np.array(res); print(len(r)); 
for q in (10,25,50,75,90): print(q, np.percentile(r[:,0],q).round(2), np.percentile(r[:,1],q).round(1), np.percentile(r[:,2],q).round(1))
print('lat<10 share', (r[:,1]<10).mean())
