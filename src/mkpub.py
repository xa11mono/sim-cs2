# Публикуемая версия: python3 src/mkpub.py [--map ancient] → <карта>-radar.html (для Ancient — ancient-radar.html)
# Берёт игру (src/game.html, v239 = v166), убирает обёртку <head>…<body> (её добавляет публикация) и тестовый вход window.__ev.
# v273: вшивает набор выбранной карты (data/maps/<карта>/, src/mapset.py).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from marks_build import inject
from mapset import map_arg, inject_map
MAPNAME, _ = map_arg(sys.argv[1:])
s = inject_map(inject(open(os.path.join(HERE, 'game.html'), encoding='utf-8').read()), MAPNAME)   # v255: «Отметить момент»
# v269: стили игры, которые лежат в <style> внутри <head> (табло, панели игроков, редактор карты, подсказки), раньше
# отрезались вместе с обёрткой — на опубликованной странице их не было. Берём их (без правил самой обёртки) и ставим в начало
head = s[:s.index('<body>')]
hs = head[head.index('<style>') + len('<style>'):head.index('</style>')]
WRAP_END = '[hidden]:not([hidden=until-found i]){display:none!important}'
game_css = hs[hs.index(WRAP_END) + len(WRAP_END):] if WRAP_END in hs else hs
s = s[s.index('<body>') + len('<body>'):]
s = '<style>' + game_css + '</style>' + s
s = s.replace('</body></html>', '')
s = s.replace('window.__ev=function(src){return eval(src);};', '')
assert '__ev' not in s
open(os.path.join(HERE, '..', MAPNAME + '-radar.html'), 'w', encoding='utf-8').write('\n' + s)
print(len(s))
