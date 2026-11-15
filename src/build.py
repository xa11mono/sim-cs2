# Сборка (v239: игра — v166; v377: исходник — модули src/game/NNN_*.js|html, склейка — src/gamesrc.py; ветка rebuild-v238 — старая модульная версия).
# python3 src/build.py [--map ancient] [куда]  → sim.html (с тестовым входом window.__ev для замеров)
# v255: на место метки @@BUILD@@ вставляется «Отметить момент» (src/marks_build.py)
# v317: на место метки @@MAP@@ — набор выбранной карты из data/maps/<карта>/ (src/mapset.py)
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from marks_build import inject
from mapset import map_arg, inject_map
from gamesrc import game_source   # v377: исходник игры — склейка src/game/*
name, args = map_arg(sys.argv[1:])
out = args[0] if args else os.path.join(HERE, '..', 'sim.html')
s = inject_map(inject(game_source()), name)
open(out, 'w', encoding='utf-8').write(s)
from syntaxcheck import check; check(out)   # (v461) битая страница — сборка падает сразу
# (15.11, перестройка, фаза 2) проверка владения полей бота (rebuild/owners.json, tools/rebuild/gen_maps.js --check): страницу не меняет.
# До переноса канала — предупреждения; перенесённый канал (enforce) — сборка падает. Нет node или acorn — проверка пропущена (с надписью).
import subprocess, shutil
_gm = os.path.join(HERE, '..', 'tools', 'rebuild', 'gen_maps.js')
_env = dict(os.environ); _env['NODE_PATH'] = os.pathsep.join(filter(None, [_env.get('NODE_PATH'), '/opt/node-tools/node_modules', '/opt/npm-tools/node_modules']))
if not shutil.which('node'): print('проверка владения полей пропущена: нет node')
else:
    _r = subprocess.run(['node', '-e', 'require("acorn");require("acorn-walk")'], env=_env, capture_output=True)
    if _r.returncode: print('проверка владения полей пропущена: нет acorn / acorn-walk (npm i acorn acorn-walk или NODE_PATH)')
    else:
        _r = subprocess.run(['node', _gm, '--check'], env=_env)
        if _r.returncode: sys.exit('сборка остановлена: поле перенесённого канала пишут мимо хозяина (rebuild/owners.json)')
