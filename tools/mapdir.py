"""Набор карты для tools/* (v318): где лежат файлы карты и что о ней знает рецепт сборки.

Каждый bake-скрипт берёт карту ключом --map <карта> (по умолчанию ancient) и читает/пишет data/maps/<карта>/.
Рецепт карты — data/maps/<карта>/_build.json (в объект MAP не попадает: src/mapset.py пропускает файлы на «_»):
  * map.json-подобные сведения для скриптов: перевод координат демок, точки сайтов, названия мест для отчётов;
  * какие шаги tools/map_build.py делает для этой карты, а какие файлы набора заморожены (и почему).
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'src'))
from mapset import map_arg  # noqa: E402,F401  (то же правило --map, что у сборки страницы)

MAPS = os.path.join(ROOT, 'data', 'maps')


_CUR = []


def current():
    """карта этого запуска: --map из sys.argv (ключ убирается из sys.argv, остальной разбор аргументов скрипта —
    как был). Один раз на процесс: скрипт и импортированные им bake-модули видят одну и ту же карту."""
    if not _CUR:
        name, rest = map_arg(sys.argv[1:])
        sys.argv[1:] = rest
        _CUR.append(name)
    return _CUR[0]


def set_current(name):
    """для tools/map_build.py: вызвать bake-модуль как функцию для заданной карты"""
    _CUR[:] = [name]


def path(name, *parts):
    return os.path.join(MAPS, name, *parts)


def recipe(name):
    f = path(name, '_build.json')
    return json.load(open(f, encoding='utf-8')) if os.path.exists(f) else {}


def load_walls(name):
    """стены набора: список замкнутых многоугольников [(x, y), …] в координатах радара 0..2048"""
    w = json.load(open(path(name, 'walls.json'), encoding='utf-8'))
    return [[tuple(q) for q in W] for W in (w['polys'] if isinstance(w, dict) else w)]


def load_nav(name):
    return json.load(open(path(name, 'navmesh.json'), encoding='utf-8'))['areas']


def radar(name):
    """pos_x, pos_y, scale карты: из .txt карты (sources.txt рецепта) или из поля radar рецепта"""
    R = recipe(name)
    if 'radar' in R:
        return R['radar']
    import re
    txt = open(path(name, R['sources']['txt']), encoding='utf-8').read()
    return {k: float(re.search(r'"%s"\s+"([-\d.]+)"' % k, txt).group(1)) for k in ('pos_x', 'pos_y', 'scale')}


def game_to_map(name):
    """перевод координат игры (демки, .nav) → карта 0..2048: x = (X − pos_x)/s, y = (pos_y − Y)/s, s = scale/2"""
    R = radar(name)
    s = R['scale'] / 2.0
    px, py = R['pos_x'], R['pos_y']
    return lambda X, Y: ((X - px) / s, (py - Y) / s)


def callouts(name):
    """названия мест для отчётов bake-скриптов: [(название, x, y)] (координаты карты 0..2048)"""
    return [tuple(c) for c in recipe(name).get('callouts', [])]


def title(name):
    """название карты для людей: map.json набора, а пока его нет — рецепт (map.name)"""
    f = path(name, 'map.json')
    if os.path.exists(f):
        return json.load(open(f, encoding='utf-8'))['name']
    return recipe(name)['map']['name']


def radar_png(name):
    """картинка радара набора (radar.png), а пока её нет — исходный радар из рецепта"""
    f = path(name, 'radar.png')
    return f if os.path.exists(f) else path(name, recipe(name)['sources']['radar'])


def pro_dir(name):
    """папка промежуточных данных из демок (сэмплы, гранаты, позиции): sources.pro рецепта; у Ancient — data/pro
    (как было), у новых карт — data/maps/<карта>/pro/"""
    d = os.path.normpath(path(name, recipe(name).get('sources', {}).get('pro', 'pro')))
    os.makedirs(d, exist_ok=True)
    return d


def site_points(name):
    """центры сайтов {'A': (x, y), 'B': (x, y)} для правил «у сайта»: nadeSites рецепта (у Ancient — числа из
    tools/lineups.py, как было), иначе — точки зон с ролями Asite/Bsite (zones.json набора)"""
    R = recipe(name)
    if 'nadeSites' in R:
        return {k: tuple(v) for k, v in R['nadeSites'].items()}
    Z = json.load(open(path(name, 'zones.json'), encoding='utf-8'))['zonemap']['points']
    return {p['name'][0]: (p['x'], p['y']) for p in Z if p['name'].split('_')[0] in ('Asite', 'Bsite')}
