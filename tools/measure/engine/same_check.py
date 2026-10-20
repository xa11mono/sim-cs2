#!/usr/bin/env python3
"""(Б2) Сторож не меняет игру: сравнить запись матчей двух прогонов одной версии игры (бит в бит).
python3 tools/measure/engine/same_check.py <папка A> <папка B> [--matches=3,7]
Папки — с rec_<m>.json или rec_<m>.json.gz. Сравниваются все поля записи, кроме записей сторожей, которых в одном из прогонов
нет (know), и подписей «кто вызвал» в сторожe ходьбы (walk.who, walk.post): это имена функций из стека, а обёртка нового сторожа
добавляет в стек свою строку — игра от этого не меняется. Вывод: по матчу — «совпадает» или первое расхождение."""
import sys, os, json, gzip
def load(d, m):
    for f in (f'rec_{m}.json.gz', f'rec_{m}.json'):
        p = os.path.join(d, f)
        if os.path.exists(p): return json.load(gzip.open(p, 'rt', encoding='utf-8') if p.endswith('.gz') else open(p, encoding='utf-8'))
    return None
def strip(R):
    R = dict(R); R.pop('know', None)
    if isinstance(R.get('walk'), dict): R['walk'] = {k: v for k, v in R['walk'].items() if k not in ('who', 'post')}
    return R
a, b = [x for x in sys.argv[1:] if not x.startswith('--')]
ms = next((x.split('=')[1].split(',') for x in sys.argv if x.startswith('--matches=')), None)
if not ms: ms = sorted({f.split('_')[1].split('.')[0] for f in os.listdir(a) if f.startswith('rec_')}, key=int)
ok = 0
for m in ms:
    A, B = load(a, m), load(b, m)
    if A is None or B is None: print(m, 'нет файла'); continue
    A, B = strip(A), strip(B)
    if A == B: ok += 1; print(m, 'совпадает', 'раундов', len(A['rounds']), 'убийств', len(A['kills']), 'выстрелов', len(A.get('shots', [])))
    else:
        k = next(k for k in sorted(set(A) | set(B)) if A.get(k) != B.get(k))
        print(m, 'РАСХОДИТСЯ: поле', k)
print(f'совпало {ok} из {len(ms)}')
