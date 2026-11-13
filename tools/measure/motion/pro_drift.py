import sys,os,glob,numpy as np,pandas as pd
sys.path.insert(0,'tools'); import demos
O=[];MX=[]
for f in sorted(glob.glob(os.path.join(demos.DEMOS,'*_motion.csv.gz'))):
  d=pd.read_csv(f,low_memory=False,usecols=['tick','steamid','is_alive','velocity_X','velocity_Y','X','Y'])
  d=d[d.is_alive==True].sort_values(['steamid','tick'])
  for sid,g in d.groupby('steamid'):
    tk=g.tick.values; v=np.hypot(g.velocity_X.fillna(0).values,g.velocity_Y.fillna(0).values); X=g.X.values;Y=g.Y.values
    slow=(v<100)&np.r_[False,np.diff(tk)==1]; n=len(tk); i=0
    while i<n:
      if slow[i]:
        j=i
        while j<n and slow[j]: j+=1
        if j-i>=128:
          x0=np.median(X[i:j]);y0=np.median(Y[i:j]); r=np.hypot(X[i:j]-x0,Y[i:j]-y0); O.extend(r[::8].tolist()); MX.append(r.max())
        i=j
      else: i+=1
print('стоя ≥2 с: отход от середины места, ед., квантили 50/75/90/95:',np.percentile(O,[50,75,90,95]).round(1).tolist(),'| наибольший за отрезок 50/75/90:',np.percentile(MX,[50,75,90]).round(1).tolist(),'отрезков',len(MX))
