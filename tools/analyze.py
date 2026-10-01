import pandas as pd, numpy as np, json, math
from matplotlib.path import Path
PH=['early','setup','late','post']
Z=json.load(open('/home/claude/sim/zones.json'))['zones']
paths=[(z['name'] or z['id'], Path(np.array(z['pts']))) for z in Z]
def zone_of(x,y):
    pts=np.c_[x,y]; out=np.array(['—']*len(pts),dtype=object)
    for nm,p in paths:
        m=p.contains_points(pts); out[m & (out=='—')]=nm
    return out
pro=pd.read_csv('pro_samples.csv.gz')
bots=[]
for m in (3,7):
    r=pd.DataFrame(json.load(open(f'bot_{m}.json'))['rows'],columns=['x','y','dx','dy','ct','ph','spd'])
    bots.append(r)
b=pd.concat(bots)
bot=pd.DataFrame({'x':b.x,'y':b.y,'dx':b.dx,'dy':b.dy,'side':np.where(b.ct==1,'CT','T'),'phase':[PH[i] for i in b.ph],'still':b.spd<25})
pro['still']=pro.still.astype(bool)
for d in (pro,bot): d['zone']=zone_of(d.x.values,d.y.values)
print('still share pro',pro.still.mean().round(2),'bot',bot.still.mean().round(2))
C=16; N=2048//C
layers={}
arrows={}
for src,d in (('pro',pro),('bot',bot)):
    for side in ('CT','T'):
        for ph in PH:
            for mode in ('all','still'):
                s=d[(d.side==side)&(d.phase==ph)]
                if mode=='still': s=s[s.still]
                tot=len(d[(d.side==side)&(d.phase==ph)])
                if tot==0: continue
                ix=(s.x//C).clip(0,N-1).astype(int); iy=(s.y//C).clip(0,N-1).astype(int)
                g=np.zeros((N,N)); np.add.at(g,(iy,ix),1); g/=tot
                nz=np.nonzero(g); vals=(g[nz]*1e5).round().astype(int)
                k=f'{src}|{side}|{ph}|{mode}'
                layers[k]=[[int(a*N+c),int(v)] for a,c,v in zip(nz[0],nz[1],vals) if v>0]
                # стрелки взгляда на сетке 48px
                A=48; M=2048//A
                ax=(s.x//A).clip(0,M-1).astype(int); ay=(s.y//A).clip(0,M-1).astype(int)
                cnt=np.zeros((M,M)); sx=np.zeros((M,M)); sy=np.zeros((M,M))
                np.add.at(cnt,(ay,ax),1); np.add.at(sx,(ay,ax),s.dx.values); np.add.at(sy,(ay,ax),s.dy.values)
                thr=max(8, 0.0015*tot)
                arr=[]
                for i,j in zip(*np.nonzero(cnt>=thr)):
                    R=math.hypot(sx[i,j],sy[i,j])/cnt[i,j]
                    if R<0.35: continue
                    arr.append([int(j*A+A/2),int(i*A+A/2),round(sx[i,j]/cnt[i,j]/R,2),round(sy[i,j]/cnt[i,j]/R,2),round(R,2)])
                arrows[k]=arr
# доли времени по зонам
zt={}
for src,d in (('pro',pro),('bot',bot)):
    for (side,ph),g in d.groupby(['side','phase']):
        zt.setdefault((side,ph),{})[src]=(g.zone.value_counts()/len(g))
gaps=[]
for (side,ph),v in zt.items():
    df=pd.DataFrame(v).fillna(0)
    df=df.drop(index='—',errors='ignore')
    df['gap']=df['bot']-df['pro']
    for zn,r in df.iterrows():
        if max(r.pro,r.bot)>=0.03 and abs(r.gap)>=0.03:
            gaps.append({'side':side,'phase':ph,'zone':zn,'pro':round(float(r.pro),3),'bot':round(float(r.bot),3),'gap':round(float(r.gap),3)})
gaps.sort(key=lambda g:-abs(g['gap']))
zshare={}
for (side,ph),v in zt.items():
    df=pd.DataFrame(v).fillna(0).drop(index='—',errors='ignore')
    zshare[f'{side}|{ph}']={zn:[round(float(r.pro),3),round(float(r.bot),3)] for zn,r in df.iterrows()}
print(len(gaps)); [print(g) for g in gaps[:25]]
# про-позиции для симулятора: где стоят (still), локальные максимумы
spots={}
for side in ('CT','T'):
    for ph in PH:
        s=pro[(pro.side==side)&(pro.phase==ph)&pro.still]
        tot=len(pro[(pro.side==side)&(pro.phase==ph)])
        C2=24; M2=2048//C2
        ix=(s.x//C2).clip(0,M2-1).astype(int); iy=(s.y//C2).clip(0,M2-1).astype(int)
        g=np.zeros((M2,M2)); np.add.at(g,(iy,ix),1)
        from scipy.ndimage import maximum_filter, uniform_filter
        gs=uniform_filter(g,3)*9
        pk=(gs==maximum_filter(gs,5))&(gs>=max(20,0.004*tot))
        L=[]
        for i,j in zip(*np.nonzero(pk)):
            cx,cy=j*C2+C2/2,i*C2+C2/2
            near=s[(abs(s.x-cx)<C2*1.5)&(abs(s.y-cy)<C2*1.5)]
            vx,vy=near.dx.mean(),near.dy.mean(); R=math.hypot(vx,vy)
            L.append({'x':round(float(near.x.mean()),1),'y':round(float(near.y.mean()),1),'share':round(float(gs[i,j]/tot),4),
                      'look':[round(vx/R,2),round(vy/R,2)] if R>0 else None,'lookFocus':round(R,2),'zone':str(zone_of(np.array([near.x.mean()]),np.array([near.y.mean()]))[0])})
        L.sort(key=lambda q:-q['share'])
        spots[f'{side}|{ph}']=L[:20]
json.dump({'zshare':zshare,'cell':C,'layers':layers,'arrows':arrows,'gaps':gaps,'spots':spots,
           'meta':{'proSamples':len(pro),'botSamples':len(bot),'proMatches':12,'botMatches':2}},open('heat.json','w'))
json.dump({'map':'ancient','coords':'пиксели радара симулятора (2048)','phases':{'early':'0–20 с','setup':'20–50 с','late':'50 с и позже, до планта','post':'после планта'},
           'source':'12 про-матчей на Ancient (Astralis, B8, Falcons, FUT, G2, GamerLegion, Liquid, Luminosity, MongolZ, MOUZ, NaVi, PARIVISION, Spirit, BetBoom)','spots':spots},open('pro_positions.json','w'),ensure_ascii=False,indent=1)
import os; print('heat.json', os.path.getsize('heat.json')//1024,'KB')
