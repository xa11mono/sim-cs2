import pickle,json,glob,numpy as np,pandas as pd,sys
exec(open('metrics.py').read().split("if __name__")[0])
def bomb_pro(R):
    D='/home/claude/demos/demo_export/'; B={}
    for f in glob.glob(D+'*_bomb_planted.csv.gz'):
        m=f.split('/')[-1].replace('_bomb_planted.csv.gz',''); pl=pd.read_csv(f)
        for _,r in R[R.rid.str.startswith(m+'|')].iterrows():
            p=pl[(pl.tick>r.t0)&(pl.tick<r.t1)]
            if len(p): x,y=tr(p.user_X.iloc[0],p.user_Y.iloc[0]); B[r.rid]=(float(x),float(y))
    return B
def bomb_bot(files):
    B={}
    for f in files:
        d=json.load(open(f)); m=f.split('/')[-1]
        rounds=[r for r in d['rounds'] if 't1' in r]
        for i,r in enumerate(rounds):
            p=[q for q in d['plants'] if r['t0']<=q[0]<=r['t1']]
            if p: B[f'{m}|{i}']=(p[0][2],p[0][3])
    return B
def econ_pro(R,P):
    P=P.merge(R[['rid','t0']],on='rid'); P=P[(P.tick-P.t0)<=20*64]
    cls=P.groupby(['rid','team','id']).w.agg(lambda s:'rifle' if (s.isin(['rifle','awp','scout'])).any() else ('smg' if (s=='smg').any() else 'pistol'))
    return cls.reset_index()
def econ_bot(files):
    rows=[]
    for f in files:
        d=json.load(open(f)); m=f.split('/')[-1]
        rounds=[r for r in d['rounds'] if 't1' in r]
        rn={r['r']:i for i,r in enumerate(rounds)}  # original r numbers may repeat across 2 matches; use order
        # map buys by sequence: buys recorded at each live start, in order
        seq=-1; last=None
        for b in d['buys']:
            if b[0]!=last: seq+=1; last=b[0]
            if seq>=len(rounds): break
            k=(b[3] or '').upper()
            c='rifle' if k in ('AK','M4','M4S','AWP','SSG','GALIL','FAMAS','AUG','SG') else ('smg' if k in ('MAC10','MP9','UMP','MP7','P90') else 'pistol')
            rows.append({'rid':f'{m}|{seq}','team':b[2],'id':b[1],'w':c})
    return pd.DataFrame(rows)
def team_type(E):
    g=E.groupby(['rid','team']).w.agg(lambda s:'фулл' if (s=='rifle').sum()>=4 else ('эко' if (s!='pistol').sum()<=1 else 'форс/хаф'))
    return g.unstack()
def mech(R,K,P,B,E):
    M={}
    R=R.set_index('rid'); Pa=P[P.alive]
    # ---- ретейк / пост-плант
    att=[];tfirst=[];gap=[];ppd=[];onb=[];ctwin=[];eq=[]
    for rid,r in R[R.plant.notna()].iterrows():
        if rid not in B: continue
        bx,by=B[rid]; g=Pa[(Pa.rid==rid)&(Pa.tick>=r.plant)]
        ct=g[g.team=='CT']; t=g[g.team=='T']
        at0=Pa[(Pa.rid==rid)&(abs(Pa.tick-r.plant)<=16)].drop_duplicates('id')
        nct=(at0.team=='CT').sum(); nt=(at0.team=='T').sum()
        if nct==0: continue
        d=np.hypot(ct.x-bx,ct.y-by); arr=ct[d<300].groupby('id').tick.min().sort_values()
        att.append(len(arr)>0)
        if len(arr): tfirst.append((arr.iloc[0]-r.plant)/64)
        if len(arr)>=2: gap.append((arr.iloc[1]-arr.iloc[0])/64)
        dt=np.hypot(t.x-bx,t.y-by); ppd+=list(dt); 
        ctwin.append(r.winner=='CT'); eq.append(nct-nt)
    M['ретейк: CT подошли к бомбе (<300px) % раундов с живыми CT']=round(np.mean(att)*100,1)
    M['ретейк: первый CT у бомбы через, медиана с']=round(float(np.median(tfirst)),1)
    M['ретейк: второй CT после первого через, медиана с']=round(float(np.median(gap)),1)
    M['ретейк: разрыв между 1-м и 2-м CT >3 с, %']=round(float((np.array(gap)>3).mean()*100),1)
    ppd=np.array(ppd)
    M['пост-плант: T от бомбы, медиана px']=round(float(np.median(ppd)),0)
    M['пост-плант: T ближе 150px к бомбе (на бомбе) % времени']=round(float((ppd<150).mean()*100),1)
    M['пост-плант: T дальше 600px от бомбы % времени']=round(float((ppd>600).mean()*100),1)
    ctwin=np.array(ctwin); eq=np.array(eq)
    M['пост-плант: CT выиграли % (все)']=round(ctwin.mean()*100,1)
    for lab,msk in (('CT больше',eq>0),('поровну',eq==0),('CT меньше на 1',eq==-1),('CT меньше на 2+',eq<=-2)):
        if msk.sum()>=5: M[f'пост-плант: CT выиграли % ({lab}, n={msk.sum()})']=round(ctwin[msk].mean()*100,1)
    # ---- сейвы
    lastalive=Pa.sort_values('tick').groupby(['rid','id']).tail(1)
    endalive=lastalive.merge(R[['t1']],left_on='rid',right_index=True); endalive=endalive[endalive.tick>=endalive.t1-32]
    ea=endalive.groupby(['rid','team']).size().unstack(fill_value=0)
    ea=ea.reindex(R.index).fillna(0)
    lostT=R[(R.winner=='CT')&(R.reason.isin(['time','defuse']))]
    M['сейв T: живых T в конце проигранного по времени/дефузу']=round(ea.loc[lostT.index,'T'].mean(),2) if len(lostT) else None
    lostCT=R[(R.winner=='T')&(R.reason=='bomb')]
    M['сейв CT: живых CT после взрыва']=round(ea.loc[lostCT.index,'CT'].mean(),2)
    # CT сейв без попытки: CT жив после взрыва и не подходил к бомбе
    sv=[]
    for rid in lostCT.index:
        if rid not in B: continue
        bx,by=B[rid]; g=Pa[(Pa.rid==rid)&(Pa.team=='CT')&(Pa.tick>=R.loc[rid,'plant'])]
        alive_ids=endalive[(endalive.rid==rid)&(endalive.team=='CT')].id
        for i in alive_ids:
            gi=g[g.id==i]; sv.append(np.hypot(gi.x-bx,gi.y-by).min()>500)
    M['сейв CT: из живых после взрыва — даже не подходили к бомбе %']=round(np.mean(sv)*100,1) if sv else None
    # ---- добивание последнего
    cnt=Pa.groupby(['rid','tick','team']).size().unstack(fill_value=0)
    lt=[];lk=[];ld=[]
    Ks=K.sort_values('tick')
    for rid,g in cnt.groupby(level=0):
        g=g.droplevel(0)
        for side,oth in (('T','CT'),('CT','T')):
            if side not in g or oth not in g: continue
            m=g[(g[side]==1)&(g[oth]>=2)]
            if not len(m): continue
            t0=m.index[0]; t1=R.loc[rid,'t1']
            lt.append((t1-t0)/64)
            k=Ks[(Ks.rid==rid)&(Ks.tick>=t0)]
            lk.append(((k.attT==side)).sum())
            ld.append(((k.vicT==side)).sum()>0)
    M['последний против 2+: сколько живёт, медиана с']=round(float(np.median(lt)),1)
    M['последний против 2+: его убили (а не бомба/время) %']=round(float(np.mean(ld)*100),1)
    M['последний против 2+: успел убить хотя бы одного %']=round(float((np.array(lk)>=1).mean()*100),1)
    # ---- экономика
    tt=team_type(E)
    for side in ('T','CT'):
        vc=tt[side].value_counts(normalize=True)
        M[f'экономика {side}: фулл/форс/эко %']=' / '.join(str(round(vc.get(k,0)*100)) for k in ('фулл','форс/хаф','эко'))
    W=R[['winner']].join(tt,how='inner')
    fv=W[(W['T']=='фулл')&(W['CT']=='фулл')]; M['фулл против фулла: CT выиграли %']=round((fv.winner=='CT').mean()*100,1)
    fe=W[((W['T']=='фулл')&(W['CT']=='эко'))|((W['CT']=='фулл')&(W['T']=='эко'))]
    fe_w=((fe['T']=='эко')&(fe.winner=='T'))|((fe['CT']=='эко')&(fe.winner=='CT'))
    M[f'эко против фулла: эко выиграло % (n={len(fe)})']=round(fe_w.mean()*100,1) if len(fe) else None
    ff=W[((W['T']=='форс/хаф')&(W['CT']=='фулл'))|((W['CT']=='форс/хаф')&(W['T']=='фулл'))]
    ff_w=((ff['T']=='форс/хаф')&(ff.winner=='T'))|((ff['CT']=='форс/хаф')&(ff.winner=='CT'))
    M[f'форс против фулла: форс выиграл % (n={len(ff)})']=round(ff_w.mean()*100,1) if len(ff) else None
    return M
if __name__=='__main__':
    if sys.argv[1]=='pro':
        R,K,P=pickle.load(open('pro.pkl','rb')); B=bomb_pro(R); E=econ_pro(R,P)
    else:
        fs=sys.argv[2:]; R,K,P=load_bot(fs); B=bomb_bot(fs); E=econ_bot(fs)
    for k,v in mech(R,K,P,B,E).items(): print(f'{k}: {v}')
