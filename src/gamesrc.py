"""Исходник игры (v377) — одно место, откуда его читают все: склейка src/game/* в порядке имён (номер впереди).
Порядок важен: это порядок строк одного <script> (и разметки вокруг), склейка == прежний src/game.html байт в байт.

  from gamesrc import game_source;  s = game_source()
  python3 src/gamesrc.py [куда]   — записать склейку в файл (по умолчанию — в stdout), напр. для grep/diff по старому виду
"""
import os, re, sys

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


SRC_EXT = ('.html', '.js', '.ts')

# (Р4.1, 26.11) порядок загрузки — один список rebuild/files.json («files», по порядку склейки), а не сортировка имён: после переименования
# без числовых префиксов (Р4.2) порядок остаётся тем же. Файл на диске не из списка или строка без файла — ошибка (новый файл — только
# с согласием владельца: сначала строка в списке, AGENTS.md §7)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FILES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'rebuild', 'files.json')


def order():
    import json
    L = list(json.load(open(FILES_JSON, encoding='utf-8'))['files'])
    dirs = {g['dir'] for g in json.load(open(FILES_JSON, encoding='utf-8'))['game']}   # (Р4.2а) каталоги файлов игры
    disk = set(f for d in dirs for f in os.listdir(os.path.join(ROOT, d)) if f.endswith(SRC_EXT))
    num = sorted(f for f in disk if re.match(r'\d{3}_', f))   # (Р4.5) файл с числовым префиксом в engine/ / view/ — ошибка
    if num:
        sys.exit('файл игры с числовым префиксом (Р4.5: имя без номера, место — строка в rebuild/files.json): ' + ', '.join(num))
    extra, missing = sorted(disk - set(L)), [f for f in L if f not in disk]
    if extra or missing:
        sys.exit('порядок загрузки (rebuild/files.json): ' + ('нет в списке: ' + ', '.join(extra) + '; ' if extra else '') +
                 ('нет файла: ' + ', '.join(missing) if missing else ''))
    return L


def read_game_file(f):
    """(Р1.1) Текст файла игры, как его видит браузер: .ts — без типов (tools/rebuild/game_src.js: типы заменены пробелами, строки и
    позиции те же); остальное — как есть. Байты — для склейки (game_source), как раньше."""
    p = f if os.path.isabs(f) else game_path(f)
    if not p.endswith('.ts'):
        return open(p, 'rb').read()
    import subprocess
    r = subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools', 'rebuild', 'game_src.js'), 'strip', p],
                       capture_output=True)
    if r.returncode:
        sys.exit('чтение %s без типов не удалось: %s' % (p, r.stderr.decode('utf-8', 'replace')))
    return r.stdout


def game_meta():
    """(Р4.2а) описание файлов игры из rebuild/files.json «game»: имя → {id, part, sys} (как tools/rebuild/game_src.js gameMeta)"""
    import json
    return {g['file']: g for g in json.load(open(FILES_JSON, encoding='utf-8'))['game']}


def game_path(name):
    """(Р4.2а) путь файла игры по имени: каталог — rebuild/files.json dir (имя файла уникально)"""
    b = os.path.basename(name)
    return os.path.join(ROOT, game_meta().get(b, {}).get('dir', 'src/game'), b)


def file_id(name):
    """короткая метка файла (вместо номера в имени)"""
    return game_meta().get(os.path.basename(name), {}).get('id', '?')


def module_source():
    """Текст каналов-модулей (по порядку номеров) — для тех, кто ищет переменные игры по исходнику (снимок отметки)."""
    return ''.join(read_game_file(f).decode('utf-8') for f in (x for x in order() if x in set(module_files())))


def bundle_modules(page, compact=False):
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
    r = subprocess.run(['node', os.path.join(tools, 'mod_build.js'), page, GAME_DIR] + mods + (['--compact'] if compact else []))
    if r.returncode:
        sys.exit('сборка модулей не удалась (tools/rebuild/mod_build.js)')


def game_files():
    skip = set(module_files())
    return [game_path(f) for f in order() if f not in skip]


def _all_files():
    return order()


def game_source():
    # файл-модуль — метка на своём месте склейки: там ядро вызывает «запуск» модуля (то, что он делает при загрузке), порядок — как в склейке
    mods = set(module_files())
    return b''.join(('/*@@MODINIT %s@@*/\n' % f).encode('utf-8') if f in mods else read_game_file(f)
                    for f in _all_files()).decode('utf-8')


if __name__ == '__main__':
    s = game_source()
    if len(sys.argv) > 1: open(sys.argv[1], 'w', encoding='utf-8', newline='').write(s)
    else: sys.stdout.write(s)
