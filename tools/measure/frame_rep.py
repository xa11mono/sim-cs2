# (v397, М146) отчёт к frame_prof.js
import json,sys,statistics as st
d=json.load(open(sys.argv[1])); fr=d['fr'][30:]
gaps=[b['ts']-a['ts'] for a,b in zip(fr,fr[1:])]
tot=[f['total'] for f in fr]
def pc(a,p): a=sorted(a); return a[min(len(a)-1,int(p*len(a)))]
print("кадров %d, интервал кадра: медиана %.1f мс, 95%% %.1f, 99%% %.1f, макс %.0f; >50мс: %d, >100мс: %d"%(len(fr),pc(gaps,.5),pc(gaps,.95),pc(gaps,.99),max(gaps),sum(g>50 for g in gaps),sum(g>100 for g in gaps)))
print("работа JS в кадре: медиана %.1f, 95%% %.1f, 99%% %.1f, макс %.0f"%(pc(tot,.5),pc(tot,.95),pc(tot,.99),max(tot)))
keys=sorted({k for f in fr for k in f if not k.startswith('#') and k not in('total','ts','tick')})
for k in keys:
  v=[f.get(k,0) for f in fr]; print("  %-16s сред %.2f  95%% %.1f  макс %.0f  всего %.0f мс"%(k,sum(v)/len(v),pc(v,.95),max(v),sum(v)))
big=sorted(fr,key=lambda f:-f['total'])[:8]
for f in big: print("  долгий кадр %.0f мс тик %d: "%(f['total'],f['tick'])+", ".join("%s %.0f"%(k,v) for k,v in f.items() if not k.startswith('#') and k not in('total','ts','tick') and v>3))
print("профиль (self, с):", d['totMs']/1000); 
for k,v in d['top'][:25]: print("   ",v,k)
print("нативное по месту вызова:"); [print("   ",v,k) for k,v in d.get('natTop',[])]
print("долгие тики stepTick (мс, тик, раунд, было, стало):", d.get('slow'))
