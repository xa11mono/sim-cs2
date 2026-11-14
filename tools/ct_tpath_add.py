"""В142 (13.11.2026, владелец «да»): места CT на пути T — в расстановки. tools/tactics_bake.py (v319) не берёт в роли CT позиции на пути T
(у Mirage — Short), а у про к 20-й с там кто-то стоит в половине раундов. Этот шаг — после сборки тактик, как tools/ct_lookpt_add.py:
по разбору раундов про (tools/shadow/round_plan.py → plans_<карта>.json) — зоны, где CT про стоят к 20-й с в ≥ SHARE раундов без пистолеток
и которых нет ни в одной роли ни одной расстановки; такая зона мида добавляется в места ролей «mid» и «roamer» (выбор места в игре — по долям
про, posPickName, 140). Запуск: python3 tools/ct_tpath_add.py --map mirage [--dry]"""
import sys, os, json, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'shadow'))
import mapdir  # noqa: E402
MAP = mapdir.current()
from round_plan import zkey  # noqa: E402
SHARE = 0.3   # проектное число: «часто стоят» — в трети раундов и чаще
R = mapdir.recipe(MAP)['regions']
MID = set(z.split(' / ')[0] for z in R.get('mid', []))
P = json.load(open(os.path.join(HERE, 'shadow', 'plans_%s.json' % MAP), encoding='utf-8'))
P = [r for r in P if not r.get('pistol') and len(r['ct20']) >= 4]
cnt = collections.Counter(z for r in P for z in set(r['ct20']) if z)
f = mapdir.path(MAP, 'tactics.json'); T = json.load(open(f, encoding='utf-8'))
have = set(zkey(z) for s in T['ctSetups'] for r in s['roles'].values() for z in r.get('pos', []))
add = [z for z, c in cnt.most_common() if c / len(P) >= SHARE and z not in have and z in MID]
print('раундов', len(P), '| зоны CT к 20 с, которых нет в ролях:', ', '.join('%s %d%%' % (z, round(100 * cnt[z] / len(P))) for z in add) or '—')
n = 0
for s in T['ctSetups']:
    for role in ('mid', 'roamer'):
        r = s['roles'].get(role)
        if not r: continue
        for z in add:
            if z not in r['pos']: r['pos'].append(z); n += 1
print('добавлено мест ролям:', n)
if '--dry' not in sys.argv and n: json.dump(T, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('записано', f)
