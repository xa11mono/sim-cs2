# Сборка (v239: игра — v166; v377: исходник — модули src/game/NNN_*.js|html, склейка — src/gamesrc.py; ветка rebuild-v238 — старая модульная версия).
# python3 src/build.py [--map ancient] [куда]  → dist/sim.html (с тестовым входом window.__ev для замеров)
# v255: на место метки @@BUILD@@ вставляется «Отметить момент» (src/marks_build.py)
# v317: на место метки @@MAP@@ — набор выбранной карты из data/maps/<карта>/ (src/mapset.py)
# L1_MULTI_MAP_V1: --map-output MAP HTML (повторяемый)
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

from gamesrc import bundle_modules, game_source
from mapset import inject_map, map_arg
from marks_build import inject
from syntaxcheck import check

HERE = Path(__file__).resolve().parent


def build_page(template, name, out, worker):
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(inject_map(template, name), encoding='utf-8')
    bundle_modules(str(out))
    check(str(out))
    if worker:
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            core = Path(temp) / 'core.js'
            subprocess.run(
                [sys.executable, str(HERE.parent / 'tools/node/core_build.py'), '--map', name, str(core)],
                check=True, capture_output=True,
            )
            text = core.read_text(encoding='utf-8').replace('</script', '<\\/script')
        html = out.read_text(encoding='utf-8')
        start = html.index('<script')
        out.write_text(html[:start] + '<script type="text/plain" id="simCore">' + text + '</script>\n' + html[start:],
                       encoding='utf-8')
        print('режим Worker: ядро %d КБ внутри страницы' % (len(text) // 1024))


def check_ownership(required=False):
    # Проверка анализирует общий исходник и реестры, без чтения HTML и данных карты.
    tools = HERE.parent / 'tools' / 'rebuild'
    env = dict(os.environ)
    env['NODE_PATH'] = os.pathsep.join(filter(None, [
        env.get('NODE_PATH'), str(tools / 'node_modules'), '/opt/node-tools/node_modules', '/opt/npm-tools/node_modules',
    ]))
    if not shutil.which('node'):
        missing = 'нет node'
    elif subprocess.run(['node', '-e', 'require("acorn");require("acorn-walk")'], env=env, capture_output=True).returncode:
        missing = 'нет acorn / acorn-walk (npm i acorn acorn-walk или NODE_PATH)'
    else:
        if subprocess.run(['node', str(tools / 'gen_maps.js'), '--check'], env=env).returncode:
            sys.exit('сборка остановлена: поле перенесённого канала пишут мимо хозяина (rebuild/owners.json)')
        return
    if required:
        sys.exit('проверка владения полей невозможна: ' + missing)
    print('проверка владения полей пропущена: ' + missing)


def main(argv):
    if '--map-output' in argv:
        parser = argparse.ArgumentParser(description='Сборка карт из одной неизменяемой рабочей копии')
        parser.add_argument('--map-output', action='append', nargs=2, metavar=('MAP', 'HTML'), required=True)
        args = parser.parse_args(argv)
        outputs = [Path(out).resolve() for _, out in args.map_output]
        if len(set(outputs)) != len(outputs):
            parser.error('Для каждой карты нужен отдельный путь HTML')
        template = inject(game_source())
        for name, out in args.map_output:
            build_page(template, name, out, worker=False)
        check_ownership(required=True)
        return

    worker = '--worker' in argv
    name, args = map_arg([arg for arg in argv if arg != '--worker'])
    out = args[0] if args else HERE.parent / 'dist' / 'sim.html'
    build_page(inject(game_source()), name, out, worker)
    check_ownership()


if __name__ == '__main__':
    main(sys.argv[1:])
