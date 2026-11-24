import json,collections,re
d=json.load(open('an.json'));F=d['F'];TV=d['topVars']
stage=json.load(open('stage.json'))
OUT='/home/user/sim-cs2/docs/reports/audit_2026-11-24/gen/'
W=collections.defaultdict(dict);R=collections.defaultdict(dict)
GW=collections.defaultdict(dict);GR=collections.defaultdict(dict)
for fn,i in F.items():
  for k,v in i['wr'].items(): W[k][fn]=v
  for k,v in i['rd'].items(): R[k][fn]=v
  for k,v in i['gw'].items(): GW[k.replace('.*','')][fn]=GW[k.replace('.*','')].get(fn,0)+v
  for k,v in i['gr'].items(): GR[k][fn]=v
fl=lambda fn: F[fn]['file'] if fn in F else 'top'
hdr="""# Поля бота: все писатели и читатели (генерируется статическим разбором; коммит 334860d)

Источник — `tools_audit/an.js` (acorn по склейке `src/game/*`). Запись — присваивание / `++` полю объекта, который разбор признал ботом
(имя `b`, `bot`, `o`… и чтение у него полей бота; параметр обхода `bots.forEach`). Это **нижняя граница**: запись через другое имя
переменной (`pb._probeLock`, `fetcher._probeLock`) разбор может пропустить — для ключевых полей точный счёт `grep` — в SYSTEM_DEPENDENCIES.md §2.
Сброс раунда (530), разминка (660), песочница (677), демо (678), повтор (675) — тоже писатели, но не в живом тике: помечены `·сброс/режим`.

| поле | файлов-писателей | функций | писатели (функция·файл) | читателей (функций) | файлы-читатели |
|---|---|---|---|---|---|
"""
MODE={'530','660','677','678','675'}
rows=[]
for k in W:
  ws=W[k]; files=sorted(set(fl(f) for f in ws)); live=[f for f in files if f not in MODE]
  rows.append((len(live),len(files),k))
rows.sort(key=lambda r:(-r[0],-r[1],r[2]))
s=hdr
for nl,nf,k in rows:
  ws=sorted(W[k], key=lambda f:(fl(f),f))
  wl=", ".join(f"`{f}·{fl(f)}`"+("·сброс/режим" if fl(f) in MODE else "") for f in ws)
  rf=sorted(set(fl(f) for f in R.get(k,{})))
  s+=f"| `{k}` | {nl} (+{nf-nl}) | {len(ws)} | {wl} | {len(R.get(k,{}))} | {' '.join(rf)} |\n"
s+="\nПоля, которые только читаются этим разбором (пишутся через другое имя объекта или при создании бота в `makeTeam`, 070):\n\n"
s+=", ".join(f"`{k}`" for k in sorted(set(R)-set(W)) if not k.startswith('__'))+"\n"
open(OUT+'FIELDS_ALL.md','w').write(s)
# globals
s="""# Общие переменные верхнего уровня: кто пишет и кто читает (генерируется; коммит 334860d)

Только переменные, которые **пишут** функции из двух и более файлов или из файла, отличного от файла объявления. Запись — присваивание
переменной или её полю (`X = …`, `X.f = …`). Читатели — число функций и файлы.

| переменная | объявлена | пишут (функция·файл) | читают: функций | читают: файлы |
|---|---|---|---|---|
"""
for v in sorted(GW):
  ws=GW[v]; wf=set(fl(f) for f in ws)
  if len(wf)<2 and (TV.get(v) in wf): continue
  rf=sorted(set(fl(f) for f in GR.get(v,{})))
  s+=f"| `{v}` | {TV.get(v,'?')} | "+", ".join(f"`{f}·{fl(f)}`" for f in sorted(ws,key=lambda f:(fl(f),f)))+f" | {len(GR.get(v,{}))} | {' '.join(rf)} |\n"
open(OUT+'GLOBALS_CROSS.md','w').write(s)
# stages
s="""# Функция → этап тика (генерируется; коммит 334860d)

Этап — от какого корня `stepTick` (540) функция достижима по графу вызовов (обход в ширину; функция может быть на нескольких этапах).
S1 фриз · S2 песочница/демо · S3 после раунда · S4 `teamBrains` (подэтапы a–l в порядке вызова) · S5 гранаты · S6 цикл по ботам ·
S7 `resolveEngagements` (видимость, взгляд, выстрел) · S8 восприятие → знание · S9 конец раунда и сторож · E — вызывается по событию
(урон, киллфид, взрыв, конец/сброс раунда, бросок, звук). Без этапа — загрузка/редакторы/показ или мёртвый код.

| файл | функция | строки | этапы | вызывающие (до 6) |
|---|---|---|---|---|
"""
callers=collections.defaultdict(set)
for f,i in F.items():
  for c in i['calls']: callers[c].add(f)
for fn,i in sorted(F.items(), key=lambda x:(x[1]['file'],x[1].get('line',0))):
  if i['file']=='top' or int(i['file'])>=550 and i['file'] not in ('677','678'): continue
  st=stage.get(fn,[])
  s+=f"| {i['file']} | `{fn}` | {i['line']}–{i['end']} | {'; '.join(st) if st else '—'} | {', '.join(sorted(callers.get(fn,[]))[:6])} |\n"
open(OUT+'STAGES.md','w').write(s)
print('ok', len(rows))
