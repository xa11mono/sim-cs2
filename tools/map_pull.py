#!/usr/bin/env python3
"""Забрать правку стен владельца из базы страницы в код.

python3 tools/map_pull.py <файл.json> [--dry]

<файл.json> — документ map/walls из базы страницы (ArtifactData get,
collection "map", doc "walls"), сохранённый в файл. Подходит и голое тело
документа {"walls": [...], "t": ...}, и ответ с обёрткой ({"data": {...}} и т.п.).
Поле walls целиком записывается в src/data/walls.json (тот же формат:
список замкнутых многоугольников [[x,y],...], одной строкой). Печатает,
сколько стен было и стало. --dry — только показать, ничего не писать.
"""
import json, os, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'walls.json')


def find_walls(o):
    """тело документа с полем walls — на верхнем уровне или внутри обёртки"""
    if isinstance(o, dict):
        if isinstance(o.get('walls'), list):
            return o
        for v in o.values():
            r = find_walls(v)
            if r is not None:
                return r
    elif isinstance(o, list):
        for v in o:
            r = find_walls(v)
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


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1:
        print(__doc__); sys.exit(2)
    doc = find_walls(json.load(open(args[0], encoding='utf-8')))
    if doc is None:
        sys.exit('в файле нет поля walls — это точно документ map/walls?')
    walls = [[[round(float(q[0]), 1), round(float(q[1]), 1)] for q in p] for p in doc['walls']]
    check(walls)
    old = json.load(open(OUT, encoding='utf-8'))
    t = doc.get('t')
    when = datetime.datetime.fromtimestamp(t / 1000).strftime('%d.%m %H:%M') if isinstance(t, (int, float)) and t > 0 else '?'
    same = old == walls
    print('правка со страницы от %s: стен было %d, стало %d%s' % (when, len(old), len(walls), ' (без изменений)' if same else ''))
    if not same:
        po = sum(len(p) for p in old); pn = sum(len(p) for p in walls)
        print('уголков было %d, стало %d' % (po, pn))
    if '--dry' in sys.argv or same:
        return
    open(OUT, 'w', encoding='utf-8').write(json.dumps(walls, separators=(',', ':')) + '\n')
    print('записано:', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
