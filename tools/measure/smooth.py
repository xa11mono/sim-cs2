import pickle,json,glob,numpy as np,pandas as pd,sys
exec(open('metrics.py').read().split("if __name__")[0])
def pro_yaw():
    R=pickle.load(open('pro.pkl','rb'))[0]
    out=[]
    D='/home/claude/demos/demo_export/'
    for f in sorted(glob.glob(D+'*_ticks.csv.gz')):
        m=f.split('/')[-1].replace('_ticks.csv.gz','')
        t=pd.read_csv(f,usecols=['tick','steamid','X','Y','yaw','is_alive'])
        rr=R[R.rid.str.startswith(m+'|')]
        for _,r in rr.iterrows():
            s=t[(t.tick>=r.t0)&(t.tick<=r.t1)&(t.is_alive==True)]
            x,y=tr(s.X.values,s.Y.values)
            out.append(pd.DataFrame({'rid':r.rid,'id':[sid(v) for v in s.steamid.values],'tick':s.tick.values,'x':x,'y':y,'ang':np.radians(-s.yaw.values)}))
    return pd.concat(out)
def bot_yaw(files):
    out=[]
    for f in files:
        d=json.load(open(f)); m=f.split('/')[-1]
        rounds=[r for r in d['rounds'] if 't1' in r]
        p=pd.DataFrame([r[:8] for r in d['pos']],columns=['tick','id','ct','x','y','alive','f','w'])
        p=p[p.alive==1]
        for i,r in enumerate(rounds):
            s=p[(p.tick>=r['t0'])&(p.tick<=r['t1'])]
            out.append(pd.DataFrame({'rid':f'{m}|{i}','id':s.id.values,'tick':s.tick.values,'x':s.x.values.astype(float),'y':s.y.values.astype(float),'ang':s.f.values.astype(float)}))
    return pd.concat(out)
def smooth(Y):
    M={}
    Y=Y.sort_values(['rid','id','tick'])
    g=Y.groupby(['rid','id'])
    dt=g.tick.diff(); vx=g.x.diff(); vy=g.y.diff()
    ok=dt==16
    sp=np.hypot(vx,vy)/(16/64)
    Y=Y.assign(vx=vx,vy=vy,sp=sp,ok=ok)
    g=Y.groupby(['rid','id'])
    pvx=g.vx.shift(1); pvy=g.vy.shift(1); pok=g.ok.shift(1)
    both=ok&(pok==True)&(Y.sp>40)&(np.hypot(pvx,pvy)/(0.25)>40)
    cosang=(Y.vx*pvx+Y.vy*pvy)/(np.hypot(Y.vx,Y.vy)*np.hypot(pvx,pvy)+1e-9)
    rev=both&(cosang<-0.5)
    movmin=(both.sum()*0.25)/60
    M['разворотов движения >120° за 0,25 с (на минуту бега)']=round(rev.sum()/max(movmin,1e-9),2)
    # дрожание на месте: стоит (скорость<15) но смещается туда-обратно >6px
    small=ok&(Y.sp<60)&(np.hypot(Y.vx,Y.vy)>6)&(pok==True)&(np.hypot(pvx,pvy)>6)
    jit=small&(cosang<-0.5)
    stmin=((ok&(Y.sp<60)).sum()*0.25)/60
    M['дёрганий туда-обратно на месте (на минуту)']=round(jit.sum()/max(stmin,1e-9),2)
    # взгляд
    da=g.ang.diff(); da=(da+np.pi)%(2*np.pi)-np.pi
    Y=Y.assign(da=da); g=Y.groupby(['rid','id'])
    pda=g.da.shift(1)
    tot=(ok.sum()*0.25)/60
    M['поворотов взгляда >90° за 0,25 с (на минуту)']=round(((abs(da)>np.pi/2)&ok).sum()/tot,2)
    fl=ok&(pok==True)&(abs(da)>np.radians(45))&(abs(pda)>np.radians(45))&(np.sign(da)!=np.sign(pda))
    M['взгляд туда-обратно >45° (на минуту)']=round(fl.sum()/tot,2)
    st=ok&(Y.sp<15)
    M['стоя: средний поворот взгляда за 0,25 с, °']=round(float(np.degrees(abs(da[st])).mean()),1)
    M['стоя: доля 0,25 с без поворота (<5°) %']=round(float((abs(da[st])<np.radians(5)).mean()*100),1)
    mv=ok&(Y.sp>=65)
    ang_mv=np.arctan2(Y.vy,Y.vx); off=(Y.ang-ang_mv+np.pi)%(2*np.pi)-np.pi
    M['на бегу: взгляд вдоль движения (±30°) %']=round(float((abs(off[mv])<np.radians(30)).mean()*100),1)
    return M
if __name__=='__main__':
    if sys.argv[1]=='pro': Y=pro_yaw()
    else: Y=bot_yaw(sys.argv[2:])
    for k,v in smooth(Y).items(): print(f'{k}: {v}')
