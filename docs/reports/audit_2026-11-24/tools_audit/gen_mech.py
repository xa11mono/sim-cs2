import json,collections
exec(open('mech_spec.py').read())
d=json.load(open('an.json'));F=d['F'];TV=d['topVars']
stage=json.load(open('stage.json'))
fn2m={}
for x in S:
  for f in x[4].split(): fn2m.setdefault(f,x[0])
M={x[0]:x for x in S}
UBI=set("x y baseX baseY z alive team id hp weapon post state facing curSpeed path pathIdx role tRole skill prof nades money crouching heading".split())
# global state vars: written somewhere in a function
GWALL=collections.defaultdict(set)
for f,i in F.items():
  for k in i['gw']: GWALL[k.replace('.*','')].add(f)
agg={}
for x in S:
  mid=x[0]; fns=[f for f in x[4].split() if f in F]
  w=collections.Counter(); r=collections.Counter(); gw=collections.Counter(); gr=collections.Counter(); st=[]; files=collections.OrderedDict()
  callees=collections.Counter(); callers=collections.Counter()
  for f in fns:
    i=F[f]; files.setdefault(i['file'],[]).append(f)
    for k,v in i['wr'].items(): w[k]+=v
    for k,v in i['rd'].items(): r[k]+=v
    for k,v in i['gw'].items(): gw[k.replace('.*','')]+=v
    for k,v in i['gr'].items():
      if k in GWALL: gr[k]+=v
    for s in stage.get(f,[]):
      if s not in st: st.append(s)
    for c in i['calls']:
      mc=fn2m.get(c)
      if mc and mc!=mid: callees[mc]+=1
  for f,i in F.items():
    mc=fn2m.get(f)
    for c in i['calls']:
      if fn2m.get(c)==mid and mc!=mid: callers[mc or ('показ/инстр.' if i['file']=='top' or int(i['file'])>=550 else f)]+=1
  ORD=['S1 фриз','S2 режимы','S3 после раунда','S4a бомба','S4b маршрут','S4c контакт','S4d задержка CT','S4e мозг T','S4f мозг CT','S4g эндгейм','S4h лайнапы','S4i смоки/огонь','S4j подбор','S4k LKP','S4l ситуации','S5 гранаты','S6 бот: место/ход','S6 бот: перестрелка','S6 бот: шаг/физика','S7 бой/взгляд','S8 восприятие→знание','S9 конец/сторож','E события']
  st.sort(key=lambda x: ORD.index(x) if x in ORD else 99)
  agg[mid]=dict(w=w,r=r,gw=gw,gr=gr,st=st,files=files,callees=callees,callers=callers)
# field coupling
writers=collections.defaultdict(set); readers=collections.defaultdict(set)
for mid,a in agg.items():
  for k in a['w']: writers[k].add(mid)
  for k in a['r']: readers[k].add(mid)
  for k in a['gw']: writers['G:'+k].add(mid)
  for k in a['gr']: readers['G:'+k].add(mid)
out=["# MECHANICS_INVENTORY — инвентаризация механик sim-cs2\n",
"Коммит аудита: **334860d4ee7c80dde09866858e1eb2bd4c03128d** (ветка `main`, 24.11.2026). Код игры не менялся.\n",
"""## Как составлено и как читать

* Состав механик — по исходнику `src/game/*` (а не по документации): каждая функция симуляции (файлы 000–545, 677, 678) отнесена ровно к одной
  механике; функции, не вошедшие ни в одну, — вспомогательные (геометрия, редакторы, показ), список — в конце.
* Колонки **«Пишет / Читает / Этап / Вызывает / Вызывают / Зависят / Влияют»** вычислены статическим разбором кода (acorn, `tools_audit/an.js`):
  - *Пишет* — поля бота (`b.поле = …`) и общие переменные верхнего уровня; `*` — поле пишет и другая механика (общий писатель — см. SYSTEM_DEPENDENCIES.md);
  - *Читает* — поля бота (самые частые) и общие переменные, которые где-то пишутся (константы не показаны);
  - *Этап тика* — от какого корня `stepTick` механика достижима (обход графа вызовов; полный список функций — `gen/STAGES.md`);
  - *Зависят от неё* — механики, которые читают поля/переменные, которые она пишет (без вездесущих полей x, y, alive, team, hp, weapon, post, state…);
  - *Влияют на неё* — механики, которые пишут то, что она читает.
  Разбор статический: он показывает, **что возможно** по коду, а не что случается в матче. Запись через нестандартное имя объекта может быть
  пропущена (нижняя граница) — для ключевых полей точный счёт `grep` дан в SYSTEM_DEPENDENCIES.md §2.
* **Запуск, владелец, статус, тесты** — проставлены вручную по чтению кода (ссылки — файл:строка в SYSTEMIC_ERRORS_AUDIT.md / FREEZE_AUDIT.md).
  Тесты: что реально есть в репозитории (`tools/tests`, `tools/measure/audit/scenarios*.js`, `rebuild/scenarios.json`) и их результат на этом коммите,
  если запускался (24.11, облако): `nade_physics_test` — 58/58 ok; `audit/scenarios.js` — 3 ok / 4 FAIL (один FAIL — тест сломан: `LKP is not defined`);
  `audit/scenarios2.js` — 4 ok / 5 FAIL. Почему FAIL — не разбиралось (тесты писались под старые версии, см. TEST_COVERAGE_PLAN.md §1).
* **Статус:** реализована · частично · не используется · устарела · только в документации.

Этапы тика: S1 фриз · S2 песочница/демо · S3 после конца раунда · S4 `teamBrains` (a бомба, b маршрут, c контакт/урон, d задержка CT, e мозг T,
f мозг CT, g эндгейм, h лайнапы, i смоки/огонь, j подбор, k LKP, l ситуации) · S5 гранаты · S6 цикл по ботам (место, ход, перестрелка, шаг) ·
S7 `resolveEngagements` (видимость, взгляд, выстрел) · S8 восприятие → знание (`knowTick`, `teamTick`, `beliefTick` …) · S9 конец раунда, сторож ·
E — по событию (урон, киллфид, взрыв, бросок, звук, конец/сброс раунда).

## Сводка

"""]
grp=collections.OrderedDict()
for x in S: grp.setdefault(x[1],[]).append(x)
out.append("| группа | механик | функций |\n|---|---|---|\n")
for g,L in grp.items(): out.append(f"| {g} | {len(L)} | {sum(len(x[4].split()) for x in L)} |\n")
out.append(f"| **всего** | **{len(S)}** | **{sum(len(x[4].split()) for x in S)}** |\n\n")
def fmtC(c,n=12,star=None):
  items=c.most_common(n)
  return ", ".join(f"`{k}`"+("*" if star and len(star.get(k,()))>1 else "") for k,_ in items)+(" …" if len(c)>n else "") or "—"
for g,L in grp.items():
  out.append(f"\n## {g}\n")
  for x in L:
    mid,_,name,purp,fns,trig,owner,status,tests=x; a=agg[mid]
    fl="; ".join(f"**{k}**: "+", ".join(f"`{f}`" for f in v) for k,v in a['files'].items())
    wstar={k:writers[k] for k in a['w']}
    gws={k:writers['G:'+k] for k in a['gw']}
    dep=collections.Counter(); inf=collections.Counter()
    for k in a['w']:
      if k in UBI: continue
      for o in readers[k]:
        if o!=mid: dep[o]+=1
    for k in a['gw']:
      for o in readers['G:'+k]:
        if o!=mid: dep[o]+=1
    for k in a['r']:
      if k in UBI: continue
      for o in writers[k]:
        if o!=mid: inf[o]+=1
    for k in a['gr']:
      for o in writers['G:'+k]:
        if o!=mid: inf[o]+=1
    nm=lambda c,n=10: ", ".join(f"{k}" for k,_ in c.most_common(n))+(" …" if len(c)>n else "") if c else "—"
    out.append(f"\n### {mid}. {name}\n")
    out.append(f"- **Назначение:** {purp}\n- **Где:** {fl}\n- **Запуск:** {trig}. **Этап тика:** {', '.join(a['st']) or '— (загрузка / по запросу)'}\n")
    out.append(f"- **Пишет (поля бота):** {fmtC(a['w'],14,wstar)}\n- **Пишет (общие переменные):** {fmtC(a['gw'],8,gws)}\n")
    out.append(f"- **Читает:** поля {fmtC(a['r'],14)}; переменные {fmtC(a['gr'],10)}\n")
    out.append(f"- **Владелец состояния:** {owner}\n- **Вызывает механики:** {nm(a['callees'])}. **Её вызывают:** {nm(a['callers'])}\n")
    out.append(f"- **Зависят от её результата (по данным):** {nm(dep)}\n- **Влияют на неё (по данным):** {nm(inf)}\n")
    out.append(f"- **Тесты:** {tests}\n- **Статус:** {status}\n")
used=set(f for x in S for f in x[4].split())
rest=sorted((F[f]['file'],f) for f,i in F.items() if i['file']!='top' and int(i['file'])<550 and f not in used)
out.append("\n## Вспомогательные функции симуляции вне механик\n\nГеометрия, сериализация правок карты, имена, сбросы кэшей, редакторы. Поведение ботов они не решают, но вызываются механиками выше:\n\n")
out.append(", ".join(f"`{f}`·{fi}" for fi,f in rest)+"\n")
out.append("""
## Только в документации / мёртвый код

| что | где сказано | в коде | вывод |
|---|---|---|---|
| `exuPending` («боец у выхода в utilWait») | `CLAUDE.md` таблица «Где что» (366), `docs/ARCHITECTURE.md:52` | нет такого имени; ожидание — `exuGate` / `exuHoldEta` (366, 170:2–22) | только в документации |
| `pistolNadePlan` по `MAP.pro.pistolNades` | `docs/ARCHITECTURE.md:426` | нет; `tools/pro/nades_pro.py:69` — «заменено на nadesBy» (v373) | устарело в документации |
| «таблица важности» причин хода (вместо «первая подходящая») | `535_move_mode.js:7–11` | нет; порядок причин — исторический | только план |
| сведение похожих свойств задач в строки `TASK_LEVEL` | `110_post_routes.js:172–173` | нет | только план |
| `airKey` (540:127) | — | ни одного вызова (только комментарий 540:118) | не используется |
| `m3Hit`, `m3BoxTri` (035) | — | вызываются только из `tools/` (экспорт `module.exports`, 035:424) | только для инструментов |
| «Одна связь — один раз за матч» (`navUnlinkBlocked`, 370:514) | комментарий 370:511–514 | связь удаляется из `zoneGraph` до `rebuildNav`; `freshMatch` её не восстанавливает | расходится с комментарием (см. SYSTEMIC_ERRORS Д-07) |
""")
open('/home/user/sim-cs2/docs/reports/audit_2026-11-24/MECHANICS_INVENTORY.md','w').write(''.join(out))
json.dump({k:sorted(v) for k,v in writers.items()},open('mwriters.json','w'),ensure_ascii=False)
json.dump({k:sorted(v) for k,v in readers.items()},open('mreaders.json','w'),ensure_ascii=False)
print('ok')
