# Сборка (v239: игра — v166; v377: исходник — модули src/game/NNN_*.js|html, склейка — src/gamesrc.py; ветка rebuild-v238 — старая модульная версия).
# python3 src/build.py [--map ancient] [куда]  → dist/sim.html (с тестовым входом window.__ev для замеров)
# python3 src/build.py --map-output mirage A.html --map-output ancient B.html  → несколько карт одной сборкой (28.11, система проверок H-3;
#   прототип Codex e94ce460): склейка и вставка отметок — один раз (не зависят от карты), проверка владения — один раз (не зависит от карты),
#   на карту — только набор карты, модули и проверка синтаксиса; страницы те же байт в байт, что по одной (tools/tests/build_batch_test.py)
# v255: на место метки @@BUILD@@ вставляется «Отметить момент» (src/marks_build.py)
# v317: на место метки @@MAP@@ — набор выбранной карты из data/maps/<карта>/ (src/mapset.py)
# L1_MULTI_MAP_V1 — метка: эта версия сборщика понимает --map-output (tools/rebuild/l1.js смотрит её у старых коммитов)
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from marks_build import inject
from mapset import map_arg, inject_map
from gamesrc import game_source   # v377: исходник игры — склейка src/game/*


def build_page(template, name, out, worker=False, worker_def=False):
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(inject_map(template, name))
    from gamesrc import bundle_modules; bundle_modules(out)   # (17.11, перестройка — модули) каналы-модули — esbuild
    from syntaxcheck import check; check(out)   # (v461) битая страница — сборка падает сразу
    if worker or worker_def:   # (Р5.2) ядро той же карты — текстом в странице; --worker: Worker по ?worker=1; --worker-default: Worker по умолчанию (Р8, 27.11)
        from gamesrc import embed_core
        print('режим Worker%s: ядро %d КБ внутри страницы' % (' по умолчанию' if worker_def else '', embed_core(out, name, worker_def) // 1024))


# (15.11, перестройка, фаза 2) проверка владения полей бота (rebuild/owners.json, tools/rebuild/gen_maps.js --check): страницу не меняет,
# от карты не зависит. До переноса канала — предупреждения; перенесённый канал (enforce) — сборка падает. Нет node или acorn — проверка
# пропущена (с надписью); required (несколько карт — режим проверок L1) — тогда сборка падает: пропустить проверку молча нельзя.
def check_ownership(required=False):
    import subprocess, shutil
    gm = os.path.join(HERE, '..', 'tools', 'rebuild', 'gen_maps.js')
    env = dict(os.environ); env['NODE_PATH'] = os.pathsep.join(filter(None, [env.get('NODE_PATH'), os.path.join(HERE, '..', 'tools', 'rebuild', 'node_modules'), '/opt/node-tools/node_modules', '/opt/npm-tools/node_modules']))   # (17.11) — и пакеты сборки модулей (ставятся сами)
    if not shutil.which('node'): miss = 'нет node'
    elif subprocess.run(['node', '-e', 'require("acorn");require("acorn-walk")'], env=env, capture_output=True).returncode:
        miss = 'нет acorn / acorn-walk (npm i acorn acorn-walk или NODE_PATH)'
    else:
        if subprocess.run(['node', gm, '--check'], env=env).returncode:
            sys.exit('сборка остановлена: поле перенесённого канала пишут мимо хозяина (rebuild/owners.json)')
        return
    if required: sys.exit('проверка владения полей невозможна: ' + miss)
    print('проверка владения полей пропущена: ' + miss)


def main(argv):
    if '--map-output' in argv:
        pairs, rest, i = [], [], 0
        while i < len(argv):
            if argv[i] == '--map-output':
                if i + 2 >= len(argv): sys.exit('--map-output: нужны КАРТА и ФАЙЛ')
                pairs.append((argv[i + 1], argv[i + 2])); i += 3
            else: rest.append(argv[i]); i += 1
        if rest: sys.exit('--map-output не сочетается с другими параметрами: ' + ' '.join(rest))
        outs = [os.path.abspath(o) for _, o in pairs]
        if len(set(outs)) != len(outs): sys.exit('--map-output: у каждой карты — свой файл')
        template = inject(game_source())
        for name, out in pairs:
            build_page(template, name, out)
        check_ownership(required=True)
        return
    worker, worker_def = '--worker' in argv, '--worker-default' in argv
    name, args = map_arg([x for x in argv if x not in ('--worker', '--worker-default')])
    out = args[0] if args else os.path.join(HERE, '..', 'dist', 'sim.html')   # (Р4.3) артефакты сборки — dist/
    build_page(inject(game_source()), name, out, worker, worker_def)
    check_ownership()


if __name__ == '__main__':
    main(sys.argv[1:])
