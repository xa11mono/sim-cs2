# Набор карты (v317): всё, что относится к одной карте, лежит в data/maps/<карта>/ — игра (src/game.html) не знает
# ни одной карты и читает только объект MAP. Здесь набор склеивается в MAP и вшивается в страницу.
#   map.json      — поля верхнего уровня MAP (имя, ключи хранилища, масштаб, спавны, подсказки UI; radar — имя картинки)
#   <имя>.json    — MAP.<имя> (zones, navmesh, walls, heights, cover, wallbang, tactics, lineups, pro)
#   radar.png     — фон; в MAP.radar — data URI
# JSON-файлы вставляются текстом, без перекодирования: числа остаются ровно как записаны (в т.ч. -0).
# Метки в src/game.html: @@MAP@@ — объект MAP; @@MAP_NAME@@, @@MAP_ZONE_HINT@@, @@MAP_ZONE_LAYER_HINT@@ — надписи в разметке.
import base64, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
MAPS = os.path.join(HERE, '..', 'data', 'maps')
DEFAULT = 'ancient'


def map_arg(argv):
    """--map <карта> из аргументов; возвращает (карта, остальные аргументы)."""
    rest, name, i = [], DEFAULT, 0
    while i < len(argv):
        if argv[i] == '--map' and i + 1 < len(argv): name = argv[i + 1]; i += 2; continue
        if argv[i].startswith('--map='): name = argv[i][6:]; i += 1; continue
        rest.append(argv[i]); i += 1
    return name, rest


def map_js(name):
    d = os.path.join(MAPS, name)
    meta = json.load(open(os.path.join(d, 'map.json'), encoding='utf-8'))
    meta.pop('_about', None)
    png = open(os.path.join(d, meta['radar']), 'rb').read()
    meta['radar'] = 'data:image/png;base64,' + base64.b64encode(png).decode()
    parts = [json.dumps(meta, ensure_ascii=False, separators=(',', ':'))[:-1]]
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.json') or fn == 'map.json': continue
        txt = open(os.path.join(d, fn), encoding='utf-8').read().strip()
        json.loads(txt)  # битый файл — ошибка сборки, а не страницы
        parts.append(',' + json.dumps(fn[:-5]) + ':' + txt)
    js = ''.join(parts) + '}'
    return js.replace('</', '<\\/'), meta


def inject_map(html, name):
    js, meta = map_js(name)
    for mark in ('@@MAP@@', '@@MAP_NAME@@'):
        assert mark in html, mark
    ui = meta.get('ui', {})
    html = html.replace('@@MAP_NAME@@', meta['name'])
    html = html.replace('@@MAP_ZONE_HINT@@', ui.get('zoneNameHint', ''))
    html = html.replace('@@MAP_ZONE_LAYER_HINT@@', ui.get('zoneLayerHint', ''))
    return html.replace('@@MAP@@', js, 1)
