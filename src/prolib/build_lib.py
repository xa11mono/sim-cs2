import sys,os,json,pickle,numpy as np,pandas as pd
sys.path.insert(0,'/home/claude/heat/cmp'); os.chdir('/home/claude/heat/cmp')
from smooth import pro_yaw
R,K,P=pickle.load(open('pro.pkl','rb'))
Y=pro_yaw(); Y['id']=Y.id.astype(str)
P2=P[['rid','tick','id','team']].copy(); P2['id']=P2.id.astype(str)
S=Y.merge(P2,on=['rid','tick','id']).merge(R[['rid','t0','plant']],on='rid')
S=S.sort_values(['rid','id','tick'])
g=S.groupby(['rid','id'])
S['sp']=np.hypot(g.x.diff(),g.y.diff())/(g.tick.diff()/64)
S['sp2']=g.sp.shift(-1)
S['t_in']=(S.tick-S.t0)/64
S['post']=S.plant.notna()&(S.tick>=S.plant)
S=S[(S.t_in>6)&(S.sp<20)&(S.sp2<20)]
# exclude moments within 1.5 s around own kill/death (fights)
K['att']=K.att.astype(str); K['vic']=K.vic.astype(str)
ev=pd.concat([K[['rid','tick','att']].rename(columns={'att':'id'}),K[['rid','tick','vic']].rename(columns={'vic':'id'})])
S=S.merge(ev.rename(columns={'tick':'kt'}),on=['rid','id'],how='left')
S['near']=(S.kt-S.tick).abs()<96
fight=S.groupby(['rid','id','tick']).near.any().reset_index()
S=S.drop_duplicates(['rid','id','tick']).drop(columns=['kt','near']).merge(fight,on=['rid','id','tick'])
S=S[~S.near]
print('samples',len(S))
out={}
for layer,sel in [('CT|pre',(S.team=='CT')&~S.post),('T|pre',(S.team=='T')&~S.post),('T|post',(S.team=='T')&S.post),('CT|post',(S.team=='CT')&S.post)]:
    D=S[sel]; X=D.x.values; Yv=D.y.values; A=D.ang.values; RID=D.rid.values
    used=np.zeros(len(D),bool); spots=[]
    # density on 8px grid
    gx=np.round(X/8).astype(int); gy=np.round(Yv/8).astype(int)
    from collections import Counter
    cnt=Counter(zip(gx,gy))
    order=sorted(cnt.items(),key=lambda kv:-kv[1])
    taken=[]
    for (cx,cy),c in order:
        px,py=cx*8,cy*8
        if any((px-t[0])**2+(py-t[1])**2<30**2 for t in taken): continue
        m=(~used)&((X-px)**2+(Yv-py)**2<22**2)
        if m.sum()<12: continue
        nr=len(set(RID[m]))
        if nr<5: continue
        used|=m; taken.append((px,py))
        mc=(~np.zeros(len(D),bool))&((X-px)**2+(Yv-py)**2<9**2); mx,my=X[mc].mean(),Yv[mc].mean()
        # yaw modes: 24 bins, smoothed
        h,_=np.histogram((A[m]%(2*np.pi)),bins=24,range=(0,2*np.pi)); hs=h+0.5*np.roll(h,1)+0.5*np.roll(h,-1)
        modes=[]
        for _ in range(2):
            i=int(np.argmax(hs)); 
            if hs[i]<=0: break
            # circular mean of samples in the bin ±1
            c0=(i+0.5)*np.pi/12; sel2=np.abs((A[m]-c0+np.pi)%(2*np.pi)-np.pi)<0.4
            ang=float(np.arctan2(np.sin(A[m][sel2]).mean(),np.cos(A[m][sel2]).mean()))
            share=float(sel2.mean())
            if modes and (share<0.15 or abs((ang-modes[0][0]+np.pi)%(2*np.pi)-np.pi)<0.8): break
            modes.append([round(ang,3),round(share,2)])
            for k in range(-3,4): hs[(i+k)%24]=0
        spots.append({'x':round(mx,1),'y':round(my,1),'n':int(m.sum()),'r':nr,'look':modes})
    out[layer]=spots
    print(layer,len(D),'spots',len(spots),'covered %.0f%%'%(100*used.mean()))
json.dump(out,open('/home/claude/sim/prolib/pro_spots.json','w'))
