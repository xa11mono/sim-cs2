# Сборка (v239: игра снова — v166, один файл src/game.html; модульная версия v197–v238 — ветка rebuild-v238).
# python3 src/build.py [куда]  → sim.html (с тестовым входом window.__ev для замеров)
import sys, os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'sim.html')
shutil.copyfile(os.path.join(HERE, 'game.html'), out)
