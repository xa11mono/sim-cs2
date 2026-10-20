import json,sys,numpy as np
sys.path.insert(0,'tools'); import mapdir
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from PIL import Image
M=sys.argv[1]; cause=sys.argv[2]; out=sys.argv[3]; VD='tools/measure/runs/e0a_vis'
K=json.load(open(f'{VD}/{M}_kills.json')); E=json.load(open(f'{VD}/{M}_engine.json'))['kills']
G=json.load(open(f'{VD}/{M}_grid.json'))
B=[(k,e) for k,e in zip(K,E) if k[12]==0 and e[0]==0 and e[3]==cause and not e[8]]
rng=np.random.default_rng(5); idx=rng.choice(len(B),9,replace=False)
R=np.asarray(Image.open(mapdir.radar_png(M)).convert('RGB')); nav=mapdir.load_nav(M)
CO=mapdir.callouts(M); place=lambda x,y: min(CO,key=lambda c:(c[1]-x)**2+(c[2]-y)**2)[0]
H=np.array(json.load(open(f'{VD}/{M}_hgt.json')))[::4]
f,axs=plt.subplots(3,3,figsize=(13,13),dpi=90)
for ax,i in zip(axs.flat,idx):
  k,e=B[i]; cx,cy=(k[3]+k[6])/2,(k[4]+k[7])/2; r=max(60,np.hypot(k[6]-k[3],k[7]-k[4])/2+40)
  ax.imshow(R,extent=(0,2048,2048,0),alpha=0.6)
  sel=(abs(H[:,0]-cx)<r)&(abs(H[:,1]-cy)<r); ax.scatter(H[sel,0],H[sel,1],s=0.5,c='green',alpha=0.4)
  for s in G['segs']:
    if min(s[0],s[2])<cx+r and max(s[0],s[2])>cx-r and min(s[1],s[3])<cy+r and max(s[1],s[3])>cy-r: ax.plot([s[0],s[2]],[s[1],s[3]],color='black',lw=1.5)
  ax.plot([k[3],k[6]],[k[4],k[7]],color='red',lw=1.2); ax.scatter([k[3]],[k[4]],c='red',s=30,marker='^'); ax.scatter([k[6]],[k[7]],c='blue',s=30,marker='x')
  ax.scatter([e[4]],[e[5]],c='orange',s=40)
  ax.set_xlim(cx-r,cx+r); ax.set_ylim(cy+r,cy-r); ax.set_xticks([]); ax.set_yticks([])
  ax.set_title(f'{place(k[3],k[4])}→{place(k[6],k[7])}, {k[9]}, z {k[5]:.0f}→{k[8]:.0f}',fontsize=8)
f.suptitle(f'{mapdir.title(M)}: убийства про, которые движок «не видит» (причина: {cause}). ▲ убийца, ✕ жертва, оранж. — точка реза, зелёное — где про ходят',fontsize=10)
f.savefig(out,bbox_inches='tight')
