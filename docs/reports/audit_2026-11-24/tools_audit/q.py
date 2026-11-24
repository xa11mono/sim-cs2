import json,collections,sys
d=json.load(open('an.json'));F=d['F']
# field -> writers
W=collections.defaultdict(dict);R=collections.defaultdict(dict)
for fn,i in F.items():
  for k,v in i['wr'].items(): W[k][fn]=v
  for k,v in i['rd'].items(): R[k][fn]=v
rows=[]
for k,ws in W.items():
  files=set(F[f]['file'] for f in ws)
  rows.append((len(files),len(ws),k,files))
rows.sort(reverse=True)
print("bot fields written:",len(W))
print("fields written from >=3 files:",sum(1 for r in rows if r[0]>=3))
for nf,nw,k,files in rows[:70]:
  print(f"{k:24s} files={nf:2d} fns={nw:3d} readers={len(R.get(k,{})):3d} [{','.join(sorted(files))}]")
