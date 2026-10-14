#!/usr/bin/env python3
"""Забрать правку карты владельца из базы страницы в код.

python3 tools/map_pull.py <файл.json> [--map ancient] [--dry]

v273: правка пишется в набор карты data/maps/<карта>/ (walls.json — поле polys; heights/cover/wallbang.json — поле own).

<файл.json> — документ из коллекции map базы страницы (ArtifactData get,
collection "map", doc "walls", "heights", "cover" или "wallbang"), сохранённый в файл. Подходит и
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
  * map/cover = {"own": [{id, pt, cat? | h?, poly?}, ...], "t": ...} — правки
    укрытий (вкладка «укрытия»: категория high/chest/low или высота числом, poly —
    кусок, нарисованный владельцем). Поле own целиком записывается в поле own
    файла src/data/cover.json; остальное (то, что посчитал tools/cover_bake.py)
    не трогается. От map/heights отличается по виду записей (у укрытия id —
    строка и есть точка pt); если список пустой — какой это документ, скрипт
    понимает по имени файла (есть «cover») или по ключу --cover.
  * map/wallbang = {"own": [{id, pt, on?, mat?, t?, poly?}, ...], "t": ...} — правки
    прострелов (вкладка «прострелы»: простреливается да/нет, материал, толщина в
    ед. игры, poly — кусок, нарисованный владельцем). Поле own целиком
    записывается в поле own файла src/data/wallbang.json; остальное (то, что
    записал tools/wallbang_bake.py) не трогается. Узнаётся по полям on/mat/t в
    записях; если список пустой — по имени файла (есть «wallbang») или ключу --wallbang.
--dry — только показать, ничего не писать.
"""
import json, os, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# --map <карта> (по умолчанию ancient) — в какой набор карты писать; убираем из аргументов до разбора остального
sys.path.insert(0, os.path.join(ROOT, 'src'))
from mapset import map_arg
MAPNAME, _rest = map_arg(sys.argv[1:]); sys.argv[1:] = _rest
MAPDIR = os.path.join(ROOT, 'data', 'maps', MAPNAME)
OUT = os.path.join(MAPDIR, 'walls.json')
HOUT = os.path.join(MAPDIR, 'heights.json')
COUT = os.path.join(MAPDIR, 'cover.json')
BOUT = os.path.join(MAPDIR, 'wallbang.json')


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
    old = json.load(open(OUT, encoding='utf-8'))['polys']
    same = old == walls
    print('стены — правка со страницы от %s: стен было %d, стало %d%s' % (when(doc), len(old), len(walls), ' (без изменений)' if same else ''))
    if not same:
        po = sum(len(p) for p in old); pn = sum(len(p) for p in walls)
        print('уголков было %d, стало %d' % (po, pn))
    if dry or same:
        return
    open(OUT, 'w', encoding='utf-8').write('{\n"polys": ' + json.dumps(walls, separators=(',', ':')) + '\n}\n')
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
    heights_bake.OUT = HOUT
    heights_bake.write(H)
    print('записано: поле own в', os.path.relpath(HOUT, ROOT))


def is_wallbang(doc, fname):
    L = doc['own']
    if L:
        return any(isinstance(e, dict) and any(k in e for k in ('on', 'mat', 't')) for e in L)
    return '--wallbang' in sys.argv or 'wallbang' in os.path.basename(fname).lower()


def pull_wallbang(doc, dry):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import wallbang_bake
    B = json.load(open(BOUT, encoding='utf-8'))
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    own = []
    for e in doc['own']:
        assert isinstance(e, dict) and isinstance(e.get('id'), str) and e['id'], 'правка прострелов: нет id %r' % (e,)
        pt = e.get('pt')
        assert isinstance(pt, list) and len(pt) == 2 and all(num(v) for v in pt), 'кусок %s: плохая точка %r' % (e['id'], pt)
        r = {'id': e['id'], 'pt': [round(float(pt[0]), 1), round(float(pt[1]), 1)]}
        if 'on' in e:
            assert isinstance(e['on'], bool), 'кусок %s: плохое «простреливается» %r' % (e['id'], e['on'])
            r['on'] = e['on']
        if 'mat' in e:
            assert e['mat'] in B['materials'], 'кусок %s: нет такого материала %r' % (e['id'], e['mat'])
            r['mat'] = e['mat']
        if 't' in e:
            assert num(e['t']) and 0 <= e['t'] <= 400, 'кусок %s: плохая толщина %r' % (e['id'], e['t'])
            r['t'] = e['t']
        if 'poly' in e:
            P = e['poly']
            assert isinstance(P, list) and len(P) >= 3 and all(isinstance(q, list) and len(q) == 2 and all(num(v) for v in q) for q in P), \
                'кусок %s: плохая форма %r' % (e['id'], P)
            r['poly'] = [[round(float(q[0]), 1), round(float(q[1]), 1)] for q in P]
        own.append(r)
    own.sort(key=lambda r: r['id'])
    old = B.get('own') or []
    same = old == own
    print('прострелы — правка со страницы от %s: правок было %d, стало %d%s' % (when(doc), len(old), len(own), ' (без изменений)' if same else ''))
    if not same:
        ids = {it['id'] for it in B['items']}
        print('  выключено %d, материал у %d, толщина у %d, новых кусков %d, новых стен %d' % (
            sum(r.get('on') is False for r in own), sum('mat' in r for r in own), sum('t' in r for r in own),
            sum('poly' in r for r in own), sum(1 for r in own if r['id'] not in ids and 'poly' not in r and r['id'].startswith('w'))))
    if dry or same:
        return
    B['own'] = own
    wallbang_bake.OUT = BOUT
    wallbang_bake.write(B)
    print('записано: поле own в', os.path.relpath(BOUT, ROOT))


def is_cover(doc, fname):
    L = doc['own']
    if L:
        return any(isinstance(e, dict) and (isinstance(e.get('id'), str) or 'pt' in e) for e in L)
    return '--cover' in sys.argv or 'cover' in os.path.basename(fname).lower()


def pull_cover(doc, dry):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cover_bake
    C = json.load(open(COUT, encoding='utf-8'))
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    own = []
    for e in doc['own']:
        assert isinstance(e, dict) and isinstance(e.get('id'), str) and e['id'], 'правка укрытий: нет id %r' % (e,)
        pt = e.get('pt')
        assert isinstance(pt, list) and len(pt) == 2 and all(num(v) for v in pt), 'укрытие %s: плохая точка %r' % (e['id'], pt)
        r = {'id': e['id'], 'pt': [round(float(pt[0]), 1), round(float(pt[1]), 1)]}
        if 'cat' in e:
            assert e['cat'] in ('high', 'chest', 'low'), 'укрытие %s: плохая категория %r' % (e['id'], e['cat'])
            r['cat'] = e['cat']
        if 'h' in e:
            assert num(e['h']) and 0 <= e['h'] <= 400, 'укрытие %s: плохая высота %r' % (e['id'], e['h'])
            r['h'] = e['h']
        if 'poly' in e:
            P = e['poly']
            assert isinstance(P, list) and len(P) >= 3 and all(isinstance(q, list) and len(q) == 2 and all(num(v) for v in q) for q in P), \
                'укрытие %s: плохой кусок %r' % (e['id'], P)
            r['poly'] = [[round(float(q[0]), 1), round(float(q[1]), 1)] for q in P]
        own.append(r)
    own.sort(key=lambda r: r['id'])
    old = C.get('own') or []
    same = old == own
    print('укрытия — правка со страницы от %s: правок было %d, стало %d%s' % (when(doc), len(old), len(own), ' (без изменений)' if same else ''))
    if not same:
        ids = {it['id'] for it in C['items']}
        print('  категория у %d, высота числом у %d, новых кусков %d, id нет среди укрытий (найдутся по точке) %d' % (
            sum('cat' in r for r in own), sum('h' in r for r in own), sum('poly' in r for r in own),
            sum(1 for r in own if r['id'] not in ids and 'poly' not in r)))
    if dry or same:
        return
    C['own'] = own
    cover_bake.OUT = COUT
    cover_bake.write(C)
    print('записано: поле own в', os.path.relpath(COUT, ROOT))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1:
        print(__doc__); sys.exit(2)
    data = json.load(open(args[0], encoding='utf-8'))
    dry = '--dry' in sys.argv
    w = find_doc(data, 'walls')
    h = find_doc(data, 'own')
    if w is None and h is None:
        sys.exit('в файле нет ни поля walls, ни поля own — это точно документ map/walls, map/heights, map/cover или map/wallbang?')
    if w is not None:
        pull_walls(w, dry)
    if h is not None:
        if is_wallbang(h, args[0]):
            pull_wallbang(h, dry)
        elif is_cover(h, args[0]):
            pull_cover(h, dry)
        else:
            pull_heights(h, dry)


if __name__ == '__main__':
    main()
