# Этаж разрыва смоков / молотовов лайнапов против этажа разрыва про (throws.json, медиана): python3 tools/nades/lineup_levels_pro.py <папка с diag_<карта>.json и <метка>_<карта>.json> <метка> …
# diag_<карта>.json — {id, type, from:[X,Y,Z], to:[X,Y]} в ед. игры (как в отчёте); «тот же этаж» — |z − z про| ≤ 64 и не крыша
import json,math,sys,collections,statistics as st
S=sys.argv[1]
for m in ['mirage','ancient']:
  D={d['id']:d for d in json.load(open(S+'diag_%s.json'%m))}
  T=[t for t in json.load(open('data/maps/%s/throws.json'%m))['throws'] if t.get('det')]
  PZ={}
  for i,d in D.items():
    ty='molotov' if d['type']=='molly' else d['type']
    ms=[t['det']['pos'][2] for t in T if t['type']==ty and math.hypot(t['pos'][0]-d['from'][0],t['pos'][1]-d['from'][1])<60 and math.hypot(t['det']['pos'][0]-d['to'][0],t['det']['pos'][1]-d['to'][1])<80]
    if ms: PZ[i]=sorted(ms)[len(ms)//2]
  for tag in sys.argv[2:]:
    L=json.load(open(S+'%s_%s.json'%(tag,m)))['lineups']; c=collections.Counter()
    wrong=[]
    for l in L:
      if l['type'] not in ('smoke','molly'): continue
      if l['how']=='fail': c['отказ']+=1; continue
      if l['id'] not in PZ: c['нет данных про']+=1; continue
      ok = l['how']!='roof' and abs(l['end'][2]-PZ[l['id']])<=64
      c['этаж про' if ok else 'ДРУГОЙ этаж/крыша']+=1
      if not ok: wrong.append(l['id'])
      if l.get('floorOk') is not None and l['floorOk']!=ok: c['проверка игры ≠ про']+=1
    print(tag,m,'смоки+молотовы:',dict(c),wrong[:10])
