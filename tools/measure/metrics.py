import pandas as pd, numpy as np, json, glob, sys
from matplotlib.path import Path
Z=json.load(open('/home/claude/sim/zones.json'))['zones']
ZP=[(z['name'] or z['id'],Path(np.array(z['pts']))) for z in Z]
def zone_of(x,y):
    pts=np.c_[x,y]; out=np.array(['—']*len(pts),dtype=object)
    for nm,p in ZP:
        m=p.contains_points(pts); out[m&(out=='—')]=nm
    return out
def wclass(w):
    w=str(w).lower()
    if 'awp' in w: return 'awp'
    if any(k in w for k in ['ssg','scout']): return 'scout'
    if any(k in w for k in ['ak','m4','galil','famas','aug','sg55','sg ','sg"','krieg']) or w in ('sg','m4s','m4a4'): return 'rifle'
    if any(k in w for k in ['mac','mp9','mp7','ump','p90','mp5','bizon']): return 'smg'
    if any(k in w for k in ['usp','glock','p250','tec','five','deagle','desert','elite','beretta','p2000','hkp','cz','revolver']): return 'pistol'
    if any(k in w for k in ['knife','karambit','bayonet','butterfly','stiletto','talon','skeleton','navaja','ursus','nomad','paracord','survival','classic','kukri','gut','flip','falchion','bowie','huntsman','daggers']): return 'knife'
    if any(k in w for k in ['grenade','flash','molotov','incend','inferno','decoy','smoke','he']): return 'nade'
    if 'c4' in w: return 'c4'
    return 'other'
def sid(v):
    try: return str(int(float(v)))
    except: return None
def tr(X,Y): return ((np.asarray(X)+2953)/5*2, (2164-np.asarray(Y))/5*2)
# ---------- загрузка про ----------
def load_pro():
    D='/home/claude/demos/demo_export/'
    R=[];K=[];P=[]
    for f in sorted(glob.glob(D+'*_ticks.csv.gz')):
        n=f.replace('_ticks.csv.gz',''); m=n.split('/')[-1]
        t=pd.read_csv(f,usecols=['tick','steamid','team_num','X','Y','is_alive','active_weapon_name'])
        fe=pd.read_csv(n+'_round_freeze_end.csv.gz'); re=pd.read_csv(n+'_round_end.csv.gz'); de=pd.read_csv(n+'_player_death.csv.gz'); pl=pd.read_csv(n+'_bomb_planted.csv.gz')
        for j,r in fe.reset_index(drop=True).iterrows():
            t0=r.tick; e=re[re.tick>t0].sort_values('tick')
            if not len(e): continue
            e=e.iloc[0]; p=pl[(pl.tick>t0)&(pl.tick<e.tick)]
            site=None
            if len(p): px,py=tr(p.user_X.iloc[0],p.user_Y.iloc[0]); site='A' if (px-630)**2+(py-518)**2<(px-1533)**2+(py-845)**2 else 'B'
            reason={'ct_killed':'elim','t_killed':'elim','bomb_defused':'defuse','bomb_exploded':'bomb','time_ran_out':'time'}.get(e.reason,e.reason)
            R.append({'rid':f'{m}|{j}','t0':t0,'t1':e.tick,'winner':e.winner,'reason':reason,'plant':p.tick.min() if len(p) else None,'site':site})
            d=de[(de.tick>t0)&(de.tick<=e.tick)]
            for _,k in d.iterrows():
                ax,ay=tr(k.attacker_X,k.attacker_Y) if not pd.isna(k.attacker_X) else (np.nan,np.nan); vx,vy=tr(k.user_X,k.user_Y)
                K.append({'rid':f'{m}|{j}','tick':k.tick,'att':sid(k.attacker_steamid),'attT':'T' if k.attacker_team_num==2 else ('CT' if k.attacker_team_num==3 else None),'ax':float(ax),'ay':float(ay),'vic':sid(k.user_steamid),'vicT':'T' if k.user_team_num==2 else 'CT','vx':float(vx),'vy':float(vy),'w':wclass(k.weapon)})
            s=t[(t.tick>=t0)&(t.tick<=e.tick)&(t.tick%16==0)]
            x,y=tr(s.X.values,s.Y.values)
            P.append(pd.DataFrame({'rid':f'{m}|{j}','tick':s.tick.values,'id':[sid(v) for v in s.steamid.values],'team':np.where(s.team_num==3,'CT','T'),'x':x,'y':y,'alive':s.is_alive.values.astype(bool),'w':[wclass(v) for v in s.active_weapon_name.values]}))
    return pd.DataFrame(R),pd.DataFrame(K),pd.concat(P)
# ---------- загрузка ботов ----------
def load_bot(files):
    R=[];K=[];P=[]
    for f in files:
        d=json.load(open(f)); m=f.split('/')[-1]
        rounds=[r for r in d['rounds'] if 't1' in r]
        for i,r in enumerate(rounds): r['r']=i
        for r in rounds:
            R.append({'rid':f"{m}|{r['r']}",'t0':r['t0'],'t1':r['t1'],'winner':r['winner'],'reason':r['reason'],'plant':r.get('plant'),'site':r.get('site'),'ctType':r.get('ctType'),'tType':r.get('tType')})
        rr=pd.DataFrame(R)
        def rid_for(tk):
            for r in rounds:
                if r['t0']<=tk<=r['t1']: return f"{m}|{r['r']}"
            return None
        for k in d['kills']:
            rid=rid_for(k[0])
            if rid: K.append({'rid':rid,'tick':k[0],'att':k[1],'attT':k[2],'ax':k[3] if k[3] is not None else np.nan,'ay':k[4] if k[4] is not None else np.nan,'vic':k[5],'vicT':k[6],'vx':k[7],'vy':k[8],'w':wclass(k[11] or k[9])})
        p=pd.DataFrame([r[:8] for r in d['pos']],columns=['tick','id','ct','x','y','alive','f','w'])
        ivs=[(r['t0'],r['t1'],f"{m}|{r['r']}") for r in rounds]
        rid=np.array([None]*len(p),dtype=object); tk=p.tick.values
        for a,b,rd in ivs: rid[(tk>=a)&(tk<=b)]=rd
        p['rid']=rid; p=p[p.rid.notna()]
        P.append(pd.DataFrame({'rid':p.rid,'tick':p.tick,'id':p.id,'team':np.where(p.ct==1,'CT','T'),'x':p.x.astype(float),'y':p.y.astype(float),'alive':p.alive.astype(bool),'w':[wclass(v) for v in p.w]}))
    return pd.DataFrame(R),pd.DataFrame(K),pd.concat(P)
# ---------- метрики ----------
def metrics(R,K,P,name):
    M={}
    R=R.copy(); R['dur']=(R.t1-R.t0)/64
    M['раундов']=len(R)
    M['длительность раунда, медиана с']=round(R.dur.median(),1)
    M['CT выиграли раундов %']=round((R.winner=='CT').mean()*100,1)
    M['плант в % раундов']=round(R.plant.notna().mean()*100,1)
    pr=R[R.plant.notna()]
    M['время планта, медиана с']=round(((pr.plant-pr.t0)/64).median(),1)
    M['доля плантов на B %']=round((pr.site=='B').mean()*100,1)
    for rs in ['elim','bomb','defuse','time']: M[f'конец раунда: {rs} %']=round((R.reason==rs).mean()*100,1)
    M['T выиграли после планта %']=round((pr.winner=='T').mean()*100,1)
    K=K.merge(R[['rid','t0']],on='rid'); K['sec']=(K.tick-K.t0)/64
    M['смертей за раунд']=round(len(K)/len(R),2)
    fk=K.sort_values('tick').groupby('rid').first()
    M['первый фраг, медиана с']=round(fk.sec.median(),1)
    M['первый фраг до 15 с, % раундов']=round((fk.sec<15).mean()*100,1)
    M['первый фраг за T %']=round((fk.attT=='T').mean()*100,1)
    fw=fk.merge(R.set_index('rid')[['winner']],left_index=True,right_index=True)
    M['кто сделал первый фраг — выиграл раунд %']=round((fw.attT==fw.winner).mean()*100,1)
    # размены: убийца убит в течение 3 с после своего фрага
    Ks=K.sort_values('tick'); traded=0; tot=0
    for rid,g in Ks.groupby('rid'):
        g=g.reset_index(drop=True)
        for i,k in g.iterrows():
            if k.att is None or pd.isna(k.ax): continue
            tot+=1
            nxt=g[(g.tick>k.tick)&(g.tick<=k.tick+3*64)&(g.vic==k.att)]
            if len(nxt): traded+=1
    M['разменяли за 3 с %']=round(traded/max(1,tot)*100,1)
    dist=np.hypot(K.ax-K.vx,K.ay-K.vy); dist=dist[~np.isnan(dist)]
    M['дистанция фрага, медиана px']=round(float(np.median(dist)),0)
    M['дистанция фрага <200px %']=round(float((dist<200).mean()*100),1)
    M['дистанция фрага >600px %']=round(float((dist>600).mean()*100),1)
    for w in ['rifle','awp','pistol','smg','scout']: M[f'фраги с {w} %']=round((K.w==w).mean()*100,1)
    mk=K.groupby(['rid','att']).size(); M['раундов с 3+ фрагами у одного %']=round((mk>=3).groupby(level=0).any().reindex(R.rid).fillna(False).mean()*100,1)
    # клатчи 1vX (X>=2): по позициям
    Pa=P[P.alive]; cnt=Pa.groupby(['rid','tick','team']).size().unstack(fill_value=0)
    cl=[]
    for rid,g in cnt.groupby(level=0):
        g=g.droplevel(0)
        for side,oth in (('T','CT'),('CT','T')):
            if side not in g or oth not in g: continue
            m=(g[side]==1)&(g[oth]>=2)
            if m.any():
                w=R.set_index('rid').loc[rid,'winner']; cl.append(w==side)
    M['клатчей 1vX за раунд']=round(len(cl)/len(R),2); M['клатч выигран %']=round(np.mean(cl)*100,1) if cl else None
    # движение
    P2=P[P.alive].sort_values(['rid','id','tick'])
    dx=P2.groupby(['rid','id']).x.diff(); dy=P2.groupby(['rid','id']).y.diff(); dt=P2.groupby(['rid','id']).tick.diff()
    sp=(np.hypot(dx,dy)/(dt/64)).where(dt==16)
    sp=sp.dropna()
    M['стоят (<15 px/с) % времени']=round((sp<15).mean()*100,1)
    M['идут шагом (15–65 px/с) %']=round(((sp>=15)&(sp<65)).mean()*100,1)
    M['бегут (>=65 px/с) %']=round((sp>=65).mean()*100,1)
    M['скорость на ходу, медиана px/с']=round(float(sp[sp>=15].median()),1)
    M['с ножом в руках % времени']=round((P2.w=='knife').mean()*100,1)
    # разброс команды
    P3=P2[(P2.tick%64==0)]
    nn=[]
    for (rid,tk,tm),g in P3.groupby(['rid','tick','team']):
        if len(g)<3: continue
        XY=g[['x','y']].values; D=np.hypot(XY[:,None,0]-XY[None,:,0],XY[:,None,1]-XY[None,:,1]); np.fill_diagonal(D,1e9); nn.append((tm,float(np.median(D.min(1)))))
    nn=pd.DataFrame(nn,columns=['tm','d'])
    for tm in ('T','CT'): M[f'{tm}: до ближайшего тиммейта, медиана px']=round(nn[nn.tm==tm].d.median(),0)
    for side in ('T','CT'):
        for sec in (20,45):
            M[f'{side}: смертей до {sec} с (до планта)']=round(len(K[(K.vicT==side)&(K.sec<sec)])/len(R),2)
    fk2=fk.copy(); fk2['zv']=zone_of(fk2.vx.values,fk2.vy.values)
    M['где первый фраг (зона жертвы)']='; '.join(f"{k} {v*100:.0f}%" for k,v in fk2.zv.value_counts(normalize=True).head(6).items())
    for side in ('T','CT'):
        M[f'{side}: фраги с AWP % от фрагов стороны']=round(((K.attT==side)&(K.w=='awp')).sum()/max(1,(K.attT==side).sum())*100,1)
    P4=P2[((P2.tick-P2.rid.map(R.set_index('rid').t0))/64).between(29.9,30.1)]
    P4=P4.copy(); P4['z']=zone_of(P4.x.values,P4.y.values)
    for side in ('T','CT'):
        g=P4[P4.team==side].groupby('rid').z.nunique(); M[f'{side}: сколько разных зон занимают на 30 с']=round(g.mean(),2)
    # где умирают
    K['zv']=zone_of(K.vx.values,K.vy.values)
    for side in ('T','CT'):
        z=K[K.vicT==side].zv.value_counts(normalize=True).head(6)
        M[f'{side} умирают чаще всего']='; '.join(f"{k} {v*100:.0f}%" for k,v in z.items())
    return M
if __name__=='__main__':
    which=sys.argv[1]
    import pickle,os
    if which=='pro': R,K,P=pickle.load(open('pro.pkl','rb')) if os.path.exists('pro.pkl') else load_pro()
    else: R,K,P=load_bot(sys.argv[2:])
    M=metrics(R,K,P,which); json.dump(M,open(f'/home/claude/heat/cmp/{which}.json','w'),ensure_ascii=False,indent=1)
    for k,v in M.items(): print(f'{k}: {v}')
