# Публикуемая версия: python3 mkpub.py  → ../ancient-radar.html
# Собирает игру из game.html, убирает обёртку <head> (её добавляет публикация)
# и тестовый вход window.__ev (нужен только для замеров).
import subprocess, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
tmp = os.path.join(HERE, '..', 'sim.html')
subprocess.run([sys.executable, os.path.join(HERE, 'build.py'), tmp], check=True)
s = open(tmp, encoding='utf-8').read()
i = s.index('<body>\n') + len('<body>\n'); s = s[i:]
s = s.replace('</body></html>', '')
# имя страницы в галерее не меняем (ссылка и название привычны владельцу)
s = s.replace('<title>Ancient Live Radar</title>', '<title>Ancient Live Radar v141</title>', 1)
s = s.replace('window.__ev=function(src){return eval(src);};\n', '')
assert '__ev' not in s
open(os.path.join(HERE, '..', 'ancient-radar.html'), 'w', encoding='utf-8').write('\n' + s)
print(len(s))
