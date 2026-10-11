# Публикуемая версия: python3 src/mkpub.py → ancient-radar.html
# Берёт игру (src/game.html, v239 = v166), убирает обёртку <head>…<body> (её добавляет публикация) и тестовый вход window.__ev.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from marks_build import inject
s = inject(open(os.path.join(HERE, 'game.html'), encoding='utf-8').read())   # v255: «Отметить момент»
s = s[s.index('<body>') + len('<body>'):]
s = s.replace('</body></html>', '')
s = s.replace('window.__ev=function(src){return eval(src);};', '')
assert '__ev' not in s
open(os.path.join(HERE, '..', 'ancient-radar.html'), 'w', encoding='utf-8').write('\n' + s)
print(len(s))
