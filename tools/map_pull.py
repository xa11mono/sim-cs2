#!/usr/bin/env python3
"""Забрать правку карты владельца из базы страницы в код.

python3 tools/map_pull.py <файл.json> [--dry]

<файл.json> — документ из коллекции map базы страницы (ArtifactData get,
collection "map", doc "walls" или "heights"), сохранённый в файл. Подходит и
голое тело документа, и ответ с обёрткой ({"data": {...}} и т.п.). Какой это
документ, скрипт понимает сам:
  * map/walls  = {"walls": [...], "t": ...} — поле walls целиком записывается в
    src/data/walls.json (тот же формат: список замкнутых многоугольников
    [[x,y],...], одной строкой). Печатает, сколько стен было и стало.
  * map/heights = {"own": [{id, lvl?, cov?}, ...], "t": ...} — правки высот
    (вкладка «высоты»: уровень и «крыто сверху» у участков навмеша). Поле own
    целиком записывается в поле own файла src/data/heights.json; остальное в
    этом файле (то, что посчитал tools/heights_bake.py) не трогается. Печатает,
    сколько участков с правкой было и стало.
--dry — только показать, ничего не писать.
"""
import json, os, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'walls.json')
HOUT = os.path.join(ROOT, 'src', 'data', 'heights.json')


def find_doc(o, field):
    """тело документа с полем field — на верхнем уровне или внутри обёртки"""
    if isinstance(o, dict):
        if isinstance(o.get(field), list):
            return o
        for v in o.values():
            r = find_doc(v, field)
            if r is not None:
                return r
    elif isinstance(o, list):
        for v in o:
            r = find_doc(v, field)
            if r is not None:
                return r
    return None


def check(walls):
    assert walls, 'в документе пустой список стен'
    for i, p in enumerate(walls):
        assert isinstance(p, list) and len(p) >= 3, 'стена %d: меньше 3 уголков' % i
        for q in p:
            assert isinstance(q, list) and len(q) == 2 and all(isinstance(v, (int, float)) for v in q), 'стена %d: плохая точка %r' % (i, q)
            assert -100 <= q[0] <= 2200 and -100 <= q[1] <= 2200, 'стена %d: точка за картой %r' % (i, q)


def when(doc):
    t = doc.get('t')
    return datetime.datetime.fromtimestamp(t / 1000).strftime('%d.%m %H:%M') if isinstance(t, (int, float)) and t > 0 else '?'


def pull_walls(doc, dry):
    walls = [[[round(float(q[0]), 1), round(float(q[1]), 1)] for q in p] for p in doc['walls']]
    check(walls)
    old = json.load(open(OUT, encoding='utf-8'))
    same = old == walls
    print('стены — правка со страницы от %s: стен было %d, стало %d%s' % (when(doc), len(old), len(walls), ' (без изменений)' if same else ''))
    if not same:
        po = sum(len(p) for p in old); pn = sum(len(p) for p in walls)
        print('уголков было %d, стало %d' % (po, pn))
    if dry or same:
        return
    open(OUT, 'w', encoding='utf-8').write(json.dumps(walls, separators=(',', ':')) + '\n')
    print('записано:', os.path.relpath(OUT, ROOT))


def pull_heights(doc, dry):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import heights_bake
    H = json.load(open(HOUT, encoding='utf-8'))
    ids = {r[0] for r in H['areas']}
    own = []
    for e in doc['own']:
        assert isinstance(e, dict) and e.get('id') in ids, 'правка высот: нет такого участка навмеша %r' % (e,)
        r = {'id': int(e['id'])}
        if 'lvl' in e:
            assert isinstance(e['lvl'], int) and 0 <= e['lvl'] <= 5, 'участок %d: плохой уровень %r' % (r['id'], e['lvl'])
            r['lvl'] = e['lvl']
        if 'cov' in e:
            assert e['cov'] in (0, 1), 'участок %d: плохое «крыто» %r' % (r['id'], e['cov'])
            r['cov'] = e['cov']
        if len(r) > 1:
            own.append(r)
    own.sort(key=lambda r: r['id'])
    old = H.get('own') or []
    same = old == own
    print('высоты — правка со страницы от %s: участков с правкой было %d, стало %d%s' % (when(doc), len(old), len(own), ' (без изменений)' if same else ''))
    if not same:
        print('  уровень поправлен у %d, «крыто сверху» — у %d' % (sum('lvl' in r for r in own), sum('cov' in r for r in own)))
    if dry or same:
        return
    H['own'] = own
    heights_bake.write(H)
    print('записано: поле own в', os.path.relpath(HOUT, ROOT))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1:
        print(__doc__); sys.exit(2)
    data = json.load(open(args[0], encoding='utf-8'))
    dry = '--dry' in sys.argv
    w = find_doc(data, 'walls')
    h = find_doc(data, 'own')
    if w is None and h is None:
        sys.exit('в файле нет ни поля walls, ни поля own — это точно документ map/walls или map/heights?')
    if w is not None:
        pull_walls(w, dry)
    if h is not None:
        pull_heights(h, dry)


if __name__ == '__main__':
    main()
