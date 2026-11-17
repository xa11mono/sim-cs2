"""Исходник игры (v377) — одно место, откуда его читают все: склейка src/game/* в порядке имён (номер впереди).
Порядок важен: это порядок строк одного <script> (и разметки вокруг), склейка == прежний src/game.html байт в байт.

  from gamesrc import game_source;  s = game_source()
  python3 src/gamesrc.py [куда]   — записать склейку в файл (по умолчанию — в stdout), напр. для grep/diff по старому виду
"""
import os, sys

GAME_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'game')


# (17.11, перестройка — модули) файлы-модули каналов (rebuild/modules.json) в склейку не входят: их собирает esbuild
# (tools/rebuild/mod_build.js) вместе с остальной игрой («ядро»), build.py — после склейки
MODULES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'rebuild', 'modules.json')


def module_files():
    try:
        import json
        return list(json.load(open(MODULES_JSON, encoding='utf-8')).get('modules', []))
    except (OSError, ValueError):
        return []


def module_source():
    """Текст каналов-модулей (по порядку номеров) — для тех, кто ищет переменные игры по исходнику (снимок отметки)."""
    return ''.join(open(os.path.join(GAME_DIR, f), encoding='utf-8').read() for f in sorted(module_files()))


def bundle_modules(page):
    """Собрать каналы-модули в странице page (на месте главной функции); нет модулей — ничего. Нужны node и npm: зависимости
    (tools/rebuild/package.json) ставятся сами при первой сборке."""
    mods = module_files()
    if not mods:
        return
    import subprocess, shutil
    tools = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools', 'rebuild')
    if not os.path.isdir(os.path.join(tools, 'node_modules', 'esbuild')):
        npm = shutil.which('npm') or shutil.which('npm.cmd')
        if not npm or subprocess.run([npm, 'install', '--no-audit', '--no-fund', '--prefix', tools], capture_output=True).returncode:
            sys.exit('сборка модулей: не поставились зависимости (npm install в tools/rebuild)')
    r = subprocess.run(['node', os.path.join(tools, 'mod_build.js'), page, GAME_DIR] + mods)
    if r.returncode:
        sys.exit('сборка модулей не удалась (tools/rebuild/mod_build.js)')


def game_files():
    skip = set(module_files())
    return [os.path.join(GAME_DIR, f) for f in sorted(os.listdir(GAME_DIR)) if f.endswith(('.html', '.js')) and f not in skip]


def game_source():
    return b''.join(open(p, 'rb').read() for p in game_files()).decode('utf-8')


if __name__ == '__main__':
    s = game_source()
    if len(sys.argv) > 1: open(sys.argv[1], 'w', encoding='utf-8', newline='').write(s)
    else: sys.stdout.write(s)
