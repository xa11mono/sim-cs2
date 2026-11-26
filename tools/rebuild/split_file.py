"""(Р4.4) Деление крупного файла игры по границе верхнего оператора: хвост с оператора на строке STMT (вместе с комментариями над ним)
уходит в новый файл того же каталога, который ставится в rebuild/files.json сразу за исходным — склейка даёт прежний текст байт в байт
(проверяется здесь же). Описание нового файла (part, sys, dir) — как у исходного, id — имя без расширения.
Запуск: python3 tools/rebuild/split_file.py <путь файла> <строка оператора> <новое имя>"""
import json, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
path, stmt, new = sys.argv[1], int(sys.argv[2]), sys.argv[3]
src = open(os.path.join(ROOT, path), encoding='utf-8').read(); L = src.split('\n')
cut = stmt - 1
while cut > 0 and L[cut - 1].lstrip().startswith('//'): cut -= 1   # комментарии над оператором — с ним
a, b = '\n'.join(L[:cut]) + '\n', '\n'.join(L[cut:])
assert a + b == src, 'склейка не равна исходнику'
d = os.path.dirname(path)
open(os.path.join(ROOT, path), 'w', encoding='utf-8').write(a); open(os.path.join(ROOT, d, new), 'w', encoding='utf-8').write(b)
FP = os.path.join(ROOT, 'rebuild', 'files.json'); F = json.load(open(FP, encoding='utf-8')); base = os.path.basename(path)
i = F['files'].index(base); F['files'].insert(i + 1, new)
gi = [k for k, g in enumerate(F['game']) if g['file'] == base][0]; g = dict(F['game'][gi]); g.pop('legacy', None); g.pop('mode', None) if not g.get('mode') else None
g.update(file=new, id=os.path.splitext(new)[0]); F['game'].insert(gi + 1, g)
json.dump(F, open(FP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(FP, 'a').write('\n')
print('%s: строк %d + %s: %d (граница — строка %d)' % (path, a.count('\n'), new, b.count('\n') + 1, cut + 1))
