#!/usr/bin/env python3
# (05.11) сколько своих / чужих в 1000 ед. у погибшего до планта: про (30 демок Mirage, _ticks) против прогона n29_mir. Путь прогона — в коде.
import csv,gzip,glob,json,collections,math,statistics as st
R=1000
def summ(L): 
    return 'n %d | один (своих рядом нет) %.0f %% | своих в среднем %.2f | чужих %.2f | чужих больше, чем своих %.0f %%'%(len(L),100*sum(m==1 for m,f in L)/len(L),st.mean(m for m,f in L),st.mean(f for m,f in L),100*sum(f>m for m,f in L)/len(L))
A=collections.defaultdict(list)
for f in sorted(glob.glob('data/maps/mirage/demos/*_ticks.csv.gz'))[:30]:
    b=f[:-len('_ticks.csv.gz')]
    try:
        fe=sorted(int(r['tick']) for r in csv.DictReader(gzip.open(b+'_round_freeze_end.csv.gz','rt')))
        P=sorted(int(r['tick']) for r in csv.DictReader(gzip.open(b+'_bomb_planted.csv.gz','rt')))
        D=list(csv.DictReader(gzip.open(b+'_player_death.csv.gz','rt')))
    except Exception: continue
    pos=collections.defaultdict(list)
    for r in csv.DictReader(gzip.open(f,'rt')):
        if r['is_alive']=='True' and r['is_warmup_period']=='False': pos[int(r['tick'])].append((r['team_num'][:1],float(r['X']),float(r['Y'])))
    for d in D:
        t=int(d['tick']); s=max([x for x in fe if x<t],default=None)
        if s is None or any(s<p<=t for p in P) or fe.index(s) in (0,12): continue
        tk=t-(t%16); L=pos.get(tk) or pos.get(tk-16)
        if not L: continue
        vx,vy=float(d['user_X']),float(d['user_Y']); vt=d['user_team_num'][:1]
        A['про '+('T' if vt=='2' else 'CT')].append((sum(1 for tm,x,y in L if tm==vt and math.hypot(x-vx,y-vy)<R), sum(1 for tm,x,y in L if tm!=vt and math.hypot(x-vx,y-vy)<R)))
pu=2.5
for f in glob.glob('tools/measure/runs/n29_mir/rec_*.json'):
    d=json.load(open(f)); pls=[p[0] for p in d['plants']]
    pos=collections.defaultdict(list)
    for q in d['pos']:
        if q[5]: pos[q[0]].append(('CT' if q[2] else 'T', q[3]*pu, q[4]*pu))
    for r in d['rounds']:
        if r['tType']=='pistol': continue
        t0=r['t0']; t1=r.get('t1',t0+64*200); p=next((x for x in pls if t0<=x<=t1),None) or t1
        for k in d['kills']:
            if not (t0<=k[0]<=p): continue
            tk=k[0]-(k[0]%16); L=pos.get(tk) or pos.get(tk-16)
            if not L: continue
            vx,vy=k[7]*pu,k[8]*pu; vt=k[6]
            A['мы '+vt].append((sum(1 for tm,x,y in L if tm==vt and math.hypot(x-vx,y-vy)<R), sum(1 for tm,x,y in L if tm!=vt and math.hypot(x-vx,y-vy)<R)))
for k in sorted(A): print(k, summ(A[k]))
