import pickle,sys,json,numpy as np,pandas as pd
exec(open('metrics.py').read().split("if __name__")[0])
def extra(R,K,P):
    M={}
    R=R.set_index('rid'); P=P[P.alive]
    Pi=P.set_index(['rid','id']).sort_index()
    # после фрага: смещение убийцы за 2 с и приближение к месту жертвы
    mv=[];adv=[]
    for _,k in K.iterrows():
        if k.att is None or pd.isna(k.ax): continue
        try: g=Pi.loc[(k.rid,k.att)]
        except KeyError: continue
        a=g[(g.tick>=k.tick)&(g.tick<=k.tick+16)]; b=g[(g.tick>=k.tick+128)&(g.tick<=k.tick+144)]
        if not len(a) or not len(b): continue
        mv.append(np.hypot(b.x.iloc[0]-a.x.iloc[0],b.y.iloc[0]-a.y.iloc[0]))
        adv.append(np.hypot(a.x.iloc[0]-k.vx,a.y.iloc[0]-k.vy)-np.hypot(b.x.iloc[0]-k.vx,b.y.iloc[0]-k.vy))
    mv=np.array(mv);adv=np.array(adv)
    M['после фрага: сдвиг за 2 с, медиана px']=round(float(np.median(mv)),0)
    M['после фрага: пошёл к трупу (>40px ближе) %']=round(float((adv>40).mean()*100),1)
    M['после фрага: откатился (>40px дальше) %']=round(float((adv<-40).mean()*100),1)
    M['после фрага: остался (±40) %']=round(float((abs(adv)<=40).mean()*100),1)
    # CT у сайта при планте и пост-плант
    near=[];tnear=[];ctalive=[];save=[]
    for rid,r in R[R.plant.notna()].iterrows():
        g=P[(P.rid==rid)&(abs(P.tick-r.plant)<=16)]
        if not len(g): continue
        gt=g.drop_duplicates('id')
        c=(630,518) if r.site=='A' else (1533,845)
        d=np.hypot(gt.x-c[0],gt.y-c[1])
        near.append(((gt.team=='CT')&(d<350)).sum()); tnear.append(((gt.team=='T')&(d<350)).sum()); ctalive.append((gt.team=='CT').sum())
        if r.reason=='bomb':
            e=P[(P.rid==rid)&(P.tick>=r.t1-32)&(P.team=='CT')].id.nunique(); save.append(e)
    M['плант: CT живых']=round(np.mean(ctalive),2)
    M['плант: CT в 350px от сайта']=round(np.mean(near),2)
    M['плант: T в 350px от сайта']=round(np.mean(tnear),2)
    M['бомба взорвалась: CT живых в конце (сейв)']=round(np.mean(save),2) if save else None
    pr=R[R.plant.notna()]
    M['от планта до конца раунда, медиана с']=round(((pr.t1-pr.plant)/64).median(),1)
    # первая смерть после планта
    fd=[]
    for rid,r in pr.iterrows():
        k=K[(K.rid==rid)&(K.tick>r.plant)]
        if len(k): fd.append((k.tick.min()-r.plant)/64)
    M['от планта до первого фрага, медиана с']=round(float(np.median(fd)),1)
    # умер с напарником рядом (до планта)
    Pg=P.copy(); Pg['tb']=Pg.tick
    Pk=Pg.set_index(['rid','tick'])
    mt=[]
    Kp=K.merge(R[['plant']],left_on='rid',right_index=True)
    Kp=Kp[Kp.plant.isna()|(Kp.tick<Kp.plant)]
    for _,k in Kp.iterrows():
        tb=(k.tick//16)*16-16
        try: g=Pk.loc[(k.rid,tb)]
        except KeyError: continue
        g=g[(g.team==k.vicT)&(g.id!=k.vic)]
        if not len(g): continue
        mt.append(float(np.hypot(g.x-k.vx,g.y-k.vy).min())<=350)
    M['смерть до планта: рядом (≤350px) был свой %']=round(float(np.mean(mt))*100,1) if mt else None
    # доля времени раунда, когда команда видит противника? нет данных -> скорость T до 20 с
    return M
if __name__=='__main__':
    if sys.argv[1]=='pro': R,K,P=pickle.load(open('pro.pkl','rb'))
    else: R,K,P=load_bot(sys.argv[2:])
    for k,v in extra(R,K,P).items(): print(f'{k}: {v}')
