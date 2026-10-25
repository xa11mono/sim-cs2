# Публикуемая версия: python3 src/mkpub.py [--map ancient] → <карта>-radar.html (для Ancient — ancient-radar.html)
# Берёт игру (склейка src/game/* — src/gamesrc.py; v239 = v166) целым документом (v430) и убирает тестовый вход window.__ev.
# v317: вшивает набор выбранной карты (data/maps/<карта>/, src/mapset.py).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from marks_build import inject
from mapset import map_arg, inject_map
from gamesrc import game_source   # v377: исходник игры — склейка src/game/*
MAPNAME, _ = map_arg(sys.argv[1:])
s = inject_map(inject(game_source()), MAPNAME)   # v255: «Отметить момент»
# (v430) страница — целый документ: <!doctype html>, кодировка, та же обёртка, что ставит публикация (000_head.html). Раньше
# обёртка отрезалась, и файл, открытый с диска, шёл в режиме совместимости (quirks): таблицы не наследовали шрифт, отступы
# другие — вид отличался от артефакта. Теперь файл с диска и артефакт выглядят одинаково
assert s.lstrip().lower().startswith('<!doctype html>')
s = s.replace('window.__ev=function(src){return eval(src);};', '')
s = s.replace('/*@@WARM_AUTO@@*/', 'warmStart(1);')
# (v349, владелец: «обновляй версию в радаре и дату») подпись версии — номер из последней записи docs/DECISIONS.md и дата сборки
import re as _re, datetime as _dt
_dec = open(os.path.join(HERE, '..', 'docs', 'DECISIONS.md'), encoding='utf-8').read()
_h = _re.search(r'^## .*$', _dec, _re.M)   # (В4) в заголовке записи бывает несколько версий — берём наибольшую
_vs = [int(v) for v in _re.findall(r'\(v(\d{3})', _h.group(0) if _h else _dec)]
_m = bool(_vs)
if _m:
    _lab = 'версия %s, %s' % (max(_vs), _dt.date.today().strftime('%d.%m'))
    s, _n = _re.subn(r'(id="simVersion"[^>]*>)[^<]*(</div>)', lambda mm: mm.group(1) + _lab + mm.group(2), s, count=1)
    print('  подпись:', _lab if _n else 'не найдена')
# (v329, М46) звуки — записи из data/sounds/sounds.json (tools/sounds_bake.py); в sim.html не нужны
_SF = os.path.join(HERE, '..', 'data', 'sounds', 'sounds.json')
if os.path.exists(_SF):
    s = s.replace('/*@@SOUNDS@@*/', 'SND_DATA = ' + open(_SF, encoding='utf-8').read() + ';')   # (v306) опубликованная страница начинается с разминки; sim.html — нет (замеры, снимки)
assert '__ev' not in s
open(os.path.join(HERE, '..', MAPNAME + '-radar.html'), 'w', encoding='utf-8').write(s)
print(len(s))
