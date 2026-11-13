import json,glob,numpy as np
import sys; S=sys.argv[1] if len(sys.argv)>1 else '.'
A=[json.load(open(f)) for f in glob.glob(S+"/bmo_*.json")]
def add(k): 
  r={}
  for a in A:
    for c,v in a[k].items(): r[c]=r.get(c,0)+v if not isinstance(v,list) else r.get(c,[])+v
  return r
T=add("T");KK=add("KK");SW=add("SW");HL=add("HL")
tot=sum(T.values()); al=sum(a["al"] for a in A)
pro={"hold":(38,43,52,.109),"walk":(29,64,46,.234),"run":(21,46,10,.266),"fight":(12,68,65,.188)}
print("ситуация  доля бот/про  клавиша% бот/про  смен/мин бот/про  нажатие мед бот/про")
for c in ("hold","walk","run","fight"):
  print("%-6s %3.0f/%2d   %3.0f/%2d   %5.1f/%2d (%+.0f%%)   %.3f/%.3f"%(c,100*T.get(c,0)/tot,pro[c][0],100*KK.get(c,0)/T.get(c,1),pro[c][1],SW.get(c,0)/(T.get(c,1)/3840),pro[c][2],100*(SW.get(c,0)/(T.get(c,1)/3840)/pro[c][2]-1),np.median(HL.get(c,[0]))/64,pro[c][3]))
print("всего смен %.1f / про 43"%(sum(SW.values())/(tot/3840)))
sv=[s for a in A for s in a["sv"]]; pk=[s[0] for s in sv if s[1]>100]; hd=[s[0] for s in sv if s[1]<=100]
q=lambda x,p: round(float(np.percentile(x,p))) if x else None
print("1-я пуля винтовки: пик мед %s (25/75 %s/%s, ≤40: %d%%) про 69 (32/103, 33%%); стоя мед %s (%s/%s, ≤40: %d%%) про 36 (9/69, 55%%); n=%d"%(q(pk,50),q(pk,25),q(pk,75),100*np.mean(np.array(pk)<=40),q(hd,50),q(hd,25),q(hd,75),100*np.mean(np.array(hd)<=40),len(sv)))
fr=sum(a["fr"] for a in A); st=sum(a["still"] for a in A); fl=sum(a["fl"] for a in A); fls=[x for a in A for x in a["fls"]]; fld=[x for a in A for x in a["fld"]]
print("прицел неподвижен %.0f%% (про 62); рывков %.1f/мин (17); рывок мед %.0f° (56); за %.2f с (0.14)"%(100*st/fr, fl/(al/3840), np.median(fls), np.median(fld)))
print("шаг %.0f%% (27); присед %.0f%% (3); минут %.0f"%(100*sum(a["walk"] for a in A)/al, 100*sum(a["duck"] for a in A)/al, al/3840))
DB={k:[sum(a["DB"][k][0] for a in A if "DB" in a),sum(a["DB"][k][1] for a in A if "DB" in a)] for k in ("1","23","4")}
print("пули на приседе: 1-я %d%% (11), 2–3 %d%% (37), 4+ %d%% (22)"%tuple(100*DB[k][1]/max(1,DB[k][0]) for k in ("1","23","4")))
pa={"fight":(50,[5,24,92]),"hold":(78,[0,3,19]),"walk":(55,[3,17,75]),"run":(52,[4,33,135])}
for c in ("fight","hold","walk","run"):
  n=sum(a["AS"].get(c,[0,0])[0] for a in A); s=sum(a["AS"].get(c,[0,0])[1] for a in A); r=[x for a in A for x in a["AR"].get(c,[])]
  print("прицел %-5s неподвижен %.0f%% (про %d) | поворот °/с 50/75/90: %s (про %s)"%(c,100*s/max(1,n),pa[c][0],np.percentile(r,[50,75,90]).round().tolist(),pa[c][1]))
