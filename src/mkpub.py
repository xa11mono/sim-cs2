# Публикуемая версия: python3 src/mkpub.py → ancient-radar.html
# Берёт игру (src/game.html, v239 = v166), убирает обёртку <head>…<body> (её добавляет публикация) и тестовый вход window.__ev.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from marks_build import inject
s = inject(open(os.path.join(HERE, 'game.html'), encoding='utf-8').read())   # v255: «Отметить момент»
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
s = s.replace('/*@@WARM_AUTO@@*/', 'warmStart(1);')   # (v306) опубликованная страница начинается с разминки; sim.html — нет (замеры, снимки)
assert '__ev' not in s
open(os.path.join(HERE, '..', 'ancient-radar.html'), 'w', encoding='utf-8').write('\n' + s)
print(len(s))
