import json,sys,numpy as np
sys.path.insert(0,'tools'); import mapdir
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from PIL import Image
M=sys.argv[1]; H=np.array(json.load(open(f'tools/measure/runs/e0a_vis/{M}_hgt.json')))[::6]
nav=mapdir.load_nav(M); W=mapdir.load_walls(M)
f,ax=plt.subplots(figsize=(10,10),dpi=100)
ax.imshow(np.asarray(Image.open(mapdir.radar_png(M)).convert('RGB')),extent=(0,2048,2048,0),alpha=0.5)
for a in nav: P=np.array([[p['x'],p['y']] for p in a['points']]+[[a['points'][0]['x'],a['points'][0]['y']]]); ax.plot(P[:,0],P[:,1],color='green',lw=0.3)
for P in W: P=np.array(P+[P[0]]); ax.fill(P[:,0],P[:,1],color='black',alpha=0.35); ax.plot(P[:,0],P[:,1],color='black',lw=0.8)
ax.scatter(H[:,0],H[:,1],s=0.3,c='red',alpha=0.3)
x0,y0,x1,y1=map(float,sys.argv[2:6]); ax.set_xlim(x0,x1); ax.set_ylim(y1,y0); ax.set_axis_off()
ax.set_title(f'{mapdir.title(M)}: позиции про (красное) поверх стен набора (чёрное) и навмеша (зелёное)',fontsize=9)
f.savefig(sys.argv[6],bbox_inches='tight')
