import json, sys, collections
for l in sys.argv[1:]:
    W=[]; ent=tr=0; mid=0; R=0
    for m in [3,7,11,13,17,19,23,29]:
        d=json.load(open('/home/user/sim-cs2/tools/measure/runs/%s/rec_%d.json'%(l,m))); R+=len(d['rounds'])
        last={}
        for t in d['task']:
            if last.get(t[1],('',0))[0]=='smokeLine' and t[2]!='smokeLine': W.append((t[0]-last[t[1]][1])/64)
            if t[2]!=last.get(t[1],('',0))[0]: last[t[1]]=(t[2],t[0])
        K=d['kills']
        for i,k in enumerate(K):
            if k[6]=='T' and k[12]=='entry':
                ent+=1; tr+= any(k2[5]==k[1] and 0<k2[0]-k[0]<=3*64 for k2 in K[i+1:i+12])
        V=d['voice'] if isinstance(d['voice'],list) else []
        mid+=sum(1 for v in V if 'мид наш' in str(v[3]))
    W.sort()
    print('%-9s ожиданий у смока %d (на 100 раундов %.0f), медиана %.1f с, дольше 5 с: %d | энтри убит %d, разменян за 3 с %.0f%% | «мид наш» %d' % (l, len(W), 100*len(W)/R, W[len(W)//2] if W else 0, sum(1 for x in W if x>5), ent, 100*tr/max(1,ent), mid))
