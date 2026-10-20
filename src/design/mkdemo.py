# Пример нового оформления (21.10): python3 src/design/mkdemo.py [--map mirage] → <карта>-redesign.html
# Берёт готовую публикуемую сборку (<карта>-radar.html из src/mkpub.py) и кладёт поверх слой src/design/redesign_overlay.html.
# Игру и прежние стили не меняет: на странице кнопка «показать старый» снимает слой (класс html.ds).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
m = sys.argv[sys.argv.index('--map') + 1] if '--map' in sys.argv else 'mirage'
page = open(os.path.join(ROOT, m + '-radar.html'), encoding='utf-8').read()
layer = open(os.path.join(HERE, 'redesign_overlay.html'), encoding='utf-8').read()
out = '<title>%s Radar Redesign</title>\n' % m.capitalize() + layer + page
open(os.path.join(ROOT, m + '-redesign.html'), 'w', encoding='utf-8').write(out)
print(m + '-redesign.html', len(out))
