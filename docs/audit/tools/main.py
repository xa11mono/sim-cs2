import json, sys, bisect
M=[3,7,11,13,17,19,23,29]
def run(l):
    R=Tw=P=0; ep={'stall':set(),'tug':set(),'danger':set(),'nav':set()}; slow=0; K=0; nad=0
    for m in M:
        try: d=json.load(open('/home/user/sim-cs2/tools/measure/runs/%s/rec_%d.json'%(l,m)))
        except Exception: continue
        rs=[r for r in d['rounds'] if r.get('winner')]; R+=len(rs); Tw+=sum(r['winner']=='T' for r in rs); P+=sum(1 for r in rs if r.get('plant'))
        t0=[r['t0'] for r in rs]
        for k,s in ep.items():
            for e in d['watch']['ev'].get(k,[]): s.add((m,bisect.bisect(t0,e[0]),e[1]))
        slow+=len(d['slow']); K+=len(d['kills']); nad+=len(d['nades'])
    return R,Tw/R,P/R,{k:100*len(v)/R for k,v in ep.items()},slow/R,K/R,nad/R
print('%-11s %4s %5s %5s %6s %5s %6s %6s %5s %5s %5s'%('метка','раунд','T','план','stall','tug','danger','nav','долг','убийс','гран'))
for l in sys.argv[1:]:
    R,t,p,e,s,k,n=run(l)
    print('%-11s %4d %5.2f %5.2f %6.0f %5.0f %6.0f %6.0f %5.0f %5.1f %5.1f'%(l,R,t,p,e['stall'],e['tug'],e['danger'],e['nav'],s,k,n))
