# Сборка (v239: игра — v166; v377: исходник — модули src/game/NNN_*.js|html, склейка — src/gamesrc.py; ветка rebuild-v238 — старая модульная версия).
# python3 src/build.py [--map ancient] [куда]  → dist/sim.html (с тестовым входом window.__ev для замеров)
# v255: на место метки @@BUILD@@ вставляется «Отметить момент» (src/marks_build.py)
# v317: на место метки @@MAP@@ — набор выбранной карты из data/maps/<карта>/ (src/mapset.py)
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from marks_build import inject
from mapset import map_arg, inject_map
from gamesrc import game_source   # v377: исходник игры — склейка src/game/*
WORKER = '--worker' in sys.argv; sys.argv = [x for x in sys.argv if x != '--worker']   # (Р5.2) ядро симуляции внутрь страницы — для режима Worker
name, args = map_arg(sys.argv[1:])
out = args[0] if args else os.path.join(HERE, '..', 'dist', 'sim.html')   # (Р4.3) артефакты сборки — dist/
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
s = inject_map(inject(game_source()), name)
open(out, 'w', encoding='utf-8').write(s)
from gamesrc import bundle_modules; bundle_modules(out)   # (17.11, перестройка — модули) каналы-модули — esbuild
from syntaxcheck import check; check(out)   # (v461) битая страница — сборка падает сразу
if WORKER:   # (Р5.2, 26.11) ядро той же карты (tools/node/core_build.py) — текстом в странице; страница с ?worker=1 запускает его в Worker
    import tempfile, subprocess as _sp
    _core = os.path.join(tempfile.mkdtemp(), 'core.js')
    _sp.run([sys.executable, os.path.join(HERE, '..', 'tools', 'node', 'core_build.py'), '--map', name, _core], check=True, capture_output=True)
    _txt = open(_core, encoding='utf-8').read().replace('</script', '<\\/script')
    _s = open(out, encoding='utf-8').read(); _i = _s.index('<script')
    open(out, 'w', encoding='utf-8').write(_s[:_i] + '<script type="text/plain" id="simCore">' + _txt + '</script>\n' + _s[_i:])
    print('режим Worker: ядро %d КБ внутри страницы' % (len(_txt) // 1024))
# (15.11, перестройка, фаза 2) проверка владения полей бота (rebuild/owners.json, tools/rebuild/gen_maps.js --check): страницу не меняет.
# До переноса канала — предупреждения; перенесённый канал (enforce) — сборка падает. Нет node или acorn — проверка пропущена (с надписью).
import subprocess, shutil
_gm = os.path.join(HERE, '..', 'tools', 'rebuild', 'gen_maps.js')
_env = dict(os.environ); _env['NODE_PATH'] = os.pathsep.join(filter(None, [_env.get('NODE_PATH'), os.path.join(HERE, '..', 'tools', 'rebuild', 'node_modules'), '/opt/node-tools/node_modules', '/opt/npm-tools/node_modules']))   # (17.11) — и пакеты сборки модулей (ставятся сами)
if not shutil.which('node'): print('проверка владения полей пропущена: нет node')
else:
    _r = subprocess.run(['node', '-e', 'require("acorn");require("acorn-walk")'], env=_env, capture_output=True)
    if _r.returncode: print('проверка владения полей пропущена: нет acorn / acorn-walk (npm i acorn acorn-walk или NODE_PATH)')
    else:
        _r = subprocess.run(['node', _gm, '--check'], env=_env)
        if _r.returncode: sys.exit('сборка остановлена: поле перенесённого канала пишут мимо хозяина (rebuild/owners.json)')
