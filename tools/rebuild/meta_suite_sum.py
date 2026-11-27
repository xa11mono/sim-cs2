"""(изоляция, 27.11) Сводка метаморфного набора: каждая пара (лог meta_know.js, JSON) — «пройдена» / «провалена» / «непригодна».
Непригодна — изменение невозможно в точке, не дошло до наблюдателя, задело законный вход, A ≠ A (недетерминизм), пробовать нечего;
непригодная пара успехом не считается. Запуск: python3 tools/rebuild/meta_suite_sum.py <каталог логов> [<префикс>] → таблица Markdown + итоги."""
import json, os, sys, re, collections
d = sys.argv[1]; pre = sys.argv[2] if len(sys.argv) > 2 else ''
def cls(r):
    v = r.get('verdict') or ''; pos = 'ПОЛОЖ' in v or 'положительная' in v
    if r.get('aa') and r['aa'] != 'A = A': return 'непригодна', 'A ≠ A'
    if v.startswith('УТЕЧКА') or v.startswith('ПОЛОЖИТЕЛЬНАЯ не пройдена'): return 'провалена', v
    if v.startswith('чисто') or v.startswith('положительная пройдена'): return 'пройдена', v
    return 'непригодна', v
rows = []; tot = collections.Counter(); grp = collections.defaultdict(collections.Counter)
for f in sorted(os.listdir(d)):
    if not f.endswith('.log') or not f.startswith(pre): continue
    try: r = json.load(open(os.path.join(d, f)))
    except Exception: rows.append((f, 'непригодна', 'лог не дописан / ошибка')); tot['непригодна'] += 1; continue
    c, v = cls(r); fam = r.get('family'); tot[c] += 1; grp[fam][c] += 1
    rows.append((f[:-4], c, '%s · м%s · тик %s · %s%s' % (fam, r.get('match'), r.get('at'), v[:90], (' · ' + (r.get('change') or '')[:50]) if r.get('change') else '')))
print('| пара | итог | семейство · матч · тик · вердикт · изменение |\n|---|---|---|')
for f, c, v in rows: print('| %s | %s | %s |' % (f, c, v.replace('|', '/')))
print('\nИтого: ' + ', '.join('%s %d' % (k, tot[k]) for k in ('пройдена', 'провалена', 'непригодна')))
for fam in sorted(grp, key=str): print('- %s: ' % fam + ', '.join('%s %d' % (k, grp[fam][k]) for k in ('пройдена', 'провалена', 'непригодна') if grp[fam][k]))
