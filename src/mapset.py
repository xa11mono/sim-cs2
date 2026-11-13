# Набор карты (v317): всё, что относится к одной карте, лежит в data/maps/<карта>/ — игра (src/game/*) не знает
# ни одной карты и читает только объект MAP. Здесь набор склеивается в MAP и вшивается в страницу.
#   map.json      — поля верхнего уровня MAP (имя, ключи хранилища, масштаб, спавны, подсказки UI; radar — имя картинки)
#   <имя>.json    — MAP.<имя> (zones, navmesh, walls, heights, cover, wallbang, tactics, lineups, pro); _*.json — не в MAP
#                   (рецепт сборки _build.json и отчёты tools/map_build.py); NOT_MAP (throws.json — В1) — тоже не в MAP
#   radar.png     — фон; в MAP.radar — data URI
# JSON-файлы вставляются текстом, без перекодирования: числа остаются ровно как записаны (в т.ч. -0).
# Метки в исходнике игры (src/game/*): @@MAP@@ — объект MAP; @@MAP_NAME@@, @@MAP_ZONE_HINT@@, @@MAP_ZONE_LAYER_HINT@@ — надписи в разметке.
import base64, json, os

# данные из демок в папке карты, которые игре не нужны (В1: броски про, ≈ 15 МБ) — в MAP не кладутся
NOT_MAP = {'throws.json', 'throws_check.json'}
# (v512) nadeguess.json — подборы бросков лайнапов, посчитанные заранее (tools/nades/guess_bake.py): в MAP только если отпечаток
# кода подбора и данных карты (nade_hash) тот же, с которым считали; иначе игра считает их сама во freeze-тайм, как раньше
NADE_SRC = ('035_', '080_', '360_', '365_', '380_', '385_', '390_', '400_')

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


def nade_hash(name):
    import hashlib
    h = hashlib.sha1()
    g = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'game')
    for fn in sorted(os.listdir(g)):
        if fn.startswith(NADE_SRC): h.update(fn.encode()); h.update(open(os.path.join(g, fn), 'rb').read())
    d = os.path.join(MAPS, name)
    for fn in sorted(os.listdir(d)):
        if fn.endswith('.json') and not fn.startswith('_') and fn not in NOT_MAP and fn not in ('nadeguess.json', 'demorounds.json'):   # (v571) раунды демок (678) к броскам не относятся
            h.update(fn.encode()); h.update(open(os.path.join(d, fn), 'rb').read())
    return h.hexdigest()[:16]


def map_js(name):
    d = os.path.join(MAPS, name)
    meta = json.load(open(os.path.join(d, 'map.json'), encoding='utf-8'))
    meta.pop('_about', None)
    png = open(os.path.join(d, meta['radar']), 'rb').read()
    meta['radar'] = 'data:image/png;base64,' + base64.b64encode(png).decode()
    parts = [json.dumps(meta, ensure_ascii=False, separators=(',', ':'))[:-1]]
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.json') or fn == 'map.json' or fn.startswith('_'): continue   # _*.json — рецепт и отчёты tools/map_build.py
        if fn in NOT_MAP: continue
        txt = open(os.path.join(d, fn), encoding='utf-8').read().strip()
        if fn == 'nadeguess.json' and json.loads(txt).get('v') != nade_hash(name):
            import sys
            print('  nadeguess.json устарел (код подбора или данные карты менялись) — не включён; пересчитать: python3 tools/nades/guess_bake.py --map ' + name, file=sys.stderr)
            continue
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
