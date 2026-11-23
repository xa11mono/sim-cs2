import json, math, bisect, collections, sys
M=[3,7,11,13,17,19,23,29]
def run(l):
    S=collections.Counter()
    for m in M:
        d=json.load(open('/home/user/sim-cs2/tools/measure/runs/%s/rec_%d.json'%(l,m)))
        pos={}; PT=collections.defaultdict(list)
        for p in d['pos']: pos[(p[0],p[1])]=p; PT[p[0]].append(p)
        # 007 ложная уверенность о носителе
        for t,cid,H in d['carh']:
            p=pos.get((t - t%16,cid))
            if not p or not H or not p[5]: continue
            S['carh_n']+=1; top=H[0]
            if top[0] is None: continue
            if top[2]>=0.7: S['carh_conf']+=1; S['carh_conf_wrong']+= math.hypot(top[0]-p[3],top[1]-p[4])>400
        # 015/016 колл CT в выходе
        CC=d['ctcall']; T=[c[0] for c in CC]
        for r in d['rounds']:
            ex=r.get('exec'); site=r.get('site') or r.get('tsite')
            if 't1' not in r: continue
            if not ex or not site: continue
            end=r.get('plant') or r['t1']; i=bisect.bisect_left(T,ex); first=None
            while i<len(CC) and CC[i][0]<=end:
                S['call_n']+=1; ok=CC[i][1]==site; S['call_ok']+=ok
                if ok and first is None: first=(CC[i][0]-ex)/64
                if CC[i][1] and CC[i][3]>20: S['call_stale']+=1
                i+=1
            if r.get('plant'):
                S['pl']+=1
                j=bisect.bisect_left(T,r['plant']); 
                if j<len(CC) and CC[j][1]==site: S['pl_callok']+=1
                if j<len(CC) and CC[j][6]: S['pl_save']+=1
            if first is not None: S['lat_sum']+=first; S['lat_n']+=1
        # 017
        for rc in d['recall']:
            S['recall']+=1; S['recall_kills2']+= rc[6]>=2
        # смерть по id
        dead={}
        for k in d['kills']: dead.setdefault(k[5],[]).append(k[0])
        # act: последняя задача бота до тика
        A=collections.defaultdict(list)
        for a in d['act']: A[a[1]].append((a[0],a[2]))
        def task(b,t):
            L=A.get(b,[]); i=bisect.bisect_right(L,(t,'￿'))-1
            return L[i][1] if i>=0 else ''
        def died_before(e,t,rt0):
            return any(rt0<=x<=t for x in dead.get(e,[]))
        R0=[r['t0'] for r in d['rounds']]
        for n in d['nades']:
            S['nades']+=1; eid=n[14] if len(n)>14 else ''
            rt0=R0[bisect.bisect_right(R0,n[0])-1] if R0 else 0
            if eid and died_before(eid,n[0],rt0): S['nade_corpse']+=1
            if n[2]!='smoke':
                S['nades_ns']+=1; tx,ty=n[5],n[6]
                near_death=any(k[6]!=n[1] and 0<=n[0]-k[0]<=5*64 and math.hypot(k[7]-tx,k[8]-ty)<250 for k in d['kills'])
                alive_near=any(p[0]==n[0]-n[0]%16 and p[5] and (p[2]==1)!=(n[1]=='CT') and math.hypot(p[3]-tx,p[4]-ty)<400 for p in PT.get(n[0]-n[0]%16,[]))
                if near_death and not alive_near: S['nade_corpse2']+=1
            tg=task(n[3],n[0])
            if n[1]=='CT' and tg.split(':')[0] in ('ambush','backstab'): S['nade_hidden']+=1
        # 030 засады
        for t in d['task']:
            if t[2].split(':')[0] in ('ambush','backstab'): S['amb_tasks_'+t[1][:2].rstrip('0123456789')]+=1
        for k in d['kills']:
            ta=task(k[1],k[0]) if k[1] else ''; tv=task(k[5],k[0])
            if ta.split(':')[0] in ('ambush','backstab'): S['amb_kill_'+k[2]]+=1
            if tv.split(':')[0] in ('ambush','backstab'): S['amb_death_'+k[6]]+=1
        for r in d['rounds']:
            if 't1' not in r: continue
            S['rounds']+=1; S['twin']+=r.get('winner')=='T'; S['plants']+=bool(r.get('plant'))
    return S
for l in sys.argv[1:]:
    S=run(l); f=lambda a,b: '%.1f%%'%(100*S[a]/max(1,S[b]))
    print('== %s: раундов %d, T побед %s, плантов %s' % (l,S['rounds'],f('twin','rounds'),f('plants','rounds')))
    print(' 007 носитель: уверенность ≥0,7 в %s замеров, из них неверно (>400) %s' % (f('carh_conf','carh_n'), f('carh_conf_wrong','carh_conf')))
    print(' 015/016 колл CT от выхода до планта: верный сайт %s, колл старше 20 с %s, первый верный колл через %.1f с; на миг планта верный %s, сейв %s' % (f('call_ok','call_n'), f('call_stale','call_n'), S['lat_sum']/max(1,S['lat_n']), f('pl_callok','pl'), f('pl_save','pl')))
    print(' 017 переколов %d, из них после ≥2 убийств у старого сайта %d' % (S['recall'], S['recall_kills2']))
    print(' 028/029 гранат %d, в уже убитого (eid) %s; не-смоков в место смерти врага (≤5 с, живого врага в 400 нет) %s из %d; 034 гранат CT из засады %d' % (S['nades'], f('nade_corpse','nades'), f('nade_corpse2','nades_ns'), S['nades_ns'], S['nade_hidden']))
    print(' 030 засад (смен задачи) CT %d T %d; убийств из засады CT %d T %d; смертей в засаде CT %d T %d' % (S['amb_tasks_CT'],S['amb_tasks_T'],S['amb_kill_CT'],S['amb_kill_T'],S['amb_death_CT'],S['amb_death_T']))
