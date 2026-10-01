import pandas as pd, numpy as np, json, glob, sys
W=np.array(json.load(open('walls.json'))['segs'],dtype=float)
ax,ay,bx,by=W.T
def los(p,q):
    # p,q: (N,2) arrays -> bool visible
    px,py=p[:,0:1],p[:,1:2]; qx,qy=q[:,0:1],q[:,1:2]
    d1x,d1y=qx-px,qy-py; d2x,d2y=bx-ax,by-ay
    den=d1x*d2y-d1y*d2x
    with np.errstate(divide='ignore',invalid='ignore'):
        t=((ax-px)*d2y-(ay-py)*d2x)/den; u=((ax-px)*d1y-(ay-py)*d1x)/den
    hit=(np.abs(den)>1e-9)&(t>0)&(t<1)&(u>=0)&(u<=1)
    return ~hit.any(axis=1)
PH=['early','setup','late','post']
def onsets(df):
    # df: round, tick, pid, ct, x, y, ang (radians, radar coords), ph, still
    out=[]
    for (r),g in df.groupby('round'):
        ticks=sorted(g.tick.unique()); prev_vis={}
        byt={t:gg for t,gg in g.groupby('tick')}
        for i,t in enumerate(ticks):
            gg=byt[t]; A=gg[gg.ct==1]; B=gg[gg.ct==0]
            if not len(A) or not len(B): prev_vis={}; continue
            ia=np.repeat(np.arange(len(A)),len(B)); ib=np.tile(np.arange(len(B)),len(A))
            P=A[['x','y']].values[ia]; Q=B[['x','y']].values[ib]
            d=np.hypot(*(Q-P).T); near=d<=900
            vis=np.zeros(len(P),bool)
            if near.any(): vis[near]=los(P[near],Q[near])
            cur={}
            for k in np.nonzero(vis)[0]:
                a=A.iloc[ia[k]]; b=B.iloc[ib[k]]
                cur[(a.pid,b.pid)]=1
                cont = i>0 and ticks[i-1]==t-16
                if cont and (a.pid,b.pid) not in prev_vis:
                    # onset for both viewers
                    for v,e in ((a,b),(b,a)):
                        ang=np.arctan2(e.y-v.y,e.x-v.x); off=abs((ang-v.ang+np.pi)%(2*np.pi)-np.pi)
                        out.append({'side':'CT' if v.ct==1 else 'T','ph':PH[int(v.ph)],'off':off,'still':bool(v.still),'dist':float(d[k])})
            prev_vis=cur
    return pd.DataFrame(out)
def summarize(o,name):
    r={'n':len(o),'<20°':round((o.off<0.35).mean(),3),'<45°':round((o.off<0.785).mean(),3),
       'стоя <20°':round((o[o.still].off<0.35).mean(),3),'n стоя':int(o.still.sum())}
    for s in ('CT','T'):
        for ph in PH:
            q=o[(o.side==s)&(o.ph==ph)]
            if len(q)>=30: r[f'{s} {ph} <20°']=round((q.off<0.35).mean(),3)
    return pd.Series(r,name=name)
