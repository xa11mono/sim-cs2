# Сборка (v239: игра снова — v166, один файл src/game.html; модульная версия v197–v238 — ветка rebuild-v238).
# python3 src/build.py [куда]  → sim.html (с тестовым входом window.__ev для замеров)
# v255: на место метки @@BUILD@@ вставляется «Отметить момент» (src/marks_build.py)
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from marks_build import inject
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'sim.html')
open(out, 'w', encoding='utf-8').write(inject(open(os.path.join(HERE, 'game.html'), encoding='utf-8').read()))
