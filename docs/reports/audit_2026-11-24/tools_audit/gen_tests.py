import json
exec(open('mech_spec.py').read()); exec(open('matrix.py').read())
RC=json.load(open('regcnt.json'))
head=open('tests_head.md').read(); tail=open('tests_tail.md').read()
rows=["\n## 3. Матрица тестов по механикам\n\nКолонки — виды сценариев из задания. «—» в первых четырёх колонках: отдельной сцены не нужно, механику покрывают общие инварианты §2.\n"
"В колонке «регрессия» — известные исправленные ошибки (номер версии / отметки) и находки этого аудита. Число «отм.» — пометки с отметкой\n"
"или словами владельца в функциях механики (`rebuild/gen/registry.json`, снят на коммите генерации, 1579 записей). Каждая пометка —\n"
"кандидат в регрессионную сцену: она описывает, что было неправильно и как стало.\n\n"
"| механика | обычный | граничный | негативный | взаимодействие | регрессия |\n|---|---|---|---|---|---|\n"]
for x in S:
  a=X[x[0]]; rc=RC.get(x[0])
  reg=a[4]
  if rc: reg=(reg+"; " if reg!="—" else "")+f"отм. {rc[0]} ({', '.join(rc[1])})"
  cell=lambda s: s.replace('|','/')
  rows.append(f"| **{x[0]}** {x[2]} | {cell(a[0])} | {cell(a[1])} | {cell(a[2])} | {cell(a[3])} | {cell(reg)} |\n")
open('/home/user/sim-cs2/docs/reports/audit_2026-11-24/TEST_COVERAGE_PLAN.md','w').write(head+''.join(rows)+tail)
print('ok')
