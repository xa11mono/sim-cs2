import json, collections, sys, bisect
M=[3,7,11,13,17,19,23,29]
def L(l,m): return json.load(open('/home/user/sim-cs2/tools/measure/runs/%s/rec_%d.json'%(l,m)))
def detour(l):
    D=[]
    for m in M:
        d=L(l,m); last={}
        for t in d['task']:
            p=last.get(t[1])
            if p and p[0].startswith('repos:hurt') and not t[2].startswith('repos:hurt'): D.append((t[0]-p[1])/64)
            if not p or p[0]!=t[2]: last[t[1]]=(t[2],t[0])
    D.sort(); return 'отходов раненым %d, медиана %.1f с, дольше 10 с %d' % (len(D), D[len(D)//2] if D else 0, sum(1 for x in D if x>10))
def flips(l):
    n=0; fl=0
    for m in M:
        d=L(l,m); R=collections.defaultdict(list)
        for rc in d['recall']:
            r=[x for x in d['rounds'] if x['t0']<=rc[0]<=x.get('t1',10**9)]
            if r: R[r[0]['r']].append((rc[1],rc[2]))
        for k,v in R.items():
            n+=len(v); fl+=sum(1 for i in range(1,len(v)) if v[i][1]==v[i-1][0])
    return 'переколов %d, туда-обратно в раунде %d' % (n, fl)
def hurtdeath(l):
    h=dd=0
    for m in M:
        d=L(l,m); K={}
        for k in d['kills']: K.setdefault(k[5],[]).append(k[0])
        for x in d['dmg']:
            if x[5]=='bullet' and x[4]>0 and len(x)>6 and x[6]>0:
                h+=1; dd+= any(0<t-x[0]<=3*64 for t in K.get(x[3],[]))
    return 'попаданий (выжил) %d, убит в течение 3 с %.1f%%' % (h, 100*dd/max(1,h))
def ctact(l):
    sw=hd=ck=cd=0
    for m in M:
        d=L(l,m)
        for c in d.get('cont',[]):
            if c[1].startswith('CT'):
                if c[2]=='contact:swing': sw+=1
                elif c[2]=='contact:hold': hd+=1
        for k in d['kills']:
            if k[2]=='CT': ck+=1
            if k[6]=='CT': cd+=1
    return 'CT выход/держать %d/%d, CT убил/погиб %d/%d' % (sw,hd,ck,cd)
def delay(l):
    C=collections.Counter()
    for m in M:
        for n in L(l,m)['nades']:
            if 'задержать' in n[12]: C[n[2]]+=1
    t=sum(C.values()) or 1; return 'задержка: ' + ', '.join('%s %.0f%%'%(k,100*v/t) for k,v in C.most_common()) + ' (n=%d; про смок 38, молотов 38, HE 24)'%sum(C.values())
def refuse(l):
    C=collections.Counter()
    for m in M:
        for r in L(l,m)['refuse']: C[(r[2].split(':')[0][:10], r[3].split(':')[0][:10])]+=1
    return 'отказы арбитра: ' + '; '.join('%s←%s %d'%(a,b,v) for (a,b),v in C.most_common(6))
for l in sys.argv[1:]:
    print('==', l); print(' ', detour(l)); print(' ', flips(l)); print(' ', hurtdeath(l)); print(' ', ctact(l)); print(' ', delay(l)); print(' ', refuse(l))
