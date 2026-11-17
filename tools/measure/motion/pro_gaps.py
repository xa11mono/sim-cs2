import sys,os,glob,numpy as np,pandas as pd,collections
sys.path.insert(0,'tools'); import demos
G=collections.defaultdict(list); SAME=collections.Counter(); NX=collections.Counter(); PR=collections.defaultdict(list); T=collections.Counter(); K=collections.Counter()
for f in sorted(glob.glob(os.path.join(demos.DEMOS,'*_motion.csv.gz'))):
  d=pd.read_csv(f,low_memory=False,usecols=['tick','steamid','is_alive','LEFT','RIGHT','velocity_X','velocity_Y','shots_fired'])
  d=d[d.is_alive==True].sort_values(['steamid','tick'])
  for sid,g in d.groupby('steamid'):
    tk=g.tick.values; v=np.hypot(g.velocity_X.fillna(0).values,g.velocity_Y.fillna(0).values); sf=g.shots_fired.fillna(0).values; cont=np.r_[False,np.diff(tk)==1]
    near=np.zeros(len(tk),bool)
    for i in np.where((np.diff(sf,prepend=sf[0])>0)&cont)[0]: near[max(0,i-96):i+97]=True
    ctx=np.where(near,'fight',np.where(v<100,'hold',np.where(v<200,'walk','run')))
    L=g.LEFT.values.astype(bool); R=g.RIGHT.values.astype(bool); side=np.where(L&~R,-1,np.where(R&~L,1,0))
    for i in range(len(tk)): T[ctx[i]]+=1; K[ctx[i]]+= side[i]!=0
    # нажатия: (начало, конец, сторона)
    i=0;n=len(tk);prs=[]
    while i<n:
      if side[i] and cont[i]:
        j=i
        while j<n and side[j]==side[i] and (j==i or cont[j]): j+=1
        prs.append((i,j,side[i])); i=j
      else: i+=1
    for a,b in zip(prs,prs[1:]):
      if not all(cont[a[1]:b[0]+1]): continue
      c=ctx[a[1]]; G[c].append((b[0]-a[1])/64); NX[c]+=1; SAME[c]+= a[2]==b[2]
    for a in prs: PR[ctx[a[1]-1]].append((a[1]-a[0])/64)
for c in ('hold','walk','fight','run'):
  g=np.array(G[c]); print(c,'клавиша зажата %.0f%% времени'%(100*K[c]/T[c]),'| пауза кв 10/25/50/75/90/95:',np.percentile(g,[10,25,50,75,90,95]).round(3).tolist(),'| следующее в ту же сторону %.0f%%'%(100*SAME[c]/NX[c]),'| нажатие:',np.percentile(PR[c],[10,25,50,75,90]).round(3).tolist())
