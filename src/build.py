# Сборка (v239: игра снова — v166, один файл src/game.html; модульная версия v197–v238 — ветка rebuild-v238).
# python3 src/build.py [--map ancient] [куда]  → sim.html (с тестовым входом window.__ev для замеров)
# v255: на место метки @@BUILD@@ вставляется «Отметить момент» (src/marks_build.py)
# v317: на место метки @@MAP@@ — набор выбранной карты из data/maps/<карта>/ (src/mapset.py)
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from marks_build import inject
from mapset import map_arg, inject_map
name, args = map_arg(sys.argv[1:])
out = args[0] if args else os.path.join(HERE, '..', 'sim.html')
s = inject_map(inject(open(os.path.join(HERE, 'game.html'), encoding='utf-8').read()), name)
open(out, 'w', encoding='utf-8').write(s)
